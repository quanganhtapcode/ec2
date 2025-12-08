"""
Generate a complete ticker list with company names from vnstock API.
Includes all exchanges: HSX (HOSE), HNX, and UPCOM.
Output: ticker_data.json containing symbol, name, sector, and exchange for autocomplete.
"""
import json
from pathlib import Path
from datetime import datetime

def generate_ticker_list_from_api():
    """
    Fetch complete stock list from vnstock API.
    Returns list of tickers with symbol, name, sector, exchange.
    """
    try:
        from vnstock import Listing
        listing = Listing()
        
        # Get complete list with exchange info
        # symbols_by_exchange() returns: symbol, exchange, type, organ_short_name, organ_name, product_grp_id
        df = listing.symbols_by_exchange()
        
        # Filter only STOCK type (exclude futures, bonds, etc.)
        df_stocks = df[df['type'] == 'STOCK'].copy()
        
        # Filter only active exchanges (HSX, HNX, UPCOM) - exclude DELISTED
        active_exchanges = ['HSX', 'HNX', 'UPCOM']
        df_active = df_stocks[df_stocks['exchange'].isin(active_exchanges)]
        
        # Get industry info for sector
        try:
            df_icb = listing.symbols_by_industries()
            # Create a mapping of symbol to icb_name2 (sector)
            sector_map = dict(zip(df_icb['symbol'], df_icb['icb_name2']))
        except Exception as e:
            print(f"Warning: Could not load industry data: {e}")
            sector_map = {}
        
        ticker_list = []
        for _, row in df_active.iterrows():
            ticker_info = {
                "symbol": row['symbol'],
                "name": row['organ_name'] or "",
                "sector": sector_map.get(row['symbol'], ""),
                "exchange": row['exchange']
            }
            ticker_list.append(ticker_info)
        
        print(f"✅ Fetched {len(ticker_list)} tickers from vnstock API")
        print(f"   - HSX: {len(df_active[df_active['exchange'] == 'HSX'])} stocks")
        print(f"   - HNX: {len(df_active[df_active['exchange'] == 'HNX'])} stocks")
        print(f"   - UPCOM: {len(df_active[df_active['exchange'] == 'UPCOM'])} stocks")
        
        return ticker_list
        
    except ImportError:
        print("⚠️ vnstock not installed, falling back to local JSON files")
        return None
    except Exception as e:
        print(f"⚠️ Error fetching from API: {e}")
        return None


def generate_ticker_list_from_local():
    """
    Fallback: Generate ticker list from local stock JSON files.
    """
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    stocks_dir = project_root / "stocks"
    
    ticker_list = []
    
    # Read all JSON files in stocks directory
    for json_file in sorted(stocks_dir.glob("*.json")):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            ticker_info = {
                "symbol": data.get("symbol", json_file.stem),
                "name": data.get("name", ""),
                "sector": data.get("sector", ""),
                "exchange": data.get("exchange", "")
            }
            ticker_list.append(ticker_info)
            
        except Exception as e:
            print(f"Error reading {json_file.name}: {e}")
            ticker_list.append({
                "symbol": json_file.stem,
                "name": "",
                "sector": "",
                "exchange": ""
            })
    
    print(f"📁 Loaded {len(ticker_list)} tickers from local JSON files")
    return ticker_list


def generate_ticker_list():
    """Main function to generate ticker list."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_file = project_root / "frontend" / "ticker_data.json"
    
    # Try API first, fallback to local files
    ticker_list = generate_ticker_list_from_api()
    
    if ticker_list is None or len(ticker_list) == 0:
        ticker_list = generate_ticker_list_from_local()
    
    # Sort by symbol
    ticker_list.sort(key=lambda x: x["symbol"])
    
    # Create output data
    output_data = {
        "last_updated": datetime.now().isoformat(),
        "count": len(ticker_list),
        "tickers": ticker_list
    }
    
    # Write to output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 Generated {output_file} with {len(ticker_list)} tickers")
    return ticker_list


if __name__ == "__main__":
    generate_ticker_list()
