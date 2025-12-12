from vnstock import Listing
listing = Listing()
df = listing.symbols_by_exchange()
print("COLUMNS:", df.columns.tolist())
if not df.empty:
    print("SAMPLE ROW:", df.iloc[0].to_dict())
