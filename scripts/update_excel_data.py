"""
Script to UPDATE financial Excel data based on 'stock_list.json'.
Location: scripts/update_excel_data.py
Logic:
1. Backup existing 'data/' folder to 'backups/'.
2. Load symbols from '../stock_list.json'.
3. Download new Excel files from VietCap.
4. Overwrite files in '../data/'.
"""

import requests
import time
import os
import json
import sys
import shutil
from pathlib import Path

# Adjust paths relative to this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data') # Excel files
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LIST_FILE = os.path.join(BASE_DIR, 'stock_list.json')

# ============================================
# CẤU HÌNH - CẬP NHẬT TOKEN MỚI Ở ĐÂY
# ============================================
BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJyb2xlIjoiVVNFUiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwic2Vzc2lvbl9pZCI6Ijk4MjAyMDczLTllN2EtNDFmMS1hMjc5LTlhZTJjOGQ0NmM5OSIsImNsaWVudF90eXBlIjoxLCJ1dWlkIjoiMTc2NDE2MTczMy0xZmI3MzQ5NS05YmVmLTRmOGQtODMzNS03YzUwZWJjZDE2ZDgiLCJjdXN0b21lck5hbWUiOiJMw6ogUXVhbmcgQW5oIiwiY2xpZW50X2lkIjoiYTY3MDkxNGMtODk2NC00YjJjLWEyODktNmRlNGQ1YjlkMmM0IiwidXNlcl90eXBlIjoiSU5ESVZJRFVBTCIsImFjY291bnRObyI6IjA2OEM1MDI1NTIiLCJwaG9uZV9udW1iZXIiOiIwODEzNjAxMDU0IiwiZW1haWwiOiJxdWFuZ2FuaC5pYmRAZ21haWwuY29tIiwidXNlcm5hbWUiOiIwNjhjNTAyNTUyIiwiaWF0IjoxNzY0MTYxNzMzLCJleHAiOjE3NjQxNjg5MzN9.Eav4hC_F5yQUGra6QknERP9HF8UYove46jbBzaGntvASPJ3s3DqzcjWcWEED7zvCuKaffpSVcV68s4YbdH3l6CpWRxE3N-RT_nK-jr2nPjuVSCrsjZmLVdBuk9VSd3sIn-Mv2s3beByxz8EF-Ge5bIXmpdoXuwQQDmiRPUikvQDBUCpWMciZTrW3kjnv1JC8qvsdrKPvupGfnGih_RXSupEvvYjmCTHC7cm_X0Jeeo_FfzQ_fjymDu1s5AqQbNfOL7I6nup55Z2kejb4Tb47GUPCBwsbUPnmnwqranAuM9fYLQ94ScQcUZWugfeC4xZHnkK0DTrC8Z9MIBYrwzatuA'

HEADERS = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7',
    'Authorization': f'Bearer {BEARER_TOKEN}',
    'Connection': 'keep-alive',
    'Origin': 'https://trading.vietcap.com.vn',
    'Referer': 'https://trading.vietcap.com.vn/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
}

REQUEST_DELAY = 1.2
BATCH_SIZE = 50

def backup_data_folder():
    """Backup data folder"""
    if not os.path.exists(DATA_DIR) or not os.listdir(DATA_DIR):
        print("Data directory is empty/missing. No backup needed.")
        return

    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

    timestamp = time.strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'data_excel_backup_{timestamp}')
    
    print(f"Creating Excel backup at: {backup_path} ...", end=" ")
    try:
        shutil.copytree(DATA_DIR, backup_path)
        print("DONE")
    except Exception as e:
        print(f"FAILED: {e}")

def get_target_tickers():
    """Load tickers from stock_list.json"""
    if not os.path.exists(LIST_FILE):
        print(f'❌ List file not found: {LIST_FILE}')
        return []
    
    try:
        with open(LIST_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            tickers = data.get('symbols', [])
            return sorted(tickers)
    except Exception as e:
        print(f'❌ Error loading list: {e}')
        return []

def download_financial_statement(ticker, output_dir):
    """Download financial statement for a ticker"""
    url = f'https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/{ticker}/financial-statement/export' 
    params = {'language': '1'}  # 1 = Tiếng Việt
    
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=30)
        
        if response.status_code == 200:
            content_length = len(response.content)
            if content_length > 1000:
                filename = os.path.join(output_dir, f'{ticker}.xlsx')
                with open(filename, 'wb') as f:
                    f.write(response.content)
                return True, content_length / 1024, None
            else:
                return False, 0, 'File too small'
        elif response.status_code == 401:
            return False, 0, '401 - Token Expired'
        elif response.status_code == 404:
            return False, 0, '404 - Not Found'
        else:
            return False, 0, f'Error {response.status_code}'
    except Exception as e:
        return False, 0, f'Connection Error: {str(e)}'

def main():
    print('='*70)
    print('  📊 VIETCAP EXCEL UPDATER')
    print('='*70)
    
    # 1. Check directories
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # 2. Backup
    backup_data_folder()

    # 3. Load List
    tickers = get_target_tickers()
    if not tickers:
        return

    print(f'✓ Found {len(tickers)} tickers to update.')
    print('\nSTARTING UPDATE...\n')
    
    success_count = 0
    fail_count = 0
    
    for i, ticker in enumerate(tickers, 1):
        print(f'[{i}/{len(tickers)}] {ticker} ...', end=' ', flush=True)
        
        # Always download (Overwrite mode)
        success, size, error = download_financial_statement(ticker, DATA_DIR)
        
        if success:
            print(f'OK ({size:.1f} KB)')
            success_count += 1
        else:
            print(f'FAILED ({error})')
            fail_count += 1
            if '401' in str(error):
                print('\n❌ STOP: TOKEN EXPIRED. Please update token in script.')
                break
        
        time.sleep(REQUEST_DELAY)
        
        if i % BATCH_SIZE == 0:
            print(f'--- Processed {i} tickers... Pausing 3s ---')
            time.sleep(3)

    print('\n' + '='*70)
    print(f'COMPLETED! Success: {success_count} | Failed: {fail_count}')
    print('='*70)

if __name__ == '__main__':
    main()
