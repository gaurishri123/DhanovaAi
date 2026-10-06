"""
Training script for Dhanova fraud detection model.
Trains XGBoost with group split, evaluates baselines, generates reports.
"""

import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'backend'))

import pandas as pd
import numpy as np
import json
import time
import hashlib
import subprocess
import platform
import sklearn
import xgboost
import networkx
from sklearn.model_selection import GroupShuffleSplit
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import warnings

warnings.filterwarnings('ignore')

from app.features import build_features, FEATURE_COLUMNS
from app.graph_engine import (
    build_graph, detect_communities, graph_features as compute_graph_features,
    ring_candidates, evaluate_rings, find_short_cycles
)
from app.scorer import RiskModel, evaluate_model
from app.explainer import explain, batch_explain

import shap


def load_data():
    """Load generated datasets."""
    print("Loading data...")

    data = {
        'accounts': pd.read_parquet(PROJECT_ROOT / 'data/accounts.parquet'),
        'devices': pd.read_parquet(PROJECT_ROOT / 'data/devices.parquet'),
        'account_devices': pd.read_parquet(PROJECT_ROOT / 'data/account_devices.parquet'),
        'transactions': pd.read_parquet(PROJECT_ROOT / 'data/transactions.parquet'),
        'labels': pd.read_parquet(PROJECT_ROOT / 'data/labels.parquet'),
    }

    print(f"  Loaded {len(data['accounts'])} accounts, {len(data['transactions'])} transactions")
    print(f"  Fraud prevalence: {data['labels']['is_mule'].mean():.2%}")

    return data


def build_snapshot_features(data, as_of):
    """Build behavior and graph features using only data visible at ``as_of``."""
    as_of = pd.Timestamp(as_of)
    if as_of.tzinfo is None:
        as_of = as_of.tz_localize("UTC")
    else:
        as_of = as_of.tz_convert("UTC")
    transactions = data['transactions'].copy()
    transactions['timestamp'] = pd.to_datetime(transactions['timestamp'], utc=True)
    transactions = transactions[transactions['timestamp'] <= as_of].copy()
    behavior_features = build_features(
        transactions,
        data['accounts'],
        data['account_devices'],
        as_of=as_of,
    )
    graph = build_graph(transactions, as_of=as_of)
    communities = detect_communities(graph, seed=42)
    rings = ring_candidates(
        graph,
        communities,
        transactions=transactions,
        account_devices=data['account_devices'],
    )
    suspicious_nodes = set()
    for members in rings.head(50).get('members', []):
        suspicious_nodes.update(members)
    cycles = find_short_cycles(graph, sorted(suspicious_nodes)[:200], max_len=4)
    graph_frame = compute_graph_features(graph, communities, cycles)
    features = build_features(
        transactions,
        data['accounts'],
        data['account_devices'],
        as_of=as_of,
        graph_features=graph_frame,
    )
    return features[FEATURE_COLUMNS]


def evaluate_ring_snapshot(data, as_of, seed=42):
    """Evaluate candidates using only transactions visible at one cutoff."""
    cutoff = pd.Timestamp(as_of)
    cutoff = cutoff.tz_localize("UTC") if cutoff.tzinfo is None else cutoff.tz_convert("UTC")
    transactions = data['transactions'].copy()
    transactions['timestamp'] = pd.to_datetime(transactions['timestamp'], utc=True)
    visible = transactions[transactions['timestamp'] <= cutoff].copy()
    graph = build_graph(visible, as_of=cutoff)
    communities = detect_communities(graph, seed=seed)
    candidates = ring_candidates(
        graph,
        communities,
        transactions=visible,
        account_devices=data['account_devices'],
    )
    metrics = evaluate_rings(candidates, data['labels'])
    metrics['as_of'] = cutoff.isoformat()
    metrics['visible_transaction_count'] = int(len(visible))
    return metrics


def evaluate_ring_snapshots(data, cutoffs):
    """Return cutoff-specific and multi-seed ring metrics."""
    by_cutoff = {
        name: evaluate_ring_snapshot(data, cutoff)
        for name, cutoff in cutoffs.items()
    }
    final_cutoff = cutoffs['test']
    seed_runs = [evaluate_ring_snapshot(data, final_cutoff, seed) for seed in (42, 43, 44)]
    aggregate = {}
    for metric in ('ring_precision', 'ring_recall', 'false_positive_count'):
        values = np.asarray([run.get(metric, 0.0) for run in seed_runs], dtype=float)
        aggregate[metric] = {'mean': float(values.mean()), 'std': float(values.std())}
    return {'by_cutoff': by_cutoff, 'multi_seed': aggregate}


def build_all_features(data):
    """Build behavior + graph features for the complete snapshot."""
    print("\nBuilding features...")

    # Behavior features
    print("  -> Behavior features...")
    behavior_features = build_features(
        data['transactions'],
        data['accounts'],
        data['account_devices'],
    )

    # Graph features
    print("  -> Graph analysis...")
    G = build_graph(data['transactions'])
    print(f"     Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    communities = detect_communities(G, seed=42)
    print(f"     Detected {len(communities)} communities")

    rings = ring_candidates(
        G,
        communities,
        transactions=data['transactions'],
        account_devices=data['account_devices'],
    )
    print(f"     Found {len(rings)} ring candidates")

    # Ring evaluation
    ring_eval = evaluate_rings(rings, data['labels'])
    print(f"     Ring Precision: {ring_eval['ring_precision']:.2%} | Ring Recall: {ring_eval['ring_recall']:.2%}")
    print(f"     Per-archetype recall: {ring_eval.get('per_archetype', {})}")

    # Find cycles in top suspicious communities
    suspicious_nodes = []
    if len(rings) > 0:
        for members in rings.head(50)['members']:
            suspicious_nodes.extend(members)
    suspicious_nodes = list(set(suspicious_nodes))[:200]  # Limit for speed

    cycles = find_short_cycles(G, suspicious_nodes, max_len=4)
    print(f"     Found {len(cycles)} short cycles")

    g_features = compute_graph_features(G, communities, cycles)

    # Merge features
    print("  -> Merging features...")
    features = behavior_features.copy()
    for col in g_features.columns:
        if col in FEATURE_COLUMNS:
            features[col] = g_features[col]

    # Ensure all feature columns exist
    for col in FEATURE_COLUMNS:
        if col not in features.columns:
            features[col] = 0

    features = features[FEATURE_COLUMNS]

    print(f"  Features shape: {features.shape}")

    return features, rings, ring_eval


def split_data(features, labels):
    """Group-aware train/test split."""
    print("\nSplitting data (group-aware by ring_id)...")

    # Merge features with labels
    X = features
    y = labels.set_index('account_id')['is_mule'].astype(int)

    # Align
    common_idx = X.index.intersection(y.index)
    X = X.loc[common_idx]
    y = y.loc[common_idx]

    # Groups: ring_id for fraud accounts, account_id for normal
    groups = []
    for acc_id in X.index:
        label_row = labels[labels['account_id'] == acc_id].iloc[0]
        if label_row['is_mule']:
            groups.append(label_row['ring_id'])
        else:
            groups.append(acc_id)  # Each normal account is its own group

    groups = np.array(groups)

    # Group split
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    groups_train = groups[train_idx]

    # Further split train into train/val
    gss_val = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx2, val_idx = next(gss_val.split(X_train, y_train, groups_train))

    X_val = X_train.iloc[val_idx]
    y_val = y_train.iloc[val_idx]
    X_train = X_train.iloc[train_idx2]
    y_train = y_train.iloc[train_idx2]

    print(f"  Train: {len(X_train)} ({y_train.sum()} fraud)")
    print(f"  Val: {len(X_val)} ({y_val.sum()} fraud)")
    print(f"  Test: {len(X_test)} ({y_test.sum()} fraud)")

    return X_train, X_val, X_test, y_train, y_val, y_test


def train_baselines(X_train, X_test, y_train, y_test, labels):
    """Train baseline models."""
    print("\nTraining baselines...")

    baselines = {}

    # 1. Rule-based
    print("  -> Rule-based...")
    rule_preds = (
        (X_test['pass_through_ratio'] > 0.9) &
        (X_test['fan_in'] > 8) &
        (X_test['median_dwell_minutes'] < 30)
    ).astype(int)

    from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

    baselines['rule_based'] = {
        'name': 'Rule-based',
        'precision': float(precision_score(y_test, rule_preds, zero_division=0)),
        'recall': float(recall_score(y_test, rule_preds, zero_division=0)),
        'f1_score': float(f1_score(y_test, rule_preds, zero_division=0)),
    }

    # 2. Isolation Forest
    print("  -> Isolation Forest...")
    iso_forest = IsolationForest(contamination=0.04, random_state=42, n_jobs=-1)
    iso_forest.fit(X_train)
    iso_scores = iso_forest.decision_function(X_test)
    iso_preds = (iso_scores < np.percentile(iso_scores, 4)).astype(int)

    baselines['isolation_forest'] = {
        'name': 'Isolation Forest',
        'precision': float(precision_score(y_test, iso_preds, zero_division=0)),
        'recall': float(recall_score(y_test, iso_preds, zero_division=0)),
        'f1_score': float(f1_score(y_test, iso_preds, zero_division=0)),
    }

    # 3. XGBoost without graph features (ablation)
    print("  -> XGBoost (no graph features)...")
    behavior_cols = [c for c in FEATURE_COLUMNS if c not in [
        'in_degree', 'out_degree', 'pagerank', 'clustering_coef',
        'community_size', 'community_internal_flow_ratio', 'community_density', 'in_short_cycle'
    ]]

    X_train_no_graph = X_train[behavior_cols]
    X_test_no_graph = X_test[behavior_cols]

    model_no_graph = RiskModel()

    # Use the same group-aware split policy as the full model. Fraud-ring
    # members must never appear in both ablation train and validation sets.
    label_groups = labels.set_index('account_id')
    groups = np.array([
        str(label_groups.loc[index, 'ring_id'])
        if bool(label_groups.loc[index, 'is_mule'])
        else str(index)
        for index in X_train_no_graph.index
    ])
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_indices, val_indices = next(
        gss.split(X_train_no_graph, y_train, groups)
    )
    X_tr = X_train_no_graph.iloc[train_indices]
    X_vl = X_train_no_graph.iloc[val_indices]
    y_tr = y_train.iloc[train_indices]
    y_vl = y_train.iloc[val_indices]

    model_no_graph.train(X_tr, y_tr, groups[train_indices], X_vl, y_vl)

    baselines['xgboost_no_graph'] = evaluate_model(model_no_graph, X_test_no_graph, y_test, name="XGBoost (no graph)")

    print("  Baselines trained")

    return baselines


def train_final_model(X_train, X_val, X_test, y_train, y_val, y_test):
    """Train final XGBoost model with all features."""
    print("\nTraining final model (XGBoost + graph features)...")

    model = RiskModel()
    groups_train = np.arange(len(X_train))  # Dummy groups for this phase

    model.train(X_train, y_train, groups_train, X_val, y_val)

    # Evaluate
    metrics = evaluate_model(model, X_test, y_test, name="XGBoost (final)")

    print(f"\n  Final Model Metrics:")
    print(f"    PR-AUC: {metrics['pr_auc']:.4f}")
    print(f"    ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"    Precision@50: {metrics['precision_at_50']:.2%}")
    print(f"    Recall@90% Precision: {metrics['recall_at_90pct_precision']:.2%}")
    print(f"    F1 Score: {metrics['f1_score']:.4f}")

    # Save model
    model.save(str(PROJECT_ROOT / 'models'))

    return model, metrics


def generate_reports(
    model,
    X_test,
    y_test,
    baselines,
    final_metrics,
    ring_eval,
    temporal_cutoffs=None,
    latency_metrics=None,
):
    """Generate evaluation reports and plots."""
    print("\nGenerating reports...")

    reports_dir = PROJECT_ROOT / 'reports'
    reports_dir.mkdir(exist_ok=True)

    # Metrics JSON
    start = time.perf_counter()
    for _ in range(3):
        model.predict_proba(X_test.iloc[:1])
    scoring_latency_ms = (time.perf_counter() - start) * 1000 / 3
    y_proba = model.predict_proba(X_test)
    threshold = 0.5
    cm = confusion_matrix(y_test, (y_proba >= threshold).astype(int)).tolist()
    try:
        git_commit = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=PROJECT_ROOT, text=True
        ).strip()
    except Exception:
        git_commit = None
    feature_schema_hash = hashlib.sha256(
        json.dumps(list(X_test.columns), separators=(",", ":")).encode()
    ).hexdigest()
    metrics_report = {
        'final_model': final_metrics,
        'baselines': baselines,
        'ring_detection': ring_eval,
        'ring_candidate_sources': ring_eval.get('candidate_sources', {}),
        'synthetic_data_disclaimer': 'Metrics are based on generated data and are not real-world accuracy estimates.',
        'test_set_size': int(len(X_test)),
        'test_fraud_count': int(y_test.sum()),
        'training_seed': 42,
        'model_version': model.version,
        'feature_columns': list(X_test.columns),
        'feature_schema_hash': feature_schema_hash,
        'split_strategy': 'temporal snapshots at 70/85/100 percent plus group-aware ring split',
        'temporal_cutoffs': temporal_cutoffs or {},
        'temporal_leakage_status': (
            'feature and ring snapshots use as_of cutoffs; eventual labels are used '
            'only for retrospective evaluation and may include future-known membership'
        ),
        'ring_snapshot_evaluation': ring_eval.get('snapshot_evaluation', {}),
        'git_commit': git_commit,
        'library_versions': {
            'python': platform.python_version(),
            'pandas': pd.__version__,
            'scikit_learn': sklearn.__version__,
            'xgboost': xgboost.__version__,
            'networkx': networkx.__version__,
        },
        'single_account_scoring_latency_ms': float(scoring_latency_ms),
        'latency_metrics_ms': latency_metrics or {
            'model_inference': {'p50': float(scoring_latency_ms), 'p95': float(scoring_latency_ms), 'p99': float(scoring_latency_ms)},
            'total': {'p50': float(scoring_latency_ms), 'p95': float(scoring_latency_ms), 'p99': float(scoring_latency_ms)},
        },
        'decision_threshold': threshold,
        'confusion_matrix_labels': ['clear', 'mule'],
        'confusion_matrix': cm,
    }

    with open(reports_dir / 'metrics.json', 'w') as f:
        json.dump(metrics_report, f, indent=2)

    print("  Saved reports/metrics.json")

    # Plots
    print("  -> Generating plots...")

    # 1. PR curve
    from sklearn.metrics import precision_recall_curve

    y_proba = model.predict_proba(X_test)
    precisions, recalls, _ = precision_recall_curve(y_test, y_proba)

    plt.figure(figsize=(8, 6))
    plt.plot(recalls, precisions, linewidth=2, label=f"Final Model (AUC={final_metrics['pr_auc']:.3f})")
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Precision-Recall Curve')
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(reports_dir / 'pr_curve.png', dpi=150)
    plt.close()

    print("  Saved reports/pr_curve.png")

    # 2. SHAP summary plot
    print("  -> Computing SHAP values (this may take a minute)...")

    # Sample for SHAP (use smaller subset for speed)
    sample_size = min(500, len(X_test))
    X_sample = X_test.sample(n=sample_size, random_state=42)

    explainer = shap.TreeExplainer(model.model)
    shap_values = explainer.shap_values(X_sample)

    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values, X_sample, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(reports_dir / 'shap_summary.png', dpi=150, bbox_inches='tight')
    plt.close()

    print("  Saved reports/shap_summary.png")

    # 3. Feature importance
    import xgboost as xgb

    plt.figure(figsize=(10, 8))
    xgb.plot_importance(model.model, max_num_features=15, importance_type='gain')
    plt.title('Feature Importance (Gain)')
    plt.tight_layout()
    plt.savefig(reports_dir / 'feature_importance.png', dpi=150)
    plt.close()

    print("  Saved reports/feature_importance.png")

    print("\nAll reports generated in reports/")


def main():
    """Main training pipeline."""
    print("=" * 60)
    print("Dhanova Fraud Detection Model Training")
    print("=" * 60)

    # Load data
    data = load_data()

    # Build features
    features, rings, ring_eval = build_all_features(data)

    # Split account groups, then rebuild every split's features from a
    # point-in-time snapshot to prevent future graph/behavior leakage.
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(features, data['labels'])
    timestamps = pd.to_datetime(data['transactions']['timestamp'], utc=True)
    start = timestamps.min()
    end = timestamps.max()
    train_cutoff = start + (end - start) * 0.70
    val_cutoff = start + (end - start) * 0.85
    print(f"\nTemporal cutoffs: train={train_cutoff}, val={val_cutoff}, test={end}")
    train_snapshot = build_snapshot_features(data, train_cutoff)
    val_snapshot = build_snapshot_features(data, val_cutoff)
    test_snapshot = build_snapshot_features(data, end)
    X_train = train_snapshot.reindex(X_train.index).fillna(0)
    X_val = val_snapshot.reindex(X_val.index).fillna(0)
    X_test = test_snapshot.reindex(X_test.index).fillna(0)

    # Train baselines
    baselines = train_baselines(X_train, X_test, y_train, y_test, data['labels'])

    # Train final model
    model, final_metrics = train_final_model(X_train, X_val, X_test, y_train, y_val, y_test)

    cutoff_map = {
        'train': train_cutoff,
        'validation': val_cutoff,
        'test': end,
    }
    snapshot_evaluation = evaluate_ring_snapshots(data, cutoff_map)
    ring_eval['snapshot_evaluation'] = snapshot_evaluation

    # Benchmark the model-only path with percentile reporting. End-to-end
    # feature assembly is reported separately when a scoring frame is built.
    timings = []
    for _ in range(20):
        started = time.perf_counter()
        model.predict_proba(X_test.iloc[:1])
        timings.append((time.perf_counter() - started) * 1000)
    latency_metrics = {
        'model_inference': {
            key: float(np.percentile(timings, percentile))
            for key, percentile in [('p50', 50), ('p95', 95), ('p99', 99)]
        },
        'total': {
            key: float(np.percentile(timings, percentile))
            for key, percentile in [('p50', 50), ('p95', 95), ('p99', 99)]
        },
        'scope': 'model inference over precomputed one-row features; feature assembly benchmark is not included',
    }

    # Generate reports
    generate_reports(
        model,
        X_test,
        y_test,
        baselines,
        final_metrics,
        ring_eval,
        temporal_cutoffs={name: cutoff.isoformat() for name, cutoff in cutoff_map.items()},
        latency_metrics=latency_metrics,
    )

    # Test explanations
    print("\nGenerating sample explanations...")
    fraud_accounts = data['labels'][data['labels']['is_mule'] == True]['account_id'].head(3).values

    for acc_id in fraud_accounts:
        if acc_id in features.index:
            expl = explain(acc_id, features, model.model, top_k=5)
            print(f"\n{acc_id} (Score: {expl['score']}):")
            print(f"  {expl['explanation']}")

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Review metrics in reports/metrics.json")
    print("  2. Check plots in reports/")
    print("  3. Share reports/ with the pitch person for deck slides")
    print("  4. Hand off backend/app/*.py to backend engineer for API integration")


if __name__ == '__main__':
    main()
