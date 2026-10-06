"""Contract tests for score bands and model input validation."""

import numpy as np
import pandas as pd
import pytest

from backend.app.scorer import RiskModel, score_accounts


def test_score_bands_are_stable():
    model = RiskModel()
    model.feature_columns = ['f1']
    model.model = type('StubModel', (), {
        'predict_proba': lambda self, X: np.column_stack([1 - X['f1'], X['f1']])
    })()
    model.calibrator = type('StubCalibrator', (), {
        'predict': lambda self, values: values
    })()
    features = pd.DataFrame({'f1': [0.1, 0.5, 0.9]}, index=['A', 'B', 'C'])
    result = score_accounts(features, model)
    assert list(result['band'].astype(str)) == ['low', 'medium', 'high']
    assert list(result['score']) == [10, 50, 90]


def test_missing_feature_column_fails_cleanly():
    model = RiskModel()
    model.feature_columns = ['required']
    model.model = object()
    model.calibrator = object()
    with pytest.raises(KeyError):
        model.predict_proba(pd.DataFrame({'other': [1.0]}))
