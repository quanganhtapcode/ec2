
import sys
import os
import pandas as pd
import numpy as np
from vnstock import Vnstock

# Thêm đường dẫn để import được models
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from models import ValuationModels
except ImportError:
    print("Không tìm thấy models.py. Đang chạy từ thư mục gốc?")
    sys.path.append(os.path.join(os.getcwd()))
    from backend.models import ValuationModels

def debug_hpg():
    symbol = "HPG"
    print(f"--- DEBUG VALUATION FOR {symbol} ---")
    
    # 1. Khởi tạo model
    print("1. Initializing ValuationModels...")
    try:
        model = ValuationModels(stock_symbol=symbol)
        if model.stock:
             print("   - Vnstock connection: OK")
        else:
             print("   - Vnstock connection: FAILED (self.stock is None)")
             return
    except Exception as e:
        print(f"   - Error initializing: {e}")
        return

    # 2. Assumptions
    assumptions = {
        'short_term_growth': 0.05,
        'terminal_growth': 0.02,
        'wacc': 0.10,            # 10%
        'cost_of_equity': 0.12,  # 12%
        'tax_rate': 0.20,
        'forecast_years': 5,
        'data_frequency': 'year'
    }
    print(f"2. Assumptions: {assumptions}")

    # 3. Test FCFF calculation detailed
    print("\n--- DEBUGGING FCFF ---")
    try:
        shares = model.get_shares_outstanding()
        print(f"   - Shares Outstanding: {shares:,.0f}")
        
        # Pull data manually to inspect
        data_freq = 'year'
        income = model.get_cached_income_data(period=data_freq)
        cashflow = model.get_cached_cash_flow_data(period=data_freq)
        balance = model.get_cached_balance_data(period=data_freq)
        
        print(f"   - Income Data Shape: {income.shape}")
        print(f"   - Cashflow Data Shape: {cashflow.shape}")
        print(f"   - Balance Data Shape: {balance.shape}")
        
        # Process frequency
        _, proc_income = model.check_data_frequency(income.copy(), data_freq)
        _, proc_cashflow = model.check_data_frequency(cashflow.copy(), data_freq)
        _, proc_balance = model.check_data_frequency(balance.copy(), data_freq)
        
        print("\n   --- BALANCE SHEET COLUMNS ---")
        print(list(proc_balance.columns))
        
        print("\n   --- FINANCIAL ITEMS (Latest Year) ---")
        
        # Helper to print value
        def print_val(label, val):
            print(f"   - {label}: {val:,.0f}")
            
        # FCFF Components
        net_income = model.find_financial_value(proc_income, ['Net Profit For the Year'], False)
        print_val("Net Income", net_income)
        
        depreciation = model.find_financial_value(proc_cashflow, ['Depreciation and Amortisation'], False)
        print_val("Depreciation", depreciation)
        
        interest = model.find_financial_value(proc_income, ['Interest Expenses'], False)
        print_val("Interest Expense", interest)
        
        interest_tax_shield = interest * (1 - 0.2)
        print_val("Interest After Tax", interest_tax_shield)
        
        capex = model.find_financial_value(proc_cashflow, ['Purchase of fixed assets', 'Proceeds from disposal of fixed assets'], False)
        print_val("Capex (Net)", capex)
        
        # Working Capital
        ar = model.find_financial_value(proc_cashflow, ['Increase/Decrease in receivables'], False)
        inv = model.find_financial_value(proc_cashflow, ['Increase/Decrease in inventories'], False)
        ap = model.find_financial_value(proc_cashflow, ['Increase/Decrease in payables'], False)
        wc_inv = ar + inv - ap
        print_val("WC Investment", wc_inv)
        
        # FCFF Base
        fcff_base = net_income + depreciation + interest_tax_shield - wc_inv + capex
        print_val("=> FCFF Base (Year 0)", fcff_base)
        
        # DEBT & CASH
        short_debt = model.find_financial_value(proc_balance, ['Short-term borrowings', 'Vay và nợ thuê tài chính ngắn hạn'], False)
        long_debt = model.find_financial_value(proc_balance, ['Long-term borrowings', 'Vay và nợ thuê tài chính dài hạn'], False)
        total_debt = short_debt + long_debt
        print_val("Short-term Debt", short_debt)
        print_val("Long-term Debt", long_debt)
        print_val("=> Total Debt", total_debt)
        
        cash = model.find_financial_value(proc_balance, ['Cash and cash equivalents', 'Tiền và các khoản tương đương tiền'], False)
        print_val("=> Cash", cash)
        
        # VALUATION
        print("\n   --- CALCULATION ---")
        # Re-run simulation of the loop
        forecast_years = 5
        short_term_growth = 0.05
        wacc = 0.10
        terminal_growth = 0.02
        
        future_fcffs = [fcff_base * ((1 + short_term_growth) ** y) for y in range(1, forecast_years + 1)]
        print(f"   - Future FCFFs (5 years): {[f'{x:,.0f}' for x in future_fcffs]}")
        
        terminal_val = future_fcffs[-1] * (1 + terminal_growth) / (wacc - terminal_growth)
        print_val("Terminal Value", terminal_val)
        
        pv_fcffs = sum([val / ((1 + wacc) ** y) for y, val in enumerate(future_fcffs, 1)])
        pv_terminal = terminal_val / ((1 + wacc) ** forecast_years)
        
        enterprise_value = pv_fcffs + pv_terminal
        print_val("Enterprise Value (EV)", enterprise_value)
        
        equity_value = enterprise_value - total_debt + cash
        print_val("Equity Value", equity_value)
        
        per_share = equity_value / shares
        print(f"   => FCFF Per Share: {per_share:,.2f}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"   ! Error in FCFF debug: {e}")

    # 3. Test FCFE calculation detailed
    print("\n--- DEBUGGING FCFE ---")
    try:
        # FCFE Components
        net_borrowing = model.find_financial_value(proc_cashflow, ['Proceeds from borrowings', 'Repayment of borrowings'], False)
        print_val("Net Borrowing (Proceeds + Repayment)", net_borrowing)
        
        fcfe_base = net_income + depreciation + net_borrowing - wc_inv + capex
        print_val("=> FCFE Base (Year 0)", fcfe_base)
        
        if fcfe_base <= 0:
            print("   ! WARNING: FCFE Base is negative. Valuation might be weird.")
            
        # CALL ACTUAL MODEL to verify
        print("\n--- ACTUAL MODEL CALCULATION ---")
        results = model.calculate_all_models(assumptions)
        print(f"FCFE Value: {results.get('fcfe', 0):,.2f} VND")
        print(f"FCFF Value: {results.get('fcff', 0):,.2f} VND")
        print(f"Justified P/E: {results.get('justified_pe', 0):,.2f} VND")
        print(f"Justified P/B: {results.get('justified_pb', 0):,.2f} VND")
        print(f"Weighted Average: {results.get('weighted_average', 0):,.2f} VND")

    except Exception as e:
        print(f"   ! Error in FCFE debug: {e}")

if __name__ == "__main__":
    debug_hpg()
