"""Import generated Parquet tables into Supabase in FK-safe batches.

Usage:
    python scripts/import_parquet_to_supabase.py --dry-run
    python scripts/import_parquet_to_supabase.py --data-dir data --batch-size 500

The labels table is intentionally not imported into production feature tables.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd

REQUIRED_COLUMNS = {
    "accounts": {"account_id", "holder_name", "bank_name", "account_age_days", "kyc_level", "status"},
    "devices": {"device_id", "device_fingerprint"},
    "account_devices": {"account_id", "device_id"},
    "transactions": {"txn_id", "sender_account_id", "receiver_account_id", "amount", "channel", "timestamp"},
}
TABLE_ORDER = ["accounts", "devices", "account_devices", "transactions"]


def _load_table(data_dir: Path, table: str) -> pd.DataFrame:
    path = data_dir / f"{table}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing required data file: {path}")
    frame = pd.read_parquet(path)
    missing = REQUIRED_COLUMNS[table] - set(frame.columns)
    if missing:
        raise ValueError(f"{table}: missing columns {sorted(missing)}")
    return frame


def _records(table: str, frame: pd.DataFrame) -> list[dict[str, Any]]:
    result = frame.copy()
    if table == "transactions":
        result["timestamp"] = pd.to_datetime(result["timestamp"], utc=True)
        result["amount"] = result["amount"].map(lambda value: str(Decimal(str(value))))
    records = result.where(pd.notna(result), None).to_dict(orient="records")
    for record in records:
        for key, value in list(record.items()):
            if isinstance(value, pd.Timestamp):
                record[key] = value.isoformat()
    return records


def _client():
    from app.db.supabase import get_db
    return get_db()


def _validate_batch_size(batch_size: int) -> None:
    if batch_size < 1:
        raise ValueError("batch_size must be positive")


def import_tables(data_dir: Path, batch_size: int, dry_run: bool) -> dict[str, int]:
    _validate_batch_size(batch_size)
    frames = {table: _load_table(data_dir, table) for table in TABLE_ORDER}
    counts = {table: len(frame) for table, frame in frames.items()}

    # Validate references before any writes.
    account_ids = set(frames["accounts"]["account_id"])
    device_ids = set(frames["devices"]["device_id"])
    mappings = frames["account_devices"]
    if not set(mappings["account_id"]).issubset(account_ids):
        raise ValueError("account_devices contains unknown account references")
    if not set(mappings["device_id"]).issubset(device_ids):
        raise ValueError("account_devices contains unknown device references")
    tx = frames["transactions"]
    if not set(tx["sender_account_id"]).issubset(account_ids) or not set(tx["receiver_account_id"]).issubset(account_ids):
        raise ValueError("transactions contains unknown account references")
    if tx["sender_account_id"].eq(tx["receiver_account_id"]).any():
        raise ValueError("transactions contains self-transfers")

    if dry_run:
        print("Dry run: validated tables and references")
        for table, count in counts.items():
            print(f"  {table}: {count} rows")
        return counts

    db = _client()
    for table in TABLE_ORDER:
        records = _records(table, frames[table])
        for offset in range(0, len(records), batch_size):
            db.table(table).upsert(records[offset : offset + batch_size]).execute()
        print(f"Imported {len(records)} rows into {table}")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size must be positive")
    import_tables(args.data_dir, args.batch_size, args.dry_run)


if __name__ == "__main__":
    main()
