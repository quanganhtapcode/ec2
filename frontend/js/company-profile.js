/**
 * Company Profile Module
 * Handles fetching and displaying company description/profile
 */

class CompanyProfileManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.currentSymbol = null;
        this.profileCache = new Map(); // Cache profiles to avoid repeated API calls
    }

    /**
     * Fetch company profile/description from backend API
     * @param {string} symbol - Stock symbol
     * @returns {Promise<void>}
     */
    async fetchProfile(symbol) {
        const descriptionEl = document.getElementById('company-description');
        if (!descriptionEl) return;

        this.currentSymbol = symbol;

        // Check cache first
        if (this.profileCache.has(symbol)) {
            const cached = this.profileCache.get(symbol);
            descriptionEl.textContent = cached.company_profile || 'Company description not available.';
            return;
        }

        // Show loading state
        descriptionEl.textContent = 'Loading...';
        descriptionEl.style.color = 'var(--color-text-secondary)';

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/company/profile/${symbol}`);
            const data = await response.json();

            // Check if this is still the current symbol (prevent race conditions)
            if (this.currentSymbol !== symbol) return;

            if (data.success && data.company_profile) {
                descriptionEl.textContent = data.company_profile;
                // Cache the result
                this.profileCache.set(symbol, data);
            } else {
                descriptionEl.textContent = 'Company description not available.';
            }
        } catch (error) {
            console.error('Error fetching company profile:', error);
            if (this.currentSymbol === symbol) {
                descriptionEl.textContent = 'Unable to load company description.';
            }
        }
    }

    /**
     * Clear the company description display
     */
    clear() {
        this.currentSymbol = null;
        const descriptionEl = document.getElementById('company-description');
        if (descriptionEl) {
            descriptionEl.textContent = '--';
        }
    }

    /**
     * Clear the cache (useful when refreshing data)
     */
    clearCache() {
        this.profileCache.clear();
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.CompanyProfileManager = CompanyProfileManager;
}
