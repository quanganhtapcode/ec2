"""
Script tải financial statements từ VietCap IQ cho tất cả cổ phiếu trong stock_data
Author: quanganhdeptrai
Date: 2025-11-26
"""

import requests
import time
import os
import json
from pathlib import Path

# ============================================
# CẤU HÌNH - CẬP NHẬT TOKEN MỚI Ở ĐÂY
# ============================================
BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJyb2xlIjoiVVNFUiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwic2Vzc2lvbl9pZCI6Ijk4MjAyMDczLTllN2EtNDFmMS1hMjc5LTlhZTJjOGQ0NmM5OSIsImNsaWVudF90eXBlIjoxLCJ1dWlkIjoiMTc2NDE2MTczMy0xZmI3MzQ5NS05YmVmLTRmOGQtODMzNS03YzUwZWJjZDE2ZDgiLCJjdXN0b21lck5hbWUiOiJMw6ogUXVhbmcgQW5oIiwiY2xpZW50X2lkIjoiYTY3MDkxNGMtODk2NC00YjJjLWEyODktNmRlNGQ1YjlkMmM0IiwidXNlcl90eXBlIjoiSU5ESVZJRFVBTCIsImFjY291bnRObyI6IjA2OEM1MDI1NTIiLCJwaG9uZV9udW1iZXIiOiIwODEzNjAxMDU0IiwiZW1haWwiOiJxdWFuZ2FuaC5pYmRAZ21haWwuY29tIiwidXNlcm5hbWUiOiIwNjhjNTAyNTUyIiwiaWF0IjoxNzY0MTYxNzMzLCJleHAiOjE3NjQxNjg5MzN9.Eav4hC_F5yQUGra6QknERP9HF8UYove46jbBzaGntvASPJ3s3DqzcjWcWEED7zvCuKaffpSVcV68s4YbdH3l6CpWRxE3N-RT_nK-jr2nPjuVSCrsjZmLVdBuk9VSd3sIn-Mv2s3beByxz8EF-Ge5bIXmpdoXuwQQDmiRPUikvQDBUCpWMciZTrW3kjnv1JC8qvsdrKPvupGfnGih_RXSupEvvYjmCTHC7cm_X0Jeeo_FfzQ_fjymDu1s5AqQbNfOL7I6nup55Z2kejb4Tb47GUPCBwsbUPnmnwqranAuM9fYLQ94ScQcUZWugfeC4xZHnkK0DTrC8Z9MIBYrwzatuA'

# Headers
HEADERS = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7',
    'Authorization': f'Bearer {BEARER_TOKEN}',
    'Connection': 'keep-alive',
    'Origin': 'https://trading.vietcap.com.vn',
    'Referer': 'https://trading.vietcap.com.vn/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
}

# Thư mục output
OUTPUT_DIR = 'vietcap_financial_statements'
STOCK_DATA_DIR = 'stock_data'

# Delay giữa các requests (seconds)
REQUEST_DELAY = 1
BATCH_SIZE = 50  # Pause sau mỗi 50 requests


def get_all_tickers():
    """Lấy danh sách tất cả ticker từ stock_data folder"""
    stock_data_path = Path(STOCK_DATA_DIR)
    
    if not stock_data_path.exists():
        print(f'❌ Không tìm thấy folder: {STOCK_DATA_DIR}')
        return []
    
    tickers = []
    for json_file in stock_data_path.glob('*.json'):
        # Lấy ticker từ tên file (VD: VCB.json -> VCB)
        ticker = json_file.stem
        tickers.append(ticker)
    
    return sorted(tickers)


def download_financial_statement(ticker, output_dir):
    """
    Tải financial statement cho 1 ticker
    
    Returns:
        tuple: (success: bool, file_size_kb: float, error_msg: str)
    """
    url = f'https://iq.vietcap.com.vn/api/iq-insight-service/v1/company/{ticker}/financial-statement/export'
    params = {'language': '1'}  # 1 = Tiếng Việt, 0 = English
    
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=30)
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            content_length = len(response.content)
            
            # Kiểm tra file Excel
            is_excel = (
                'spreadsheet' in content_type.lower() or 
                'excel' in content_type.lower() or
                'application/vnd.openxmlformats' in content_type.lower() or
                'application/octet-stream' in content_type.lower() or
                content_length > 1000
            )
            
            if is_excel or content_length > 1000:
                filename = os.path.join(output_dir, f'{ticker}.xlsx')
                with open(filename, 'wb') as f:
                    f.write(response.content)
                file_size_kb = content_length / 1024
                return True, file_size_kb, None
            else:
                return False, 0, 'Not Excel file'
                
        elif response.status_code == 401:
            return False, 0, '401 - Token expired'
            
        elif response.status_code == 404:
            return False, 0, '404 - Not found'
            
        else:
            return False, 0, f'{response.status_code} - {response.text[:100]}'
    
    except Exception as e:
        return False, 0, f'Exception: {str(e)}'


def save_progress(success_list, failed_list, progress_file='download_progress.json'):
    """Lưu tiến trình download"""
    progress = {
        'success': success_list,
        'failed': failed_list,
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    with open(progress_file, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


def main():
    print('='*70)
    print('  📊 VIETCAP FINANCIAL STATEMENT DOWNLOADER')
    print('='*70)
    print()
    
    # Tạo thư mục output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f'✓ Output folder: {os.path.abspath(OUTPUT_DIR)}')
    
    # Lấy danh sách tickers
    tickers = get_all_tickers()
    total = len(tickers)
    
    if total == 0:
        print('❌ Không tìm thấy file JSON nào trong stock_data/')
        return
    
    print(f'✓ Tìm thấy {total} cổ phiếu trong {STOCK_DATA_DIR}/')
    print()
    
    # Confirm trước khi download
    print(f'⚠️  Sẽ tải {total} files Excel (có thể mất ~{total * REQUEST_DELAY / 60:.0f} phút)')
    confirm = input('Tiếp tục? (y/n): ').strip().lower()
    
    if confirm != 'y':
        print('Đã hủy.')
        return
    
    print()
    print('='*70)
    print('BẮT ĐẦU DOWNLOAD...')
    print('='*70)
    print()
    
    # Download
    success_list = []
    failed_list = []
    start_time = time.time()
    
    for i, ticker in enumerate(tickers, 1):
        print(f'[{i:3d}/{total}] {ticker:6s}', end=' ... ')
        
        success, file_size, error = download_financial_statement(ticker, OUTPUT_DIR)
        
        if success:
            print(f'✓ {file_size:7.1f} KB')
            success_list.append(ticker)
        else:
            print(f'✗ {error}')
            failed_list.append({'ticker': ticker, 'error': error})
            
            # Dừng nếu token hết hạn
            if '401' in str(error):
                print()
                print('='*70)
                print('❌ TOKEN HẾT HẠN!')
                print('='*70)
                print()
                print('Vui lòng làm theo các bước sau:')
                print('1. Mở https://iq.vietcap.com.vn/ trong Chrome')
                print('2. Đăng nhập nếu cần')
                print('3. F12 → Network tab')
                print('4. Click download bất kỳ financial statement nào')
                print('5. Tìm request "export?language=1"')
                print('6. Copy Bearer token từ Authorization header')
                print('7. Cập nhật BEARER_TOKEN trong file này')
                print('8. Chạy lại script')
                print()
                break
        
        # Save progress mỗi 10 files
        if i % 10 == 0:
            save_progress(success_list, failed_list)
        
        # Pause sau mỗi batch
        if i % BATCH_SIZE == 0 and i < total:
            print()
            print(f'⏸️  Pause 5 giây sau {BATCH_SIZE} requests...')
            time.sleep(5)
            print()
        
        # Delay giữa các requests
        if i < total:
            time.sleep(REQUEST_DELAY)
    
    # Save final progress
    save_progress(success_list, failed_list)
    
    # Tóm tắt kết quả
    elapsed = time.time() - start_time
    print()
    print('='*70)
    print('KẾT QUẢ')
    print('='*70)
    print(f'✓ Thành công: {len(success_list)}/{total} cổ phiếu')
    print(f'✗ Thất bại:   {len(failed_list)}/{total} cổ phiếu')
    print(f'⏱️  Thời gian:   {elapsed/60:.1f} phút')
    print()
    
    if failed_list:
        print('Danh sách lỗi:')
        for item in failed_list[:10]:  # Hiển thị 10 lỗi đầu
            print(f'  - {item["ticker"]}: {item["error"]}')
        if len(failed_list) > 10:
            print(f'  ... và {len(failed_list) - 10} lỗi khác')
        print()
    
    # Thống kê files
    total_size = 0
    file_count = 0
    for file in os.listdir(OUTPUT_DIR):
        if file.endswith('.xlsx'):
            filepath = os.path.join(OUTPUT_DIR, file)
            total_size += os.path.getsize(filepath)
            file_count += 1
    
    print(f'📁 Files: {file_count} files, {total_size/1024/1024:.1f} MB')
    print(f'📂 Location: {os.path.abspath(OUTPUT_DIR)}')
    print()
    print('✅ HOÀN THÀNH!')
    print('='*70)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        print()
        print('='*70)
        print('⚠️  ĐÃ DỪNG BỞI NGƯỜI DÙNG (Ctrl+C)')
        print('='*70)
        print()
        print('Tiến trình đã được lưu vào download_progress.json')
        print('Bạn có thể chạy lại script để tiếp tục.')
    except Exception as e:
        print()
        print('='*70)
        print(f'❌ LỖI: {str(e)}')
        print('='*70)
        import traceback
        traceback.print_exc()
