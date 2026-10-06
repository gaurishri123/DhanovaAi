"""Authentication and authorization contract tests."""

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.auth import current_user, require_officer


def test_local_development_identity_is_admin():
    with patch("app.auth.settings.AUTH_REQUIRED", False):
        assert current_user(None) == {"sub": "local-development", "role": "admin"}


def test_required_auth_rejects_missing_credentials():
    with patch("app.auth.settings.AUTH_REQUIRED", True):
        with pytest.raises(HTTPException) as error:
            current_user(None)
    assert error.value.status_code == 401


@pytest.mark.parametrize("role,allowed", [
    ("citizen", False),
    ("officer", True),
    ("supervisor", True),
    ("admin", True),
])
def test_officer_role_matrix(role, allowed):
    user = {"sub": "u1", "role": role}
    if allowed:
        assert require_officer(user) == user
    else:
        with pytest.raises(HTTPException) as error:
            require_officer(user)
        assert error.value.status_code == 403
