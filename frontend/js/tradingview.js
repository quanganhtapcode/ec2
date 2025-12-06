/**
 * TradingView Widget Manager
 * Handles initialization and management of TradingView stock charts
 */

class TradingViewManager {
    constructor() {
        this.widget = null;
        this.currentSymbol = null;
        this.scriptLoaded = false;
    }

    /**
     * Map Vietnamese exchange to TradingView exchange code
     * @param {string} exchange - Exchange name (HOSE, HNX, UPCOM)
     * @returns {string} TradingView exchange code
     */
    mapExchange(exchange) {
        if (!exchange) return 'HOSE';

        const exchangeUpper = exchange.toUpperCase();
        if (exchangeUpper.includes('HNX')) {
            return 'HNX';
        } else if (exchangeUpper.includes('UPCOM')) {
            return 'UPCOM';
        } else if (exchangeUpper.includes('HOSE') || exchangeUpper.includes('HSX')) {
            return 'HOSE';
        }
        return 'HOSE'; // Default
    }

    /**
     * Detect current theme (dark or light)
     * @returns {string} 'dark' or 'light'
     */
    getTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    /**
     * Load TradingView script if not already loaded
     * @returns {Promise<void>}
     */
    loadScript() {
        return new Promise((resolve, reject) => {
            if (this.scriptLoaded || typeof TradingView !== 'undefined') {
                this.scriptLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                this.scriptLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load TradingView script'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize TradingView widget for a symbol
     * @param {string} symbol - Stock symbol
     * @param {string} exchange - Exchange name
     */
    async initWidget(symbol, exchange) {
        const container = document.getElementById('tradingview-widget');
        if (!container) return;

        this.currentSymbol = symbol;

        // Clear previous widget
        container.innerHTML = '<div class="tradingview-widget-placeholder">Loading chart...</div>';

        try {
            await this.loadScript();

            // Check if still the current symbol
            if (this.currentSymbol !== symbol) return;

            // Clear container
            container.innerHTML = '';

            // Create TradingView symbol
            const tvExchange = this.mapExchange(exchange);
            const tvSymbol = `${tvExchange}:${symbol}`;

            // Create widget
            this.widget = new TradingView.widget({
                "width": "100%",
                "height": 400,
                "symbol": tvSymbol,
                "interval": "D",
                "timezone": "Asia/Ho_Chi_Minh",
                "theme": this.getTheme(),
                "style": "1",
                "locale": "vi_VN",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "hide_side_toolbar": false,
                "allow_symbol_change": true,
                "container_id": "tradingview-widget",
                "hide_volume": false,
                "studies": ["MASimple@tv-basicstudies"],
                "show_popup_button": true,
                "popup_width": "1000",
                "popup_height": "650"
            });

            console.log(`TradingView widget initialized for ${tvSymbol}`);

        } catch (error) {
            console.error('Error initializing TradingView widget:', error);
            container.innerHTML = '<div class="tradingview-widget-placeholder">Unable to load chart</div>';
        }
    }

    /**
     * Clear the widget
     */
    clear() {
        this.currentSymbol = null;
        const container = document.getElementById('tradingview-widget');
        if (container) {
            container.innerHTML = '<div class="tradingview-widget-placeholder">Search for a stock to view price chart</div>';
        }
        this.widget = null;
    }

    /**
     * Update widget theme (call when user toggles theme)
     */
    updateTheme() {
        if (this.currentSymbol && this.widget) {
            // TradingView widget doesn't support dynamic theme change
            // Need to reinitialize
            const exchange = this.widget._options?.symbol?.split(':')[0];
            this.initWidget(this.currentSymbol, exchange);
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.TradingViewManager = TradingViewManager;
}
