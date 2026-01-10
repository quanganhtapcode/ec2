/**
 * API Client for interacting with the backend
 * Handles all network requests, error parsing, and response caching
 */
class ApiClient {
    constructor(baseUrl) {
        // Remove trailing slash if present to avoid double slashes
        this.baseUrl = baseUrl.replace(/\/$/, '');

        // In-memory cache for API responses (stored in USER's browser memory)
        this.cache = new Map();
        this.cacheExpiry = 4 * 60 * 60 * 1000; // 4 hours cache
    }

    /**
     * Get cached data or null if expired/missing
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * Store data in cache
     */
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    /**
     * Clear cache for a specific key or all
     */
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Fetch valuation data for a stock symbol
     * @param {string} symbol 
     * @returns {Promise<Object>} Valuation data
     */
    async getValuation(symbol) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/valuation/${cleanSymbol}`;

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
     * Fetch real-time price only (lightweight for auto-refresh)
     * @param {string} symbol 
     * @param {AbortSignal} signal Optional abort signal
     * @returns {Promise<Object>} Price data { current_price, price_change, price_change_percent }
     */
    async getRealTimePrice(symbol, signal = null) {
        const cleanSymbol = symbol.trim().toUpperCase();
        const url = `${this.baseUrl}/price/${cleanSymbol}`;

        try {
            const response = await fetch(url, { signal });

            if (!response.ok) {
                // Fallback: price endpoint might not exist, return null
                console.warn(`Price endpoint not available for ${cleanSymbol}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.warn('Price fetch failed:', error.message);
            return null;
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
        const cacheKey = `appData_${cleanSymbol}_${period}`;

        // Return cached data if available and fresh
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`📦 Using cached data for ${cleanSymbol}`);
            return cached;
        }

        const url = `${this.baseUrl}/app-data/${cleanSymbol}?period=${period}&fetch_price=${fetchPrice}`;

        try {
            const response = await fetch(url, { signal });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Throw specific error messages based on status
                if (response.status === 404) throw new Error('No data found for this stock symbol');
                if (response.status === 500) throw new Error('Server error while loading data');
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();

            // Cache successful response
            this.setCache(cacheKey, data);

            return data;
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
        const cacheKey = `chart_${cleanSymbol}`;

        // Return cached data if available and fresh
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`📊 Using cached chart data for ${cleanSymbol}`);
            return cached;
        }

        const url = `${this.baseUrl}/historical-chart-data/${cleanSymbol}`;

        try {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`Chart load failed: ${response.status}`);

            const data = await response.json();

            // Cache successful response
            this.setCache(cacheKey, data);

            return data;
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
        const url = `${this.baseUrl}/valuation/${cleanSymbol}`;

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
        return `${this.baseUrl}/download/${symbol.trim().toUpperCase()}`;
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
