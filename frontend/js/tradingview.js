/**
 * TradingView Widget Manager
 * Handles initialization and management of TradingView stock charts
 * Note: Vietnamese stocks may have limited availability on TradingView
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
     * Initialize TradingView widget for a symbol
     * Uses Symbol Overview widget which has better support for Vietnamese stocks
     * @param {string} symbol - Stock symbol
     * @param {string} exchange - Exchange name
     */
    async initWidget(symbol, exchange) {
        const container = document.getElementById('tradingview-widget');
        if (!container) return;

        this.currentSymbol = symbol;

        // Map exchange
        const tvExchange = this.mapExchange(exchange);
        const tvSymbol = `${tvExchange}:${symbol}`;

        // Detect theme
        const isDarkMode = this.getTheme() === 'dark';

        // Clear container and create widget with Symbol Overview (better VN stock support)
        container.innerHTML = '';

        // Create container div for the widget
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = '400px';
        widgetDiv.style.width = '100%';
        container.appendChild(widgetDiv);

        // Create and append the Symbol Overview widget script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbols": [[tvSymbol, tvSymbol]],
            "chartOnly": false,
            "width": "100%",
            "height": "400",
            "locale": "vi_VN",
            "colorTheme": isDarkMode ? "dark" : "light",
            "autosize": true,
            "showVolume": true,
            "showMA": true,
            "hideDateRanges": false,
            "hideMarketStatus": false,
            "hideSymbolLogo": false,
            "scalePosition": "right",
            "scaleMode": "Normal",
            "fontFamily": "Inter, -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
            "fontSize": "10",
            "noTimeScale": false,
            "valuesTracking": "1",
            "changeMode": "price-and-percent",
            "chartType": "area",
            "maLineColor": "#2962FF",
            "maLineWidth": 1,
            "maLength": 9,
            "lineWidth": 2,
            "lineType": 0,
            "dateRanges": [
                "1d|1",
                "1m|30",
                "3m|60",
                "12m|1D",
                "60m|1W",
                "all|1M"
            ]
        });

        // Handle script load error - show fallback message
        script.onerror = () => {
            container.innerHTML = `
                <div class="tradingview-widget-placeholder">
                    <div style="text-align: center;">
                        <p style="margin-bottom: 8px;">Chart không khả dụng cho ${tvSymbol}</p>
                        <a href="https://www.tradingview.com/chart/?symbol=${tvSymbol}" target="_blank" rel="noopener" 
                           style="color: var(--color-primary); text-decoration: underline;">
                           Xem trên TradingView →
                        </a>
                    </div>
                </div>
            `;
        };

        widgetDiv.appendChild(script);
        console.log(`TradingView Symbol Overview widget initialized for ${tvSymbol}`);
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
        if (this.currentSymbol) {
            // Reinitialize with new theme
            this.initWidget(this.currentSymbol, null);
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.TradingViewManager = TradingViewManager;
}
