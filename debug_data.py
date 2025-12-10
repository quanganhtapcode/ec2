from vnstock import Vnstock
import pandas as pd
import sys

# Set encoding to utf-8 for console output
sys.stdout.reconfigure(encoding='utf-8')

try:
    # 1. Fetch Balance Sheet data for VCI
    print("Fetching Balance Sheet for VCI...")
    stock = Vnstock().stock(symbol='VCI', source='VCI')
    balance_sheet = stock.finance.balance_sheet(period='year')

    if balance_sheet.empty:
        print("No data found!")
        exit()

    print(f"Data shape: {balance_sheet.shape}")

    # 2. Inspect Columns for Cash and Debt
    print("\n--- POTENTIAL CASH & DEBT COLUMNS ---")
    keywords = ['vay', 'nợ', 'debt', 'borrow', 'tiền', 'cash', 'equivalent']

    # Get latest year data
    latest_data = balance_sheet.iloc[0]
        
    for col in balance_sheet.columns:
        col_str = str(col)
        # Check keyword match
        if any(k in col_str.lower() for k in keywords):
            val = latest_data[col]
            # Print column name and value if not NaN/0 to reduce noise
            if pd.notna(val) and val != 0:
                print(f"[{col_str}]: {val:,.0f}")

except Exception as e:
    print(f"Error: {e}")
