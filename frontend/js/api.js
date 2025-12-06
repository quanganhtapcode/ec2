/**
 * API Client for interacting with the backend
 * Handles all network requests and error parsing
 */
class ApiClient {
    constructor(baseUrl) {
        // Remove trailing slash if present to avoid double slashes
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    /**
     * Fetch valuation data for a stock symbol
     * @param {string} symbol 
     * @returns {Promise<Object>} Valuation data
     */
    async getValuation(symbol) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/api/valuation/${cleanSymbol}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                // Try to parse error message from JSON response
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            // Re-throw to be handled by the caller (App)
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * Fetch full application data (Overview + Financials)
     * @param {string} symbol 
     * @param {string} period 'year' or 'quarter'
     * @param {boolean} fetchPrice Whether to fetch real-time price
     * @param {AbortSignal} signal Optional abort signal
     * @returns {Promise<Object>}
     */
    async getAppData(symbol, period = 'year', fetchPrice = true, signal = null) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/api/app-data/${cleanSymbol}?period=${period}&fetch_price=${fetchPrice}`;

        try {
            const response = await fetch(url, { signal });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Throw specific error messages based on status
                if (response.status === 404) throw new Error('No data found for this stock symbol');
                if (response.status === 500) throw new Error('Server error while loading data');
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            // Rethrow AbortError as is, wrap others
            if (error.name === 'AbortError') throw error;
            console.error('API Error (getAppData):', error);
            throw error;
        }
    }

    /**
     * Fetch historical chart data
     * @param {string} symbol
     * @param {AbortSignal} signal
     * @returns {Promise<Object>}
     */
    async getHistoricalChart(symbol, signal = null) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/api/historical-chart-data/${cleanSymbol}`;

        try {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`Chart load failed: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.error('API Error (getHistoricalChart):', error);
            throw error;
        }
    }

    /**
     * Calculate valuation models
     * @param {string} symbol 
     * @param {Object} data Assumptions and weights
     * @returns {Promise<Object>}
     */
    async calculateValuation(symbol, data) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/api/valuation/${cleanSymbol}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Valuation failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error (calculateValuation):', error);
            throw error;
        }
    }

    /**
     * Get the download URL for a symbol
     * @param {string} symbol 
     * @returns {string} Absolute URL
     */
    getDownloadUrl(symbol) {
        return `${this.baseUrl}/api/download/${symbol.trim().toUpperCase()}`;
    }

    /**
     * Check if the Excel download file exists
     * @param {string} symbol 
     * @returns {Promise<boolean>}
     */
    async checkDownloadAvailability(symbol) {
        const url = this.getDownloadUrl(symbol);
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn(`Check download availability failed for ${symbol}:`, error);
            return false;
        }
    }
}

// Make globally available
window.ApiClient = ApiClient;
