from vnstock import Vnstock
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Test HPG
stock = Vnstock().stock(symbol='HPG', source='VCI')
cf = stock.finance.cash_flow(period='year')

# Try to find the values using exact column names from backend code
search_cols = {
    'Increase/Decrease in receivables': 'receivablesChange',
    'Increase/Decrease in inventories': 'inventoriesChange', 
    'Increase/Decrease in payables': 'payablesChange',
    'Proceeds from borrowings': 'proceedsBorrowings',
    'Repayment of borrowings': 'repaymentBorrowings',
}

print("=== TESTING COLUMN MATCHING ===")
for target, name in search_cols.items():
    target_clean = target.lower().strip()
    found = False
    for col in cf.columns:
        col_clean = str(col).split('(')[0].strip().lower()
        if target_clean == col_clean or target_clean in col_clean:
            val = cf[col].iloc[0] if not cf.empty else 0
            print(f"[FOUND] {name}: {target} -> '{col}' = {val:,.0f}")
            found = True
            break
    if not found:
        print(f"[NOT FOUND] {name}: {target}")
