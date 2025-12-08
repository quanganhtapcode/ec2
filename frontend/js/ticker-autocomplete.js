/**
 * Ticker Autocomplete Module
 * Provides dropdown suggestions when searching for stock tickers
 */
class TickerAutocomplete {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            maxResults: 10,
            minChars: 1,
            onSelect: null,
            ...options
        };

        this.tickers = [];
        this.isOpen = false;
        this.selectedIndex = -1;
        this.dropdown = null;

        this.init();
    }

    async init() {
        // Create dropdown element
        this.createDropdown();

        // Load ticker data
        await this.loadTickerData();

        // Setup event listeners
        this.setupEventListeners();
    }

    createDropdown() {
        // Create dropdown container
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'ticker-dropdown';
        this.dropdown.style.display = 'none';

        // Insert dropdown right after the input's parent container
        const searchContainer = this.input.closest('.search-container-v2');
        if (searchContainer) {
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(this.dropdown);
        } else {
            // Fallback: insert after input
            this.input.parentElement.style.position = 'relative';
            this.input.parentElement.appendChild(this.dropdown);
        }
    }

    async loadTickerData() {
        try {
            const response = await fetch('ticker_data.json');
            if (response.ok) {
                const data = await response.json();
                this.tickers = data.tickers || [];
                console.log(`📋 Loaded ${this.tickers.length} tickers for autocomplete`);
            }
        } catch (error) {
            console.error('Failed to load ticker data:', error);
            this.tickers = [];
        }
    }

    setupEventListeners() {
        // Input events
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('focus', (e) => this.handleFocus(e));
        this.input.addEventListener('blur', (e) => this.handleBlur(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Prevent form submission on dropdown selection
        this.dropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        });
    }

    handleInput(e) {
        const query = e.target.value.trim();

        if (query.length < this.options.minChars) {
            this.close();
            return;
        }

        const results = this.search(query);
        this.render(results);
    }

    handleFocus(e) {
        const query = e.target.value.trim();
        if (query.length >= this.options.minChars) {
            const results = this.search(query);
            this.render(results);
        }
    }

    handleBlur(e) {
        // Delay close to allow click on dropdown item
        setTimeout(() => this.close(), 200);
    }

    handleKeydown(e) {
        if (!this.isOpen) return;

        const items = this.dropdown.querySelectorAll('.ticker-item');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection(items);
                break;

            case 'Enter':
                // If an item is selected in the dropdown, use that
                if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                    e.preventDefault();
                    this.selectItem(items[this.selectedIndex].dataset.symbol);
                } else {
                    // No item selected - just close the dropdown
                    // Let the form submission happen naturally with the typed value
                    this.close();
                }
                break;

            case 'Escape':
                this.close();
                break;
        }
    }

    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
            if (index === this.selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    search(query) {
        if (!query || !this.tickers.length) return [];

        const normalizedQuery = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Score-based search
        const scored = this.tickers.map(ticker => {
            let score = 0;
            const symbol = ticker.symbol.toUpperCase();
            const name = (ticker.name || '').toLowerCase();

            // Exact symbol match - highest priority
            if (symbol === normalizedQuery) {
                score = 1000;
            }
            // Symbol starts with query - high priority
            else if (symbol.startsWith(normalizedQuery)) {
                score = 500 + (100 - symbol.length);
            }
            // Symbol contains query
            else if (symbol.includes(normalizedQuery)) {
                score = 200;
            }
            // Name contains query
            else if (name.includes(queryLower)) {
                score = 100;
            }

            return { ...ticker, score };
        });

        // Filter and sort by score
        return scored
            .filter(t => t.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.options.maxResults);
    }

    render(results) {
        if (!results.length) {
            this.close();
            return;
        }

        // Get current query for highlighting
        const query = this.input.value.trim().toUpperCase();

        this.dropdown.innerHTML = results.map((ticker, index) => {
            // Highlight matching part in symbol
            const highlightedSymbol = this.highlightMatch(ticker.symbol, query);

            return `
                <div class="ticker-item ${index === this.selectedIndex ? 'selected' : ''}" 
                     data-symbol="${ticker.symbol}">
                    <div class="ticker-item-left">
                        <span class="ticker-symbol">${highlightedSymbol}</span>
                        <span class="ticker-exchange">${ticker.exchange || ''}</span>
                    </div>
                    <div class="ticker-item-right">
                        <span class="ticker-name">${ticker.name || ''}</span>
                        ${ticker.sector ? `<span class="ticker-sector">${ticker.sector}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.dropdown.querySelectorAll('.ticker-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectItem(item.dataset.symbol);
            });
        });

        this.open();
    }

    highlightMatch(text, query) {
        if (!query) return text;

        const upperText = text.toUpperCase();
        const index = upperText.indexOf(query);

        if (index === -1) return text;

        const before = text.slice(0, index);
        const match = text.slice(index, index + query.length);
        const after = text.slice(index + query.length);

        return `${before}<mark>${match}</mark>${after}`;
    }

    selectItem(symbol) {
        this.input.value = symbol;
        this.close();

        // Call optional callback
        if (this.options.onSelect) {
            const ticker = this.tickers.find(t => t.symbol === symbol);
            this.options.onSelect(ticker);
        }

        // Trigger search immediately by clicking the search button
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.click();
        }
    }

    open() {
        this.dropdown.style.display = 'block';
        this.isOpen = true;
        this.selectedIndex = -1;
    }

    close() {
        this.dropdown.style.display = 'none';
        this.isOpen = false;
        this.selectedIndex = -1;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const stockInput = document.getElementById('stock-symbol');
    if (stockInput) {
        window.tickerAutocomplete = new TickerAutocomplete(stockInput, {
            maxResults: 8,
            minChars: 1,
            onSelect: (ticker) => {
                console.log('Selected ticker:', ticker);
            }
        });
    }
});
