/**
 * Utility functions for the Valuation Application
 * Provides common formatting and helper methods
 */

const AppUtils = {
    /**
     * Format currency (VND)
     * Rounds to integer and adds thousand separators
     * @param {number} value - The value to format
     * @returns {string} Formatted string (e.g. "1,234,567")
     */
    /**
     * Format currency (VND)
     * Uses Intl.NumberFormat for correct currency symbol and spacing
     * @param {number} value 
     * @returns {string}
     */
    formatCurrency(value) {
        if (!value && value !== 0) return '--';
        if (isNaN(value)) return '--';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    },

    /**
     * Format number with fixed decimals
     * @param {number} value 
     * @param {number} decimals 
     * @returns {string}
     */
    formatNumber(value, decimals = 2) {
        if (!value && value !== 0) return '--';
        if (isNaN(value)) return '--';
        return value.toFixed(decimals);
    },

    /**
     * Format large numbers (Trillion/Billion/Million) with suffixes
     * @param {number} value 
     * @returns {string}
     */
    formatLargeNumber(value) {
        if (!value && value !== 0) return '--';
        if (isNaN(value)) return '--';

        if (value >= 1e12) {
            return `${(value / 1e12).toFixed(1)} trillion`;
        } else if (value >= 1e9) {
            return `${(value / 1e9).toFixed(1)} billion`;
        } else if (value >= 1e6) {
            return `${(value / 1e6).toFixed(1)} million`;
        } else {
            return this.formatCurrency(value);
        }
    },

    /**
     * Format percentage
     * @param {number} value 
     * @returns {string}
     */
    formatPercent(value) {
        if (!value && value !== 0) return '--';
        if (isNaN(value)) return '--';
        return `${value.toFixed(1)}%`;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },

    /**
     * Safely update DOM element content
     */
    safeUpdate(id, content, isHtml = true) {
        const el = document.getElementById(id);
        if (el) {
            if (isHtml) el.innerHTML = content;
            else el.textContent = content;
        }
    }
};

// Expose to global window object
window.AppUtils = AppUtils;
