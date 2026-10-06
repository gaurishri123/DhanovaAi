"""
Risk scoring model for Dhanova fraud detection.
Trains XGBoost classifier and exposes scoring functions.
"""

import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from typing import Dict, Optional
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import precision_recall_curve, roc_auc_score
import xgboost as xgb


class RiskModel:
    """XGBoost-based risk scoring model."""

    def __init__(self):
        self.model = None
        self.calibrator = None
        self.feature_columns = None
        self.version = "1.0"

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        groups_train: np.ndarray,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        scale_pos_weight: Optional[float] = None,
    ):
        """
        Train XGBoost classifier with early stopping.

        Args:
            X_train: Training features
            y_train: Training labels
            groups_train: Group IDs for ring-aware splitting
            X_val: Validation features
            y_val: Validation labels
            scale_pos_weight: Class weight (neg/pos ratio)
        """
        self.feature_columns = list(X_train.columns)

        if scale_pos_weight is None:
            positive_count = int((y_train == 1).sum())
            negative_count = int((y_train == 0).sum())
            scale_pos_weight = negative_count / positive_count if positive_count else 1.0

        print(f"  Training XGBoost (scale_pos_weight={scale_pos_weight:.2f})...")

        self.model = xgb.XGBClassifier(
            n_estimators=600,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            eval_metric='aucpr',
            early_stopping_rounds=50,
            random_state=42,
            n_jobs=-1,
        )

        self.model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        print(f"    -> Best iteration: {self.model.best_iteration}")
        print(f"    -> Best score: {self.model.best_score:.4f}")

        # Calibrate probabilities using a held-out validation set.
        print("  Calibrating probabilities...")
        self.calibrator = IsotonicRegression(out_of_bounds='clip')
        validation_proba = self.model.predict_proba(X_val)[:, 1]
        self.calibrator.fit(validation_proba, y_val)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Get calibrated probabilities."""
        if self.model is None or self.calibrator is None:
            raise RuntimeError('RiskModel must be trained or loaded before prediction')
        if self.feature_columns is not None:
            expected = list(self.feature_columns)
            actual = list(X.columns)
            missing = [column for column in expected if column not in actual]
            extra = [column for column in actual if column not in expected]
            if missing:
                raise KeyError(f"Missing feature columns: {missing}")
            if extra or actual != expected:
                raise ValueError(
                    "Feature columns must exactly match the trained schema in order: "
                    f"expected {expected}, got {actual}"
                )
        raw_proba = self.model.predict_proba(X)[:, 1]
        return np.asarray(self.calibrator.predict(raw_proba), dtype=float)

    def predict_score(self, X: pd.DataFrame) -> np.ndarray:
        """Get risk scores (0-100)."""
        proba = self.predict_proba(X)
        return np.round(proba * 100).astype(int)

    def save(self, model_dir: str = 'models'):
        """Save model and metadata."""
        model_dir = Path(model_dir)
        model_dir.mkdir(exist_ok=True)

        joblib.dump(self.model, model_dir / 'risk_model.joblib')
        joblib.dump(self.calibrator, model_dir / 'calibrator.joblib')

        with open(model_dir / 'feature_columns.json', 'w') as f:
            json.dump(self.feature_columns, f, indent=2)

        with open(model_dir / 'model_version.txt', 'w') as f:
            f.write(self.version)

        print(f"Model saved to {model_dir}/")

    @classmethod
    def load(cls, model_dir: str = 'models') -> 'RiskModel':
        """Load saved model."""
        model_dir = Path(model_dir)

        instance = cls()
        instance.model = joblib.load(model_dir / 'risk_model.joblib')
        instance.calibrator = joblib.load(model_dir / 'calibrator.joblib')

        with open(model_dir / 'feature_columns.json', 'r') as f:
            instance.feature_columns = json.load(f)

        with open(model_dir / 'model_version.txt', 'r') as f:
            instance.version = f.read().strip()

        return instance


def score_accounts(features_df: pd.DataFrame, model: RiskModel) -> pd.DataFrame:
    """
    Score multiple accounts.

    Args:
        features_df: DataFrame with feature columns (indexed by account_id)
        model: Trained RiskModel

    Returns:
        DataFrame with [account_id, score, band]
    """
    scores = model.predict_score(features_df)

    # Score bands: low [0, 40), medium [40, 70), high [70, 100].
    bands = pd.cut(
        scores,
        bins=[-0.1, 40, 70, 100],
        labels=['low', 'medium', 'high'],
        right=False,
        include_lowest=True,
    )

    result = pd.DataFrame({
        'account_id': features_df.index,
        'score': scores,
        'band': bands,
    })

    return result


def score_account(
    account_id: str,
    as_of: pd.Timestamp,
    transactions: pd.DataFrame,
    accounts: pd.DataFrame,
    account_devices: pd.DataFrame,
    model: RiskModel,
) -> Dict:
    """
    Score a single account (with feature computation).

    Args:
        account_id: Account to score
        as_of: Timestamp cutoff
        transactions: Transaction data
        accounts: Account data
        account_devices: Device mapping
        model: Trained model

    Returns:
        Dict with account_id, score, band
    """
    from .services.feature_pipeline import build_scoring_features

    # Build the same point-in-time graph + behavior frame used by explanations.
    account_features = build_scoring_features(
        accounts=accounts,
        transactions=transactions,
        account_devices=account_devices,
        as_of=as_of,
        target_account_id=account_id,
    )
    result = score_accounts(account_features, model)

    return result.iloc[0].to_dict()


def evaluate_model(
    model: RiskModel,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    name: str = "Model",
) -> Dict:
    """
    Compute evaluation metrics.

    Args:
        model: Trained model
        X_test: Test features
        y_test: Test labels
        name: Model name for reporting

    Returns:
        Dict with PR-AUC, ROC-AUC, precision@50, recall@90%precision
    """
    y_proba = model.predict_proba(X_test)
    y_pred = (y_proba >= 0.5).astype(int)

    # PR-AUC
    from sklearn.metrics import average_precision_score
    pr_auc = average_precision_score(y_test, y_proba)

    # ROC-AUC
    roc_auc = roc_auc_score(y_test, y_proba)

    # Precision@50 (top 50 flagged accounts)
    top_50_idx = np.argsort(y_proba)[-50:]
    if len(top_50_idx) > 0:
        precision_at_50 = y_test.iloc[top_50_idx].mean()
    else:
        precision_at_50 = 0

    # Recall at 90% precision
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_proba)
    recall_at_90p = recalls[precisions >= 0.9].max() if any(precisions >= 0.9) else 0

    # F1 score
    from sklearn.metrics import f1_score
    f1 = f1_score(y_test, y_pred, zero_division=0)

    metrics = {
        'name': name,
        'pr_auc': float(pr_auc),
        'roc_auc': float(roc_auc),
        'precision_at_50': float(precision_at_50),
        'recall_at_90pct_precision': float(recall_at_90p),
        'f1_score': float(f1),
    }

    return metrics


# Public API for backend
def load_model(model_dir: str = 'models') -> RiskModel:
    """Load trained model (called by FastAPI)."""
    return RiskModel.load(model_dir)


if __name__ == '__main__':
    print("Use scripts/train.py to train the model")
