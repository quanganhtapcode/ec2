"""
Script to UPDATE stock data (JSON) based on 'stock_list.json'.
Location: scripts/update_json_data.py
Logic:
1. Backup existing 'stocks/' folder to 'backups/'.
2. Load symbols from '../stock_list.json'.
3. Fetch fresh data from VnStock.
4. Overwrite files in '../stocks/' on success.
"""

import warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

import pandas as pd
import numpy as np
import json
import os
import sys
import time
import shutil
from datetime import datetime
from vnstock import Vnstock

# Adjust paths relative to this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STOCKS_DIR = os.path.join(BASE_DIR, 'stocks')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LIST_FILE = os.path.join(BASE_DIR, 'stock_list.json')

# Monkey-patch sys.exit
original_exit = sys.exit
def safe_exit(code=0):
    raise SystemExit(f"Exit called with code: {code}")
sys.exit = safe_exit

class StockUpdater:
    def __init__(self):
        self.vnstock = Vnstock()
        
        # Rate limiting settings
        self.requests_per_minute = 35
        self.delay_between_requests = 1.6
        self.max_retries = 3
        
        # Ensure directories exist
        if not os.path.exists(STOCKS_DIR):
            os.makedirs(STOCKS_DIR)
        if not os.path.exists(BACKUP_DIR):
            os.makedirs(BACKUP_DIR)

    def backup_existing_data(self):
        """Create a backup of the current stocks folder"""
        if not os.listdir(STOCKS_DIR):
            print("Stocks directory is empty. No backup needed.")
            return

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, f'stocks_backup_{timestamp}')
        
        print(f"Creating backup at: {backup_path} ...", end=" ")
        try:
            shutil.copytree(STOCKS_DIR, backup_path)
            print("DONE")
        except Exception as e:
            print(f"FAILED: {e}")

    def load_target_symbols(self):
        """Load symbols from stock_list.json"""
        if not os.path.exists(LIST_FILE):
            print(f"'{LIST_FILE}' not found. Please run generate_stock_list.py first.")
            return []
        
        try:
            with open(LIST_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                symbols = data.get('symbols', [])
                print(f"Loaded {len(symbols)} symbols from master list.")
                return sorted(symbols)
        except Exception as e:
            print(f"Error loading list file: {e}")
            return []

    def fetch_stock_data(self, symbol):
        """Fetch comprehensive data for a single stock (Annual/Yearly)"""
        try:
            stock = self.vnstock.stock(symbol=symbol, source='VCI')
            
            # 1. Overview
            try:
                overview = stock.company.overview()
                overview_data = overview.iloc[0].to_dict() if not overview.empty else {}
            except: overview_data = {}

            # 2. Ratios
            ratios_df = pd.DataFrame()
            try:
                ratios_df = stock.finance.ratio(period='year', lang='en', dropna=True)
                if ratios_df.empty:
                    ratios_df = stock.finance.ratio(period='year', lang='vn', dropna=True)
            except: pass

            # 3. Statements
            income_df = pd.DataFrame()
            balance_df = pd.DataFrame()
            try:
                income_df = stock.finance.income_statement(period='year', lang='en', dropna=True)
                balance_df = stock.finance.balance_sheet(period='year', lang='en', dropna=True)
            except: pass
            
            if ratios_df.empty and income_df.empty:
                return None

            # 4. Construct Data
            data = {
                "symbol": symbol,
                "name": overview_data.get('organ_name', symbol),
                "sector": overview_data.get('industry', ''),
                "industry": overview_data.get('industry', ''),
                "exchange": overview_data.get('exchange', ''),
                "last_updated": datetime.now().isoformat(),
                "data_source": "VNSTOCK_V3"
            }

            def get_latest(df, col_candidates):
                if df.empty: return None
                row = df.iloc[0]
                for col in col_candidates:
                    if col in row and pd.notna(row[col]):
                        try: return float(row[col])
                        except: return row[col]
                return None

            if not ratios_df.empty:
                data['roe'] = get_latest(ratios_df, ['ROE (%)', 'roe'])
                data['roa'] = get_latest(ratios_df, ['ROA (%)', 'roa'])
                data['pe_ratio'] = get_latest(ratios_df, ['P/E', 'pe'])
                data['pb_ratio'] = get_latest(ratios_df, ['P/B', 'pb'])
                data['eps'] = get_latest(ratios_df, ['EPS (VND)', 'eps'])
                data['book_value_per_share'] = get_latest(ratios_df, ['BVPS (VND)', 'bvps'])
                data['market_cap'] = get_latest(ratios_df, ['Market Capital (Bn. VND)', 'market_cap'])
            
            if not income_df.empty:
                data['revenue'] = get_latest(income_df, ['Revenue', 'Doanh thu thuần', 'revenue'])
                data['net_income'] = get_latest(income_df, ['Net profit', 'Lợi nhuận sau thuế', 'net_income'])
            
            if not balance_df.empty:
                data['total_assets'] = get_latest(balance_df, ['Total assets', 'Tổng tài sản', 'total_assets'])
                data['total_equity'] = get_latest(balance_df, ["Owner's equity", 'Vốn chủ sở hữu', 'total_equity'])
                data['total_debt'] = get_latest(balance_df, ['Total liabilities', 'Nợ phải trả', 'total_debt'])
            
            # Historical
            historical = {
                "years": [], "revenue": [], "net_income": [], 
                "roe": [], "roa": [], "pe": [], "pb": []
            }
            
            if not ratios_df.empty:
                year_col = None
                for c in ratios_df.columns:
                    col_str = c[1] if isinstance(c, tuple) else c
                    if col_str in ['yearReport', 'Year']:
                        year_col = c
                        break
                if year_col:
                    df_sorted = ratios_df.sort_values(by=year_col, ascending=True)
                    historical['years'] = df_sorted[year_col].tolist()
                    def get_series(df, keys):
                        for k in keys:
                            if k in df.columns: return df[k].fillna(0).tolist()
                        return []
                    historical['roe'] = get_series(df_sorted, ['ROE (%)', 'roe'])
                    historical['roa'] = get_series(df_sorted, ['ROA (%)', 'roa'])
                    historical['pe'] = get_series(df_sorted, ['P/E', 'pe'])
                    historical['pb'] = get_series(df_sorted, ['P/B', 'pb'])
            
            data['historical'] = historical
            
            def clean_nan(obj):
                if isinstance(obj, dict): return {k: clean_nan(v) for k,v in obj.items()}
                if isinstance(obj, list): return [clean_nan(v) for v in obj]
                if pd.isna(obj): return None
                return obj
            
            return clean_nan(data)

        except Exception as e:
            return None

    def save_json(self, symbol, data):
        path = os.path.join(STOCKS_DIR, f"{symbol}.json")
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except:
            return False

    def run(self):
        print("="*60)
        print("JORDAN STOCK UPDATER (JSON)")
        print("="*60)
        
        # 1. Backup
        self.backup_existing_data()
        
        # 2. Load List
        symbols = self.load_target_symbols()
        if not symbols:
            return

        print(f"Target Queue: {len(symbols)} stocks")
        
        success_count = 0
        fail_count = 0
        
        # 3. Update Loop
        for idx, symbol in enumerate(symbols):
            print(f"Updating {symbol} [{idx+1}/{len(symbols)}]...", end='', flush=True)
            
            retry = 0
            fetched = False
            while retry < self.max_retries:
                try:
                    data = self.fetch_stock_data(symbol)
                    if data:
                        self.save_json(symbol, data) # OVERWRITE
                        print(" OK")
                        success_count += 1
                        fetched = True
                    else:
                        print(" No Data")
                        fail_count += 1
                    break
                except Exception as e:
                    retry += 1
                    print(f" Retry({retry})...", end='', flush=True)
                    time.sleep(2)
            
            if not fetched and retry == self.max_retries:
                print(" FAILED")
                fail_count += 1
            
            time.sleep(self.delay_between_requests)
            
            if (idx + 1) % 50 == 0:
                print(f"--- Progress: {idx+1}/{len(symbols)} (OK: {success_count}) ---")

        print("="*60)
        print(f"Completed! Updated: {success_count}, Failed: {fail_count}")

if __name__ == "__main__":
    updater = StockUpdater()
    updater.run()
