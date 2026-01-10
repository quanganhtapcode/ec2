/**
 * Company Profile Module
 * Handles fetching and displaying company description/profile
 * Includes "Read More" functionality for long text
 */

class CompanyProfileManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.currentSymbol = null;
        this.profileCache = new Map(); // Cache profiles to avoid repeated API calls
        this.isExpanded = false;
        this.initReadMoreButton();
    }

    /**
     * Initialize the "Read More" button click handler
     */
    initReadMoreButton() {
        // Use event delegation in case button is not yet in DOM
        document.addEventListener('click', (e) => {
            if (e.target.closest('#read-more-btn')) {
                this.toggleExpand();
            }
        });
    }

    /**
     * Toggle expand/collapse of company description
     */
    toggleExpand() {
        const descriptionEl = document.getElementById('company-description');
        const wrapperEl = document.getElementById('company-description-wrapper');
        const btnEl = document.getElementById('read-more-btn');
        const btnText = btnEl?.querySelector('span');

        if (!descriptionEl || !btnEl) return;

        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            descriptionEl.classList.remove('collapsed');
            descriptionEl.classList.add('expanded');
            wrapperEl?.classList.add('expanded');
            btnEl.classList.add('expanded');
            if (btnText) btnText.textContent = 'Thu gọn';
        } else {
            descriptionEl.classList.remove('expanded');
            descriptionEl.classList.add('collapsed');
            wrapperEl?.classList.remove('expanded');
            btnEl.classList.remove('expanded');
            if (btnText) btnText.textContent = 'Xem thêm';
        }
    }

    /**
     * Check if text overflows and show/hide read more button
     */
    checkOverflow() {
        const descriptionEl = document.getElementById('company-description');
        const wrapperEl = document.getElementById('company-description-wrapper');
        const btnEl = document.getElementById('read-more-btn');

        if (!descriptionEl || !btnEl) return;

        // Reset to collapsed state to measure
        descriptionEl.classList.add('collapsed');
        descriptionEl.classList.remove('expanded');
        this.isExpanded = false;

        // Check if text would overflow the collapsed height (100px)
        const textHeight = descriptionEl.scrollHeight;
        const collapsedHeight = 100;

        if (textHeight > collapsedHeight + 20) {
            btnEl.style.display = 'inline-flex';
            wrapperEl?.classList.add('has-overflow');
        } else {
            btnEl.style.display = 'none';
            wrapperEl?.classList.remove('has-overflow');
            // If no overflow, show full text
            descriptionEl.classList.remove('collapsed');
        }
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
            // Check overflow after setting text
            setTimeout(() => this.checkOverflow(), 50);
            return;
        }

        // Show loading state
        descriptionEl.textContent = 'Loading...';
        descriptionEl.style.color = 'var(--color-text-secondary)';

        try {
            const response = await fetch(`${this.apiBaseUrl}/company/profile/${symbol}`);
            const data = await response.json();

            // Check if this is still the current symbol (prevent race conditions)
            if (this.currentSymbol !== symbol) return;

            if (data.success && data.company_profile) {
                descriptionEl.textContent = data.company_profile;
                descriptionEl.style.color = '';
                // Cache the result
                this.profileCache.set(symbol, data);
            } else {
                descriptionEl.textContent = 'Company description not available.';
            }

            // Check overflow after setting text
            setTimeout(() => this.checkOverflow(), 50);

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
        this.isExpanded = false;

        const descriptionEl = document.getElementById('company-description');
        const wrapperEl = document.getElementById('company-description-wrapper');
        const btnEl = document.getElementById('read-more-btn');

        if (descriptionEl) {
            descriptionEl.textContent = '--';
            descriptionEl.classList.add('collapsed');
            descriptionEl.classList.remove('expanded');
        }
        if (wrapperEl) {
            wrapperEl.classList.remove('expanded', 'has-overflow');
        }
        if (btnEl) {
            btnEl.style.display = 'none';
            btnEl.classList.remove('expanded');
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
