from vnstock import Vnstock
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Test with HPG
stock = Vnstock().stock(symbol='HPG', source='VCI')
cash_flow = stock.finance.cash_flow(period='year')

print("=== CASH FLOW STATEMENT COLUMNS (HPG) ===")
for col in cash_flow.columns:
    col_clean = str(col).split('(')[0].strip()
    print(f"  '{col_clean}'")

# Look for specific keywords
keywords = ['receivable', 'inventor', 'payable', 'borrow', 'repay', 'proceed']
print("\n=== COLUMNS MATCHING KEYWORDS ===")
for col in cash_flow.columns:
    col_lower = str(col).lower()
    for kw in keywords:
        if kw in col_lower:
            val = cash_flow[col].iloc[0] if not cash_flow.empty else 0
            print(f"  [{kw}] '{col}': {val:,.0f}")
            break
