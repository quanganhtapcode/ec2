/**
 * Stock Price Chart Manager
 * Uses Chart.js with data from vnstock API
 */

class StockChartManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.chart = null;
        this.currentSymbol = null;
    }

    /**
     * Detect current theme (dark or light)
     * @returns {boolean} true if dark mode
     */
    isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    /**
     * Get chart colors based on theme
     */
    getChartColors() {
        const isDark = this.isDarkMode();
        return {
            line: isDark ? '#4ade80' : '#22c55e', // Green
            fill: isDark ? 'rgba(74, 222, 128, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            text: isDark ? '#94a3b8' : '#64748b',
            tooltip: isDark ? '#1e293b' : '#ffffff'
        };
    }

    /**
     * Initialize chart for a symbol
     * @param {string} symbol - Stock symbol
     * @param {string} exchange - Exchange name (not used, kept for compatibility)
     * @param {string} range - Time range (1M, 3M, 6M, 1Y, 2Y, ALL)
     */
    async initWidget(symbol, exchange, range = '6M') {
        const container = document.getElementById('tradingview-widget');
        if (!container) return;

        this.currentSymbol = symbol;

        // Setup button listeners
        const buttons = document.querySelectorAll('.time-btn');
        buttons.forEach(btn => {
            // Check active state
            if (btn.dataset.range === range) {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }

            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const target = e.target;
                // Visual update immediately
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                // Fetch new data
                const selectedRange = target.dataset.range;
                this.initWidget(this.currentSymbol, null, selectedRange);
            });
        });

        // Show loading state
        container.innerHTML = `
            <div class="chart-loading" style="display: flex; align-items: center; justify-content: center; height: 400px; color: var(--color-text-secondary);">
                <div style="text-align: center;">
                    <div class="loader" style="width: 40px; height: 40px; margin: 0 auto 12px;"></div>
                    <span>Loading ${range} chart data...</span>
                </div>
            </div>
        `;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/stock/history/${symbol}?range=${range}`);

            if (!response.ok) {
                const text = await response.text();
                console.error('API Error Response:', text);
                throw new Error(`Server returned ${response.status}: ${text.substring(0, 50)}...`);
            }

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse JSON response:", text);
                throw new Error(`Invalid JSON: ${text.substring(0, 100)}...`);
            }

            // Check if still the current symbol
            if (this.currentSymbol !== symbol) return;

            if (!data.success || !data.data || data.data.length === 0) {
                container.innerHTML = `
                    <div class="tradingview-widget-placeholder">
                        <div style="text-align: center;">
                            <p>No chart data available for ${symbol}</p>
                        </div>
                    </div>
                `;
                return;
            }

            // Create canvas for Chart.js
            container.innerHTML = '<canvas id="stock-price-chart" style="width: 100%; height: 400px;"></canvas>';
            const canvas = document.getElementById('stock-price-chart');
            const ctx = canvas.getContext('2d');

            // Prepare data
            const labels = data.data.map(d => d.date);
            const prices = data.data.map(d => d.close);
            const volumes = data.data.map(d => d.volume);

            const colors = this.getChartColors();

            // Destroy existing chart if any
            if (this.chart) {
                this.chart.destroy();
            }

            // Create new chart
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${symbol} Price`,
                        data: prices,
                        borderColor: colors.line,
                        backgroundColor: colors.fill,
                        fill: true,
                        tension: 0.3, // Smooth curve
                        pointRadius: range === '1M' ? 3 : 0, // Show points for short range only
                        pointHoverRadius: 5,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: colors.tooltip,
                            titleColor: this.isDarkMode() ? '#fff' : '#333',
                            bodyColor: this.isDarkMode() ? '#fff' : '#333',
                            borderColor: colors.grid,
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: (context) => {
                                    // Multiply by 1000 for correct VND display
                                    const price = context.parsed.y * 1000;
                                    return `Price: ${new Intl.NumberFormat('vi-VN').format(price)} VND`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                color: colors.grid,
                                drawBorder: false
                            },
                            ticks: {
                                color: colors.text,
                                maxTicksLimit: 8,
                                maxRotation: 0
                            }
                        },
                        y: {
                            display: true,
                            position: 'right',
                            grid: {
                                color: colors.grid,
                                drawBorder: false
                            },
                            ticks: {
                                color: colors.text,
                                callback: (value) => {
                                    // Multiply by 1000 for scale labels as well
                                    return new Intl.NumberFormat('vi-VN', {
                                        notation: 'compact',
                                        maximumFractionDigits: 1
                                    }).format(value * 1000);
                                }
                            }
                        }
                    }
                }
            });

            console.log(`Stock chart created for ${symbol} (${range}) with ${data.data.length} data points`);

        } catch (error) {
            console.error('Error loading chart data:', error);
            if (this.currentSymbol === symbol) {
                container.innerHTML = `
                    <div class="tradingview-widget-placeholder">
                        <div style="text-align: center;">
                            <p>Unable to load chart data</p>
                            <small style="color: var(--color-text-secondary);">${error.message}</small>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Clear the chart
     */
    clear() {
        this.currentSymbol = null;
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        const container = document.getElementById('tradingview-widget');
        if (container) {
            container.innerHTML = '<div class="tradingview-widget-placeholder">Search for a stock to view price chart</div>';
        }
    }

    /**
     * Update chart theme
     */
    updateTheme() {
        if (this.currentSymbol) {
            // Refresh with current range? Ideally yes, but here we reset to default or need to store current range
            const currentRangeBtn = document.querySelector('.time-btn.active');
            const range = currentRangeBtn ? currentRangeBtn.dataset.range : '6M';
            this.initWidget(this.currentSymbol, null, range);
        }
    }
}

// Export for use in main app - replace TradingViewManager
if (typeof window !== 'undefined') {
    window.TradingViewManager = StockChartManager; // Use same name for compatibility
}
