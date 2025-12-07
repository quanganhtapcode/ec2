import os
import json
from datetime import datetime

# Adjust paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STOCKS_DIR = os.path.join(BASE_DIR, 'stocks')
LIST_FILE = os.path.join(BASE_DIR, 'stock_list.json')

def generate_stock_list():
    if not os.path.exists(STOCKS_DIR):
        print(f"Error: Directory '{STOCKS_DIR}' not found.")
        return

    # Scan directory
    files = [f for f in os.listdir(STOCKS_DIR) if f.endswith('.json')]
    symbols = sorted([f.replace('.json', '').upper() for f in files])
    
    data = {
        "last_updated": datetime.now().isoformat(),
        "count": len(symbols),
        "symbols": symbols
    }
    
    try:
        with open(LIST_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Success! Created '{LIST_FILE}' with {len(symbols)} symbols.")
    except Exception as e:
        print(f"Error writing file: {e}")

if __name__ == "__main__":
    generate_stock_list()
