import numpy as np
import pandas as pd
from vnstock import Vnstock

class ValuationModels:
    """
    Comprehensive financial valuation models for Vietnamese stocks
    Implements 4 models: FCFE, FCFF, Justified P/E, and Justified P/B
    """
    def __init__(self, stock_data=None, stock_symbol=None):
        """Initialize with stock data from API"""
        self.stock_data = stock_data or {}
        self.stock_symbol = stock_symbol
        self.vnstock_instance = Vnstock()
        self.stock = None
        if stock_symbol:
            self.stock = self.vnstock_instance.stock(symbol=stock_symbol, source='VCI')
        
        # Cache for financial data to avoid multiple API calls
        self._income_data_cache = {}
        self._cash_flow_data_cache = {}
        self._balance_data_cache = {}
        self._shares_outstanding_cache = None

    def calculate_all_models(self, assumptions):
        """Calculate all 4 valuation models with given assumptions"""
        if not self.stock_symbol and not self.stock_data:
            return {'error': 'No stock data or symbol available'}
        
        results = {}
        
        # Calculate FCFE
        try:
            fcfe_result = self.calculate_fcfe(assumptions)
            results['fcfe'] = fcfe_result
        except Exception as e:
            results['fcfe'] = 0
            
        # Calculate FCFF
        try:
            fcff_result = self.calculate_fcff(assumptions)
            results['fcff'] = fcff_result
        except Exception as e:
            results['fcff'] = 0
            
        # Calculate Justified P/E
        try:
            pe_result = self.calculate_justified_pe(assumptions)
            results['justified_pe'] = pe_result
        except Exception as e:
            results['justified_pe'] = 0
            
        # Calculate Justified P/B
        try:
            pb_result = self.calculate_justified_pb(assumptions)
            results['justified_pb'] = pb_result
        except Exception as e:
            results['justified_pb'] = 0

        results['weighted_average'] = 0
        results['summary'] = {}

        # Calculate weighted average of valid models
        model_weights = assumptions.get('model_weights', {
            'fcfe': 0.25, 'fcff': 0.25, 'justified_pe': 0.25, 'justified_pb': 0.25
        })
        
        # Helper to extract numeric value from result
        def get_model_value(res):
            if isinstance(res, dict):
                return float(res.get('shareValue', 0))
            try:
                return float(res) if res is not None else 0
            except:
                return 0

        valid_models = {}
        for k, v in results.items():
            if k in model_weights:
                val = get_model_value(v)
                if val > 0:
                     valid_models[k] = val

        if valid_models:
            total_weight = sum(model_weights[k] for k in valid_models.keys())
            if total_weight > 0:
                results['weighted_average'] = float(sum(
                    valid_models[k] * model_weights[k] for k in valid_models.keys()
                ) / total_weight)
                
                # Add summary statistics
                values = list(valid_models.values())
                results['summary'] = {
                    'average': float(np.mean(values)),
                    'min': float(min(values)),
                    'max': float(max(values)),
                    'models_used': len(values),
                    'total_models': 4
                }

        # Sensitivity Analysis (FCFF)
        try:
            base_wacc = assumptions.get('wacc', 0.10)
            base_growth = assumptions.get('terminal_growth', 0.02)
            
            # Ranges: +/- 1% with 0.5% steps
            wacc_range = [base_wacc - 0.01, base_wacc - 0.005, base_wacc, base_wacc + 0.005, base_wacc + 0.01]
            growth_range = [base_growth - 0.01, base_growth - 0.005, base_growth, base_growth + 0.005, base_growth + 0.01]
            
            sensitivity_matrix = {
                'row_headers': [float(round(w * 100, 1)) for w in wacc_range],
                'col_headers': [float(round(g * 100, 1)) for g in growth_range],
                'values': []
            }
            
            for w in wacc_range:
                row_values = []
                for g in growth_range:
                    # Create temp assumptions
                    temp_assumptions = assumptions.copy()
                    temp_assumptions['wacc'] = float(w)
                    temp_assumptions['terminal_growth'] = float(g)
                    
                    # Calculate FCFF with temp assumptions
                    val_result = self.calculate_fcff(temp_assumptions, logging_enabled=False)
                    val = get_model_value(val_result)
                    row_values.append(int(val)) # Store integer value
                sensitivity_matrix['values'].append(row_values)
                
            results['sensitivity_analysis'] = sensitivity_matrix
            
        except Exception as e:
            # print(f"Sensitivity analysis error: {e}")
            results['sensitivity_analysis'] = None

        return results

    # ===================================================
    # HELPER FUNCTIONS
    # ===================================================
    
    def get_cached_income_data(self, period='year'):
        """Get income statement data with caching to avoid repeated API calls"""
        cache_key = f"income_{period}"
        if cache_key not in self._income_data_cache:
            if self.stock:
                self._income_data_cache[cache_key] = self.stock.finance.income_statement(period=period, dropna=False)
            else:
                self._income_data_cache[cache_key] = pd.DataFrame()
        return self._income_data_cache[cache_key]
    
    def get_cached_cash_flow_data(self, period='year'):
        """Get cash flow data with caching to avoid repeated API calls"""
        cache_key = f"cash_flow_{period}"
        if cache_key not in self._cash_flow_data_cache:
            if self.stock:
                self._cash_flow_data_cache[cache_key] = self.stock.finance.cash_flow(period=period, dropna=False)
            else:
                self._cash_flow_data_cache[cache_key] = pd.DataFrame()
        return self._cash_flow_data_cache[cache_key]
    
    def get_cached_balance_data(self, period='year'):
        """Get balance sheet data with caching to avoid repeated API calls"""
        cache_key = f"balance_{period}"
        if cache_key not in self._balance_data_cache:
            if self.stock:
                self._balance_data_cache[cache_key] = self.stock.finance.balance_sheet(period=period, dropna=False)
            else:
                self._balance_data_cache[cache_key] = pd.DataFrame()
        return self._balance_data_cache[cache_key]
    
    def check_data_frequency(self, data, expected_frequency):
        """Check if data is yearly or quarterly, sort, and filter latest quarters if needed."""
        time_cols = [col for col in data.columns if any(kw in col.lower() for kw in ['year', 'quarter', 'date', 'time'])]
        quarter_col = [col for col in data.columns if 'lengthReport' in col or 'quarter' in col.lower()]
        
        if not time_cols and not quarter_col:
            return expected_frequency, data
        
        # Handle quarterly data with yearReport and lengthReport
        if 'yearReport' in data.columns and 'lengthReport' in data.columns:
            data = data.copy()
            data['yearReport'] = data['yearReport'].astype(float)
            data['lengthReport'] = data['lengthReport'].astype(float)
            data = data.sort_values(['yearReport', 'lengthReport'], ascending=[False, False]).reset_index(drop=True)
            
            if expected_frequency == 'quarter':
                latest_quarters = data.head(4)
                quarter_labels = [f"{int(row['yearReport'])}Q{int(row['lengthReport'])}" for _, row in latest_quarters.iterrows()]
                if len(latest_quarters) < 4:
                    pass
                return 'quarter', latest_quarters
            else:
                latest_year = data[data['lengthReport'] == 4].head(1) if not data[data['lengthReport'] == 4].empty else data.head(1)
                if not latest_year.empty:
                    pass
                return 'year', latest_year
        
        # Handle other datetime columns
        time_col = time_cols[0] if time_cols else None
        if time_col:
            try:
                data[time_col] = pd.to_datetime(data[time_col], errors='coerce')
                if data[time_col].notna().any():
                    data = data.sort_values(time_col, ascending=False).reset_index(drop=True)
                    if expected_frequency == 'quarter':
                        latest_quarters = data.head(4)
                        return 'quarter', latest_quarters
                    else:
                        latest_year = data.head(1)
                        return 'year', latest_year
            except Exception as e:
                pass
        
        return expected_frequency, data.head(1)

    def find_financial_value(self, data, column_names, is_quarterly=False):
        """Find and return value for given column names, following original logic."""
        total = 0
        matched_columns = []
        
        if data.empty:
            return 0
        
        for target_col in column_names:
            found = False
            target_clean = target_col.lower().strip()
            
            for data_col in data.columns:
                # Normalize data_col: remove units like (Bn. VND) and case fold
                data_col_clean = str(data_col).split('(')[0].strip().lower()
                
                # Check for match (clean match OR exact match)
                if target_clean == data_col_clean or target_clean == str(data_col).lower().strip():
                    values = data[data_col]
                    if values.notna().any():
                        valid_values = values.dropna()
                        if not valid_values.empty:
                            if is_quarterly:
                                current_sum = float(valid_values.sum())
                            else:
                                current_sum = float(valid_values.iloc[0])
                            
                            # For fixed_capital, sum all matching columns
                            if 'fixed' in target_col.lower() or 'capital' in target_col.lower():
                                total += current_sum
                                matched_columns.append(f"'{data_col}' ({current_sum:,.0f})")
                            else:
                                total = current_sum
                                matched_columns.append(f"'{data_col}' ({current_sum:,.0f})")
                                found = True
                                break
            if found and 'fixed' not in target_col.lower():
                break
        
        if matched_columns:
            pass
        
        return total

    def get_shares_outstanding(self):
        """Get shares outstanding from stock data with caching"""
        if self._shares_outstanding_cache is not None:
            return self._shares_outstanding_cache
            
        if not self.stock:
            result = self.stock_data.get('shares_outstanding', 1_000_000_000)
            self._shares_outstanding_cache = result
            return result
            
        try:
            price_board = self.stock.trading.price_board([self.stock_symbol])
            shares_outstanding = 1_000_000_000  # Default
            for col in price_board.columns:
                if 'listed_share' in str(col).lower():
                    shares_outstanding = price_board[col].iloc[0]
                    break
            self._shares_outstanding_cache = shares_outstanding
            return shares_outstanding
        except:
            result = self.stock_data.get('shares_outstanding', 1_000_000_000)
            self._shares_outstanding_cache = result
            return result
      # ===================================================
    # VALUATION MODELS
    # ===================================================
    
    def calculate_fcfe(self, assumptions, logging_enabled=True):
        """
        Calculate FCFE (Free Cash Flow to Equity) Valuation - CORRECTED
        Returns: value per share in VND
        """
        try:
            
            # Get assumptions
            short_term_growth = assumptions.get('short_term_growth', 
                                               assumptions.get('revenue_growth', 0.05))
            terminal_growth = assumptions.get('terminal_growth', 0.02)
            # FCFE must use Cost of Equity, NOT WACC
            cost_of_equity = assumptions.get('cost_of_equity', 0.12)
            
            tax_rate = assumptions.get('tax_rate', 0.20)
            forecast_years = assumptions.get('forecast_years', 5)
            data_frequency = assumptions.get('data_frequency', 'year')
            
            
            shares_outstanding = self.get_shares_outstanding()
            
            # Use stock data if available, otherwise use provided data
            if self.stock:
                # Fetch financial data with caching
                income_data = self.get_cached_income_data(period=data_frequency)
                cash_flow_data = self.get_cached_cash_flow_data(period=data_frequency)
                
                # Process data frequency
                actual_freq, processed_income = self.check_data_frequency(income_data.copy(), data_frequency)
                _, processed_cash_flow = self.check_data_frequency(cash_flow_data.copy(), data_frequency)
                is_quarterly = actual_freq == 'quarter'
                
                
                # Net Income
                net_income = self.find_financial_value(processed_income, ['Net Profit For the Year'], is_quarterly)
                
                # Non-Cash Charges (Depreciation)
                non_cash_charges = self.find_financial_value(processed_cash_flow, ['Depreciation and Amortisation'], is_quarterly)
                
                # Working Capital Investment
                receivables_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in receivables'], is_quarterly)
                inventories_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in inventories'], is_quarterly)
                payables_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in payables'], is_quarterly)
                working_capital_investment = receivables_change + inventories_change - payables_change
                
                # Fixed Capital Investment
                fixed_capital_investment = self.find_financial_value(processed_cash_flow, 
                                                                   ['Purchase of fixed assets', 'Proceeds from disposal of fixed assets'], 
                                                                   is_quarterly)
                
                # Net Borrowing
                proceeds_borrowings = self.find_financial_value(processed_cash_flow, ['Proceeds from borrowings'], is_quarterly)
                repayment_borrowings = self.find_financial_value(processed_cash_flow, ['Repayment of borrowings'], is_quarterly)
                net_borrowing = proceeds_borrowings + repayment_borrowings
                
                # FCFE CALCULATION
                fcfe = net_income + non_cash_charges + net_borrowing - working_capital_investment + fixed_capital_investment
                
            else:
                # Use provided stock data
                net_income = self.stock_data.get('net_income_ttm', 0)
                depreciation = self.stock_data.get('depreciation', 0)
                capex = abs(self.stock_data.get('capex', 0))
                net_borrowing = self.stock_data.get('net_borrowing', 0)
                working_capital_change = self.stock_data.get('working_capital_change', 0)
                
                fcfe = net_income + depreciation + net_borrowing - working_capital_change - capex
                
            
            # Project and discount using Cost of Equity
            future_fcfes = [fcfe * ((1 + short_term_growth) ** year) for year in range(1, forecast_years + 1)]
            
            # Terminal Value calculation
            # If cost_of_equity <= terminal_growth, use a safe multiplier or cap
            if cost_of_equity <= terminal_growth:
                 # Fallback: assume constant multiple or force a spread
                 adj_cost_of_equity = max(cost_of_equity, terminal_growth + 0.02)
                 terminal_value = future_fcfes[-1] * (1 + terminal_growth) / (adj_cost_of_equity - terminal_growth)
            else:
                terminal_value = future_fcfes[-1] * (1 + terminal_growth) / (cost_of_equity - terminal_growth)

            pv_fcfes = [fcfe_val / ((1 + cost_of_equity) ** year) for year, fcfe_val in enumerate(future_fcfes, 1)]
            pv_terminal = terminal_value / ((1 + cost_of_equity) ** forecast_years)
            
            total_equity_value = sum(pv_fcfes) + pv_terminal
            
            if shares_outstanding > 0:
                per_share_fcfe = total_equity_value / shares_outstanding
            else:
                per_share_fcfe = 0
            
            # Return detailed result for Excel export
            # Prepare detailed result for Excel export
            detailed_result = {
                'shareValue': float(per_share_fcfe),
                'baseFCFE': float(fcfe),
                'projectedCashFlows': [float(x) for x in future_fcfes],
                'presentValues': [float(x) for x in pv_fcfes],
                'terminalValue': float(terminal_value),
                'pvTerminal': float(pv_terminal),
                'totalEquityValue': float(total_equity_value),
                'sharesOutstanding': float(shares_outstanding),
                'inputs': {
                    'netIncome': float(net_income if self.stock else self.stock_data.get('net_income_ttm', 0)),
                    'depreciation': float(non_cash_charges if self.stock else self.stock_data.get('depreciation', 0)),
                    'netBorrowing': float(net_borrowing),
                    'workingCapitalInvestment': float(working_capital_investment if self.stock else self.stock_data.get('working_capital_change', 0)),
                    'fixedCapitalInvestment': float(fixed_capital_investment if self.stock else -abs(self.stock_data.get('capex', 0))),
                    # Detailed breakdown for Excel
                    'receivablesChange': float(receivables_change) if self.stock else 0,
                    'inventoriesChange': float(inventories_change) if self.stock else 0,
                    'payablesChange': float(payables_change) if self.stock else 0,
                    'proceedsBorrowings': float(proceeds_borrowings) if self.stock else 0,
                    'repaymentBorrowings': float(repayment_borrowings) if self.stock else 0,
                },
                'assumptions': {
                    'costOfEquity': float(cost_of_equity),
                    'shortTermGrowth': float(short_term_growth),
                    'terminalGrowth': float(terminal_growth),
                    'forecastYears': int(forecast_years)
                }
            }

            # LOG CALCULATION DETAILS
            if logging_enabled:
                try:
                    print(f"\n{'='*60}")
                    print(f"🧮 FCFE CALCULATION LOG: {self.stock_symbol or 'Custom Data'}")
                    print(f"{'='*60}")
                    inp = detailed_result['inputs']
                    print(f" (+) Net Income:                {inp['netIncome']:20,.0f}")
                    print(f" (+) Depreciation:              {inp['depreciation']:20,.0f}")
                    print(f" (+) Net Borrowing:             {inp['netBorrowing']:20,.0f}")
                    print(f" (-) Working Capital Inv:       {inp['workingCapitalInvestment']:20,.0f}")
                    print(f" (+) Fixed Capital Inv (CapEx): {inp['fixedCapitalInvestment']:20,.0f} (Note: Negative means outflow)")
                    print(f"{'-'*60}")
                    print(f" (=) Base FCFE:                 {detailed_result['baseFCFE']:20,.0f}")
                    print(f"Shares Outstanding:             {detailed_result['sharesOutstanding']:20,.0f}")
                    print(f"Fair Value per Share:           {detailed_result['shareValue']:20,.0f} VND")
                    print(f"{'='*60}")
                    # Debug: Show detailed breakdown fields
                    print(f"[DEBUG] Detailed inputs in response:")
                    print(f"  receivablesChange: {inp.get('receivablesChange', 'NOT SET')}")
                    print(f"  inventoriesChange: {inp.get('inventoriesChange', 'NOT SET')}")
                    print(f"  payablesChange: {inp.get('payablesChange', 'NOT SET')}")
                    print(f"  proceedsBorrowings: {inp.get('proceedsBorrowings', 'NOT SET')}")
                    print(f"  repaymentBorrowings: {inp.get('repaymentBorrowings', 'NOT SET')}")
                    print(f"{'='*60}\n")
                except Exception as e:
                    print(f"Error logging FCFE: {e}")

            return detailed_result

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'shareValue': 0, 'error': str(e)}
    
    def calculate_fcff(self, assumptions, logging_enabled=True):
        """
        Calculate FCFF (Free Cash Flow to Firm) Valuation - CORRECTED
        Returns: value per share in VND
        """
        try:
            
            # Get assumptions
            short_term_growth = assumptions.get('short_term_growth', 0.05)
            terminal_growth = assumptions.get('terminal_growth', 0.02)
            wacc = assumptions.get('wacc', 0.10)
            tax_rate = assumptions.get('tax_rate', 0.20)
            forecast_years = assumptions.get('forecast_years', 5)
            data_frequency = assumptions.get('data_frequency', 'year')
            
            shares_outstanding = self.get_shares_outstanding()
            
            # Initialize Debt and Cash
            total_debt = 0
            cash = 0

            # Use stock data if available, otherwise use provided data
            if self.stock:
                # Fetch financial data with caching
                income_data = self.get_cached_income_data(period=data_frequency)
                cash_flow_data = self.get_cached_cash_flow_data(period=data_frequency)
                balance_data = self.get_cached_balance_data(period=data_frequency)

                # Process data frequency
                actual_freq, processed_income = self.check_data_frequency(income_data.copy(), data_frequency)
                _, processed_cash_flow = self.check_data_frequency(cash_flow_data.copy(), data_frequency)
                _, processed_balance = self.check_data_frequency(balance_data.copy(), data_frequency)
                
                is_quarterly = actual_freq == 'quarter'
                
                
                # Net Income
                net_income = self.find_financial_value(processed_income, ['Net Profit For the Year'], is_quarterly)
                
                # Non-Cash Charges (Depreciation)
                non_cash_charges = self.find_financial_value(processed_cash_flow, ['Depreciation and Amortisation'], is_quarterly)
                
                # Interest Expense After Tax (FCFF specific)
                interest_expense = self.find_financial_value(processed_income, ['Interest Expenses'], is_quarterly)
                # Ensure positive interest expense for adding back
                interest_after_tax = abs(interest_expense) * (1 - tax_rate)
                
                # Working Capital Investment
                receivables_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in receivables'], is_quarterly)
                inventories_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in inventories'], is_quarterly)
                payables_change = self.find_financial_value(processed_cash_flow, ['Increase/Decrease in payables'], is_quarterly)
                working_capital_investment = receivables_change + inventories_change - payables_change
                
                # Fixed Capital Investment
                fixed_capital_investment = self.find_financial_value(processed_cash_flow, 
                                                                   ['Purchase of fixed assets', 'Proceeds from disposal of fixed assets'], 
                                                                   is_quarterly)
                
                # Extract Debt and Cash for Equity Value Calculation
                # Short-term debt
                short_term_debt = self.find_financial_value(processed_balance, [
                    'Short-term borrowings', 'Vay và nợ thuê tài chính ngắn hạn', 'Short-term debt', 'Vay ngắn hạn',
                    'Vay ngắn hạn và nợ thuê tài chính ngắn hạn', 'Short-term borrowings and financial lease liabilities'
                ], False)
                # Long-term debt
                long_term_debt = self.find_financial_value(processed_balance, [
                    'Long-term borrowings', 'Vay và nợ thuê tài chính dài hạn', 'Long-term debt', 'Vay dài hạn',
                    'Vay dài hạn và nợ thuê tài chính dài hạn', 'Long-term borrowings and financial lease liabilities'
                ], False)
                total_debt = short_term_debt + long_term_debt

                # Cash
                cash = self.find_financial_value(processed_balance, [
                    'Cash and cash equivalents', 'Tiền và các khoản tương đương tiền', 'Cash', 'Tiền'
                ], False)


                # FCFF CALCULATION
                fcff = net_income + non_cash_charges + interest_after_tax - working_capital_investment + fixed_capital_investment
                
            else:
                # Use provided stock data
                net_income = self.stock_data.get('net_income_ttm', 0)
                depreciation = self.stock_data.get('depreciation', 0)
                interest_expense = self.stock_data.get('interest_expense', 0)
                interest_after_tax = interest_expense * (1 - tax_rate)
                capex = abs(self.stock_data.get('capex', 0))
                working_capital_change = self.stock_data.get('working_capital_change', 0)
                
                total_debt = self.stock_data.get('total_debt', 0)
                cash = self.stock_data.get('cash', 0)

                fcff = net_income + depreciation + interest_after_tax - working_capital_change - capex
                
            
            # Project and discount FCFF using WACC
            future_fcffs = [fcff * ((1 + short_term_growth) ** year) for year in range(1, forecast_years + 1)]
            
            if wacc <= terminal_growth:
                adj_wacc = max(wacc, terminal_growth + 0.02)
                terminal_value_fcff = future_fcffs[-1] * (1 + terminal_growth) / (adj_wacc - terminal_growth)
            else:
                terminal_value_fcff = future_fcffs[-1] * (1 + terminal_growth) / (wacc - terminal_growth)

            pv_fcffs = [fcff_val / ((1 + wacc) ** year) for year, fcff_val in enumerate(future_fcffs, 1)]
            pv_terminal_fcff = terminal_value_fcff / ((1 + wacc) ** forecast_years)
            
            # This is ENTERPRISE VALUE (Firm Value)
            enterprise_value = sum(pv_fcffs) + pv_terminal_fcff
            
            # Calculate EQUITY VALUE
            # Equity Value = Enterprise Value - Total Debt + Cash
            equity_value = enterprise_value - total_debt + cash
            
            if shares_outstanding > 0:
                per_share_fcff = equity_value / shares_outstanding
            else:
                per_share_fcff = 0
            
            # Return detailed result for Excel export
            # Prepare detailed result for Excel export
            detailed_result = {
                'shareValue': float(per_share_fcff),
                'baseFCFF': float(fcff),
                'projectedCashFlows': [float(x) for x in future_fcffs],
                'presentValues': [float(x) for x in pv_fcffs],
                'terminalValue': float(terminal_value_fcff),
                'pvTerminal': float(pv_terminal_fcff),
                'enterpriseValue': float(enterprise_value),
                'totalDebt': float(total_debt),
                'cash': float(cash),
                'equityValue': float(equity_value),
                'sharesOutstanding': float(shares_outstanding),
                'inputs': {
                    'netIncome': float(net_income if self.stock else self.stock_data.get('net_income_ttm', 0)),
                    'depreciation': float(non_cash_charges if self.stock else self.stock_data.get('depreciation', 0)),
                    'interestExpense': float(interest_expense if self.stock else self.stock_data.get('interest_expense', 0)),
                    'interestAfterTax': float(interest_after_tax),
                    'workingCapitalInvestment': float(working_capital_investment if self.stock else self.stock_data.get('working_capital_change', 0)),
                    'fixedCapitalInvestment': float(fixed_capital_investment if self.stock else -abs(self.stock_data.get('capex', 0))),
                    # Detailed breakdown for Excel
                    'receivablesChange': float(receivables_change) if self.stock else 0,
                    'inventoriesChange': float(inventories_change) if self.stock else 0,
                    'payablesChange': float(payables_change) if self.stock else 0,
                    'shortTermDebt': float(short_term_debt) if self.stock else 0,
                    'longTermDebt': float(long_term_debt) if self.stock else 0,
                },
                'assumptions': {
                    'wacc': float(wacc),
                    'shortTermGrowth': float(short_term_growth),
                    'terminalGrowth': float(terminal_growth),
                    'forecastYears': int(forecast_years),
                    'taxRate': float(tax_rate)
                }
            }

            # LOG CALCULATION DETAILS
            if logging_enabled:
                try:
                    print(f"\n{'='*60}")
                    print(f"🏢 FCFF CALCULATION LOG: {self.stock_symbol or 'Custom Data'}")
                    print(f"{'='*60}")
                    inp = detailed_result['inputs']
                    print(f" (+) Net Income:                {inp['netIncome']:20,.0f}")
                    print(f" (+) Interest (After Tax):      {inp['interestAfterTax']:20,.0f} (Exp: {inp['interestExpense']:,.0f})")
                    print(f" (+) Depreciation:              {inp['depreciation']:20,.0f}")
                    print(f" (-) Working Capital Inv:       {inp['workingCapitalInvestment']:20,.0f}")
                    print(f" (+) Fixed Capital Inv (CapEx): {inp['fixedCapitalInvestment']:20,.0f}")
                    print(f"{'-'*60}")
                    print(f" (=) Base FCFF:                 {detailed_result['baseFCFF']:20,.0f}")
                    print(f"Enterprise Value:               {detailed_result['enterpriseValue']:20,.0f}")
                    print(f" (-) Total Debt:                {detailed_result['totalDebt']:20,.0f}")
                    print(f" (+) Cash:                      {detailed_result['cash']:20,.0f}")
                    print(f"Equity Value:                   {detailed_result['equityValue']:20,.0f}")
                    print(f"Fair Value per Share:           {detailed_result['shareValue']:20,.0f} VND")
                    print(f"{'='*60}\n")
                except Exception as e:
                    print(f"Error logging FCFF: {e}")

            return detailed_result

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'shareValue': 0, 'error': str(e)}
    
    def calculate_dividend_discount(self, assumptions):
        """
        Calculate Dividend Discount Model
        Not currently used but kept for future implementation
        """
        try:
            data = self.stock_data

            # Get assumptions
            growth_rate = assumptions.get('revenue_growth', 0.08)
            terminal_growth = assumptions.get('terminal_growth', 0.03)
            required_return = assumptions.get('required_return_equity', 0.12)

            # Get financial data
            eps = data.get('earnings_per_share', 0)
            dividend_payout_ratio = 0.3  # Assume 30% payout

            # Calculate dividend per share
            dividend_per_share = eps * dividend_payout_ratio

            # Apply Gordon Growth Model
            if required_return <= terminal_growth:
                return 0

            value_per_share = dividend_per_share * (1 + terminal_growth) / (required_return - terminal_growth)

            return value_per_share

        except Exception as e:
            return 0

    def calculate_justified_pe(self, assumptions):
        """
        Calculate Justified P/E Valuation
        Returns: value per share in VND
        """
        try:
            
            # Get assumptions
            roe = assumptions.get('roe', 0.15)
            payout_ratio = assumptions.get('payout_ratio', 0.40)
            cost_of_equity = assumptions.get('cost_of_equity', 0.12)
            data_frequency = assumptions.get('data_frequency', 'year')
            
            shares_outstanding = self.get_shares_outstanding()
            
            # Get current EPS
            if self.stock:
                income_data = self.get_cached_income_data(period=data_frequency)
                actual_freq, processed_income = self.check_data_frequency(income_data.copy(), data_frequency)
                is_quarterly = actual_freq == 'quarter'
                
                net_income = self.find_financial_value(processed_income, ['Net Profit For the Year'], is_quarterly)
                current_eps = net_income / shares_outstanding
            else:
                net_income = self.stock_data.get('net_income_ttm', 0)
                current_eps = net_income / shares_outstanding
            
            dividend_growth_rate = roe * (1 - payout_ratio)
            
            if cost_of_equity <= dividend_growth_rate:
                justified_pe = 15  # Default fallback
            else:
                justified_pe = (payout_ratio * (1 + dividend_growth_rate)) / (cost_of_equity - dividend_growth_rate)
            
            per_share_pe = justified_pe * current_eps
            
            
            return per_share_pe

        except Exception as e:
            return 0

    def calculate_justified_pb(self, assumptions):
        """
        Calculate Justified P/B Valuation - IMPROVED
        Returns: value per share in VND
        """
        try:
            
            # Get assumptions
            roe = assumptions.get('roe', 0.15)
            payout_ratio = assumptions.get('payout_ratio', 0.40)
            cost_of_equity = assumptions.get('cost_of_equity', 0.12)
            data_frequency = assumptions.get('data_frequency', 'year')
            
            shares_outstanding = self.get_shares_outstanding()
            
            # Get balance sheet data
            if self.stock:
                balance_sheet = self.get_cached_balance_data(period=data_frequency)
                _, processed_balance = self.check_data_frequency(balance_sheet.copy(), data_frequency)
                is_quarterly = processed_balance is not None
                
                
                # Try multiple equity column names (comprehensive search)
                equity_names = [
                    'Total Equity', 'Shareholders Equity', 'Total shareholders equity', 
                    'Total Shareholders Equity', 'Stockholders Equity', 'Total Stockholders Equity',
                    'Vốn chủ sở hữu', 'Tổng vốn chủ sở hữu', 'Total shareholders equity',
                    'Equity', 'Total equity', 'shareholders equity', 'stockholders equity',
                    'Owner Equity', 'Owners Equity', 'Total Owner Equity'
                ]
                
                total_equity = 0
                equity_found = False
                
                # Search for equity with case-insensitive partial matching
                for col in processed_balance.columns:
                    col_lower = str(col).lower()
                    for equity_name in equity_names:
                        if equity_name.lower() in col_lower or col_lower in equity_name.lower():
                            values = processed_balance[col]
                            if values.notna().any():
                                valid_values = values.dropna()
                                if not valid_values.empty:
                                    if data_frequency == 'quarter':
                                        total_equity = float(valid_values.sum())
                                    else:
                                        total_equity = float(valid_values.iloc[0])
                                    equity_found = True
                                    break
                    if equity_found:
                        break
                
                # If still zero, try calculating from assets - liabilities
                if total_equity == 0:
                    
                    # Find total assets
                    asset_names = ['Total Assets', 'Total assets', 'assets', 'Assets', 'Tổng tài sản']
                    total_assets = 0
                    for col in processed_balance.columns:
                        col_lower = str(col).lower()
                        for asset_name in asset_names:
                            if asset_name.lower() in col_lower or col_lower in asset_name.lower():
                                values = processed_balance[col]
                                if values.notna().any():
                                    valid_values = values.dropna()
                                    if not valid_values.empty:
                                        total_assets = float(valid_values.iloc[0])
                                        break
                        if total_assets > 0:
                            break
                    
                    # Find total liabilities
                    liability_names = ['Total Liabilities', 'Total liabilities', 'liabilities', 'Liabilities', 'Tổng nợ phải trả']
                    total_liabilities = 0
                    for col in processed_balance.columns:
                        col_lower = str(col).lower()
                        for liability_name in liability_names:
                            if liability_name.lower() in col_lower or col_lower in liability_name.lower():
                                values = processed_balance[col]
                                if values.notna().any():
                                    valid_values = values.dropna()
                                    if not valid_values.empty:
                                        total_liabilities = float(valid_values.iloc[0])
                                        break
                        if total_liabilities > 0:
                            break
                    
                    if total_assets > 0 and total_liabilities >= 0:
                        total_equity = total_assets - total_liabilities
                        
            else:
                # Use provided data
                total_equity = self.stock_data.get('total_equity', 0)
                if total_equity == 0:
                    total_assets = self.stock_data.get('total_assets', 0)
                    total_liabilities = self.stock_data.get('total_liabilities', 0)
                    total_equity = total_assets - total_liabilities
            
            if total_equity > 0:
                book_value_per_share = total_equity / shares_outstanding
                dividend_growth_rate = roe * (1 - payout_ratio)
                
                
                # Improved P/B calculation with better validation
                if cost_of_equity <= dividend_growth_rate:
                    justified_pb = 1.0  # Conservative default
                elif roe <= dividend_growth_rate:
                    justified_pb = 1.0  # Conservative default
                else:
                    justified_pb = (roe - dividend_growth_rate) / (cost_of_equity - dividend_growth_rate)
                
                per_share_pb = justified_pb * book_value_per_share
                
                
                return per_share_pb
            else:
                return 0
                
        except Exception as e:
            return 0
# Export the class
if __name__ == "__main__":
    # Testing
    mock_data = {
        'revenue_ttm': 2000000000000,    # 2T VND
        'net_income_ttm': 200000000000,  # 200B VND
        'ebit': 300000000000,            # 300B VND
        'ebitda': 400000000000,          # 400B VND
        'total_assets': 10000000000000,  # 10T VND
        'total_debt': 3000000000000,     # 3T VND
        'total_liabilities': 6000000000000, # 6T VND
        'cash': 1000000000000,           # 1T VND
        'depreciation': 100000000000,    # 100B VND
        'fcfe': 150000000000,            # 150B VND
        'capex': -200000000000,          # -200B VND
        'shares_outstanding': 1000000000,
    }

    default_assumptions = {
        'revenue_growth': 0.08,
        'terminal_growth': 0.03,
        'wacc': 0.10,
        'required_return_equity': 0.12,
        'tax_rate': 0.20,
        'projection_years': 5,
        'model_weights': {'dcf': 0.5, 'fcfe': 0.5}
    }

    models = ValuationModels(mock_data)
    results = models.calculate_all_models(default_assumptions)

    for model, value in results.items():
        pass
