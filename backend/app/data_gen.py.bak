"""
Synthetic transaction dataset generator for Dhanova fraud detection system.
Generates accounts, devices, transactions with injected fraud rings per SIM_SPEC.md.
"""

import numpy as np
import pandas as pd
from faker import Faker
from datetime import datetime, timedelta
from typing import Dict
import warnings

warnings.filterwarnings('ignore')

# Constants from SIM_SPEC
TOTAL_ACCOUNTS = 6000
TOTAL_TRANSACTIONS = 150000
SIMULATION_DAYS = 30
FRAUD_PREVALENCE = 0.035  # 3.5%

# Account persona distribution
PERSONA_COUNTS = {
    'salaried': 2500,
    'merchant': 800,
    'student': 1200,
    'dormant': 600,
    'family': 400,  # Will be in ~80 family groups
}

# Fraud ring archetypes
FRAUD_ARCHETYPES = {
    'fan_out_dispersal': {'count': 6, 'size_range': (10, 25)},
    'fan_in_collector': {'count': 5, 'size_range': (8, 15)},
    'circular_layering': {'count': 5, 'size_range': (5, 10)},
    'burst_mule': {'count': 5, 'size_range': (5, 8)},
    'device_farm': {'count': 4, 'size_range': (8, 12)},
}


def generate(seed: int = 42) -> Dict[str, pd.DataFrame]:
    """
    Generate synthetic dataset with fraud rings and hard negatives.

    Args:
        seed: Random seed for reproducibility

    Returns:
        Dictionary of DataFrames: accounts, devices, account_devices, transactions, labels
    """
    rng = np.random.default_rng(seed)
    fake = Faker('en_IN')
    Faker.seed(seed)

    print(f"Generating synthetic dataset with seed={seed}...")

    # Step 1: Generate accounts
    print("  -> Generating accounts...")
    accounts_list = []
    account_id = 1

    # Normal accounts
    for persona, count in PERSONA_COUNTS.items():
        for _ in range(count):
            age_days = rng.integers(30, 1825) if persona != 'burst_mule' else rng.integers(1, 365)
            accounts_list.append({
                'account_id': f'ACC_{account_id:05d}',
                'holder_name': fake.name(),
                'bank_name': rng.choice(['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'Kotak']),
                'account_age_days': int(age_days),
                'kyc_level': rng.choice(['basic', 'full'], p=[0.3, 0.7]),
                'persona': persona,
                'status': 'clear',
                'created_at': datetime.now() - timedelta(days=int(age_days)),
            })
            account_id += 1

    # Fraud ring members
    fraud_accounts = []
    ring_id = 1

    for archetype, config in FRAUD_ARCHETYPES.items():
        for _ in range(config['count']):
            size = rng.integers(*config['size_range'])
            for _ in range(size):
                age_days = rng.integers(1, 15) if archetype == 'burst_mule' else rng.integers(5, 180)
                fraud_accounts.append({
                    'account_id': f'ACC_{account_id:05d}',
                    'holder_name': fake.name(),
                    'bank_name': rng.choice(['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB']),
                    'account_age_days': int(age_days),
                    'kyc_level': rng.choice(['basic', 'full'], p=[0.6, 0.4]),
                    'persona': 'fraud',
                    'ring_id': f'R_{ring_id:03d}',
                    'archetype': archetype,
                    'status': 'clear',
                    'created_at': datetime.now() - timedelta(days=int(age_days)),
                })
                account_id += 1
            ring_id += 1

    accounts_list.extend(fraud_accounts)
    accounts_df = pd.DataFrame(accounts_list)

    print(f"     Generated {len(accounts_df)} accounts ({len(fraud_accounts)} fraud)")

    # Step 2: Generate devices
    print("  -> Generating devices...")
    devices_list = []
    account_devices_list = []
    device_id = 1

    # Normal accounts - mostly 1 device per account
    for idx, row in accounts_df[accounts_df['persona'] != 'fraud'].iterrows():
        # 10% share device with 1 other (couples/family)
        if rng.random() < 0.1 and device_id > 1:
            # Reuse recent device
            reuse_device = f'DEV_{rng.integers(max(1, device_id-50), device_id):05d}'
            account_devices_list.append({
                'account_id': row['account_id'],
                'device_id': reuse_device,
            })
        else:
            device_fingerprint = fake.sha256()[:16]
            devices_list.append({
                'device_id': f'DEV_{device_id:05d}',
                'device_fingerprint': device_fingerprint,
            })
            account_devices_list.append({
                'account_id': row['account_id'],
                'device_id': f'DEV_{device_id:05d}',
            })
            device_id += 1

    # Family groups - shared device
    family_accounts = accounts_df[accounts_df['persona'] == 'family']['account_id'].values
    family_groups = np.array_split(family_accounts, 80)
    for group in family_groups:
        device_fingerprint = fake.sha256()[:16]
        devices_list.append({
            'device_id': f'DEV_{device_id:05d}',
            'device_fingerprint': device_fingerprint,
        })
        for acc_id in group:
            account_devices_list.append({
                'account_id': acc_id,
                'device_id': f'DEV_{device_id:05d}',
            })
        device_id += 1

    # Fraud accounts - device farms
    fraud_by_archetype = accounts_df[accounts_df['persona'] == 'fraud'].groupby('ring_id')
    for ring, group in fraud_by_archetype:
        archetype = group.iloc[0]['archetype']
        if archetype == 'device_farm':
            # 1-2 devices for the whole ring
            num_devices = rng.integers(1, 3)
            for _ in range(num_devices):
                device_fingerprint = fake.sha256()[:16]
                devices_list.append({
                    'device_id': f'DEV_{device_id:05d}',
                    'device_fingerprint': device_fingerprint,
                })
                ring_device = f'DEV_{device_id:05d}'
                device_id += 1
                # Assign all ring members to this device
                for acc_id in group['account_id']:
                    account_devices_list.append({
                        'account_id': acc_id,
                        'device_id': ring_device,
                    })
        else:
            # Normal device distribution for other fraud types
            for acc_id in group['account_id']:
                device_fingerprint = fake.sha256()[:16]
                devices_list.append({
                    'device_id': f'DEV_{device_id:05d}',
                    'device_fingerprint': device_fingerprint,
                })
                account_devices_list.append({
                    'account_id': acc_id,
                    'device_id': f'DEV_{device_id:05d}',
                })
                device_id += 1

    devices_df = pd.DataFrame(devices_list).drop_duplicates(subset=['device_id'])
    account_devices_df = pd.DataFrame(account_devices_list)

    print(f"     Generated {len(devices_df)} devices")

    # Step 3: Generate transactions
    print("  -> Generating transactions...")
    transactions_list = []
    txn_id = 1

    start_time = datetime.now() - timedelta(days=SIMULATION_DAYS)

    # Normal transactions
    for idx, row in accounts_df[accounts_df['persona'] != 'fraud'].iterrows():
        persona = row['persona']
        acc_id = row['account_id']

        if persona == 'salaried':
            num_txns = rng.integers(15, 40)
            # Salary credit
            salary_day = int(rng.choice([1, 28]))
            salary_date = start_time + timedelta(days=salary_day)
            device = account_devices_df[account_devices_df['account_id'] == acc_id]['device_id'].values[0]

            transactions_list.append({
                'txn_id': f'TXN_{txn_id:08d}',
                'sender_account_id': f'ACC_{rng.integers(1, 100):05d}',  # Company account
                'receiver_account_id': acc_id,
                'amount': round(rng.lognormal(10.5, 0.4)),
                'channel': 'NEFT',
                'device_id': device,
                'timestamp': salary_date,
            })
            txn_id += 1

            # Regular spends
            for _ in range(num_txns - 1):
                hour = int(rng.normal(14, 4) % 24)
                if hour < 9 or hour > 21:
                    hour = rng.integers(9, 21)
                txn_date = start_time + timedelta(days=int(rng.integers(0, SIMULATION_DAYS), hours=hour, minutes=rng.integers(0, 60))

                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': acc_id,
                    'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                    'amount': round(rng.lognormal(6, 1.2)),
                    'channel': rng.choice(['UPI', 'IMPS'], p=[0.8, 0.2]),
                    'device_id': device,
                    'timestamp': txn_date,
                })
                txn_id += 1

        elif persona == 'merchant':
            num_txns = rng.integers(100, 250)
            device = account_devices_df[account_devices_df['account_id'] == acc_id]['device_id'].values[0]

            for _ in range(num_txns):
                hour = rng.integers(8, 22)
                txn_date = start_time + timedelta(days=int(rng.integers(0, SIMULATION_DAYS), hours=hour, minutes=rng.integers(0, 60))

                # Mostly credits (customer payments)
                if rng.random() < 0.85:
                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'receiver_account_id': acc_id,
                        'amount': round(rng.lognormal(5.5, 1)),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                else:
                    # Supplier payment
                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': acc_id,
                        'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'amount': round(rng.lognormal(9, 0.8)),
                        'channel': 'NEFT',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                txn_id += 1

        elif persona == 'student':
            num_txns = rng.integers(5, 20)
            device = account_devices_df[account_devices_df['account_id'] == acc_id]['device_id'].values[0]

            for _ in range(num_txns):
                hour = rng.integers(10, 22)
                txn_date = start_time + timedelta(days=int(rng.integers(0, SIMULATION_DAYS), hours=hour, minutes=rng.integers(0, 60))

                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': acc_id if rng.random() < 0.6 else f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                    'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}' if rng.random() < 0.6 else acc_id,
                    'amount': round(rng.lognormal(5, 0.9)),
                    'channel': 'UPI',
                    'device_id': device,
                    'timestamp': txn_date,
                })
                txn_id += 1

        elif persona == 'dormant':
            num_txns = rng.integers(0, 5)
            if num_txns > 0:
                device = account_devices_df[account_devices_df['account_id'] == acc_id]['device_id'].values[0]

                for _ in range(num_txns):
                    txn_date = start_time + timedelta(days=int(rng.integers(0, SIMULATION_DAYS), hours=rng.integers(9, 20))

                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': acc_id,
                        'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'amount': round(rng.lognormal(5, 0.6)),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                    txn_id += 1

        elif persona == 'family':
            num_txns = rng.integers(10, 30)
            device = account_devices_df[account_devices_df['account_id'] == acc_id]['device_id'].values[0]
            # Find family group members
            family_members = account_devices_df[account_devices_df['device_id'] == device]['account_id'].values

            for _ in range(num_txns):
                txn_date = start_time + timedelta(days=int(rng.integers(0, SIMULATION_DAYS), hours=rng.integers(9, 21))

                # 60% within family, 40% outside
                if rng.random() < 0.6 and len(family_members) > 1:
                    other_member = rng.choice([m for m in family_members if m != acc_id])
                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': acc_id,
                        'receiver_account_id': other_member,
                        'amount': round(rng.lognormal(7.5, 0.9)),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                else:
                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': acc_id if rng.random() < 0.5 else f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}' if acc_id == transactions_list[-1]['sender_account_id'] else acc_id,
                        'amount': round(rng.lognormal(6.5, 1)),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                txn_id += 1

    # Fraud ring transactions
    print("  -> Injecting fraud rings...")
    fraud_by_ring = accounts_df[accounts_df['persona'] == 'fraud'].groupby('ring_id')

    for ring, group in fraud_by_ring:
        archetype = group.iloc[0]['archetype']
        members = group['account_id'].values

        # Random day in the simulation window
        fraud_day = rng.integers(3, SIMULATION_DAYS - 2)

        if archetype == 'fan_out_dispersal':
            # 1 source receives large amount, disperses to all members
            source = members[0]
            hour = rng.integers(0, 24)
            base_time = start_time + timedelta(days=fraud_day, hours=hour)
            device = account_devices_df[account_devices_df['account_id'] == source]['device_id'].values[0]

            # Large inflow
            transactions_list.append({
                'txn_id': f'TXN_{txn_id:08d}',
                'sender_account_id': f'ACC_{rng.integers(1, 1000):05d}',  # Victim
                'receiver_account_id': source,
                'amount': rng.integers(50000, 500000),
                'channel': 'IMPS',
                'device_id': device,
                'timestamp': base_time,
            })
            txn_id += 1

            # Disperse to mules within 30 minutes
            for mule in members[1:]:
                mule_device = account_devices_df[account_devices_df['account_id'] == mule]['device_id'].values[0]
                txn_time = base_time + timedelta(minutes=rng.integers(5, 30))

                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': source,
                    'receiver_account_id': mule,
                    'amount': rng.integers(5000, 30000),
                    'channel': 'UPI',
                    'device_id': device,
                    'timestamp': txn_time,
                })
                txn_id += 1

        elif archetype == 'fan_in_collector':
            # Multiple mules forward to 1-2 collectors
            collectors = members[:2]
            mules = members[2:]
            hour = rng.integers(0, 24)
            base_time = start_time + timedelta(days=fraud_day, hours=hour)

            for mule in mules:
                device = account_devices_df[account_devices_df['account_id'] == mule]['device_id'].values[0]

                # Mule receives from victim
                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': f'ACC_{rng.integers(1, 1000):05d}',
                    'receiver_account_id': mule,
                    'amount': rng.integers(5000, 20000),
                    'channel': 'UPI',
                    'device_id': device,
                    'timestamp': base_time + timedelta(minutes=rng.integers(-30, 30)),
                })
                txn_id += 1

                # Mule forwards to collector within 1 hour
                collector = rng.choice(collectors)
                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': mule,
                    'receiver_account_id': collector,
                    'amount': transactions_list[-1]['amount'] - rng.integers(100, 500),
                    'channel': 'UPI',
                    'device_id': device,
                    'timestamp': base_time + timedelta(minutes=rng.integers(30, 60)),
                })
                txn_id += 1

        elif archetype == 'circular_layering':
            # A->B->C->D->A cycles
            hour = rng.integers(0, 24)
            base_time = start_time + timedelta(days=fraud_day, hours=hour)

            for i in range(len(members)):
                sender = members[i]
                receiver = members[(i + 1) % len(members)]
                device = account_devices_df[account_devices_df['account_id'] == sender]['device_id'].values[0]

                transactions_list.append({
                    'txn_id': f'TXN_{txn_id:08d}',
                    'sender_account_id': sender,
                    'receiver_account_id': receiver,
                    'amount': rng.integers(10000, 50000),
                    'channel': 'IMPS',
                    'device_id': device,
                    'timestamp': base_time + timedelta(minutes=i * rng.integers(15, 60)),
                })
                txn_id += 1

        elif archetype == 'burst_mule':
            # High volume, amounts just below ₹10k threshold
            for member in members:
                device = account_devices_df[account_devices_df['account_id'] == member]['device_id'].values[0]
                num_burst = rng.integers(20, 50)
                burst_start = start_time + timedelta(days=fraud_day, hours=rng.integers(22, 24))

                for j in range(num_burst):
                    txn_time = burst_start + timedelta(minutes=j * rng.integers(2, 8))

                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': member if rng.random() < 0.5 else f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}' if transactions_list[-1]['sender_account_id'] == member else member,
                        'amount': rng.integers(9000, 9999),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_time,
                    })
                    txn_id += 1

        elif archetype == 'device_farm':
            # High velocity on shared device
            device = account_devices_df[account_devices_df['account_id'] == members[0]]['device_id'].values[0]
            num_txns_per_member = rng.integers(15, 30)

            for member in members:
                for _ in range(num_txns_per_member):
                    hour = rng.integers(0, 24)
                    txn_date = start_time + timedelta(days=int(rng.integers(fraud_day - 1, fraud_day + 2), hours=hour, minutes=rng.integers(0, 60))

                    transactions_list.append({
                        'txn_id': f'TXN_{txn_id:08d}',
                        'sender_account_id': member if rng.random() < 0.5 else f'ACC_{rng.integers(1, len(accounts_df)):05d}',
                        'receiver_account_id': f'ACC_{rng.integers(1, len(accounts_df)):05d}' if txn_id % 2 == 0 else member,
                        'amount': rng.integers(1000, 15000),
                        'channel': 'UPI',
                        'device_id': device,
                        'timestamp': txn_date,
                    })
                    txn_id += 1

    transactions_df = pd.DataFrame(transactions_list).sort_values('timestamp').reset_index(drop=True)

    # Limit to target count
    if len(transactions_df) > TOTAL_TRANSACTIONS:
        transactions_df = transactions_df.sample(n=TOTAL_TRANSACTIONS, random_state=seed).sort_values('timestamp').reset_index(drop=True)

    print(f"     Generated {len(transactions_df)} transactions")

    # Step 4: Labels table (separate from features)
    print("  -> Creating labels table...")
    labels_list = []

    for idx, row in accounts_df.iterrows():
        if row['persona'] == 'fraud':
            labels_list.append({
                'account_id': row['account_id'],
                'is_mule': True,
                'ring_id': row['ring_id'],
                'ring_archetype': row['archetype'],
            })
        else:
            labels_list.append({
                'account_id': row['account_id'],
                'is_mule': False,
                'ring_id': None,
                'ring_archetype': None,
            })

    labels_df = pd.DataFrame(labels_list)

    # Clean accounts table (remove fraud-specific columns)
    accounts_final = accounts_df.drop(columns=['persona', 'ring_id', 'archetype'], errors='ignore')

    print(f"✓ Dataset generated: {len(accounts_final)} accounts, {len(transactions_df)} transactions")
    print(f"  Fraud prevalence: {labels_df['is_mule'].sum() / len(labels_df) * 100:.2f}%")

    return {
        'accounts': accounts_final,
        'devices': devices_df,
        'account_devices': account_devices_df,
        'transactions': transactions_df,
        'labels': labels_df,
    }


if __name__ == '__main__':
    # Generate and save dataset
    print("=== Dhanova Synthetic Data Generator ===\n")

    data = generate(seed=42)

    # Save as parquet
    import os
    os.makedirs('data', exist_ok=True)

    for name, df in data.items():
        path = f'data/{name}.parquet'
        df.to_parquet(path, index=False)
        print(f"Saved: {path} ({len(df)} rows)")

    print("\n✓ All datasets saved to data/ directory")
