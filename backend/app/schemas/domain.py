from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import Field, field_validator

# =======================
# Account Schemas
# =======================
class AccountBase(BaseModel):
    account_id: str
    holder_name: str
    bank_name: str
    account_age_days: int
    kyc_level: str
    status: str = "clear"  # clear | flagged | on_hold

class AccountDetail(AccountBase):
    model_config = ConfigDict(from_attributes=True)

# =======================
# Device Schemas
# =======================
class AccountDeviceMap(BaseModel):
    account_id: str
    device_id: str

# =======================
# Transaction Schemas
# =======================
class TransactionCreate(BaseModel):
    sender_account_id: str = Field(min_length=1, max_length=128)
    receiver_account_id: str = Field(min_length=1, max_length=128)
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    channel: str = Field(min_length=1, max_length=32)
    device_id: Optional[str] = Field(default=None, max_length=128)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    idempotency_key: Optional[str] = Field(default=None, min_length=1, max_length=128)

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @field_validator("receiver_account_id")
    @classmethod
    def reject_self_transfer(cls, value: str, info):
        sender = info.data.get("sender_account_id")
        if sender and value == sender:
            raise ValueError("sender and receiver must be different")
        return value

class TransactionResponse(TransactionCreate):
    txn_id: str
    model_config = ConfigDict(from_attributes=True)

# =======================
# Risk & ML Schemas
# =======================
class RiskScoreResponse(BaseModel):
    account_id: str
    score: int
    top_features: Dict[str, Any]
    explanation_text: Optional[str] = None
    ring_id: Optional[str] = None
    computed_at: datetime
    as_of: Optional[datetime] = None
    model_version: Optional[str] = None
    feature_schema_hash: Optional[str] = None

# =======================
# Officer Action Schemas
# =======================
class HoldActionRequest(BaseModel):
    account_id: str = Field(min_length=1, max_length=128)
    reason: str = Field(min_length=3, max_length=2000)
    officer_id: str = Field(min_length=1, max_length=128)
    idempotency_key: Optional[str] = Field(default=None, min_length=1, max_length=128)

class HoldActionResponse(BaseModel):
    action_id: str
    account_id: str
    officer_id: str
    reason: str
    hold_start: datetime
    hold_expiry: datetime
    status: str  # active | released | expired

# =======================
# Chat Schemas
# =======================
class ChatRequest(BaseModel):
    account_id: str = Field(min_length=1, max_length=128)
    question: str = Field(min_length=1, max_length=2000)

class ChatResponse(BaseModel):
    answer: str
