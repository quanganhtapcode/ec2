"""
Script to generate sector_peers.json from vnstock Screener API or local JSON files
Gets real-time P/E, P/B, market cap for accurate sector comparable analysis
Run this periodically (daily/weekly) to update the data
"""

import os
import json
import numpy as np
from collections import defaultdict

def generate_sector_peers_from_screener():
    """Generate sector peers data from vnstock Screener API (real-time)"""
    
    # Try multiple import methods for different vnstock versions
    df = None
    
    # Method 1: vnstock 3.3.0+ Screener
    try:
        from vnstock import Screener
        print("Using vnstock Screener class...")
        screener = Screener()
        # Try different parameter formats
        try:
            df = screener.stock(params={"exchangeName": "HOSE,HNX,UPCOM"}, limit=1700)
        except Exception as e1:
            print(f"Method 1 failed: {e1}")
            try:
                # Try without params
                df = screener.stock(limit=1700)
            except Exception as e2:
                print(f"Method 1b failed: {e2}")
    except ImportError:
        print("Screener class not found in vnstock")
    
    # Method 2: Try using vnstock.Explorer
    if df is None:
        try:
            from vnstock import Vnstock
            print("Using Vnstock.stock().listing approach...")
            stock = Vnstock().stock(symbol='VNM', source='VCI')
            # Get all symbols from listing
            listing_df = stock.listing.symbols_by_industries()
            if listing_df is not None and not listing_df.empty:
                df = listing_df
                print(f"Got {len(df)} stocks from listing")
        except Exception as e:
            print(f"Method 2 failed: {e}")
    
    # Method 3: Use stock screener with different approach
    if df is None:
        try:
            from vnstock import MSNComponents
            print("Using MSN Components...")
            msn = MSNComponents()
            df = msn.stock_screener()
        except Exception as e:
            print(f"Method 3 failed: {e}")
    
    if df is None or df.empty:
        raise Exception("All API methods failed. Use --json flag to use local data.")
    
    print(f"Retrieved {len(df)} stocks")
    print(f"Columns: {list(df.columns)}")
    
    # Map column names (different sources use different names)
    symbol_col = None
    industry_col = None
    pe_col = None
    pb_col = None
    mcap_col = None
    
    for col in df.columns:
        col_lower = str(col).lower()
        if col_lower in ['ticker', 'symbol', 'code', 'mã']:
            symbol_col = col
        elif col_lower in ['industry', 'industryname', 'sector', 'icb_name3', 'ngành']:
            industry_col = col
        elif col_lower in ['pe', 'p/e']:
            pe_col = col
        elif col_lower in ['pb', 'p/b']:
            pb_col = col
        elif col_lower in ['marketcap', 'mcap', 'market_cap', 'vốn hóa']:
            mcap_col = col
    
    print(f"\nColumn mapping found:")
    print(f"  Symbol: {symbol_col}")
    print(f"  Industry: {industry_col}")
    print(f"  P/E: {pe_col}")
    print(f"  P/B: {pb_col}")
    print(f"  Market Cap: {mcap_col}")
    
    if not symbol_col or not industry_col:
        print("ERROR: Cannot find required columns (symbol, industry)")
        print("Available columns:", list(df.columns))
        
        # If we have listing data, try to enrich it with financial data
        if symbol_col:
            print("\nAttempting to build sector peers from listing + individual stock data...")
            return generate_sector_peers_from_listing(df, symbol_col, industry_col)
        
        return None
    
    # Group by industry
    sectors = defaultdict(list)
    
    for _, row in df.iterrows():
        symbol = row.get(symbol_col)
        industry = row.get(industry_col)
        
        if not symbol or not industry:
            continue
        
        pe = row.get(pe_col) if pe_col else None
        pb = row.get(pb_col) if pb_col else None
        mcap = row.get(mcap_col) if mcap_col else 0
        
        # Convert to float safely
        try:
            pe = float(pe) if pe and not np.isnan(float(pe)) else None
            pb = float(pb) if pb and not np.isnan(float(pb)) else None
            mcap = float(mcap) if mcap else 0
        except:
            continue
        
        # Only include stocks with valid P/E and P/B
        if pe and pb and pe > 0 and pb > 0:
            sectors[industry].append({
                'symbol': symbol,
                'market_cap': mcap,
                'pe_ratio': pe,
                'pb_ratio': pb
            })
    
    # Process each sector
    sector_peers = {}
    
    print(f"\nProcessing {len(sectors)} industries...")
    
    for industry, stocks in sectors.items():
        # Sort by market cap descending
        stocks.sort(key=lambda x: x['market_cap'], reverse=True)
        
        # Take top 10
        top_10 = stocks[:10]
        
        if len(top_10) == 0:
            continue
        
        # Calculate median P/E and P/B
        pe_values = [s['pe_ratio'] for s in top_10]
        pb_values = [s['pb_ratio'] for s in top_10]
        
        median_pe = float(np.median(pe_values))
        median_pb = float(np.median(pb_values))
        
        # Prepare peer data
        peers = []
        for s in top_10:
            peers.append({
                'symbol': s['symbol'],
                'market_cap': s['market_cap'],
                'pe_ratio': round(s['pe_ratio'], 2),
                'pb_ratio': round(s['pb_ratio'], 2)
            })
        
        sector_peers[industry] = {
            'median_pe': round(median_pe, 2),
            'median_pb': round(median_pb, 2),
            'peer_count': len(top_10),
            'total_in_sector': len(stocks),
            'peers': peers
        }
        
        print(f"  {industry}: {len(top_10)} peers, PE={median_pe:.2f}, PB={median_pb:.2f}")
    
    return sector_peers


def generate_sector_peers_from_listing(df, symbol_col, industry_col=None):
    """Build sector peers by fetching individual stock data"""
    # This is a fallback that's slower but more reliable
    print("This method requires fetching individual stock data - skipping for now")
    return None


def generate_sector_peers_from_json():
    """Generate sector peers data from local JSON files (offline)"""
    
    base_path = os.path.dirname(os.path.abspath(__file__))
    stocks_folder = os.path.join(base_path, 'stocks')
    
    if not os.path.exists(stocks_folder):
        print(f"Stocks folder not found: {stocks_folder}")
        return None
    
    # Collect all stocks by sector
    sectors = defaultdict(list)
    
    print(f"Reading stock files from: {stocks_folder}")
    
    file_count = 0
    for filename in os.listdir(stocks_folder):
        if not filename.endswith('.json'):
            continue
        
        symbol = filename.replace('.json', '')
        file_count += 1
        
        try:
            filepath = os.path.join(stocks_folder, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            sector = data.get('sector')
            if not sector:
                continue
            
            market_cap = data.get('market_cap', 0) or 0
            pe_ratio = data.get('pe_ratio')
            pb_ratio = data.get('pb_ratio')
            
            if market_cap > 0 and pe_ratio and pb_ratio and pe_ratio > 0 and pb_ratio > 0:
                sectors[sector].append({
                    'symbol': symbol,
                    'market_cap': market_cap,
                    'pe_ratio': pe_ratio,
                    'pb_ratio': pb_ratio,
                    'name': data.get('name', '')
                })
        except Exception as e:
            continue
    
    print(f"Read {file_count} stock files")
    
    # Process each sector
    sector_peers = {}
    
    print(f"\nProcessing {len(sectors)} sectors...")
    
    for sector, stocks in sectors.items():
        stocks.sort(key=lambda x: x['market_cap'], reverse=True)
        top_10 = stocks[:10]
        
        if len(top_10) == 0:
            continue
        
        pe_values = [s['pe_ratio'] for s in top_10]
        pb_values = [s['pb_ratio'] for s in top_10]
        
        median_pe = float(np.median(pe_values))
        median_pb = float(np.median(pb_values))
        
        peers = []
        for s in top_10:
            peers.append({
                'symbol': s['symbol'],
                'market_cap': s['market_cap'],
                'pe_ratio': round(s['pe_ratio'], 2),
                'pb_ratio': round(s['pb_ratio'], 2),
                'name': s.get('name', '')
            })
        
        sector_peers[sector] = {
            'median_pe': round(median_pe, 2),
            'median_pb': round(median_pb, 2),
            'peer_count': len(top_10),
            'total_in_sector': len(stocks),
            'peers': peers
        }
        
        print(f"  {sector}: {len(top_10)} peers, PE={median_pe:.2f}, PB={median_pb:.2f}")
    
    return sector_peers


def save_sector_peers(sector_peers, filename='sector_peers.json'):
    """Save sector peers to JSON file"""
    base_path = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(base_path, filename)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sector_peers, f, ensure_ascii=False, indent=2)
    
    print(f"\nSaved to: {output_file}")
    print(f"Total sectors: {len(sector_peers)}")


if __name__ == "__main__":
    import sys
    
    # Use command line arg to choose source
    # --api    : Use Screener API (real-time)
    # --json   : Use local JSON files (offline)
    # default  : Try API first, fallback to JSON
    
    use_api = '--api' in sys.argv
    use_json = '--json' in sys.argv
    
    if use_api:
        print("=== Using Screener API (real-time) ===\n")
        try:
            sector_peers = generate_sector_peers_from_screener()
        except Exception as e:
            print(f"API failed: {e}")
            print("\nFalling back to JSON files...")
            sector_peers = generate_sector_peers_from_json()
    elif use_json:
        print("=== Using local JSON files (offline) ===\n")
        sector_peers = generate_sector_peers_from_json()
    else:
        print("=== Trying Screener API first ===\n")
        try:
            sector_peers = generate_sector_peers_from_screener()
        except Exception as e:
            print(f"API failed: {e}")
            print("\n=== Falling back to JSON files ===\n")
            sector_peers = generate_sector_peers_from_json()
    
    if sector_peers:
        save_sector_peers(sector_peers)
        
        # Summary
        print("\n" + "="*60)
        print("SECTOR SUMMARY")
        print("="*60)
        print(f"{'Sector':<35} {'Peers':>6} {'Med P/E':>10} {'Med P/B':>10}")
        print("-"*60)
        for sector, data in sorted(sector_peers.items(), key=lambda x: x[1]['peer_count'], reverse=True):
            print(f"{sector[:35]:<35} {data['peer_count']:>6} {data['median_pe']:>10.2f} {data['median_pb']:>10.2f}")
    else:
        print("Failed to generate sector peers data")
        sys.exit(1)
