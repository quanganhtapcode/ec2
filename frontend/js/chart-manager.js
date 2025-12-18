/**
 * Chart Manager Module
 * Handles initialization, updating, and management of Chart.js instances
 */
class ChartManager {
    constructor() {
        this.charts = {
            roeRoa: null,
            liquidity: null,
            pePb: null,
            nim: null
        };
        this.chartCache = new Map(); // Cache chart data by symbol
        this.chartsLoaded = false;

        // Initialize charts when instantiated (or maybe explicitly called)
        // Ideally called after DOM is ready
    }

    /**
     * Initialize all chart instances
     */
    init() {
        console.log('Setting up charts...');

        // Initialize ROE/ROA Chart with area/mountain style
        const roeRoaCanvas = document.getElementById('roe-roa-chart');
        if (roeRoaCanvas) {
            const roeRoaCtx = roeRoaCanvas.getContext('2d');
            this.charts.roeRoa = new Chart(roeRoaCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'ROA (%)',
                            data: [],
                            backgroundColor: 'rgba(75, 192, 192, 0.3)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 3,
                            fill: 'origin',
                            tension: 0.4, pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'ROE (%)',
                            data: [],
                            backgroundColor: 'rgba(54, 162, 235, 0.3)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 3,
                            fill: 'origin',
                            tension: 0.4,
                            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxTicksLimit: 5 }
                        }, y: {
                            beginAtZero: true,
                            title: { display: false },
                            grid: { color: 'rgba(0,0,0,0.1)' },
                            ticks: { maxTicksLimit: 6 }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { usePointStyle: true, padding: 20 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            cornerRadius: 8,
                            displayColors: true
                        }
                    },
                    elements: {
                        point: { hoverBorderWidth: 3 }
                    }
                }
            });
        }

        // Initialize Liquidity Chart
        const liquidityCanvas = document.getElementById('liquidity-chart');
        if (liquidityCanvas) {
            const liquidityCtx = liquidityCanvas.getContext('2d');
            this.charts.liquidity = new Chart(liquidityCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Current Ratio',
                            data: [],
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.3, pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Quick Ratio',
                            data: [],
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.3,
                            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Cash Ratio',
                            data: [],
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.3,
                            pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxTicksLimit: 5 }
                        }, y: {
                            beginAtZero: true,
                            title: { display: false },
                            grid: { color: 'rgba(0,0,0,0.1)' },
                            ticks: { maxTicksLimit: 6 }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { usePointStyle: true, padding: 20 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            cornerRadius: 8,
                            displayColors: true
                        }
                    },
                    elements: {
                        point: { hoverBorderWidth: 3 }
                    }
                }
            });
        }

        // Initialize P/E and P/B Chart with dual y-axes
        console.log('Initializing P/E P/B chart...');
        const pePbCtx = document.getElementById('pe-pb-chart');
        if (pePbCtx) {
            console.log('P/E P/B chart canvas found, creating chart...');
            try {
                this.charts.pePb = new Chart(pePbCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                            {
                                label: 'P/E Ratio',
                                data: [],
                                borderColor: 'rgba(255, 99, 132, 1)',
                                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                                borderWidth: 3,
                                fill: false,
                                tension: 0.3,
                                pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 1,
                                pointRadius: 3,
                                pointHoverRadius: 5,
                                yAxisID: 'y'
                            },
                            {
                                label: 'P/B Ratio',
                                data: [],
                                borderColor: 'rgba(153, 102, 255, 1)',
                                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                                borderWidth: 3,
                                fill: false,
                                tension: 0.3,
                                pointBackgroundColor: 'rgba(153, 102, 255, 1)',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 1,
                                pointRadius: 3,
                                pointHoverRadius: 5,
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: { maxTicksLimit: 5 }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                beginAtZero: true,
                                title: { display: true, text: 'P/E Ratio' },
                                grid: { color: 'rgba(0,0,0,0.1)' },
                                ticks: { maxTicksLimit: 6 }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                beginAtZero: true,
                                title: { display: true, text: 'P/B Ratio' },
                                grid: {
                                    drawOnChartArea: false,
                                },
                                ticks: { maxTicksLimit: 6 }
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { usePointStyle: true, padding: 20 },
                                onClick: function (e, legendItem) {
                                    const index = legendItem.datasetIndex;
                                    const chart = this.chart;
                                    const meta = chart.getDatasetMeta(index);

                                    // Toggle visibility
                                    meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                                    chart.update();
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                cornerRadius: 8,
                                displayColors: true
                            }
                        },
                        elements: {
                            point: { hoverBorderWidth: 3 }
                        }
                    }
                });
                console.log('P/E P/B chart created successfully');
            } catch (error) {
                console.error('Error creating P/E P/B chart:', error);
            }
        } else {
            console.error('P/E P/B chart canvas not found');
        }

        // Initialize NIM Chart
        const nimCtx = document.getElementById('nim-chart');
        if (nimCtx) {
            this.charts.nim = new Chart(nimCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'NIM (%)',
                        data: [],
                        backgroundColor: 'rgba(255, 206, 86, 0.1)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: 'rgba(255, 206, 86, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { maxTicksLimit: 5 }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.1)' },
                            ticks: {
                                maxTicksLimit: 6,
                                callback: function (value) {
                                    return value.toFixed(2) + '%';
                                }
                            },
                            title: {
                                display: true,
                                text: 'NIM (%)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { usePointStyle: true, padding: 20 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            cornerRadius: 8,
                            displayColors: true,
                            callbacks: {
                                label: function (context) {
                                    return `NIM: ${context.parsed.y.toFixed(3)}%`;
                                }
                            }
                        }
                    },
                    elements: { point: { hoverBorderWidth: 3 } }
                }
            });
        }
    }

    updateCharts(historicalData, stockData) {
        if (!historicalData) {
            this.clearCharts();
            return;
        }

        // Check if this is a bank stock
        const isBank = stockData && stockData.sector &&
            (stockData.sector.toLowerCase().includes('bank') ||
                stockData.sector.toLowerCase().includes('ngân hàng'));

        // Show/hide chart containers based on sector
        const nimChartContainer = document.getElementById('nim-chart')?.closest('.chart-container');
        const liquidityChartContainer = document.getElementById('liquidity-chart')?.closest('.chart-container');

        if (nimChartContainer) {
            nimChartContainer.style.display = isBank ? 'block' : 'none';
        }
        if (liquidityChartContainer) {
            liquidityChartContainer.style.display = isBank ? 'none' : 'block';
        }

        // Update ROE/ROA Chart
        if (this.charts.roeRoa) {
            this.charts.roeRoa.data.labels = historicalData.years;
            this.charts.roeRoa.data.datasets[0].data = historicalData.roa_data;
            this.charts.roeRoa.data.datasets[1].data = historicalData.roe_data;
            this.charts.roeRoa.update();
        }

        // Update Liquidity Chart (only if not a bank)
        if (!isBank && this.charts.liquidity) {
            this.charts.liquidity.data.labels = historicalData.years;
            this.charts.liquidity.data.datasets[0].data = historicalData.current_ratio_data;
            this.charts.liquidity.data.datasets[1].data = historicalData.quick_ratio_data;
            this.charts.liquidity.data.datasets[2].data = historicalData.cash_ratio_data;
            this.charts.liquidity.update();
        }

        // Update P/E and P/B Chart
        if (this.charts.pePb) {
            this.charts.pePb.data.labels = historicalData.years;
            this.charts.pePb.data.datasets[0].data = historicalData.pe_ratio_data || [];
            this.charts.pePb.data.datasets[1].data = historicalData.pb_ratio_data || [];
            this.charts.pePb.update();
        }

        // Update NIM Chart (only for banks)
        if (isBank && this.charts.nim) {
            console.log('🏦 Bank detected, updating NIM chart');
            this.charts.nim.data.labels = historicalData.years;
            this.charts.nim.data.datasets[0].data = historicalData.nim_data || [];
            this.charts.nim.update();
        }
    }

    clearCharts() {
        if (this.charts.roeRoa) {
            this.charts.roeRoa.data.labels = [];
            this.charts.roeRoa.data.datasets.forEach(dataset => dataset.data = []);
            this.charts.roeRoa.update();
        }

        if (this.charts.liquidity) {
            this.charts.liquidity.data.labels = [];
            this.charts.liquidity.data.datasets.forEach(dataset => dataset.data = []);
            this.charts.liquidity.update();
        }

        if (this.charts.pePb) {
            this.charts.pePb.data.labels = [];
            this.charts.pePb.data.datasets.forEach(dataset => dataset.data = []);
            this.charts.pePb.update();
        }
        if (this.charts.nim) {
            this.charts.nim.data.labels = [];
            this.charts.nim.data.datasets.forEach(dataset => dataset.data = []);
            this.charts.nim.update();
        }
    }

    resetState() {
        // Reset chart state when symbol input changes
        this.chartsLoaded = false;
        // Don't clear cache, just reset loaded flag for current flow
    }

    // Clear all chart cache
    clearCache() {
        this.chartCache.clear();
        this.chartsLoaded = false;
        console.log('🗑️ Chart cache cleared');
    }

    // Clear cache for a specific symbol
    clearCacheForSymbol(symbol) {
        if (this.chartCache.has(symbol)) {
            this.chartCache.delete(symbol);
            console.log(`🗑️ Chart cache cleared for ${symbol}`);
        }
        this.chartsLoaded = false;
    }

    // Cache management helpers
    hasCache(symbol) {
        return this.chartCache.has(symbol);
    }

    getCache(symbol) {
        return this.chartCache.get(symbol);
    }

    setCache(symbol, data) {
        this.chartCache.set(symbol, data);
    }

    showLoading(show) {
        // Add a subtle loading indicator for charts
        const chartsSection = document.querySelector('.charts-grid');
        if (chartsSection) {
            if (show) {
                chartsSection.style.opacity = '0.7';
                // Add loading text if it doesn't exist
                if (!document.getElementById('chart-loading-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.id = 'chart-loading-indicator';
                    indicator.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: rgba(0,0,0,0.8);
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        z-index: 1000;
                        font-size: 14px;
                    `;
                    indicator.textContent = 'Loading charts...';
                    chartsSection.style.position = 'relative';
                    chartsSection.appendChild(indicator);
                }
            } else {
                chartsSection.style.opacity = '1';
                const indicator = document.getElementById('chart-loading-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        }
    }
}
