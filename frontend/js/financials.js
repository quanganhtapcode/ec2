/**
 * Financials Tab Manager
 * Handles displaying detailed financial ratios and data in the Financials tab
 */

class FinancialsManager {
    constructor() {
        // No specific initialization needed yet
    }

    /**
     * Update the financials display with stock data
     * @param {Object} data - Normalized stock data object
     */
    updateDisplay(data) {
        if (!data) return;

        // Valuation Ratios (Moved from Overview)
        this.safeUpdateElement('pe-ratio', AppUtils.formatNumber(data.pe_ratio));
        this.safeUpdateElement('pb-ratio', AppUtils.formatNumber(data.pb_ratio));
        this.safeUpdateElement('ps-ratio', AppUtils.formatNumber(data.ps_ratio));
        this.safeUpdateElement('ev-ebitda', AppUtils.formatNumber(data.ev_ebitda));
        this.safeUpdateElement('pcf-ratio', AppUtils.formatNumber(data.pcf));


        // Efficiency Ratios
        this.safeUpdateElement('asset-turnover', AppUtils.formatNumber(data.asset_turnover));
        this.safeUpdateElement('inventory-turnover', AppUtils.formatNumber(data.inventory_turnover));
        this.safeUpdateElement('fixed-asset-turnover', AppUtils.formatNumber(data.fixed_asset_turnover));

        // Liquidity Ratios
        this.safeUpdateElement('current-ratio', AppUtils.formatNumber(data.current_ratio));
        this.safeUpdateElement('quick-ratio', AppUtils.formatNumber(data.quick_ratio));
        this.safeUpdateElement('cash-ratio', AppUtils.formatNumber(data.cash_ratio));
        this.safeUpdateElement('interest-coverage', AppUtils.formatNumber(data.interest_coverage));

        // Profitability Margins
        this.safeUpdateElement('gross-profit-margin', AppUtils.formatPercent(data.gross_profit_margin));
        this.safeUpdateElement('ebit-margin', AppUtils.formatPercent(data.ebit_margin));
        this.safeUpdateElement('net-profit-margin', AppUtils.formatPercent(data.net_profit_margin));
        this.safeUpdateElement('roic', AppUtils.formatPercent(data.roic));
    }

    /**
     * Clear all financial data display
     */
    clear() {
        // Valuation Ratios
        this.safeUpdateElement('pe-ratio', '--');
        this.safeUpdateElement('pb-ratio', '--');
        this.safeUpdateElement('ps-ratio', '--');
        this.safeUpdateElement('ev-ebitda', '--');
        this.safeUpdateElement('pcf-ratio', '--');


        // Efficiency Ratios
        this.safeUpdateElement('asset-turnover', '--');
        this.safeUpdateElement('inventory-turnover', '--');
        this.safeUpdateElement('fixed-asset-turnover', '--');

        // Liquidity Ratios
        this.safeUpdateElement('current-ratio', '--');
        this.safeUpdateElement('quick-ratio', '--');
        this.safeUpdateElement('cash-ratio', '--');
        this.safeUpdateElement('interest-coverage', '--');

        // Profitability Margins
        this.safeUpdateElement('gross-profit-margin', '--');
        this.safeUpdateElement('ebit-margin', '--');
        this.safeUpdateElement('net-profit-margin', '--');
        this.safeUpdateElement('roic', '--');
    }

    /**
     * Helper to safely update element text content
     */
    safeUpdateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value ?? '--';
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.FinancialsManager = FinancialsManager;
}
