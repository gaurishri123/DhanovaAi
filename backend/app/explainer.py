"""
Explainability module for Dhanova fraud detection.
SHAP-based feature attribution + plain-language explanations.
"""

import pandas as pd
import numpy as np
import shap
from typing import Dict, List, Optional
import warnings

warnings.filterwarnings('ignore')

# Feature name to human-readable description
FEATURE_DESCRIPTIONS = {
    'in_count': 'received {value} transactions',
    'out_count': 'sent {value} transactions',
    'fan_in': 'received money from {value} unique senders',
    'fan_out': 'sent money to {value} unique receivers',
    'pass_through_ratio': 'forwards {pct}% of received money',
    'median_dwell_minutes': 'holds money for {value} minutes on average',
    'max_txn_10min': 'peak activity of {value} transactions in 10 minutes',
    'amount_cv': 'transaction amounts vary significantly (CV={value:.2f})',
    'new_counterparty_ratio': '{pct}% of transactions are with new counterparties',
    'night_txn_ratio': '{pct}% of transactions happen at night (12am-5am)',
    'near_threshold_ratio': '{pct}% of amounts are ₹9,000-₹9,999 (structuring pattern)',
    'account_age_days': 'account is {value} days old',
    'device_count': 'uses {value} different devices',
    'max_accounts_per_device': 'device is shared with {value} accounts',
    'in_degree': 'has {value} incoming transaction partners',
    'out_degree': 'has {value} outgoing transaction partners',
    'pagerank': 'central in the network (PageRank={value:.4f})',
    'clustering_coef': 'forms tight clusters with counterparties (coef={value:.3f})',
    'community_size': 'belongs to a network community of {value} accounts',
    'community_internal_flow_ratio': '{pct}% of community\'s money stays internal',
    'community_density': 'community has dense connections (density={value:.3f})',
    'in_short_cycle': 'participates in circular money flow (A->B->C->A pattern)',
}


def explain(
    account_id: str,
    features: pd.DataFrame,
    model,
    top_k: int = 5,
    scored_score: int | None = None,
) -> Dict:
    """
    Generate SHAP-based explanation for an account's risk score.

    Args:
        account_id: Account to explain
        features: Feature DataFrame (must include account_id)
        model: Trained XGBoost model (base model, not calibrator)
        top_k: Number of top features to include

    Returns:
        Dict with account_id, score, top_reasons, and template explanation
    """
    # Get account features
    if account_id not in features.index:
        return {
            'account_id': account_id,
            'score': 0,
            'top_reasons': [],
            'explanation': 'Account not found in feature set',
        }

    account_features = features.loc[[account_id]]

    # Get prediction
    raw_prediction = model.predict_proba(account_features)
    if raw_prediction.ndim == 2:
        raw_prediction = raw_prediction[:, 1]
    score = scored_score if scored_score is not None else int(float(raw_prediction[0]) * 100)

    # SHAP explanation
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(account_features)

    # Get base value (average prediction)
    base_value = explainer.expected_value
    if isinstance(base_value, np.ndarray):
        base_value = base_value[-1] if base_value.ndim else base_value.item()

    if isinstance(shap_values, list):
        shap_values = shap_values[1]  # For binary classification, take positive class

    # Top contributing features
    shap_row = shap_values[0]
    feature_names = list(account_features.columns)
    feature_values = account_features.iloc[0].values

    # Sort by absolute SHAP value
    feature_importance = [
        {
            'feature': feature_names[i],
            'value': feature_values[i],
            'shap_contribution': float(shap_row[i]),
            'abs_contribution': abs(shap_row[i]),
        }
        for i in range(len(feature_names))
    ]

    feature_importance.sort(key=lambda x: x['abs_contribution'], reverse=True)

    # Top K features
    top_reasons = []
    for feat in feature_importance[:top_k]:
        direction = 'increases_risk' if feat['shap_contribution'] > 0 else 'decreases_risk'

        top_reasons.append({
            'feature': feat['feature'],
            'value': feat['value'],
            'direction': direction,
            'contribution': feat['shap_contribution'],
        })

    # Template explanation (fallback if Gemini fails)
    template_text = template_explanation(account_id, score, top_reasons)

    return {
        'account_id': account_id,
        'score': score,
        'top_reasons': top_reasons,
        'explanation': template_text,
        'base_value': float(base_value),
    }


def template_explanation(
    account_id: str,
    score: int,
    top_reasons: List[Dict],
) -> str:
    """
    Generate template-based explanation from SHAP features.
    This is the fallback when Gemini API is unavailable.

    Args:
        account_id: Account ID
        score: Risk score (0-100)
        top_reasons: List of top contributing features

    Returns:
        Plain-language explanation
    """
    risk_band = 'high' if score >= 70 else ('medium' if score >= 40 else 'low')

    explanation_parts = [
        f"Account {account_id} has a {risk_band} risk score of {score}/100."
    ]

    # Top risk-increasing features
    risk_factors = [r for r in top_reasons if r['direction'] == 'increases_risk']

    if risk_factors:
        explanation_parts.append("\nKey risk factors:")
        for feat in risk_factors[:3]:
            feature_name = feat['feature']
            value = feat['value']

            if feature_name in FEATURE_DESCRIPTIONS:
                desc_template = FEATURE_DESCRIPTIONS[feature_name]

                # Format the description
                if '{pct}' in desc_template:
                    pct = int(value * 100)
                    desc = desc_template.format(pct=pct, value=value)
                elif '{value}' in desc_template:
                    if isinstance(value, float) and value < 1:
                        desc = desc_template.format(value=f"{value:.3f}")
                    elif isinstance(value, float):
                        desc = desc_template.format(value=f"{value:.1f}")
                    else:
                        desc = desc_template.format(value=int(value))
                else:
                    desc = desc_template.format(value=value)

                explanation_parts.append(f"• {desc}")
            else:
                explanation_parts.append(f"• {feature_name}: {value:.2f}")

    # Suggested action
    if score >= 70:
        explanation_parts.append("\nRecommended action: Place account on hold for manual review (max 60 days per RBI guidelines).")
    elif score >= 40:
        explanation_parts.append("\nRecommended action: Monitor account closely for 7 days before escalating.")
    else:
        explanation_parts.append("\nRecommended action: No immediate action required. Continue routine monitoring.")

    return ' '.join(explanation_parts)


def gemini_explanation_prompt(payload: Dict) -> str:
    """
    Generate the prompt for Gemini to create a plain-language explanation.

    Args:
        payload: Dict with account_id, score, top_reasons

    Returns:
        Formatted prompt for Gemini
    """
    import json

    prompt = f"""You are a fraud analyst assistant. Using ONLY the JSON below, write 2-3 sentences explaining why this account was flagged as suspicious.

Rules:
- Do not invent facts, names or numbers not in the JSON
- Use plain English suitable for a bank compliance officer
- Focus on the top risk-increasing features
- End with one suggested next step (review / hold / monitor)

JSON:
{json.dumps(payload, indent=2)}

Write the explanation:"""

    return prompt


def batch_explain(
    accounts: List[str],
    features: pd.DataFrame,
    model,
    top_k: int = 5,
) -> pd.DataFrame:
    """
    Generate explanations for multiple accounts.

    Args:
        accounts: List of account IDs
        features: Feature DataFrame
        model: Trained model
        top_k: Number of top features per account

    Returns:
        DataFrame with explanations
    """
    explanations = []

    for account_id in accounts:
        expl = explain(account_id, features, model, top_k=top_k)
        explanations.append(expl)

    return pd.DataFrame(explanations)


if __name__ == '__main__':
    print("Use scripts/train.py to generate explanations after training")
