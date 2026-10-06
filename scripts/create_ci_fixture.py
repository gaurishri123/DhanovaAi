"""Create a tiny deterministic Parquet fixture for CI contract checks.

The fixture validates importer schemas and foreign-key checks without committing
or downloading the full synthetic dataset. It is not training data.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def create_fixture(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    accounts = pd.DataFrame([
        {
            "account_id": "ACC_CI_001",
            "holder_name": "CI Fixture",
            "bank_name": "Dhanova",
            "account_age_days": 100,
            "kyc_level": "full",
            "status": "clear",
        },
        {
            "account_id": "ACC_CI_002",
            "holder_name": "CI Receiver",
            "bank_name": "Dhanova",
            "account_age_days": 90,
            "kyc_level": "full",
            "status": "clear",
        },
    ])
    devices = pd.DataFrame([
        {"device_id": "DEV_CI_001", "device_fingerprint": "fixture-fingerprint"},
    ])
    account_devices = pd.DataFrame([
        {"account_id": "ACC_CI_001", "device_id": "DEV_CI_001"},
    ])
    transactions = pd.DataFrame([
        {
            "txn_id": "00000000-0000-0000-0000-000000000001",
            "sender_account_id": "ACC_CI_001",
            "receiver_account_id": "ACC_CI_002",
            "amount": "10.00",
            "channel": "upi",
            "device_id": "DEV_CI_001",
            "timestamp": "2026-01-01T00:00:00Z",
        },
    ])
    for name, frame in {
        "accounts": accounts,
        "devices": devices,
        "account_devices": account_devices,
        "transactions": transactions,
    }.items():
        frame.to_parquet(output_dir / f"{name}.parquet", index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(".ci-fixture"))
    args = parser.parse_args()
    create_fixture(args.output_dir)


if __name__ == "__main__":
    main()
