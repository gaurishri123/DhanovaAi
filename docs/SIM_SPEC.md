# Dhanova — Simulation Specification

## Scale
- ~6,000 accounts
- ~150,000 transactions  
- 30-day transaction window
- ~25 fraud rings (5–25 members each)
- Fraud prevalence: 3–4% of accounts

## Normal Account Personas

| Persona | Count | Behavior |
|---|---|---|
| Salaried | ~2,500 | 1 large credit/month (salary day: 1st/last), 10-30 UPI debits for bills/food/shopping. Amounts: salary ₹15k–₹80k, spends ₹50–₹5,000 lognormal |
| Merchant | ~800 | High fan-in (50–200 unique senders/month), small credits ₹50–₹2,000. Few large debits (supplier payments). Active 8am–10pm |
| Student | ~1,200 | Low activity (5–15 txns/month), small amounts ₹20–₹1,500. Peer transfers, food delivery. Some have shared devices (hostel) |
| Dormant | ~600 | 0–3 txns/month, small amounts. Occasional recharge or utility |
| Family/Pooling | ~400 (in ~80 family groups of ~5) | Shared device across 2-5 accounts, frequent transfers within group ₹500–₹20,000. Looks like a ring structurally but is legit |

## Fraud Ring Archetypes

| Archetype | Count | Size | Pattern |
|---|---|---|---|
| Fan-out Dispersal | 6 rings | 10–25 members | 1 source receives large amount (₹50k–₹5L), disperses to 10–20 mules within 30 minutes. Mules withdraw/forward within 2 hours |
| Fan-in Collector | 5 rings | 8–15 members | Multiple mules each receive ₹5k–₹20k from victims, all forward to 1-2 collector accounts within 1 hour. Collector does cash-out |
| Circular Layering | 5 rings | 5–10 members | A→B→C→D→A cycles, amounts ₹10k–₹50k, transactions spaced 15–60 minutes apart. Purpose: break audit trail |
| Burst Mule | 5 rings | 5–8 members | New accounts (age < 15 days), sudden burst of 20–50 transactions in 2-3 hours, amounts ₹9,000–₹9,999 (just below ₹10k threshold — structuring) |
| Device Farm | 4 rings | 8–12 members | 1-2 devices shared across all accounts. High velocity, varied amounts. Accounts created within same week |

## Hard Negatives (Critical)
- Merchants with high fan-in (50–200 senders) — looks like fan-in collector but legit
- Salary disbursement accounts with high fan-out (1 account → 20-50 employees) — looks like fan-out but legit
- Family groups on shared devices — looks like device farm but legit
- Festival/wedding season burst of gifting transactions — looks like burst mule but legit

## Amount Distributions
- All amounts: lognormal base, rounded to nearest ₹10 or ₹100 for realism
- Structuring amounts: concentrated at ₹9,000–₹9,999 (below ₹10k reporting threshold)
- Normal UPI: median ~₹500, range ₹10–₹50,000
- Salary: ₹15,000–₹80,000

## Timing Patterns
- Normal: 70% transactions between 9am–9pm, peak at lunch (12–2pm) and evening (6–8pm)
- Salary credits: 1st and last day of month
- Fraud: 40% of fraud transactions happen between 11pm–5am (night shift)
- Burst fraud: 20–50 transactions in a 2-3 hour window

## Noise/Realism
- 5% of fraud ring members behave normally (sleeper mules — have normal activity, only 1-2 fraud transactions)
- 3% of normal accounts have suspicious-looking patterns (odd timing, high single-day activity)
- Device reuse: 10% of normal accounts share a device with 1 other account (couples, family)
