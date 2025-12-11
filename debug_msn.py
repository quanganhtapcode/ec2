from vnstock import Vnstock
import sys
import os

# Suppress vnstock banner
os.environ['VNSTOCK_SILENT'] = '1'

# Test MSN
stock = Vnstock().stock(symbol='MSN', source='VCI')
cf = stock.finance.cash_flow(period='year')

print("SEARCHING FOR SPECIFIC COLUMNS")
targets = [
    'Increase/Decrease in receivables',
    'Increase/Decrease in inventories', 
    'Increase/Decrease in payables',
    'Proceeds from borrowings',
    'Repayment of borrowings',
    'Purchase of fixed assets',
    'Depreciation and Amortisation',
]

for target in targets:
    target_clean = target.lower().strip()
    found = False
    for col in cf.columns:
        col_clean = str(col).split('(')[0].strip().lower()
        if target_clean == col_clean:
            val = cf[col].iloc[0] if not cf.empty else 0
            print(f"FOUND: {target} = {val}")
            found = True
            break
    if not found:
        print(f"NOT FOUND: {target}")
