"""
Script to update ticker_data.json with the latest stock list and industry classification.
This script should be run daily to ensure new listings are captured.
"""

import os
import json
import logging
from datetime import datetime
from vnstock import Listing

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def update_ticker_data():
    """Fetch latest ticker data from vnstock and save to frontend/ticker_data.json"""
    try:
        logger.info("Starting ticker data update...")
        listing = Listing()
        
        # Fetch all stocks with industry info
        # symbols_by_industries returns DataFrame with columns like:
        # symbol, organ_name, icb_name2, icb_name3, ...
        logger.info("Fetching symbols from vnstock...")
        df = listing.symbols_by_industries()
        
        if df is None or df.empty:
            logger.error("Failed to fetch data or data is empty")
            return False
            
        logger.info(f"Fetched {len(df)} symbols")
        
        # Standardize column names
        # We need: symbol, name, sector (icb_name2), exchange
        
        # Check available columns
        cols = df.columns.tolist()
        logger.info(f"Available columns: {cols}")
        
        tickers = []
        for _, row in df.iterrows():
            # Sector: Prefer ICB Level 2 (Industry), fallback to Level 3 (Supersector)
            sector = row.get('icb_name2') or row.get('icb_name3') or 'Unknown'
            
            # Exchange handling
            exchange = row.get('com_group_code') or row.get('exchange') or 'Unknown'
            
            ticker = {
                "symbol": row.get('symbol'),
                "name": row.get('organ_name'),
                "sector": sector,
                "exchange": exchange
            }
            
            if ticker['symbol']:
                tickers.append(ticker)
        
        # Construct final JSON structure
        output_data = {
            "last_updated": datetime.now().isoformat(),
            "count": len(tickers),
            "tickers": tickers
        }
        
        # Determine output path
        # Script is in root, we want to save to /frontend/ticker_data.json
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        output_file = os.path.join(base_dir, 'frontend', 'ticker_data.json')
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Successfully saved {len(tickers)} tickers to {output_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error updating ticker data: {e}")
        return False

if __name__ == "__main__":
    success = update_ticker_data()
    if not success:
        exit(1)
