"""
Script to generate sector_peers.json using frontend/ticker_data.json as the Source of Truth for Industry/Sector.
This ensures consistent industry naming across the application.
"""

import os
import json
import numpy as np
from collections import defaultdict

def generate_sector_peers_from_ticker_data():
    """
    Generate sector peers using ticker_data.json for industry classification
    """
    print("="*60)
    print("GENERATING SECTOR PEERS FROM TICKER_DATA.JSON")
    print("="*60)
    
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    # Step 1: Load ticker_data.json (Source of Truth for Sectors)
    ticker_file = os.path.join(base_path, 'frontend', 'ticker_data.json')
    print(f"\n📋 Step 1: Loading ticker data from {ticker_file}...")
    
    if not os.path.exists(ticker_file):
        print(f"   ❌ Error: {ticker_file} not found!")
        return None
        
    try:
        with open(ticker_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Check for "tickers" key (as seen in file view)
            if isinstance(data, dict) and 'tickers' in data:
                all_tickers = data['tickers']
            elif isinstance(data, list):
                all_tickers = data
            else:
                print(f"   ❌ Unknown format in ticker_data.json. Keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
                return None
            
            print(f"   ✓ Loaded {len(all_tickers)} tickers")
    except Exception as e:
        print(f"   ❌ Error reading ticker_data.json: {e}")
        return None

    # Step 2: Load P/E, P/B from local JSON files
    print("\n📋 Step 2: Loading P/E, P/B from local JSON files...")
    stocks_folder = os.path.join(base_path, 'stocks')
    
    local_stocks = {}
    if os.path.exists(stocks_folder):
        for filename in os.listdir(stocks_folder):
            if filename.endswith('.json'):
                symbol = filename.replace('.json', '')
                try:
                    with open(os.path.join(stocks_folder, filename), 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        local_stocks[symbol] = {
                            'pe_ratio': data.get('pe_ratio'),
                            'pb_ratio': data.get('pb_ratio'),
                            'market_cap': data.get('market_cap', 0) or 0
                        }
                except:
                    pass
        print(f"   ✓ Loaded {len(local_stocks)} stocks from local JSON files")
    else:
        print(f"   ⚠️ No local stocks folder found")

    # Step 3: Build sector data
    print("\n📋 Step 3: Building sector data...")
    sectors = defaultdict(list)
    no_data_count = 0
    skipped_no_sector = 0
    
    # Map tickers to their sectors using ticker_data.json
    for ticker_info in all_tickers:
        symbol = ticker_info.get('symbol')
        # Use 'industry' or 'sector' key, depend on file structure. Assuming 'industry' based on previous context or 'sector'
        # Let's check both or prioritize one
        sector = ticker_info.get('sector') or ticker_info.get('industry')
        
        if not symbol or not sector:
            if symbol and not sector:
                skipped_no_sector += 1
            continue
            
        # Standardize sector name if essential (optional)
        
        # Get financial metrics from local data
        stock_data = local_stocks.get(symbol, {})
        pe = stock_data.get('pe_ratio')
        pb = stock_data.get('pb_ratio')
        mcap = stock_data.get('market_cap', 0)
        
        if pe and pb and pe > 0 and pb > 0:
            sectors[sector].append({
                'symbol': symbol,
                'market_cap': float(mcap) if mcap else 0,
                'pe_ratio': float(pe),
                'pb_ratio': float(pb)
            })
        else:
            no_data_count += 1

    print(f"   ✓ Processed stocks into {len(sectors)} sectors")
    print(f"   ⚠️ {skipped_no_sector} tickers skipped due to missing sector info")
    print(f"   ⚠️ {no_data_count} tickers skipped due to missing P/E or P/B data")

    # Step 4: Calculate Medians
    print("\n📋 Step 4: Calculating sector medians...")
    sector_peers = {}
    
    for sector_name, stocks in sectors.items():
        if not stocks:
            continue
            
        # Sort by market cap
        stocks.sort(key=lambda x: x['market_cap'], reverse=True)
        top_10 = stocks[:10]
        
        all_pe = [s['pe_ratio'] for s in stocks]
        all_pb = [s['pb_ratio'] for s in stocks]
        
        median_pe = float(np.median(all_pe))
        median_pb = float(np.median(all_pb))
        
        peers = []
        for s in top_10:
            peers.append({
                'symbol': s['symbol'],
                'market_cap': s['market_cap'],
                'pe_ratio': round(s['pe_ratio'], 2),
                'pb_ratio': round(s['pb_ratio'], 2)
            })
            
        sector_peers[sector_name] = {
            'median_pe': round(median_pe, 2),
            'median_pb': round(median_pb, 2),
            'peer_count': len(top_10),
            'total_in_sector': len(stocks),
            'peers': peers
        }

    # Step 5: Save and Summary
    print("\n" + "="*60)
    print("SECTOR SUMMARY")
    print("="*60)
    print(f"{'Sector':<40} {'Total':>6} {'Peers':>6} {'Med P/E':>10} {'Med P/B':>10}")
    print("-"*72)
    
    for sector, data in sorted(sector_peers.items(), key=lambda x: x[1]['total_in_sector'], reverse=True):
        print(f"{sector[:40]:<40} {data['total_in_sector']:>6} {data['peer_count']:>6} {data['median_pe']:>10.2f} {data['median_pb']:>10.2f}")
    
    base_path = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(base_path, 'sector_peers.json')
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sector_peers, f, ensure_ascii=False, indent=2)
        
    print(f"\n✅ Saved to: {output_file}")
    return output_file

if __name__ == "__main__":
    generate_sector_peers_from_ticker_data()
