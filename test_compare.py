"""Update VCB.json with hybrid data approach"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.update_json_data import StockUpdater
import json

updater = StockUpdater()
print("Fetching VCB data with hybrid approach (Year + Quarter)...")
data, rate_limit = updater.fetch_stock_data('VCB')

if data:
    # Save to VCB.json
    with open('stocks/VCB.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("\n✅ VCB.json updated successfully!")
    print("\n=== KEY DATA ===")
    print(f"P/E (quarter): {data.get('pe_ratio', 'N/A')}")
    print(f"P/B (quarter): {data.get('pb_ratio', 'N/A')}")
    print(f"ROE (quarter): {data.get('roe', 'N/A')}%")
    print(f"ROA (quarter): {data.get('roa', 'N/A')}%")
    print(f"BVPS (quarter): {data.get('bvps', 'N/A'):,.0f}" if data.get('bvps') else "BVPS: N/A")
    print(f"Shares (quarter): {data.get('shares_outstanding', 'N/A'):,.0f}" if data.get('shares_outstanding') else "Shares: N/A")
    print(f"EPS (year): {data.get('eps', 'N/A'):,.0f}" if data.get('eps') else "EPS: N/A")
    print(f"Net Income (year): {data.get('net_income', 0)/1e12:.2f}T")
    print(f"Revenue (year): {data.get('revenue', 0)/1e12:.2f}T")
else:
    print(f"❌ Failed to fetch data. Rate limit: {rate_limit}")
