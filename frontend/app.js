/**
 * Vietnamese Stock Valuation - Client-side application logic
 * Uses vanilla JavaScript for state management and DOM manipulation
 * Integrates with Chart.js for historical trend visualization
 * Generates PDF reports using jsPDF
 */

// Application State
class StockValuationApp {
    constructor() {
        this.currentStock = null;
        this.stockData = null;
        this.historicalData = null;
        this.chartsLoaded = false;
        this.chartCache = new Map(); // Cache chart data by symbol
        this.valuationCache = null; // Cache full valuation results (per symbol + assumptions)
        this.abortControllers = {
            stockData: null,
            chartData: null
        };
        this.debounceTimer = null; // For debouncing symbol input
        this.loadingState = {
            stockData: false,
            chartData: false
        };
        this.assumptions = {
            revenueGrowth: 8.0,
            terminalGrowth: 3.0,
            wacc: 10.5,
            requiredReturn: 12.0,
            taxRate: 20.0,
            projectionYears: 5
        };
        this.modelWeights = {
            fcfe: 25,
            fcff: 25,
            justified_pe: 25,
            justified_pb: 25
        };
        this.valuationResults = null;
        this.apiBaseUrl = 'https://api.quanganh.org'; // Local testing
        // this.apiBaseUrl = 'https://api.quanganh.org'; // Production API endpoint
        this.charts = {
            roeRoa: null,
            liquidity: null,
            pePb: null,
            nim: null
        };
        this.currentLanguage = 'en'; // Default to English

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultAssumptions();
        this.setupThemeToggle();
        this.setupDownloadModal();
        this.applyLanguage(this.currentLanguage);
        this.setupCharts();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Prevent form submit from reloading/clearing input
        const searchForm = document.querySelector('.header-search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
            });
        }

        // Stock search - Search button and Enter key
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadStockData();
            });
        }
        
        document.getElementById('stock-symbol').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.loadStockData();
            }
        });

        // Reset cache when symbol input changes and enable download button
        document.getElementById('stock-symbol').addEventListener('input', (e) => {
            this.resetChartsState();
            
            // Cancel any pending debounced requests
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            
            // Enable download button if valid ticker is entered
            const symbol = e.target.value.trim().toUpperCase();
            const downloadBtn = document.getElementById('download-financials-btn');
            if (downloadBtn) {
                downloadBtn.disabled = !symbol || symbol.length === 0;
            }
            
            // Auto-suggest with 500ms debounce (future enhancement)
            // Could fetch ticker suggestions here
        });

        // Period selector with debounce
        document.getElementById('period-select').addEventListener('change', () => {
            if (this.currentStock) {
                // Cancel pending requests
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }
                
                // Debounce to prevent rapid switching
                this.debounceTimer = setTimeout(() => {
                    this.loadStockData();
                }, 300);
            }
        });

        // Assumptions form
        document.getElementById('calculate-btn').addEventListener('click', () => this.calculateValuation());
        document.getElementById('reset-assumptions-btn').addEventListener('click', () => this.resetAssumptions());

        // Real-time updates on assumption changes
        document.querySelectorAll('#assumptions-form input').forEach(input => {
            input.addEventListener('input', () => this.updateAssumptions());
        });

        // Model weights checkboxes
        document.getElementById('fcfe-enabled').addEventListener('change', () => this.updateModelSelection());
        document.getElementById('fcff-enabled').addEventListener('change', () => this.updateModelSelection());
        document.getElementById('pe-enabled').addEventListener('change', () => this.updateModelSelection());
        document.getElementById('pb-enabled').addEventListener('change', () => this.updateModelSelection());
        document.getElementById('select-all-btn').addEventListener('click', () => this.toggleSelectAll());

        // Export functionality
        const exportReportBtn = document.getElementById('export-report-btn');
        const exportExcelBtn = document.getElementById('export-excel-btn');
        
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => this.exportReport());
        } else {
            console.error('Export PDF button not found');
        }
        
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                console.log('Excel export button clicked');
                this.exportExcelReport();
            });
        } else {
            console.error('Export Excel button not found');
        }
        
        // Setup language toggle
        this.setupLanguageToggle();
    }
    
    setupLanguageToggle() {
        const languageToggle = document.getElementById('language-toggle-btn');
        const langText = languageToggle.querySelector('.lang-text');
        
        // Get saved language or default to English
        const savedLang = localStorage.getItem('language') || 'en';
        this.currentLanguage = savedLang;
        langText.textContent = savedLang.toUpperCase();
        document.documentElement.setAttribute('lang', savedLang);
        this.applyLanguage(savedLang);
        
        languageToggle.addEventListener('click', () => {
            // Toggle between English and Vietnamese
            const newLang = this.currentLanguage === 'en' ? 'vi' : 'en';
            this.currentLanguage = newLang;
            langText.textContent = newLang.toUpperCase();
            localStorage.setItem('language', newLang);
            document.documentElement.setAttribute('lang', newLang);
            this.applyLanguage(newLang);
        });
    }
    
    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle-btn');
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);

        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }



    setupDownloadModal() {
        const downloadBtn = document.getElementById('download-financials-btn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                // Get current stock symbol
                const symbol = this.currentStock?.symbol || document.getElementById('stock-symbol').value.trim().toUpperCase();
                
                if (!symbol) {
                    this.showStatus('Please enter a stock symbol first', 'error');
                    return;
                }
                
                // Validate ticker format
                if (!/^[A-Z0-9]{1,10}$/.test(symbol)) {
                    this.showStatus('Invalid ticker format', 'error');
                    return;
                }
                
                // Show loading state
                this.showStatus(`Preparing download for ${symbol}...`, 'loading');
                
                // Download from VPS backend with error handling
                const fileUrl = `${this.apiBaseUrl}/api/download/${symbol}`;
                
                try {
                    // Directly trigger download with invisible link
                    const tempLink = document.createElement('a');
                    tempLink.href = fileUrl;
                    tempLink.download = `${symbol}.xlsx`;
                    tempLink.style.display = 'none';
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    
                    // Show success message
                    this.showStatus(`Downloading ${symbol}.xlsx - Full financial statements`, 'success');
                    
                    // Clean up after delay
                    setTimeout(() => {
                        document.body.removeChild(tempLink);
                    }, 100);
                    
                } catch (error) {
                    console.error('Download error:', error);
                    this.showStatus('Download failed. Please check your connection and try again.', 'error');
                }
            });
        }
    }

    applyLanguage(lang) {
        // Check if translations are loaded
        if (typeof translations === 'undefined') {
            console.warn('Translations not loaded yet');
            return;
        }

        const langData = translations[lang];
        if (!langData) {
            console.error(`Language ${lang} not found`);
            return;
        }

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (langData[key]) {
                element.textContent = langData[key];
            }
        });

        // Update placeholders for inputs with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (langData[key]) {
                element.placeholder = langData[key];
            }
        });

        // Update footer elements with data-en and data-vi attributes
        document.querySelectorAll('[data-en][data-vi]').forEach(element => {
            const enText = element.getAttribute('data-en');
            const viText = element.getAttribute('data-vi');
            element.textContent = lang === 'en' ? enText : viText;
        });

        // Update app title (only if the element exists)
        const appTitleEl = document.querySelector('.app-title');
        if (appTitleEl && langData.appTitle) {
            appTitleEl.textContent = langData.appTitle;
        }

        const calculateBtn = document.getElementById('calculate-btn');
        if (calculateBtn) {
            calculateBtn.textContent = langData.calculateValuation;
        }

        const resetBtn = document.getElementById('reset-assumptions-btn');
        if (resetBtn) {
            resetBtn.textContent = langData.resetAssumptions;
        }

        const exportBtn = document.getElementById('export-report-btn');
        if (exportBtn) {
            exportBtn.textContent = langData.exportPDFReport;
        }

        // Update select all button
        const selectAllBtn = document.getElementById('select-all-btn');
        if (selectAllBtn) {
            const selectedCount = [
                document.getElementById('fcfe-enabled').checked,
                document.getElementById('fcff-enabled').checked,
                document.getElementById('pe-enabled').checked,
                document.getElementById('pb-enabled').checked
            ].filter(Boolean).length;
            selectAllBtn.textContent = selectedCount === 4 ? langData.deselectAll : langData.selectAll;
        }

    }

    setupCharts() {
        console.log('Setting up charts...');
        
        // Initialize ROE/ROA Chart with area/mountain style
        const roeRoaCtx = document.getElementById('roe-roa-chart').getContext('2d');
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
                        tension: 0.4,                        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
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
                    },                    y: { 
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
        });        // Initialize Liquidity Chart
        const liquidityCtx = document.getElementById('liquidity-chart').getContext('2d');
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
                        tension: 0.3,                        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
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
                    },                    y: { 
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

        // Initialize P/E and P/B Chart with dual y-axes
        console.log('Initializing P/E P/B chart...');
        const pePbCtx = document.getElementById('pe-pb-chart');
        if (!pePbCtx) {
            console.error('P/E P/B chart canvas not found');
            return;
        }
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
                        onClick: function(e, legendItem) {
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
        
        // Initialize NIM Chart
        const nimCtx = document.getElementById('nim-chart')?.getContext('2d');
        if (nimCtx) {
            this.charts.nim = new Chart(nimCtx, {
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
                                callback: function(value) {
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
                                label: function(context) {
                                    return `NIM: ${context.parsed.y.toFixed(3)}%`;
                                }
                            }
                        }
                    },
                    elements: { point: { hoverBorderWidth: 3 } }
                }
            });
        }
        
        } catch (error) {
            console.error('Error creating P/E P/B chart:', error);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    loadDefaultAssumptions() {
        document.getElementById('revenue-growth').value = this.assumptions.revenueGrowth;
        document.getElementById('terminal-growth').value = this.assumptions.terminalGrowth;
        document.getElementById('wacc').value = this.assumptions.wacc;
        document.getElementById('required-return').value = this.assumptions.requiredReturn;
        document.getElementById('tax-rate').value = this.assumptions.taxRate;
        document.getElementById('projection-years').value = this.assumptions.projectionYears;

        this.updateTotalWeight();
    }

    updateAssumptions() {
        this.assumptions.revenueGrowth = parseFloat(document.getElementById('revenue-growth').value);
        this.assumptions.terminalGrowth = parseFloat(document.getElementById('terminal-growth').value);
        this.assumptions.wacc = parseFloat(document.getElementById('wacc').value);
        this.assumptions.requiredReturn = parseFloat(document.getElementById('required-return').value);
        this.assumptions.taxRate = parseFloat(document.getElementById('tax-rate').value);
        this.assumptions.projectionYears = parseInt(document.getElementById('projection-years').value);
    }

    updateModelSelection() {
        // Get checkbox states
        const fcfeEnabled = document.getElementById('fcfe-enabled').checked;
        const fcffEnabled = document.getElementById('fcff-enabled').checked;
        const peEnabled = document.getElementById('pe-enabled').checked;
        const pbEnabled = document.getElementById('pb-enabled').checked;

        // Count selected models
        const selectedCount = [fcfeEnabled, fcffEnabled, peEnabled, pbEnabled].filter(Boolean).length;
        
        // Ensure at least one model is selected
        if (selectedCount === 0) {
            // Re-check the last unchecked checkbox
            event.target.checked = true;
            return;
        }

        // Calculate equal weight for selected models
        const equalWeight = selectedCount > 0 ? 100 / selectedCount : 0;

        // Update weights
        this.modelWeights.fcfe = fcfeEnabled ? equalWeight : 0;
        this.modelWeights.fcff = fcffEnabled ? equalWeight : 0;
        this.modelWeights.justified_pe = peEnabled ? equalWeight : 0;
        this.modelWeights.justified_pb = pbEnabled ? equalWeight : 0;

        // Update UI displays
        document.getElementById('fcfe-weight-display').textContent = this.modelWeights.fcfe.toFixed(1) + '%';
        document.getElementById('fcff-weight-display').textContent = this.modelWeights.fcff.toFixed(1) + '%';
        document.getElementById('pe-weight-display').textContent = this.modelWeights.justified_pe.toFixed(1) + '%';
        document.getElementById('pb-weight-display').textContent = this.modelWeights.justified_pb.toFixed(1) + '%';
        document.getElementById('selected-count').textContent = selectedCount;

        // Update button text
        const selectAllBtn = document.getElementById('select-all-btn');
        selectAllBtn.textContent = selectedCount === 4 ? 'Deselect All' : 'Select All';

        // Fast recalculation using cache if exists
        if (this.valuationResults && this.valuationCache) {
            this.recalculateWeightedAverage();
            this.updateValuationDisplay(); // Update all results display including weighted average
        }
    }

    toggleSelectAll() {
        const selectAllBtn = document.getElementById('select-all-btn');
        const shouldSelectAll = selectAllBtn.textContent === 'Select All';

        document.getElementById('fcfe-enabled').checked = shouldSelectAll;
        document.getElementById('fcff-enabled').checked = shouldSelectAll;
        document.getElementById('pe-enabled').checked = shouldSelectAll;
        document.getElementById('pb-enabled').checked = shouldSelectAll;

        this.updateModelSelection();
    }

    updateTotalWeight() {
        // No longer needed but keep for compatibility
        const total = this.modelWeights.fcfe + this.modelWeights.fcff + 
                     this.modelWeights.justified_pe + this.modelWeights.justified_pb;
        return total;
    }

    normalizeWeights() {
        // Reset to all selected with equal weights
        document.getElementById('fcfe-enabled').checked = true;
        document.getElementById('fcff-enabled').checked = true;
        document.getElementById('pe-enabled').checked = true;
        document.getElementById('pb-enabled').checked = true;

        this.updateModelSelection();
    }

    resetAssumptions() {
        this.assumptions = {
            revenueGrowth: 8.0,
            terminalGrowth: 3.0,
            wacc: 10.5,
            requiredReturn: 12.0,
            taxRate: 20.0,
            projectionYears: 5
        };

        this.loadDefaultAssumptions();
    }    async loadStockData() {
        const symbol = document.getElementById('stock-symbol').value.trim().toUpperCase();
        const period = document.getElementById('period-select').value || 'year'; // Get period from dropdown, default to year

        if (!symbol) {
            this.showStatus('Please enter a stock symbol', 'error');
            return;
        }

        // CRITICAL: Cancel ALL pending requests immediately when new symbol is entered
        this.cancelAllPendingRequests();
        
        // Clear old data immediately to prevent showing stale data
        this.clearDisplay();
        this.resetChartsState();

        // Fast loading: Load stock data immediately without waiting for charts
        await this.loadStockDataOnly(symbol, period);
        
        // Background loading: Load charts in the background if needed
        this.loadChartsInBackground(symbol, period);
    }
    
    cancelAllPendingRequests() {
        // Cancel stock data request
        if (this.abortControllers.stockData) {
            console.log('⚠️ Cancelling pending stock data request');
            this.abortControllers.stockData.abort();
            this.abortControllers.stockData = null;
        }
        
        // Cancel chart data request
        if (this.abortControllers.chartData) {
            console.log('⚠️ Cancelling pending chart data request');
            this.abortControllers.chartData.abort();
            this.abortControllers.chartData = null;
        }
    }

    async loadStockDataOnly(symbol, period) {
        // CRITICAL: Check if this symbol is still current before processing
        const requestSymbol = symbol;
        
        this.showLoading(true);
        this.showStatus('Loading data...', 'info');
        this.loadingState.stockData = true;

        // Create new abort controller for this request
        this.abortControllers.stockData = new AbortController();
        const controller = this.abortControllers.stockData;

        try {
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced timeout for stock data

            // Always fetch current price for accurate valuation comparison
            const fetchPrice = true;
            
            // Fetch stock data only - fastest possible loading
            const stockResponse = await fetch(`${this.apiBaseUrl}/api/app-data/${symbol}?period=${period}&fetch_price=${fetchPrice}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!stockResponse.ok) {
                if (stockResponse.status === 404) {
                    throw new Error('No data found for this stock symbol');
                } else if (stockResponse.status === 500) {
                    throw new Error('Server error while loading data');
                } else {
                    throw new Error('Unable to connect to server');
                }
            }

            const stockData = await stockResponse.json();

            if (!stockData.success) {
                throw new Error(stockData.error || 'Unable to load data from server');
            }

            // CRITICAL: Only update UI if this is still the current symbol
            const currentInputSymbol = document.getElementById('stock-symbol').value.trim().toUpperCase();
            if (requestSymbol !== currentInputSymbol) {
                console.log(`⚠️ Discarding stale data for ${requestSymbol}, current symbol is ${currentInputSymbol}`);
                return; // Discard this response
            }

            this.stockData = stockData;
            this.currentStock = symbol;
            
            // Enable download button when stock data is loaded
            const downloadBtn = document.getElementById('download-financials-btn');
            if (downloadBtn) {
                downloadBtn.disabled = false;
            }
            
            this.updateOverviewDisplay(stockData);
            
            this.showStatus('Data loaded successfully', 'success');
            this.showLoading(false);
            this.loadingState.stockData = false;

        } catch (error) {
            console.error('Error loading stock data:', error);
            
            if (error.name === 'AbortError') {
                // Don't show error for intentional cancellations
                console.log('Previous stock data request cancelled');
            } else {
                this.showStatus(`Error: ${error.message}`, 'error');
                this.stockData = null;
                this.currentStock = null;
                this.clearDisplay();
            }
            
            this.showLoading(false);
            this.loadingState.stockData = false;
        } finally {
            // Clear the abort controller reference
            if (this.abortControllers.stockData === controller) {
                this.abortControllers.stockData = null;
            }
        }
    }

    async loadChartsInBackground(symbol, period) {
        // Cancel previous chart request if still running
        if (this.abortControllers.chartData) {
            console.log('Cancelling previous chart request');
            this.abortControllers.chartData.abort();
        }

        // Check if we have cached chart data for this symbol
        if (this.chartCache.has(symbol)) {
            this.historicalData = this.chartCache.get(symbol);
            this.chartsLoaded = true;
            this.updateCharts();
            return;
        }

        // Only load charts if we don't have them cached
        if (this.chartsLoaded && this.currentStock === symbol) {
            return; // Charts already loaded for this symbol
        }

        this.loadingState.chartData = true;
        this.showChartLoadingIndicator(true);

        // Create new abort controller for this chart request
        this.abortControllers.chartData = new AbortController();
        const controller = this.abortControllers.chartData;

        try {
            const timeoutId = setTimeout(() => controller.abort(), 20000); // Longer timeout for chart data

            const chartResponse = await fetch(`${this.apiBaseUrl}/api/historical-chart-data/${symbol}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            if (chartResponse.ok) {
                const chartData = await chartResponse.json();
                
                console.log('📊 Chart data response:', chartData);
                
                if (chartData.success) {
                    // Only update if this is still the current symbol
                    if (this.currentStock === symbol) {
                        this.historicalData = chartData.data;
                        console.log('📈 Historical data set:', this.historicalData);
                        this.chartsLoaded = true;
                        
                        // Cache the chart data for future use
                        this.chartCache.set(symbol, chartData.data);
                        
                        this.updateCharts();
                        this.showStatus('Charts loaded', 'success');
                    } else {
                        console.log(`Chart data for ${symbol} loaded but user has moved to ${this.currentStock}`);
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Chart request cancelled for symbol:', symbol);
            } else {
                console.error('Error loading chart data:', error);
                if (this.currentStock === symbol) {
                    this.showStatus('Charts could not be loaded', 'warning');
                }
            }
        } finally {
            this.loadingState.chartData = false;
            this.showChartLoadingIndicator(false);
            
            // Clear the abort controller reference
            if (this.abortControllers.chartData === controller) {
                this.abortControllers.chartData = null;
            }
        }
    }

    showChartLoadingIndicator(show) {
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

    async calculateValuation() {
        // Auto-load stock data if not available
        if (!this.currentStock) {
            const symbol = document.getElementById('stock-symbol').value.trim().toUpperCase();
            if (!symbol) {
                this.showStatus('Please enter a stock symbol first', 'error');
                return;
            }
            
            // Load stock data first, then calculate valuation
            this.showStatus('Loading stock data before valuation...', 'info');
            const period = document.getElementById('period-select').value || 'year';
            await this.loadStockDataOnly(symbol, period);
            
            if (!this.currentStock) {
                this.showStatus('Failed to load stock data. Please try again.', 'error');
                return;
            }
            
            // Load charts in background (non-blocking)
            this.loadChartsInBackground(symbol, period);
        }

        // Check if we have cached valuation with same assumptions
        const cacheKey = this.getValuationCacheKey();
        if (this.valuationCache && this.valuationCache.cacheKey === cacheKey) {
            this.recalculateWeightedAverage();
            this.updateValuationDisplay();
            this.updateWeightedResults();
            this.updateRecommendation();
            document.getElementById('export-report-btn').disabled = false;
            document.getElementById('export-excel-btn').disabled = false;
            this.showStatus(`Valuation updated (${cacheTime.toFixed(0)}ms - cached)`, 'success');
            return;
        }

        try {
            this.showStatus('Calculating valuation models...', 'info');

            const requestData = {
                revenueGrowth: this.assumptions.revenueGrowth,
                terminalGrowth: this.assumptions.terminalGrowth,
                wacc: this.assumptions.wacc,
                requiredReturn: this.assumptions.requiredReturn,
                taxRate: this.assumptions.taxRate,
                projectionYears: this.assumptions.projectionYears,
                roe: 15.0,
                payoutRatio: 40.0,
                modelWeights: this.modelWeights,
                currentPrice: this.stockData.current_price, // Pass current price to avoid backend fetch
                // Pass financial data to avoid backend refetch
                financialData: {
                    eps: this.stockData.earnings_per_share,
                    bvps: this.stockData.book_value_per_share,
                    net_income: this.stockData.net_income_ttm,
                    equity: this.stockData.total_assets - this.stockData.total_debt,
                    shares_outstanding: this.stockData.shares_outstanding
                }
            };

            const response = await fetch(`${this.apiBaseUrl}/api/valuation/${this.currentStock}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Valuation calculation failed');
            }

            this.valuationResults = {
                fcfe: {
                    shareValue: result.valuations.fcfe,
                    equityValue: result.valuations.fcfe * (this.stockData.shares_outstanding || result.financial_data.shares_outstanding)
                },
                fcff: {
                    shareValue: result.valuations.fcff,
                    equityValue: result.valuations.fcff * (this.stockData.shares_outstanding || result.financial_data.shares_outstanding)
                },
                justified_pe: {
                    shareValue: result.valuations.justified_pe
                },
                justified_pb: {
                    shareValue: result.valuations.justified_pb
                },
                weighted_average: result.valuations.weighted_average,
                summary: result.summary,
                market_comparison: result.market_comparison,
                financial_data: result.financial_data
            };

            // Cache the valuation results
            this.valuationCache = {
                cacheKey: cacheKey,
                results: JSON.parse(JSON.stringify(this.valuationResults)) // Deep copy
            };

            this.updateValuationDisplay();
            this.updateWeightedResults();
            this.updateRecommendation();

            document.getElementById('export-report-btn').disabled = false;
            document.getElementById('export-excel-btn').disabled = false;
            
            this.showStatus('Valuation completed successfully', 'success');

        } catch (error) {
            console.error('Error calculating valuation:', error);
            this.showStatus(`Error calculating valuation: ${error.message}`, 'error');
        }
    }

    getValuationCacheKey() {
        // Create a cache key based on symbol and assumptions (not weights)
        return `${this.currentStock}_${this.assumptions.revenueGrowth}_${this.assumptions.terminalGrowth}_${this.assumptions.wacc}_${this.assumptions.requiredReturn}_${this.assumptions.taxRate}_${this.assumptions.projectionYears}`;
    }

    recalculateWeightedAverage() {
        // Recalculate only the weighted average when weights change
        if (!this.valuationCache || !this.valuationCache.results) return;

        const results = this.valuationCache.results;
        const totalWeight = this.modelWeights.fcfe + this.modelWeights.fcff + 
                           this.modelWeights.justified_pe + this.modelWeights.justified_pb;

        if (totalWeight === 0) {
            this.valuationResults.weighted_average = 0;
            return;
        }

        const weightedAverage = (
            (results.fcfe.shareValue * this.modelWeights.fcfe) +
            (results.fcff.shareValue * this.modelWeights.fcff) +
            (results.justified_pe.shareValue * this.modelWeights.justified_pe) +
            (results.justified_pb.shareValue * this.modelWeights.justified_pb)
        ) / totalWeight;

        this.valuationResults.weighted_average = weightedAverage;
    }

    updateCharts() {
        if (!this.historicalData) {
            this.clearCharts();
            return;
        }

        // Check if this is a bank stock
        const isBank = this.stockData && this.stockData.sector && 
                      (this.stockData.sector.toLowerCase().includes('bank') || 
                       this.stockData.sector.toLowerCase().includes('ngân hàng'));

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
        this.charts.roeRoa.data.labels = this.historicalData.years;
        this.charts.roeRoa.data.datasets[0].data = this.historicalData.roa_data;
        this.charts.roeRoa.data.datasets[1].data = this.historicalData.roe_data;
        this.charts.roeRoa.update();

        // Update Liquidity Chart (only if not a bank)
        if (!isBank) {
            this.charts.liquidity.data.labels = this.historicalData.years;
            this.charts.liquidity.data.datasets[0].data = this.historicalData.current_ratio_data;
            this.charts.liquidity.data.datasets[1].data = this.historicalData.quick_ratio_data;
            this.charts.liquidity.data.datasets[2].data = this.historicalData.cash_ratio_data;
            this.charts.liquidity.update();
        }

        // Update P/E and P/B Chart
        if (this.charts.pePb) {
            this.charts.pePb.data.labels = this.historicalData.years;
            this.charts.pePb.data.datasets[0].data = this.historicalData.pe_ratio_data || [];
            this.charts.pePb.data.datasets[1].data = this.historicalData.pb_ratio_data || [];
            this.charts.pePb.update();
        }
        
        // Update NIM Chart (only for banks)
        if (isBank && this.charts.nim) {
            console.log('🏦 Bank detected, updating NIM chart');
            console.log('NIM data:', this.historicalData.nim_data);
            console.log('Years:', this.historicalData.years);
            this.charts.nim.data.labels = this.historicalData.years;
            this.charts.nim.data.datasets[0].data = this.historicalData.nim_data || [];
            this.charts.nim.update();
        }
    }

    clearCharts() {
        this.charts.roeRoa.data.labels = [];
        this.charts.roeRoa.data.datasets.forEach(dataset => dataset.data = []);
        this.charts.roeRoa.update();

        this.charts.liquidity.data.labels = [];
        this.charts.liquidity.data.datasets.forEach(dataset => dataset.data = []);
        this.charts.liquidity.update();

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

    resetChartsState() {
        // Reset chart state when symbol input changes - this will force fresh loading for new symbols
        this.chartsLoaded = false;
        this.historicalData = null;
        // Note: We don't clear the entire cache, just reset the current state
        // The cache is still preserved for quick switching between symbols
    }

    updateValuationDisplay() {
        const currentPrice = this.stockData.current_price;

        // FCFE Results
        document.getElementById('fcfe-result').textContent = this.formatCurrency(this.valuationResults.fcfe.shareValue);
        const fcfeDiff = ((this.valuationResults.fcfe.shareValue - currentPrice) / currentPrice) * 100;
        const fcfeDiffElement = document.getElementById('fcfe-diff');
        fcfeDiffElement.textContent = `${fcfeDiff > 0 ? '+' : ''}${fcfeDiff.toFixed(1)}%`;
        fcfeDiffElement.className = `result-diff ${fcfeDiff > 0 ? 'positive' : 'negative'}`;

        // FCFF Results
        document.getElementById('fcff-result').textContent = this.formatCurrency(this.valuationResults.fcff.shareValue);
        const fcffDiff = ((this.valuationResults.fcff.shareValue - currentPrice) / currentPrice) * 100;
        const fcffDiffElement = document.getElementById('fcff-diff');
        fcffDiffElement.textContent = `${fcffDiff > 0 ? '+' : ''}${fcffDiff.toFixed(1)}%`;
        fcffDiffElement.className = `result-diff ${fcffDiff > 0 ? 'positive' : 'negative'}`;

        // Justified P/E Results
        document.getElementById('pe-result').textContent = this.formatCurrency(this.valuationResults.justified_pe.shareValue);
        const peDiff = ((this.valuationResults.justified_pe.shareValue - currentPrice) / currentPrice) * 100;
        const peDiffElement = document.getElementById('pe-diff');
        peDiffElement.textContent = `${peDiff > 0 ? '+' : ''}${peDiff.toFixed(1)}%`;
        peDiffElement.className = `result-diff ${peDiff > 0 ? 'positive' : 'negative'}`;

        // Justified P/B Results
        document.getElementById('pb-result').textContent = this.formatCurrency(this.valuationResults.justified_pb.shareValue);
        const pbDiff = ((this.valuationResults.justified_pb.shareValue - currentPrice) / currentPrice) * 100;
        const pbDiffElement = document.getElementById('pb-diff');
        pbDiffElement.textContent = `${pbDiff > 0 ? '+' : ''}${pbDiff.toFixed(1)}%`;
        pbDiffElement.className = `result-diff ${pbDiff > 0 ? 'positive' : 'negative'}`;

        // Weighted Average Results
        const weightedValue = this.valuationResults.weighted_average;
        document.getElementById('weighted-result').textContent = this.formatCurrency(weightedValue);
        const weightedDiff = ((weightedValue - currentPrice) / currentPrice) * 100;
        const weightedDiffElement = document.getElementById('weighted-diff');
        weightedDiffElement.textContent = `${weightedDiff > 0 ? '+' : ''}${weightedDiff.toFixed(1)}%`;
        weightedDiffElement.className = `result-diff ${weightedDiff > 0 ? 'positive' : 'negative'}`;

        // Update summary
        this.safeUpdateElement('target-price', this.formatCurrency(weightedValue));
        this.safeUpdateElement('summary-potential', `${weightedDiff.toFixed(1)}%`);
        this.safeUpdateElement('return-value', `${weightedDiff.toFixed(1)}%`);

        // Update model details with PE/PB ratios
        this.updateModelDetails();
    }

    updateWeightedResults() {
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const weightedDiff = ((weightedValue - currentPrice) / currentPrice) * 100;

        document.getElementById('weighted-result').textContent = this.formatCurrency(weightedValue);
        const weightedDiffElement = document.getElementById('weighted-diff');
        weightedDiffElement.textContent = `${weightedDiff > 0 ? '+' : ''}${weightedDiff.toFixed(1)}%`;
        weightedDiffElement.className = `result-diff ${weightedDiff > 0 ? 'positive' : 'negative'}`;

        this.safeUpdateElement('target-price', this.formatCurrency(weightedValue));
        this.safeUpdateElement('summary-potential', `${weightedDiff.toFixed(1)}%`);
        this.safeUpdateElement('return-value', `${weightedDiff.toFixed(1)}%`);
    }

    updateRecommendation() {
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;

        let recommendation, status, reasoning;

        if (this.valuationResults.market_comparison) {
            recommendation = this.valuationResults.market_comparison.recommendation;
            reasoning = `Based on 4-model average of ${this.formatCurrency(weightedValue)} vs current price ${this.formatCurrency(currentPrice)}`;
            status = recommendation.includes('BUY') ? 'positive' : recommendation.includes('SELL') ? 'negative' : 'neutral';
        } else {
            if (upside > 15) {
                recommendation = 'BUY';
                status = 'positive';
                reasoning = 'Significant undervaluation detected - upside potential above 15%';
            } else if (upside < -15) {
                recommendation = 'SELL';
                status = 'negative';
                reasoning = 'Significant overvaluation detected - downside risk above 15%';
            } else {
                recommendation = 'HOLD';
                status = 'neutral';
                reasoning = 'Stock is fairly valued - upside/downside within 15% range';
            }
        }

        const recommendationElement = document.getElementById('recommendation');
        recommendationElement.innerHTML = `<span class="status status--${status}">${recommendation}</span>`;

        const finalRecommendationElement = document.getElementById('final-recommendation');
        finalRecommendationElement.innerHTML = `<span class="status status--${status}">${recommendation}</span>`;

        this.safeUpdateElement('recommendation-reasoning', reasoning);

        // Placeholder for confidence level
        this.safeUpdateElement('confidence-level', this.valuationResults.summary?.confidence || '--');
    }

    async exportReport() {
        if (!this.stockData || !this.valuationResults) {
            this.showStatus('No data available to export report', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                console.warn('jsPDF not available, generating text report');
                this.generateTextReport();
                this.showStatus('PDF library not available. Downloaded text report.', 'warning');
                return;
            }

            this.generatePDFReport(jsPDF);
            
            // Also download Excel financial data
            await this.downloadFinancialData();
            
            this.showStatus('PDF report and Excel data downloaded successfully!', 'success');

        } catch (error) {
            console.error('Error generating PDF report:', error);
            try {
                this.generateTextReport();
                this.showStatus('PDF generation failed. Downloaded text report.', 'warning');
            } catch (textError) {
                console.error('Text report generation failed:', textError);
                this.showStatus('Error generating report: ' + error.message, 'error');
            }
        }
    }

    async downloadFinancialData() {
        const symbol = this.currentStock?.symbol || this.stockData?.symbol;
        
        if (!symbol) {
            console.warn('No symbol available for Excel download');
            return;
        }

        const fileUrl = `${this.apiBaseUrl}/api/download/${symbol}`;
        
        try {
            // Check if file exists
            const checkResponse = await fetch(fileUrl, { method: 'HEAD' });
            
            if (!checkResponse.ok) {
                console.warn(`Excel data not available for ${symbol}`);
                return;
            }
            
            // File exists, download it
            const tempLink = document.createElement('a');
            tempLink.href = fileUrl;
            tempLink.download = `${symbol}_Financial_Data.xlsx`;
            tempLink.style.display = 'none';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            
            console.log(`Excel financial data downloaded for ${symbol}`);
        } catch (error) {
            console.error('Error downloading Excel data:', error);
            // Don't show error to user, it's optional
        }
    }

    generatePDFReport(jsPDFConstructor) {
        const doc = new jsPDFConstructor();
        
        const lang = this.currentLanguage;
        const t = translations[lang];

        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 7;
        const contentWidth = pageWidth - 2 * margin;
        let yPosition = margin;
        let pageNumber = 1;

        // Helper: Check if need new page
        const checkPageBreak = (neededSpace = 20) => {
            if (yPosition + neededSpace > pageHeight - 30) {
                doc.addPage();
                pageNumber++;
                yPosition = margin;
                addPageHeader();
                return true;
            }
            return false;
        };

        // Helper: Add page header (after first page)
        const addPageHeader = () => {
            if (pageNumber > 1) {
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text(`${this.currentStock} - Valuation Report`, margin, 15);
                doc.line(margin, 18, pageWidth - margin, 18);
                yPosition = 25;
            }
        };

        // Helper: Add page footer
        const addPageFooter = () => {
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
            doc.text('Generated by Stock Valuation Tool', margin, pageHeight - 10);
            doc.text(new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US'), pageWidth / 2 - 30, pageHeight - 10);
        };

        // Helper: Add text (English only to avoid UTF-8 issues)
        const addText = (text, fontSize = 10, style = 'normal') => {
            checkPageBreak();
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', style);
            doc.setTextColor(0, 0, 0);
            // Convert Vietnamese to English labels
            const englishText = this.toEnglishLabel(text);
            doc.text(englishText, margin, yPosition);
            yPosition += lineHeight;
        };

        // Helper: Add centered text
        const addCenteredText = (text, fontSize = 10, style = 'normal') => {
            checkPageBreak();
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', style);
            doc.setTextColor(0, 0, 0);
            const englishText = this.toEnglishLabel(text);
            const textWidth = doc.getTextWidth(englishText);
            doc.text(englishText, (pageWidth - textWidth) / 2, yPosition);
            yPosition += lineHeight;
        };

        // Helper: Add section title with line
        const addSectionTitle = (title, fontSize = 12) => {
            checkPageBreak(15);
            yPosition += 3;
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(41, 98, 255);
            const englishTitle = this.toEnglishLabel(title);
            doc.text(englishTitle, margin, yPosition);
            yPosition += 2;
            doc.setDrawColor(41, 98, 255);
            doc.setLineWidth(0.5);
            doc.line(margin, yPosition, margin + 60, yPosition);
            yPosition += 8;
        };

        // Helper: Add table row
        const addTableRow = (label, value, isHeader = false, isHighlight = false) => {
            checkPageBreak(10);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', isHeader ? 'bold' : 'normal');

            // Background color
            if (isHighlight) {
                doc.setFillColor(232, 245, 233); // Light green
                doc.rect(margin, yPosition - 5, contentWidth, lineHeight, 'F');
            } else if (isHeader) {
                doc.setFillColor(245, 245, 245); // Light gray
                doc.rect(margin, yPosition - 5, contentWidth, lineHeight, 'F');
            }

            // Text
            doc.setTextColor(0, 0, 0);
            const englishLabel = this.toEnglishLabel(label);
            const englishValue = this.toEnglishLabel(value);
            doc.text(englishLabel, margin + 3, yPosition);
            doc.text(englishValue, margin + 100, yPosition);

            // Border
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.rect(margin, yPosition - 5, contentWidth, lineHeight);

            yPosition += lineHeight;
        };

        // ========== HEADER ==========
        doc.setFillColor(41, 98, 255);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('STOCK VALUATION REPORT', pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        const companyName = `${this.stockData.name || this.currentStock} (${this.currentStock})`;
        doc.text(companyName, pageWidth / 2, 25, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, 33, { align: 'center' });
        
        yPosition = 50;

        // ========== COMPANY INFORMATION ==========
        addSectionTitle(t.companyInformation || 'Company Information');
        addTableRow('Stock Symbol', this.stockData.symbol || '--');
        addTableRow('Company Name', this.stockData.name || '--');
        addTableRow('Industry', this.stockData.sector || '--');
        addTableRow('Exchange', this.stockData.exchange || '--');

        // ========== MARKET DATA ==========
        addSectionTitle(t.marketData || 'Market Data');
        addTableRow('Current Price', this.formatCurrency(currentPrice));
        addTableRow('Market Cap', this.formatLargeNumber(this.stockData.market_cap));
        addTableRow('Shares Outstanding', this.formatLargeNumber(this.stockData.shares_outstanding));
        addTableRow('P/E Ratio', this.formatNumber(this.stockData.pe_ratio));
        addTableRow('P/B Ratio', this.formatNumber(this.stockData.pb_ratio));
        addTableRow('EPS', this.formatCurrency(this.stockData.eps));
        addTableRow('Book Value/Share', this.formatCurrency(this.stockData.book_value_per_share));

        // ========== VALUATION RESULTS ==========
        addSectionTitle(t.valuationResults || 'Valuation Results');
        addTableRow('Valuation Model', 'Share Value (VND)', true);
        addTableRow('FCFE (Free Cash Flow to Equity)', this.formatCurrency(this.valuationResults.fcfe.shareValue));
        addTableRow('FCFF (Free Cash Flow to Firm)', this.formatCurrency(this.valuationResults.fcff.shareValue));
        addTableRow('Justified P/E Multiple', this.formatCurrency(this.valuationResults.justified_pe.shareValue));
        addTableRow('Justified P/B Multiple', this.formatCurrency(this.valuationResults.justified_pb.shareValue));
        yPosition += 2;
        addTableRow('WEIGHTED AVERAGE TARGET PRICE', this.formatCurrency(weightedValue), true, true);

        // ========== MARKET COMPARISON ==========
        addSectionTitle(t.marketComparison || 'Market Comparison');
        addTableRow('Current Market Price', this.formatCurrency(currentPrice));
        addTableRow('Intrinsic Value (Target)', this.formatCurrency(weightedValue));
        
        const upsideText = `${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`;
        const upsideLabel = upside >= 0 ? 'Upside Potential' : 'Downside Risk';
        addTableRow(upsideLabel, upsideText, false, Math.abs(upside) > 10);
        
        // Recommendation
        if (this.valuationResults.market_comparison?.recommendation) {
            const rec = this.valuationResults.market_comparison.recommendation;
            addTableRow('Investment Recommendation', rec.toUpperCase(), true, true);
        }

        // ========== PAGE 2: ASSUMPTIONS ==========
        checkPageBreak(80);
        
        addSectionTitle(t.modelAssumptions || 'Valuation Assumptions');
        addTableRow('Revenue Growth Rate', `${this.assumptions.revenueGrowth}%`);
        addTableRow('Terminal Growth Rate', `${this.assumptions.terminalGrowth}%`);
        addTableRow('WACC (Cost of Capital)', `${this.assumptions.wacc}%`);
        addTableRow('Required Return (Equity)', `${this.assumptions.requiredReturn}%`);
        addTableRow('Corporate Tax Rate', `${this.assumptions.taxRate}%`);
        addTableRow('Projection Period', `${this.assumptions.projectionYears} years`);

        addSectionTitle('Model Weights');
        addTableRow('FCFE Weight', `${this.modelWeights.fcfe}%`);
        addTableRow('FCFF Weight', `${this.modelWeights.fcff}%`);
        addTableRow('Justified P/E Weight', `${this.modelWeights.justified_pe}%`);
        addTableRow('Justified P/B Weight', `${this.modelWeights.justified_pb}%`);

        // ========== FINANCIAL METRICS ==========
        addSectionTitle(t.financialMetrics || 'Key Financial Metrics');
        addTableRow('Revenue (TTM)', this.formatLargeNumber(this.stockData.revenue_ttm));
        addTableRow('Net Income (TTM)', this.formatLargeNumber(this.stockData.net_income_ttm));
        addTableRow('EBITDA', this.formatLargeNumber(this.stockData.ebitda));
        addTableRow('ROE (Return on Equity)', this.formatPercent(this.stockData.roe));
        addTableRow('ROA (Return on Assets)', this.formatPercent(this.stockData.roa));
        addTableRow('Debt/Equity Ratio', this.formatNumber(this.stockData.debt_to_equity));

        // ========== DISCLAIMER ==========
        checkPageBreak(30);
        yPosition += 10;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        const disclaimer = 'DISCLAIMER: This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Please consult with a qualified financial advisor before making investment decisions.';
        const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
        doc.text(disclaimerLines, margin, yPosition);

        // ========== FOOTER ON ALL PAGES ==========
        const totalPages = pageNumber;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 25, pageHeight - 10);
            if (i === 1) {
                doc.text('Generated by Stock Valuation Tool', margin, pageHeight - 10);
            }
        }

        const fileName = `${this.currentStock}_Valuation_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    }

    // Helper: Convert Vietnamese labels to English (avoid UTF-8 issues)
    toEnglishLabel(text) {
        if (typeof text !== 'string') return String(text);
        
        // Keep numbers and common symbols
        if (/^[\d\s,.%\-+()/:]+$/.test(text)) return text;
        
        // Common Vietnamese to English mappings
        const mappings = {
            'Thông tin công ty': 'Company Information',
            'Dữ liệu thị trường': 'Market Data',
            'Kết quả định giá': 'Valuation Results',
            'So sánh thị trường': 'Market Comparison',
            'Giả định mô hình': 'Model Assumptions',
            'Chỉ số tài chính': 'Financial Metrics',
            'Khuyến nghị đầu tư': 'Investment Recommendation',
            'Mua mạnh': 'STRONG BUY',
            'Mua': 'BUY',
            'Giữ': 'HOLD',
            'Bán': 'SELL',
            'Bán mạnh': 'STRONG SELL'
        };
        
        return mappings[text] || text;
    }

    generateTextReport() {
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;

        const reportContent = `
STOCK VALUATION REPORT
=====================
Company: ${this.stockData.name} (${this.currentStock})
Date: ${new Date().toLocaleDateString('en-US')}

COMPANY INFORMATION
------------------
Stock Symbol: ${this.stockData.symbol}
Company Name: ${this.stockData.name}
Industry: ${this.stockData.sector || '--'}
Exchange: ${this.stockData.exchange || '--'}

MARKET DATA
-----------
Current Price: ${this.formatCurrency(currentPrice)}
Market Cap: ${this.formatLargeNumber(this.stockData.market_cap)}
P/E Ratio: ${this.formatNumber(this.stockData.pe_ratio)}
P/B Ratio: ${this.formatNumber(this.stockData.pb_ratio)}
EPS: ${this.formatCurrency(this.stockData.eps)}

VALUATION RESULTS
----------------
FCFE: ${this.formatCurrency(this.valuationResults.fcfe.shareValue)} (Weight: ${this.modelWeights.fcfe}%)
FCFF: ${this.formatCurrency(this.valuationResults.fcff.shareValue)} (Weight: ${this.modelWeights.fcff}%)
Justified P/E: ${this.formatCurrency(this.valuationResults.justified_pe.shareValue)} (Weight: ${this.modelWeights.justified_pe}%)
Justified P/B: ${this.formatCurrency(this.valuationResults.justified_pb.shareValue)} (Weight: ${this.modelWeights.justified_pb}%)

WEIGHTED AVERAGE: ${this.formatCurrency(weightedValue)}

MARKET COMPARISON
----------------
Current Price: ${this.formatCurrency(currentPrice)}
Target Price: ${this.formatCurrency(weightedValue)}
Upside/Downside Potential: ${upside.toFixed(1)}%

ASSUMPTIONS USED
---------------
Revenue Growth: ${this.assumptions.revenueGrowth}%
Terminal Growth: ${this.assumptions.terminalGrowth}%
WACC: ${this.assumptions.wacc}%
Required Return: ${this.assumptions.requiredReturn}%
Tax Rate: ${this.assumptions.taxRate}%
Projection Years: ${this.assumptions.projectionYears}

Generated by Stock Valuation Tool
        `.trim();

        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentStock}_valuation_report_${new Date().toISOString().split('T')[0]}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async exportExcelReport() {
        if (!this.stockData || !this.valuationResults) {
            this.showStatus('No data available to export Excel report', 'error');
            return;
        }

        try {
            // Check if required libraries are loaded
            if (typeof ExcelJS === 'undefined') {
                this.showStatus('ExcelJS library not loaded yet, please try again', 'warning');
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                this.showStatus('JSZip library not loaded yet, please try again', 'warning');
                return;
            }

            this.showStatus('Generating Excel reports and downloading original data...', 'info');

            const zip = new JSZip();
            const symbol = this.currentStock;
            const dateStr = new Date().toISOString().split('T')[0];
            
            // FILE 1: Create valuation report Excel
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'quanganh.org';
            workbook.created = new Date();
            
            // SHEET: Summary Dashboard
            const summarySheet = workbook.addWorksheet('Summary Dashboard', {
                views: [{ showGridLines: false }]
            });
            await this.createSummaryDashboard(summarySheet, workbook);
            
            // SHEET: FCFE Detailed Calculations (with formulas)
            const fcfeSheet = workbook.addWorksheet('FCFE Analysis', {
                views: [{ showGridLines: true }]
            });
            this.createFCFESheet(fcfeSheet);
            
            // SHEET: FCFF Detailed Calculations (with formulas)
            const fcffSheet = workbook.addWorksheet('FCFF Analysis', {
                views: [{ showGridLines: true }]
            });
            this.createFCFFSheet(fcffSheet);
            
            // SHEET: P/E Analysis (with formulas)
            const peSheet = workbook.addWorksheet('PE Analysis', {
                views: [{ showGridLines: true }]
            });
            this.createPESheet(peSheet);
            
            // SHEET: P/B Analysis (with formulas)
            const pbSheet = workbook.addWorksheet('PB Analysis', {
                views: [{ showGridLines: true }]
            });
            this.createPBSheet(pbSheet);
            
            // SHEET: Assumptions & Inputs
            const assumptionsSheet = workbook.addWorksheet('Assumptions', {
                views: [{ showGridLines: true }]
            });
            this.createAssumptionsSheet(assumptionsSheet);
            
            // Generate valuation Excel buffer
            const valuationBuffer = await workbook.xlsx.writeBuffer();
            zip.file(`${symbol}_Valuation_${dateStr}.xlsx`, valuationBuffer);
            
            // FILE 2: Try to fetch original financial data Excel
            let originalDataAdded = false;
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/download/${symbol}`);
                
                if (response.ok && response.headers.get('content-type')?.includes('spreadsheet')) {
                    const originalBuffer = await response.arrayBuffer();
                    zip.file(`${symbol}_Financial_Data.xlsx`, originalBuffer);
                    originalDataAdded = true;
                    console.log('Original financial data added to ZIP');
                } else {
                    console.warn('Original financial data not available');
                }
            } catch (error) {
                console.error('Error fetching original financial data:', error);
            }
            
            // Generate ZIP and download
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            if (typeof saveAs !== 'undefined') {
                saveAs(zipBlob, `${symbol}_Complete_Report_${dateStr}.zip`);
            } else {
                // Fallback if FileSaver not loaded
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${symbol}_Complete_Report_${dateStr}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            const successMsg = originalDataAdded 
                ? `ZIP package downloaded with valuation report and original financial data!`
                : `ZIP package downloaded with valuation report!`;
            this.showStatus(successMsg, 'success');
        } catch (error) {
            console.error('Error generating Excel report:', error);
            this.showStatus('Error generating Excel report: ' + error.message, 'error');
        }
    }

    async addOriginalFinancialData(workbook) {
        const symbol = this.currentStock;
        
        try {
            // Fetch original Excel file from VPS
            const response = await fetch(`${this.apiBaseUrl}/api/download/${symbol}`);
            
            if (response.ok && response.headers.get('content-type')?.includes('spreadsheet')) {
                const arrayBuffer = await response.arrayBuffer();
                const originalWorkbook = new ExcelJS.Workbook();
                await originalWorkbook.xlsx.load(arrayBuffer);
                
                console.log(`Loading original Excel file with ${originalWorkbook.worksheets.length} sheets`);
                
                // Copy ALL sheets from original workbook
                for (let sheetIndex = 0; sheetIndex < originalWorkbook.worksheets.length; sheetIndex++) {
                    const sheet = originalWorkbook.worksheets[sheetIndex];
                    
                    console.log(`Copying sheet ${sheetIndex + 1}: ${sheet.name}`);
                    
                    // Create new sheet with original name
                    const newSheet = workbook.addWorksheet(sheet.name);
                    
                    // Copy all rows and cells with full formatting
                    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                        const newRow = newSheet.getRow(rowNumber);
                        
                        // Copy row height first
                        if (row.height) {
                            newRow.height = row.height;
                        }
                        
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            const newCell = newRow.getCell(colNumber);
                            
                            // Copy value (including formulas)
                            if (cell.value !== undefined && cell.value !== null) {
                                newCell.value = cell.value;
                            }
                            
                            // Deep copy all style properties
                            if (cell.style) {
                                newCell.style = {
                                    ...cell.style,
                                    font: cell.font ? { ...cell.font } : undefined,
                                    alignment: cell.alignment ? { ...cell.alignment } : undefined,
                                    border: cell.border ? {
                                        top: cell.border.top ? { ...cell.border.top } : undefined,
                                        left: cell.border.left ? { ...cell.border.left } : undefined,
                                        bottom: cell.border.bottom ? { ...cell.border.bottom } : undefined,
                                        right: cell.border.right ? { ...cell.border.right } : undefined
                                    } : undefined,
                                    fill: cell.fill ? { ...cell.fill } : undefined,
                                    numFmt: cell.numFmt
                                };
                            }
                            
                            // Copy data validation
                            if (cell.dataValidation) {
                                newCell.dataValidation = cell.dataValidation;
                            }
                            
                            // Copy hyperlink
                            if (cell.hyperlink) {
                                newCell.hyperlink = cell.hyperlink;
                            }
                            
                            // Copy note/comment
                            if (cell.note) {
                                newCell.note = cell.note;
                            }
                        });
                        
                        newRow.commit();
                    });
                    
                    // Copy column widths and properties
                    if (sheet.columns) {
                        sheet.columns.forEach((col, idx) => {
                            if (col) {
                                const targetCol = newSheet.getColumn(idx + 1);
                                if (col.width) {
                                    targetCol.width = col.width;
                                }
                                if (col.hidden) {
                                    targetCol.hidden = col.hidden;
                                }
                                if (col.style) {
                                    targetCol.style = col.style;
                                }
                            }
                        });
                    }
                    
                    // Copy merged cells
                    if (sheet.model && sheet.model.merges) {
                        Object.keys(sheet.model.merges).forEach(mergeRef => {
                            try {
                                newSheet.mergeCells(mergeRef);
                            } catch (e) {
                                console.warn(`Could not merge cells ${mergeRef}:`, e);
                            }
                        });
                    }
                    
                    // Copy sheet properties
                    if (sheet.properties) {
                        newSheet.properties = {
                            ...sheet.properties
                        };
                    }
                    
                    // Copy page setup
                    if (sheet.pageSetup) {
                        newSheet.pageSetup = {
                            ...sheet.pageSetup
                        };
                    }
                    
                    // Copy views (frozen panes, etc)
                    if (sheet.views && sheet.views.length > 0) {
                        newSheet.views = sheet.views.map(view => ({ ...view }));
                    }
                    
                    // Copy auto filter
                    if (sheet.autoFilter) {
                        newSheet.autoFilter = sheet.autoFilter;
                    }
                }
                
                console.log(`Successfully integrated ${originalWorkbook.worksheets.length} sheets from original financial data`);
                return true; // Success
            } else {
                console.warn(`Financial data file not available (HTTP ${response.status})`);
                return false;
            }
        } catch (error) {
            console.error('Error fetching original financial data:', error);
            return false; // Not critical - continue without
        }
    }

    createAssumptionsSheet(sheet) {
        let row = 1;
        
        // Header
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = 'VALUATION ASSUMPTIONS & INPUTS';
        sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '6C757D' } };
        sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 30;
        row += 2;
        
        // Company Data Section
        sheet.getCell(`A${row}`).value = 'COMPANY DATA';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        const companyData = [
            ['Stock Symbol', this.currentStock],
            ['Company Name', this.stockData.name],
            ['Industry', this.stockData.sector],
            ['Exchange', this.stockData.exchange],
            ['', ''],
            ['Current Price (VND)', this.stockData.current_price, '#,##0'],
            ['Market Cap (VND)', this.stockData.market_cap, '#,##0'],
            ['Shares Outstanding', this.stockData.shares_outstanding, '#,##0'],
            ['', ''],
            ['EPS (VND)', this.stockData.eps || 0, '#,##0'],
            ['Book Value/Share (VND)', this.stockData.book_value_per_share || 0, '#,##0'],
            ['P/E Ratio', this.stockData.pe_ratio || 0, '0.00'],
            ['P/B Ratio', this.stockData.pb_ratio || 0, '0.00'],
            ['', ''],
            ['Revenue (TTM)', this.stockData.revenue_ttm || 0, '#,##0'],
            ['Net Income (TTM)', this.stockData.net_income_ttm || 0, '#,##0'],
            ['EBITDA', this.stockData.ebitda || 0, '#,##0'],
            ['ROE (%)', this.stockData.roe || 0, '0.00'],
            ['ROA (%)', this.stockData.roa || 0, '0.00'],
            ['Debt/Equity', this.stockData.debt_to_equity || 0, '0.00']
        ];
        
        companyData.forEach(([label, value, format]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            if (format && typeof value === 'number') {
                sheet.getCell(`B${row}`).numFmt = format;
            }
            if (label !== '') {
                sheet.getCell(`A${row}`).font = { bold: true };
            }
            row++;
        });
        
        row += 2;
        
        // Valuation Assumptions Section
        sheet.getCell(`A${row}`).value = 'VALUATION ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        const assumptions = [
            ['Revenue Growth Rate (%)', this.assumptions.revenueGrowth, '0.00'],
            ['Terminal Growth Rate (%)', this.assumptions.terminalGrowth, '0.00'],
            ['WACC - Weighted Average Cost of Capital (%)', this.assumptions.wacc, '0.00'],
            ['Cost of Equity / Required Return (%)', this.assumptions.requiredReturn, '0.00'],
            ['Tax Rate (%)', this.assumptions.taxRate, '0.00'],
            ['Projection Years', this.assumptions.projectionYears, '0'],
            ['Payout Ratio (%)', this.assumptions.payoutRatio || 50, '0.00']
        ];
        
        assumptions.forEach(([label, value, format]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            if (format) {
                sheet.getCell(`B${row}`).numFmt = format;
            }
            sheet.getCell(`A${row}`).font = { bold: true };
            row++;
        });
        
        row += 2;
        
        // Model Weights Section
        sheet.getCell(`A${row}`).value = 'MODEL WEIGHTS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        const weights = [
            ['FCFE Weight (%)', this.modelWeights.fcfe],
            ['FCFF Weight (%)', this.modelWeights.fcff],
            ['P/E Weight (%)', this.modelWeights.justified_pe],
            ['P/B Weight (%)', this.modelWeights.justified_pb],
            ['Total', this.modelWeights.fcfe + this.modelWeights.fcff + this.modelWeights.justified_pe + this.modelWeights.justified_pb]
        ];
        
        weights.forEach(([label, value], idx) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            sheet.getCell(`B${row}`).numFmt = '0.00';
            sheet.getCell(`A${row}`).font = { bold: true };
            if (idx === weights.length - 1) {
                sheet.getCell(`A${row}`).font = { bold: true, size: 11 };
                sheet.getCell(`B${row}`).font = { bold: true };
            }
            row++;
        });
        
        // Column widths
        sheet.getColumn(1).width = 45;
        sheet.getColumn(2).width = 25;
    }

    async createSummaryDashboard(sheet, workbook) {
        const lang = this.currentLanguage;
        const t = translations[lang];
        
        let row = 1;
        
        // Header with branding
        sheet.mergeCells('A1:F1');
        sheet.getCell('A1').value = 'COMPREHENSIVE STOCK VALUATION REPORT';
        sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0066CC' } };
        sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 30;
        row++;
        
        sheet.mergeCells('A2:F2');
        sheet.getCell('A2').value = 'Powered by quanganh.org | Professional Stock Analysis Platform';
        sheet.getCell('A2').font = { italic: true, size: 10 };
        sheet.getCell('A2').alignment = { horizontal: 'center' };
        row += 2;
        
        // Company Info Section
        sheet.getCell(`A${row}`).value = 'COMPANY INFORMATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        const companyInfo = [
            ['Stock Symbol', this.currentStock],
            ['Company Name', this.stockData.name],
            ['Industry', this.stockData.sector],
            ['Exchange', this.stockData.exchange],
            ['Report Date', new Date().toLocaleString()]
        ];
        
        companyInfo.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            sheet.getCell(`A${row}`).font = { bold: true };
            row++;
        });
        row++;
        
        // Market Data Section
        sheet.getCell(`A${row}`).value = 'MARKET DATA';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        const marketDataRow = row;
        const marketData = [
            ['Current Price (VND)', this.stockData.current_price, '#,##0'],
            ['Market Cap (Billion VND)', this.stockData.market_cap / 1e9, '#,##0.00'],
            ['Shares Outstanding (Million)', this.stockData.shares_outstanding / 1e6, '#,##0.00'],
            ['P/E Ratio', this.stockData.pe_ratio, '#,##0.00'],
            ['P/B Ratio', this.stockData.pb_ratio, '#,##0.00'],
            ['EPS (VND)', this.stockData.eps, '#,##0']
        ];
        
        marketData.forEach(([label, value, format]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            sheet.getCell(`B${row}`).numFmt = format;
            sheet.getCell(`A${row}`).font = { bold: true };
            row++;
        });
        row++;
        
        // Valuation Summary Section with FORMULAS
        sheet.getCell(`A${row}`).value = 'VALUATION SUMMARY';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7E6E6' } };
        row++;
        
        // Header row for valuation table
        const valHeaderRow = row;
        ['Method', 'Fair Value (VND)', 'Current Price', 'Upside %', 'Weight %', 'Weighted Value'].forEach((header, idx) => {
            const cell = sheet.getCell(row, idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
            cell.alignment = { horizontal: 'center' };
        });
        row++;
        
        const valuationStartRow = row;
        const currentPrice = this.stockData.current_price;
        
        // FCFE Row with formulas
        sheet.getCell(`A${row}`).value = 'FCFE';
        sheet.getCell(`B${row}`).value = this.valuationResults.fcfe.shareValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = currentPrice;
        sheet.getCell(`C${row}`).numFmt = '#,##0';
        sheet.getCell(`D${row}`).value = { formula: `(B${row}-C${row})/C${row}*100` };
        sheet.getCell(`D${row}`).numFmt = '0.00"%"';
        sheet.getCell(`E${row}`).value = this.modelWeights.fcfe / 100;
        sheet.getCell(`E${row}`).numFmt = '0.00"%"';
        sheet.getCell(`F${row}`).value = { formula: `B${row}*E${row}` };
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        row++;
        
        // FCFF Row
        sheet.getCell(`A${row}`).value = 'FCFF';
        sheet.getCell(`B${row}`).value = this.valuationResults.fcff.shareValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = currentPrice;
        sheet.getCell(`C${row}`).numFmt = '#,##0';
        sheet.getCell(`D${row}`).value = { formula: `(B${row}-C${row})/C${row}*100` };
        sheet.getCell(`D${row}`).numFmt = '0.00"%"';
        sheet.getCell(`E${row}`).value = this.modelWeights.fcff / 100;
        sheet.getCell(`E${row}`).numFmt = '0.00"%"';
        sheet.getCell(`F${row}`).value = { formula: `B${row}*E${row}` };
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        row++;
        
        // P/E Row
        sheet.getCell(`A${row}`).value = 'P/E';
        sheet.getCell(`B${row}`).value = this.valuationResults.justified_pe.shareValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = currentPrice;
        sheet.getCell(`C${row}`).numFmt = '#,##0';
        sheet.getCell(`D${row}`).value = { formula: `(B${row}-C${row})/C${row}*100` };
        sheet.getCell(`D${row}`).numFmt = '0.00"%"';
        sheet.getCell(`E${row}`).value = this.modelWeights.justified_pe / 100;
        sheet.getCell(`E${row}`).numFmt = '0.00"%"';
        sheet.getCell(`F${row}`).value = { formula: `B${row}*E${row}` };
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        row++;
        
        // P/B Row
        sheet.getCell(`A${row}`).value = 'P/B';
        sheet.getCell(`B${row}`).value = this.valuationResults.justified_pb.shareValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = currentPrice;
        sheet.getCell(`C${row}`).numFmt = '#,##0';
        sheet.getCell(`D${row}`).value = { formula: `(B${row}-C${row})/C${row}*100` };
        sheet.getCell(`D${row}`).numFmt = '0.00"%"';
        sheet.getCell(`E${row}`).value = this.modelWeights.justified_pb / 100;
        sheet.getCell(`E${row}`).numFmt = '0.00"%"';
        sheet.getCell(`F${row}`).value = { formula: `B${row}*E${row}` };
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        row++;
        
        // Total row with formula
        sheet.getCell(`A${row}`).value = 'WEIGHTED AVERAGE';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`F${row}`).value = { formula: `SUM(F${valuationStartRow}:F${row-1})` };
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        sheet.getCell(`F${row}`).font = { bold: true, size: 12, color: { argb: '0066CC' } };
        
        // Calculate upside for weighted average
        const weightedRow = row;
        sheet.getCell(`D${row}`).value = { formula: `(F${row}-C${valuationStartRow})/C${valuationStartRow}*100` };
        sheet.getCell(`D${row}`).numFmt = '0.00"%"';
        sheet.getCell(`D${row}`).font = { bold: true };
        row += 2;
        
        // Add a simple chart showing valuation comparison
        try {
            // Note: ExcelJS chart support is limited, but we'll add a basic column chart
            // Users can enhance it in Excel
            sheet.getCell(`A${row}`).value = 'Chart: See detailed charts in individual analysis sheets';
            sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '666666' } };
        } catch (e) {
            console.warn('Chart creation not supported:', e);
        }
        
        // Column widths
        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 18;
        sheet.getColumn(3).width = 18;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 12;
        sheet.getColumn(6).width = 18;
    }

    createFCFESheet(sheet) {
        let row = 1;
        
        // Header
        sheet.mergeCells('A1:G1');
        sheet.getCell('A1').value = 'FCFE (Free Cash Flow to Equity) ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0066CC' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;
        
        // Assumptions Section
        sheet.getCell(`A${row}`).value = 'ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        const assumptionsStart = row;
        sheet.getCell(`A${row}`).value = 'Cost of Equity (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.requiredReturn / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'CostOfEquity';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Terminal Growth Rate (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.terminalGrowth / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'TerminalGrowth';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Projection Years';
        sheet.getCell(`B${row}`).value = this.assumptions.projectionYears;
        sheet.getCell(`B${row}`).name = 'ProjectionYears';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Shares Outstanding';
        sheet.getCell(`B${row}`).value = this.stockData.shares_outstanding;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'SharesOutstanding';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Current Stock Price (VND)';
        sheet.getCell(`B${row}`).value = this.stockData.current_price;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'CurrentPrice';
        row += 2;
        
        // Cash Flow Projections Table
        sheet.getCell(`A${row}`).value = 'CASH FLOW PROJECTIONS & DISCOUNTING';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        // Table headers
        const tableHeaderRow = row;
        ['Year', 'FCFE (VND)', 'Discount Rate', 'Discount Factor', 'Present Value (VND)', 'Formula', 'Calculation'].forEach((header, idx) => {
            const cell = sheet.getCell(row, idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
        });
        row++;
        
        const dataStartRow = row;
        
        // Calculate projected cash flows (since backend doesn't provide them)
        const baseFCFE = this.stockData.net_income_ttm || this.stockData.eps * this.stockData.shares_outstanding || 0;
        const growthRate = this.assumptions.revenueGrowth / 100;
        const years = this.assumptions.projectionYears;
        
        const projectedCashFlows = [];
        for (let i = 0; i < years; i++) {
            projectedCashFlows.push(baseFCFE * Math.pow(1 + growthRate, i + 1));
        }
        
        // Projected cash flows with FORMULAS
        projectedCashFlows.forEach((cf, idx) => {
            const year = idx + 1;
            
            sheet.getCell(`A${row}`).value = year;
            sheet.getCell(`B${row}`).value = cf;
            sheet.getCell(`B${row}`).numFmt = '#,##0';
            
            sheet.getCell(`C${row}`).value = { formula: 'CostOfEquity' };
            sheet.getCell(`C${row}`).numFmt = '0.00%';
            
            sheet.getCell(`D${row}`).value = { formula: `1/((1+C${row})^A${row})` };
            sheet.getCell(`D${row}`).numFmt = '0.0000';
            
            sheet.getCell(`E${row}`).value = { formula: `B${row}*D${row}` };
            sheet.getCell(`E${row}`).numFmt = '#,##0';
            
            sheet.getCell(`F${row}`).value = `PV = CF / (1+r)^n`;
            sheet.getCell(`F${row}`).font = { italic: true };
            
            const rPct = this.assumptions.requiredReturn;
            sheet.getCell(`G${row}`).value = `${cf.toLocaleString('vi-VN')} / (1+${rPct}%)^${year}`;
            sheet.getCell(`G${row}`).font = { size: 9 };
            
            row++;
        });
        
        // Terminal Value Row with FORMULA
        const terminalRow = row;
        const lastCF = projectedCashFlows[projectedCashFlows.length - 1];
        const terminalValue = lastCF * (1 + this.assumptions.terminalGrowth/100) / (this.assumptions.requiredReturn/100 - this.assumptions.terminalGrowth/100);
        
        sheet.getCell(`A${row}`).value = `Terminal (Y${years})`;
        sheet.getCell(`A${row}`).font = { italic: true };
        
        sheet.getCell(`B${row}`).value = { formula: `B${row-1}*(1+TerminalGrowth)/(CostOfEquity-TerminalGrowth)` };
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'TerminalValue';
        
        sheet.getCell(`C${row}`).value = { formula: 'CostOfEquity' };
        sheet.getCell(`C${row}`).numFmt = '0.00%';
        
        sheet.getCell(`D${row}`).value = { formula: `1/((1+C${row})^${years})` };
        sheet.getCell(`D${row}`).numFmt = '0.0000';
        
        sheet.getCell(`E${row}`).value = { formula: `B${row}*D${row}` };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        
        sheet.getCell(`F${row}`).value = `TV = CF(1+g)/(r-g)`;
        sheet.getCell(`F${row}`).font = { italic: true };
        
        row += 2;
        
        // Summary calculations with FORMULAS
        sheet.getCell(`A${row}`).value = 'Total Present Value (Equity Value)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = { formula: `SUM(E${dataStartRow}:E${terminalRow})` };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        sheet.getCell(`E${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).name = 'TotalEquityValue';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`E${row}`).value = { formula: 'TotalEquityValue/SharesOutstanding' };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        sheet.getCell(`E${row}`).font = { bold: true, size: 12, color: { argb: '0066CC' } };
        sheet.getCell(`E${row}`).name = 'FairValue_FCFE';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`E${row}`).value = { formula: 'CurrentPrice' };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Upside/Downside (%)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = { formula: `(FairValue_FCFE-CurrentPrice)/CurrentPrice` };
        sheet.getCell(`E${row}`).numFmt = '0.00%';
        sheet.getCell(`E${row}`).font = { bold: true };
        
        // Column widths
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 18;
        sheet.getColumn(3).width = 15;
        sheet.getColumn(4).width = 18;
        sheet.getColumn(5).width = 20;
        sheet.getColumn(6).width = 25;
        sheet.getColumn(7).width = 30;
    }

    createFCFFSheet(sheet) {
        let row = 1;
        
        // Header
        sheet.mergeCells('A1:G1');
        sheet.getCell('A1').value = 'FCFF (Free Cash Flow to Firm) ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '28A745' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;
        
        // Assumptions
        sheet.getCell(`A${row}`).value = 'ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'WACC (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.wacc / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'WACC';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Terminal Growth Rate (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.terminalGrowth / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'TerminalGrowth_FCFF';
        row++;
        
        // Estimate debt and cash
        const estimatedDebt = (this.stockData.debt_to_equity || 0) * (this.stockData.book_value_per_share || 0) * this.stockData.shares_outstanding;
        const estimatedCash = (this.stockData.current_ratio || 1) * (this.stockData.market_cap || 0) * 0.1; // Rough estimate
        
        sheet.getCell(`A${row}`).value = 'Total Debt (estimated)';
        sheet.getCell(`B${row}`).value = estimatedDebt;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'TotalDebt';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Cash & Equivalents (estimated)';
        sheet.getCell(`B${row}`).value = estimatedCash;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'TotalCash';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Shares Outstanding';
        sheet.getCell(`B${row}`).value = this.stockData.shares_outstanding;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'SharesOutstanding_FCFF';
        row += 2;
        
        // Cash Flow Projections
        sheet.getCell(`A${row}`).value = 'CASH FLOW PROJECTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        ['Year', 'FCFF (VND)', 'Discount Rate', 'Discount Factor', 'Present Value (VND)', 'Formula'].forEach((header, idx) => {
            const cell = sheet.getCell(row, idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
        });
        row++;
        
        const dataStartRow = row;
        
        // Calculate FCFF projections
        const baseEBITDA = this.stockData.ebitda || this.stockData.net_income_ttm * 1.5 || 0;
        const growthRate = this.assumptions.revenueGrowth / 100;
        const years = this.assumptions.projectionYears;
        
        const projectedFCFF = [];
        for (let i = 0; i < years; i++) {
            projectedFCFF.push(baseEBITDA * Math.pow(1 + growthRate, i + 1) * (1 - this.assumptions.taxRate/100));
        }
        
        projectedFCFF.forEach((cf, idx) => {
            const year = idx + 1;
            
            sheet.getCell(`A${row}`).value = year;
            sheet.getCell(`B${row}`).value = cf;
            sheet.getCell(`B${row}`).numFmt = '#,##0';
            
            sheet.getCell(`C${row}`).value = { formula: 'WACC' };
            sheet.getCell(`C${row}`).numFmt = '0.00%';
            
            sheet.getCell(`D${row}`).value = { formula: `1/((1+C${row})^A${row})` };
            sheet.getCell(`D${row}`).numFmt = '0.0000';
            
            sheet.getCell(`E${row}`).value = { formula: `B${row}*D${row}` };
            sheet.getCell(`E${row}`).numFmt = '#,##0';
            
            sheet.getCell(`F${row}`).value = `PV = FCFF / (1+WACC)^${year}`;
            sheet.getCell(`F${row}`).font = { italic: true, size: 9 };
            
            row++;
        });
        
        // Terminal Value
        const terminalRow = row;
        sheet.getCell(`A${row}`).value = `Terminal`;
        
        sheet.getCell(`B${row}`).value = { formula: `B${row-1}*(1+TerminalGrowth_FCFF)/(WACC-TerminalGrowth_FCFF)` };
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'TerminalValue_FCFF';
        
        sheet.getCell(`C${row}`).value = { formula: 'WACC' };
        sheet.getCell(`C${row}`).numFmt = '0.00%';
        
        sheet.getCell(`D${row}`).value = { formula: `1/((1+C${row})^${years})` };
        sheet.getCell(`D${row}`).numFmt = '0.0000';
        
        sheet.getCell(`E${row}`).value = { formula: `B${row}*D${row}` };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        row += 2;
        
        // Calculations with FORMULAS
        sheet.getCell(`A${row}`).value = 'Enterprise Value (EV)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = { formula: `SUM(E${dataStartRow}:E${terminalRow})` };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        sheet.getCell(`E${row}`).name = 'EnterpriseValue';
        row++;
        
        sheet.getCell(`A${row}`).value = '- Debt';
        sheet.getCell(`E${row}`).value = { formula: 'TotalDebt' };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = '+ Cash';
        sheet.getCell(`E${row}`).value = { formula: 'TotalCash' };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = '= Equity Value';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = { formula: `EnterpriseValue-TotalDebt+TotalCash` };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        sheet.getCell(`E${row}`).name = 'EquityValue_FCFF';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`E${row}`).value = { formula: 'EquityValue_FCFF/SharesOutstanding_FCFF' };
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        sheet.getCell(`E${row}`).font = { bold: true, size: 12, color: { argb: '28A745' } };
        sheet.getCell(`E${row}`).name = 'FairValue_FCFF';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`E${row}`).value = this.stockData.current_price;
        sheet.getCell(`E${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Upside/Downside (%)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = { formula: `(FairValue_FCFF-E${row-1})/E${row-1}` };
        sheet.getCell(`E${row}`).numFmt = '0.00%';
        sheet.getCell(`E${row}`).font = { bold: true };
        
        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 18;
        sheet.getColumn(3).width = 15;
        sheet.getColumn(4).width = 18;
        sheet.getColumn(5).width = 20;
        sheet.getColumn(6).width = 30;
    }

    createPESheet(sheet) {
        let row = 1;
        
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'P/E RATIO ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC107' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;
        
        // Inputs
        sheet.getCell(`A${row}`).value = 'INPUTS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Current EPS';
        sheet.getCell(`B${row}`).value = this.stockData.eps || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'CurrentEPS';
        row++;
        
        sheet.getCell(`A${row}`).value = 'ROE (%)';
        sheet.getCell(`B${row}`).value = (this.stockData.roe || 0) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'ROE';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Payout Ratio (%)';
        sheet.getCell(`B${row}`).value = (this.assumptions.payoutRatio || 50) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'PayoutRatio';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Required Return (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.requiredReturn / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'RequiredReturn_PE';
        row += 2;
        
        // Calculation
        sheet.getCell(`A${row}`).value = 'CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Growth Rate (g)';
        sheet.getCell(`B${row}`).value = { formula: 'ROE*(1-PayoutRatio)' };
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'GrowthRate_PE';
        sheet.getCell(`C${row}`).value = 'g = ROE × (1 - Payout Ratio)';
        sheet.getCell(`C${row}`).font = { italic: true };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Justified P/E Ratio';
        sheet.getCell(`B${row}`).value = { formula: 'PayoutRatio/(RequiredReturn_PE-GrowthRate_PE)' };
        sheet.getCell(`B${row}`).numFmt = '0.00';
        sheet.getCell(`B${row}`).name = 'JustifiedPE';
        sheet.getCell(`C${row}`).value = 'P/E = Payout / (r - g)';
        sheet.getCell(`C${row}`).font = { italic: true };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`B${row}`).value = { formula: 'JustifiedPE*CurrentEPS' };
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: 'FFC107' } };
        sheet.getCell(`C${row}`).value = 'Fair Value = Justified P/E × EPS';
        sheet.getCell(`C${row}`).font = { italic: true };
        row += 2;
        
        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`B${row}`).value = this.stockData.current_price;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = { formula: `(B${row-3}-B${row-1})/B${row-1}` };
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        
        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 20;
        sheet.getColumn(3).width = 35;
    }

    createPBSheet(sheet) {
        let row = 1;
        
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'P/B RATIO ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DC3545' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;
        
        // Inputs
        sheet.getCell(`A${row}`).value = 'INPUTS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Book Value per Share';
        sheet.getCell(`B${row}`).value = this.stockData.book_value_per_share || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'BVPS';
        row++;
        
        sheet.getCell(`A${row}`).value = 'ROE (%)';
        sheet.getCell(`B${row}`).value = (this.stockData.roe || 0) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'ROE_PB';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Required Return (%)';
        sheet.getCell(`B${row}`).value = this.assumptions.requiredReturn / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'RequiredReturn_PB';
        row += 2;
        
        // Calculation
        sheet.getCell(`A${row}`).value = 'CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Justified P/B Ratio';
        sheet.getCell(`B${row}`).value = { formula: 'ROE_PB/RequiredReturn_PB' };
        sheet.getCell(`B${row}`).numFmt = '0.00';
        sheet.getCell(`B${row}`).name = 'JustifiedPB';
        sheet.getCell(`C${row}`).value = 'P/B = ROE / r';
        sheet.getCell(`C${row}`).font = { italic: true };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        sheet.getCell(`B${row}`).value = { formula: 'JustifiedPB*BVPS' };
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: 'DC3545' } };
        sheet.getCell(`C${row}`).value = 'Fair Value = Justified P/B × BVPS';
        sheet.getCell(`C${row}`).font = { italic: true };
        row += 2;
        
        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`B${row}`).value = this.stockData.current_price;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row++;
        
        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = { formula: `(B${row-3}-B${row-1})/B${row-1}` };
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        
        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 20;
        sheet.getColumn(3).width = 35;
    }

    createFinancialDataSheet(sheet) {
        let row = 1;
        
        sheet.getCell('A1').value = 'FINANCIAL DATA REFERENCE';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        row += 2;
        
        // Company Info
        const companyData = [
            ['Symbol', this.currentStock],
            ['Name', this.stockData.name],
            ['Sector', this.stockData.sector],
            ['Exchange', this.stockData.exchange],
            ['', ''],
            ['Current Price', this.stockData.current_price],
            ['Market Cap', this.stockData.market_cap],
            ['Shares Outstanding', this.stockData.shares_outstanding],
            ['EPS', this.stockData.eps],
            ['Book Value/Share', this.stockData.book_value_per_share],
            ['P/E Ratio', this.stockData.pe_ratio],
            ['P/B Ratio', this.stockData.pb_ratio],
            ['', ''],
            ['Revenue (TTM)', this.stockData.revenue_ttm],
            ['Net Income (TTM)', this.stockData.net_income_ttm],
            ['EBITDA', this.stockData.ebitda],
            ['ROE (%)', this.stockData.roe],
            ['ROA (%)', this.stockData.roa],
            ['Debt/Equity', this.stockData.debt_to_equity]
        ];
        
        companyData.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            if (typeof value === 'number' && label !== '') {
                sheet.getCell(`B${row}`).numFmt = '#,##0.00';
            }
            if (label !== '') {
                sheet.getCell(`A${row}`).font = { bold: true };
            }
            row++;
        });
        
        sheet.getColumn(1).width = 30;
        sheet.getColumn(2).width = 25;
    }

    // Keep old function for backward compatibility (now unused)
    createDetailedReportSheet(sheet) {
        const t = translations[lang];
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;
        
        let row = 1;
        
        // Helper to add section
        const addSection = (title, data) => {
            sheet.getCell(`A${row}`).value = title;
            sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
            row++;
            
            data.forEach(([label, value]) => {
                sheet.getCell(`A${row}`).value = label;
                sheet.getCell(`B${row}`).value = value;
                row++;
            });
            row++; // Empty row
        };
        
        // Brand Header
        sheet.mergeCells(`A${row}:E${row}`);
        sheet.getCell(`A${row}`).value = t.valuationReport || 'STOCK VALUATION REPORT';
        sheet.getCell(`A${row}`).font = { bold: true, size: 16 };
        sheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row++;
        
        sheet.mergeCells(`A${row}:E${row}`);
        sheet.getCell(`A${row}`).value = 'Powered by quanganh.org | Professional Stock Analysis Platform';
        sheet.getCell(`A${row}`).font = { italic: true, size: 10 };
        sheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row += 2;
        
        // Company Info
        addSection('═══ 1. COMPANY INFORMATION ═══', [
            ['Stock Symbol', this.currentStock],
            ['Company Name', this.stockData.name],
            ['Industry', this.stockData.sector],
            ['Exchange', this.stockData.exchange],
            ['Report Date', new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')]
        ]);
        
        // Market Data
        addSection('═══ 2. MARKET DATA ═══', [
            ['Current Price', `${currentPrice.toLocaleString('vi-VN')} VND`],
            ['Market Cap', `${(this.stockData.market_cap / 1e9).toFixed(2)} Billion VND`],
            ['Shares Outstanding', `${(this.stockData.shares_outstanding / 1e6).toFixed(2)} Million`],
            ['P/E Ratio', `${this.stockData.pe_ratio?.toFixed(2)}x`],
            ['P/B Ratio', `${this.stockData.pb_ratio?.toFixed(2)}x`],
            ['EPS', `${this.stockData.eps?.toLocaleString('vi-VN')} VND`]
        ]);
        
        // Valuation Summary
        addSection('═══ 3. VALUATION SUMMARY ═══', [
            ['FCFE Fair Value', `${this.valuationResults.fcfe.shareValue.toLocaleString('vi-VN')} VND (${this.modelWeights.fcfe}%)`],
            ['FCFF Fair Value', `${this.valuationResults.fcff.shareValue.toLocaleString('vi-VN')} VND (${this.modelWeights.fcff}%)`],
            ['P/E Fair Value', `${this.valuationResults.justified_pe.shareValue.toLocaleString('vi-VN')} VND (${this.modelWeights.justified_pe}%)`],
            ['P/B Fair Value', `${this.valuationResults.justified_pb.shareValue.toLocaleString('vi-VN')} VND (${this.modelWeights.justified_pb}%)`],
            ['', ''],
            ['>>> WEIGHTED TARGET PRICE', `${weightedValue.toLocaleString('vi-VN')} VND`],
            ['>>> Upside/Downside', `${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`]
        ]);
        
        // DETAILED CALCULATIONS - FCFE
        sheet.getCell(`A${row}`).value = '═══ 4. DETAILED STEP-BY-STEP CALCULATIONS ═══';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row += 2;
        
        sheet.getCell(`A${row}`).value = '4.1 FCFE (Free Cash Flow to Equity) - Discounted Cash Flow Method';
        sheet.getCell(`A${row}`).font = { bold: true };
        row++;
        
        const fcfe = this.valuationResults.fcfe;
        const r = this.assumptions.requiredReturn / 100;
        
        if (fcfe.projectedCashFlows && fcfe.projectedCashFlows.length > 0) {
            sheet.getCell(`A${row}`).value = 'Step-by-step discount calculation:';
            row++;
            
            fcfe.projectedCashFlows.forEach((cf, idx) => {
                const year = idx + 1;
                const pv = cf / Math.pow(1 + r, year);
                sheet.getCell(`A${row}`).value = `Year ${year}: FCFE = ${cf.toLocaleString('vi-VN')} VND`;
                sheet.getCell(`B${row}`).value = `→ PV = ${cf.toLocaleString('vi-VN')} / (1+${(r*100).toFixed(1)}%)^${year} = ${pv.toLocaleString('vi-VN')} VND`;
                row++;
            });
            
            // Terminal Value
            const tv = fcfe.terminalValue || 0;
            const tvPV = tv / Math.pow(1 + r, fcfe.projectedCashFlows.length);
            row++;
            sheet.getCell(`A${row}`).value = `Terminal Value (Year ${fcfe.projectedCashFlows.length}):`;
            sheet.getCell(`B${row}`).value = `${tv.toLocaleString('vi-VN')} VND`;
            row++;
            sheet.getCell(`A${row}`).value = `→ PV of Terminal Value:`;
            sheet.getCell(`B${row}`).value = `${tv.toLocaleString('vi-VN')} / (1+${(r*100).toFixed(1)}%)^${fcfe.projectedCashFlows.length} = ${tvPV.toLocaleString('vi-VN')} VND`;
            row += 2;
            
            // Sum
            sheet.getCell(`A${row}`).value = `Total Present Value (Equity Value):`;
            sheet.getCell(`B${row}`).value = `${(fcfe.equityValue || 0).toLocaleString('vi-VN')} VND`;
            sheet.getCell(`B${row}`).font = { bold: true };
            row++;
            sheet.getCell(`A${row}`).value = `÷ Shares Outstanding:`;
            sheet.getCell(`B${row}`).value = `${this.stockData.shares_outstanding.toLocaleString('vi-VN')} shares`;
            row++;
            sheet.getCell(`A${row}`).value = `= Fair Value per Share:`;
            sheet.getCell(`B${row}`).value = `${fcfe.shareValue.toLocaleString('vi-VN')} VND`;
            sheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF0066CC' } };
            row += 2;
        }
        
        // Set column widths
        sheet.getColumn(1).width = 40;
        sheet.getColumn(2).width = 60;
        
        // Add footer
        row += 2;
        sheet.getCell(`A${row}`).value = 'Generated by quanganh.org - Professional Stock Valuation Platform';
        sheet.getCell(`A${row}`).font = { italic: true, size: 9 };
        sheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        sheet.mergeCells(`A${row}:E${row}`);
    }

    createExcelDataSheet(sheet) {
        // Headers
        sheet.getCell('A1').value = 'COMPANY DATA';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        
        let row = 2;
        
        // Company Info
        const companyData = [
            ['Symbol', this.currentStock],
            ['Name', this.stockData.name],
            ['Sector', this.stockData.sector],
            ['Exchange', this.stockData.exchange],
            ['', ''],
            ['Current Price', this.stockData.current_price],
            ['Market Cap', this.stockData.market_cap],
            ['Shares Outstanding', this.stockData.shares_outstanding],
            ['EPS', this.stockData.eps],
            ['Book Value/Share', this.stockData.book_value_per_share],
            ['', ''],
            ['Revenue (TTM)', this.stockData.revenue_ttm],
            ['Net Income (TTM)', this.stockData.net_income_ttm],
            ['EBITDA', this.stockData.ebitda],
            ['ROE (%)', this.stockData.roe],
            ['ROA (%)', this.stockData.roa],
            ['Debt/Equity', this.stockData.debt_to_equity]
        ];
        
        companyData.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            if (typeof value === 'number') {
                sheet.getCell(`B${row}`).numFmt = '#,##0.00';
            }
            row++;
        });
        
        // Assumptions
        row += 2;
        sheet.getCell(`A${row}`).value = 'VALUATION ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        row++;
        
        const assumptions = [
            ['Revenue Growth Rate (%)', this.assumptions.revenueGrowth],
            ['Terminal Growth Rate (%)', this.assumptions.terminalGrowth],
            ['WACC (%)', this.assumptions.wacc],
            ['Cost of Equity (%)', this.assumptions.requiredReturn],
            ['Tax Rate (%)', this.assumptions.taxRate],
            ['Projection Years', this.assumptions.projectionYears]
        ];
        
        assumptions.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            row++;
        });
        
        // FCFE Projections
        row += 2;
        sheet.getCell(`A${row}`).value = 'FCFE PROJECTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        row++;
        
        sheet.getCell(`A${row}`).value = 'Year';
        sheet.getCell(`B${row}`).value = 'FCFE (VND)';
        sheet.getCell(`C${row}`).value = 'Discount Factor';
        sheet.getCell(`D${row}`).value = 'Present Value (VND)';
        sheet.getRow(row).font = { bold: true };
        row++;
        
        const fcfe = this.valuationResults.fcfe;
        const r = this.assumptions.requiredReturn / 100;
        
        if (fcfe.projectedCashFlows) {
            fcfe.projectedCashFlows.forEach((cf, idx) => {
                const year = idx + 1;
                const discountFactor = 1 / Math.pow(1 + r, year);
                const pv = cf * discountFactor;
                
                sheet.getCell(`A${row}`).value = year;
                sheet.getCell(`B${row}`).value = cf;
                sheet.getCell(`C${row}`).value = discountFactor;
                sheet.getCell(`D${row}`).value = pv;
                
                sheet.getCell(`B${row}`).numFmt = '#,##0';
                sheet.getCell(`C${row}`).numFmt = '0.0000';
                sheet.getCell(`D${row}`).numFmt = '#,##0';
                row++;
            });
            
            // Terminal Value
            sheet.getCell(`A${row}`).value = `Terminal (Y${fcfe.projectedCashFlows.length})`;
            sheet.getCell(`B${row}`).value = fcfe.terminalValue;
            sheet.getCell(`C${row}`).value = 1 / Math.pow(1 + r, fcfe.projectedCashFlows.length);
            sheet.getCell(`D${row}`).value = (fcfe.terminalValue || 0) / Math.pow(1 + r, fcfe.projectedCashFlows.length);
            sheet.getCell(`B${row}`).numFmt = '#,##0';
            sheet.getCell(`C${row}`).numFmt = '0.0000';
            sheet.getCell(`D${row}`).numFmt = '#,##0';
        }
        
        // Set column widths
        sheet.getColumn(1).width = 30;
        sheet.getColumn(2).width = 20;
        sheet.getColumn(3).width = 20;
        sheet.getColumn(4).width = 25;
    }

    generateCSVReport() {
        const lang = this.currentLanguage;
        const t = translations[lang];
        
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;
        
        let csv = [];
        const SEP = ',';
        
        // Brand Header
        csv.push('═══════════════════════════════════════════════════════════════════════════════');
        csv.push(`${t.valuationReport || 'STOCK VALUATION REPORT'}`);
        csv.push('Powered by quanganh.org | Professional Stock Analysis Platform');
        csv.push('═══════════════════════════════════════════════════════════════════════════════');
        csv.push('');
        
        // Report Metadata
        csv.push(`${t.companyInformation || 'Company'}${SEP}${this.stockData.name} (${this.currentStock})`);
        csv.push(`${t.reportDate || 'Report Date'}${SEP}${new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
        csv.push(`${t.dataPeriod || 'Data Period'}${SEP}${this.stockData.data_frequency === 'quarter' ? (t.latestQuarter || 'Latest Quarter') : (t.latestYear || 'Latest Year')}`);
        csv.push('');
        csv.push('───────────────────────────────────────────────────────────────────────────────');
        
        // SECTION 1: Company Overview
        csv.push('');
        csv.push(`═══ 1. ${t.companyInformation || 'COMPANY INFORMATION'} ═══`);
        csv.push(`${t.symbol || 'Stock Symbol'}${SEP}${this.stockData.symbol || '--'}`);
        csv.push(`${t.name || 'Company Name'}${SEP}${this.stockData.name || '--'}`);
        csv.push(`${t.industry || 'Industry'}${SEP}${this.stockData.sector || '--'}`);
        csv.push(`${t.exchange || 'Exchange'}${SEP}${this.stockData.exchange || '--'}`);
        csv.push('');
        
        // SECTION 2: Market Data
        csv.push(`═══ 2. ${t.marketData || 'MARKET DATA'} ═══`);
        csv.push(`Metric${SEP}Value${SEP}Unit`);
        csv.push(`${t.currentPrice || 'Current Price'}${SEP}${currentPrice.toLocaleString('vi-VN')}${SEP}VND`);
        csv.push(`${t.marketCap || 'Market Cap'}${SEP}${(this.stockData.market_cap / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`${t.sharesOutstanding || 'Shares Outstanding'}${SEP}${(this.stockData.shares_outstanding / 1e6).toFixed(2)}${SEP}Million shares`);
        csv.push(`${t.eps || 'EPS'}${SEP}${this.stockData.eps?.toLocaleString('vi-VN') || '--'}${SEP}VND`);
        csv.push(`${t.bookValuePerShare || 'Book Value/Share'}${SEP}${this.stockData.book_value_per_share?.toLocaleString('vi-VN') || '--'}${SEP}VND`);
        csv.push(`${t.peRatio || 'P/E Ratio'}${SEP}${this.stockData.pe_ratio?.toFixed(2) || '--'}${SEP}x`);
        csv.push(`${t.pbRatio || 'P/B Ratio'}${SEP}${this.stockData.pb_ratio?.toFixed(2) || '--'}${SEP}x`);
        csv.push('');
        
        // SECTION 3: Valuation Summary
        csv.push(`═══ 3. ${t.valuationResults || 'VALUATION SUMMARY'} ═══`);
        csv.push(`Model${SEP}Fair Value (VND)${SEP}Weight${SEP}Difference vs Market`);
        const fcfe = this.valuationResults.fcfe;
        const fcfeDiff = ((fcfe.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`FCFE${SEP}${fcfe.shareValue.toLocaleString('vi-VN')}${SEP}${this.modelWeights.fcfe}%${SEP}${fcfeDiff}%`);
        
        const fcff = this.valuationResults.fcff;
        const fcffDiff = ((fcff.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`FCFF${SEP}${fcff.shareValue.toLocaleString('vi-VN')}${SEP}${this.modelWeights.fcff}%${SEP}${fcffDiff}%`);
        
        const pe = this.valuationResults.justified_pe;
        const peDiff = ((pe.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`Justified P/E${SEP}${pe.shareValue.toLocaleString('vi-VN')}${SEP}${this.modelWeights.justified_pe}%${SEP}${peDiff}%`);
        
        const pb = this.valuationResults.justified_pb;
        const pbDiff = ((pb.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`Justified P/B${SEP}${pb.shareValue.toLocaleString('vi-VN')}${SEP}${this.modelWeights.justified_pb}%${SEP}${pbDiff}%`);
        
        csv.push('───────────────────────────────────────────────────────────────────────────────');
        csv.push(`>>> ${t.weightedAverageTargetPrice || 'WEIGHTED TARGET PRICE'}${SEP}${weightedValue.toLocaleString('vi-VN')} VND${SEP}${SEP}${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`);
        csv.push('───────────────────────────────────────────────────────────────────────────────');
        csv.push('');
        
        // SECTION 4: Detailed Calculations - FCFE
        csv.push(`═══ 4. ${t.modelDetails || 'DETAILED VALUATION CALCULATIONS'} ═══`);
        csv.push('');
        csv.push('4.1 FCFE (Free Cash Flow to Equity) Method');
        csv.push(`Description${SEP}Value (VND)`);
        if (fcfe.projectedCashFlows && fcfe.projectedCashFlows.length > 0) {
            csv.push('Projected FCFE:');
            fcfe.projectedCashFlows.forEach((cf, idx) => {
                csv.push(`  Year ${idx + 1}${SEP}${cf.toLocaleString('vi-VN')}`);
            });
            csv.push(`Terminal Value (Year ${fcfe.projectedCashFlows.length})${SEP}${(fcfe.terminalValue || 0).toLocaleString('vi-VN')}`);
            csv.push(`Total Present Value (Equity Value)${SEP}${(fcfe.equityValue || 0).toLocaleString('vi-VN')}`);
            csv.push(`÷ Shares Outstanding${SEP}${this.stockData.shares_outstanding.toLocaleString('vi-VN')}`);
            csv.push(`= Fair Value per Share${SEP}${fcfe.shareValue.toLocaleString('vi-VN')}`);
        }
        csv.push(`Formula${SEP}PV = Σ(FCFE_t / (1+r)^t) + TV / (1+r)^n`);
        csv.push(`Growth Rate (g)${SEP}${this.assumptions.revenueGrowth}%`);
        csv.push(`Discount Rate (r)${SEP}${this.assumptions.requiredReturn}%`);
        csv.push('');
        
        // 4.2 FCFF
        csv.push('4.2 FCFF (Free Cash Flow to Firm) Method');
        csv.push(`Description${SEP}Value (VND)`);
        if (fcff.projectedCashFlows && fcff.projectedCashFlows.length > 0) {
            csv.push('Projected FCFF:');
            fcff.projectedCashFlows.forEach((cf, idx) => {
                csv.push(`  Year ${idx + 1}${SEP}${cf.toLocaleString('vi-VN')}`);
            });
            csv.push(`Terminal Value (Year ${fcff.projectedCashFlows.length})${SEP}${(fcff.terminalValue || 0).toLocaleString('vi-VN')}`);
            csv.push(`Enterprise Value${SEP}${(fcff.enterpriseValue || 0).toLocaleString('vi-VN')}`);
            csv.push(`− Net Debt${SEP}${(fcff.netDebt || 0).toLocaleString('vi-VN')}`);
            csv.push(`= Equity Value${SEP}${(fcff.equityValue || 0).toLocaleString('vi-VN')}`);
            csv.push(`÷ Shares Outstanding${SEP}${this.stockData.shares_outstanding.toLocaleString('vi-VN')}`);
            csv.push(`= Fair Value per Share${SEP}${fcff.shareValue.toLocaleString('vi-VN')}`);
        }
        csv.push(`Formula${SEP}EV = Σ(FCFF_t / (1+WACC)^t) + TV / (1+WACC)^n`);
        csv.push(`WACC${SEP}${this.assumptions.wacc}%`);
        csv.push('');
        
        // 4.3 P/E
        csv.push('4.3 Justified P/E Valuation');
        csv.push(`Description${SEP}Value`);
        csv.push(`Current EPS${SEP}${this.stockData.eps?.toLocaleString('vi-VN')} VND`);
        csv.push(`Justified P/E Ratio${SEP}${pe.ratio?.toFixed(2)}x`);
        csv.push(`= Fair Value per Share${SEP}${pe.shareValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Formula${SEP}Justified P/E = Payout × (1+g) / (r-g)`);
        csv.push(`Payout Ratio${SEP}${(this.assumptions.payoutRatio || 40)}%`);
        csv.push(`Growth Rate (g)${SEP}${this.assumptions.revenueGrowth}%`);
        csv.push(`Required Return (r)${SEP}${this.assumptions.requiredReturn}%`);
        csv.push('');
        
        // 4.4 P/B
        csv.push('4.4 Justified P/B Valuation');
        csv.push(`Description${SEP}Value`);
        csv.push(`Book Value per Share${SEP}${this.stockData.book_value_per_share?.toLocaleString('vi-VN')} VND`);
        csv.push(`Justified P/B Ratio${SEP}${pb.ratio?.toFixed(2)}x`);
        csv.push(`= Fair Value per Share${SEP}${pb.shareValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Formula${SEP}Justified P/B = ROE × Payout × (1+g) / (r-g)`);
        csv.push(`ROE${SEP}${this.stockData.roe?.toFixed(2)}%`);
        csv.push('');
        
        // SECTION 5: Investment Decision
        csv.push(`═══ 5. ${t.recommendation || 'INVESTMENT RECOMMENDATION'} ═══`);
        csv.push(`Current Market Price${SEP}${currentPrice.toLocaleString('vi-VN')} VND`);
        csv.push(`Fair Value (Weighted Average)${SEP}${weightedValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Upside/Downside Potential${SEP}${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`);
        if (this.valuationResults.market_comparison?.recommendation) {
            const rec = this.valuationResults.market_comparison.recommendation;
            csv.push(`>>> Investment Recommendation${SEP}${rec.toUpperCase()}`);
        }
        csv.push('');
        
        // SECTION 6: Assumptions & Parameters
        csv.push(`═══ 6. ${t.modelAssumptions || 'VALUATION ASSUMPTIONS'} ═══`);
        csv.push(`Parameter${SEP}Value`);
        csv.push(`Revenue Growth Rate${SEP}${this.assumptions.revenueGrowth}%`);
        csv.push(`Terminal Growth Rate${SEP}${this.assumptions.terminalGrowth}%`);
        csv.push(`WACC (Weighted Average Cost of Capital)${SEP}${this.assumptions.wacc}%`);
        csv.push(`Cost of Equity (Required Return)${SEP}${this.assumptions.requiredReturn}%`);
        csv.push(`Corporate Tax Rate${SEP}${this.assumptions.taxRate}%`);
        csv.push(`Projection Period${SEP}${this.assumptions.projectionYears} years`);
        csv.push('');
        
        // SECTION 7: Financial Health
        csv.push(`═══ 7. ${t.financialMetrics || 'FINANCIAL HEALTH METRICS'} ═══`);
        csv.push(`Metric${SEP}Value${SEP}Unit`);
        csv.push(`Revenue (TTM)${SEP}${(this.stockData.revenue_ttm / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`Net Income (TTM)${SEP}${(this.stockData.net_income_ttm / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`EBITDA${SEP}${(this.stockData.ebitda / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`ROE (Return on Equity)${SEP}${this.stockData.roe?.toFixed(2) || '--'}${SEP}%`);
        csv.push(`ROA (Return on Assets)${SEP}${this.stockData.roa?.toFixed(2) || '--'}${SEP}%`);
        csv.push(`Debt/Equity Ratio${SEP}${this.stockData.debt_to_equity?.toFixed(2) || '--'}${SEP}x`);
        csv.push('');
        
        // Footer
        csv.push('═══════════════════════════════════════════════════════════════════════════════');
        csv.push('DISCLAIMER');
        csv.push('This report is for informational purposes only and does not constitute investment');
        csv.push('advice. Past performance does not guarantee future results. Please consult with a');
        csv.push('qualified financial advisor before making investment decisions.');
        csv.push('');
        csv.push('Generated by quanganh.org - Professional Stock Valuation Platform');
        csv.push(`Report Generated: ${new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}`);
        csv.push('Website: https://valuation.quanganh.org | API: https://api.quanganh.org');
        csv.push('═══════════════════════════════════════════════════════════════════════════════');
        
        return csv.join('\n');
    }

    showStatus(message, type) {
        // Loading overlay removed - no visual indicator
        // Data loads silently in background
    }

    showLoading(show) {
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            if (show) {
                searchBtn.disabled = true;
                searchBtn.style.opacity = '0.6';
            } else {
                searchBtn.disabled = false;
                searchBtn.style.opacity = '1';
            }
        }
    }

    clearDisplay() {
        // Clear company info
        this.safeUpdateElement('company-name', '--');
        this.safeUpdateElement('company-symbol', '--');
        this.safeUpdateElement('company-sector', '--');
        this.safeUpdateElement('company-exchange', '--');

        // Clear market data
        this.safeUpdateElement('current-price', '--');
        this.safeUpdateElement('market-cap', '--');
        this.safeUpdateElement('shares-outstanding', '--');
        this.safeUpdateElement('pe-ratio', '--');
        this.safeUpdateElement('pb-ratio', '--');
        this.safeUpdateElement('ps-ratio', '--');
        this.safeUpdateElement('eps', '--');
        this.safeUpdateElement('book-value-per-share', '--');
        this.safeUpdateElement('ev-ebitda', '--');

        // Clear financial metrics
        this.safeUpdateElement('revenue', '--');
        this.safeUpdateElement('net-income', '--');
        this.safeUpdateElement('ebitda', '--');
        this.safeUpdateElement('roe', '--');
        this.safeUpdateElement('roa', '--');
        this.safeUpdateElement('debt-equity', '--');

        // Clear ratio metrics
        this.safeUpdateElement('asset-turnover', '--');
        this.safeUpdateElement('inventory-turnover', '--');
        this.safeUpdateElement('fixed-asset-turnover', '--');
        this.safeUpdateElement('current-ratio', '--');
        this.safeUpdateElement('quick-ratio', '--');
        this.safeUpdateElement('cash-ratio', '--');
        this.safeUpdateElement('interest-coverage', '--');
        this.safeUpdateElement('gross-profit-margin', '--');
        this.safeUpdateElement('ebit-margin', '--');
        this.safeUpdateElement('net-profit-margin', '--');
        this.safeUpdateElement('ev-ebitda-ratio', '--');

        // Clear valuation results
        this.safeUpdateElement('fcfe-result', '--');
        this.safeUpdateElement('fcff-result', '--');
        this.safeUpdateElement('pe-result', '--');
        this.safeUpdateElement('pb-result', '--');
        this.safeUpdateElement('weighted-result', '--');
        this.safeUpdateElement('fcfe-diff', '--');
        this.safeUpdateElement('fcff-diff', '--');
        this.safeUpdateElement('pe-diff', '--');
        this.safeUpdateElement('pb-diff', '--');
        this.safeUpdateElement('weighted-diff', '--');

        // Clear summary tab
        this.safeUpdateElement('summary-symbol', '--');
        this.safeUpdateElement('summary-name', '--');
        this.safeUpdateElement('summary-sector', '--');
        this.safeUpdateElement('summary-exchange', '--');
        this.safeUpdateElement('summary-price', '--');
        this.safeUpdateElement('summary-market-cap', '--');
        this.safeUpdateElement('summary-pe', '--');
        this.safeUpdateElement('summary-pb', '--');
        this.safeUpdateElement('target-price', '--');
        this.safeUpdateElement('summary-potential', '--');
        this.safeUpdateElement('return-value', '--');

        // Clear model details
        this.safeUpdateElement('fcfe-equity', '--');
        this.safeUpdateElement('fcfe-share-value', '--');
        this.safeUpdateElement('fcfe-market-diff', '--');
        this.safeUpdateElement('fcff-ev', '--');
        this.safeUpdateElement('fcff-equity', '--');
        this.safeUpdateElement('fcff-share-value', '--');
        this.safeUpdateElement('fcff-market-diff', '--');
        this.safeUpdateElement('pe-justified-ratio', '--');
        this.safeUpdateElement('pe-current-eps', '--');
        this.safeUpdateElement('pe-share-value', '--');
        this.safeUpdateElement('pe-market-diff', '--');
        this.safeUpdateElement('pb-justified-ratio', '--');
        this.safeUpdateElement('pb-current-bvps', '--');
        this.safeUpdateElement('pb-share-value', '--');
        this.safeUpdateElement('pb-market-diff', '--');

        // Clear recommendation
        const recommendationElement = document.getElementById('recommendation');
        recommendationElement.innerHTML = '<span class="status status--warning">--</span>';
        const finalRecommendationElement = document.getElementById('final-recommendation');
        finalRecommendationElement.innerHTML = '<span class="status status--warning">--</span>';
        this.safeUpdateElement('recommendation-reasoning', 'Please load company data to receive investment recommendations.');
        this.safeUpdateElement('confidence-level', '--');

        // Disable export button
        document.getElementById('export-report-btn').disabled = true;
        document.getElementById('export-excel-btn').disabled = true;

        // Clear valuation results
        this.valuationResults = null;
    }

    formatCurrency(value) {
        if (!value || isNaN(value)) return '--';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    formatLargeNumber(value) {
        if (!value || isNaN(value)) return '--';
        if (value >= 1e12) {
            return `${(value / 1e12).toFixed(1)} trillion`;
        } else if (value >= 1e9) {
            return `${(value / 1e9).toFixed(1)} billion`;
        } else if (value >= 1e6) {
            return `${(value / 1e6).toFixed(1)} million`;
        } else {
            return this.formatCurrency(value);
        }
    }

    formatNumber(value) {
        if (!value || isNaN(value)) return '--';
        return value.toFixed(2);
    }

    formatPercent(value) {
        if (!value || isNaN(value)) return '--';
        return `${value.toFixed(1)}%`;
    }

    updateOverviewDisplay(data) {
        // Update company info
        this.safeUpdateElement('company-name', data.name || '--');
        this.safeUpdateElement('company-symbol', data.symbol || '--');
        this.safeUpdateElement('company-sector', data.sector || '--');
        this.safeUpdateElement('company-exchange', data.exchange || '--');

        // Update market data
        this.safeUpdateElement('current-price', this.formatCurrency(data.current_price));
        this.safeUpdateElement('market-cap', this.formatLargeNumber(data.market_cap));
        this.safeUpdateElement('shares-outstanding', this.formatLargeNumber(data.shares_outstanding));
        this.safeUpdateElement('pe-ratio', this.formatNumber(data.pe_ratio));
        this.safeUpdateElement('pb-ratio', this.formatNumber(data.pb_ratio));
        this.safeUpdateElement('ps-ratio', this.formatNumber(data.ps_ratio));
        this.safeUpdateElement('pcf-ratio', this.formatNumber(data.pcf_ratio));
        this.safeUpdateElement('eps', this.formatCurrency(data.eps));
        this.safeUpdateElement('book-value-per-share', this.formatCurrency(data.book_value_per_share));
        this.safeUpdateElement('ev-ebitda', this.formatNumber(data.ev_ebitda));

        // Update financial metrics
        this.safeUpdateElement('revenue', this.formatLargeNumber(data.revenue_ttm));
        this.safeUpdateElement('net-income', this.formatLargeNumber(data.net_income_ttm));
        this.safeUpdateElement('ebitda', this.formatLargeNumber(data.ebitda));
        this.safeUpdateElement('roe', this.formatPercent(data.roe));
        this.safeUpdateElement('roa', this.formatPercent(data.roa));
        this.safeUpdateElement('debt-equity', this.formatNumber(data.debt_to_equity));

        // Update ratio metrics
        this.safeUpdateElement('asset-turnover', this.formatNumber(data.asset_turnover));
        this.safeUpdateElement('inventory-turnover', this.formatNumber(data.inventory_turnover));
        this.safeUpdateElement('fixed-asset-turnover', this.formatNumber(data.fixed_asset_turnover));
        this.safeUpdateElement('current-ratio', this.formatNumber(data.current_ratio));
        this.safeUpdateElement('quick-ratio', this.formatNumber(data.quick_ratio));
        this.safeUpdateElement('cash-ratio', this.formatNumber(data.cash_ratio));
        this.safeUpdateElement('interest-coverage', this.formatNumber(data.interest_coverage));
        this.safeUpdateElement('gross-profit-margin', this.formatPercent(data.gross_profit_margin));
        this.safeUpdateElement('ebit-margin', this.formatPercent(data.ebit_margin));
        this.safeUpdateElement('net-profit-margin', this.formatPercent(data.net_profit_margin));

        // Update summary tab
        this.safeUpdateElement('summary-symbol', data.symbol || '--');
        this.safeUpdateElement('summary-name', data.name || '--');
        this.safeUpdateElement('summary-sector', data.sector || '--');
        this.safeUpdateElement('summary-exchange', data.exchange || '--');
        this.safeUpdateElement('summary-price', this.formatCurrency(data.current_price));
        this.safeUpdateElement('summary-market-cap', this.formatLargeNumber(data.market_cap));
        this.safeUpdateElement('summary-pe', this.formatNumber(data.pe_ratio));
        this.safeUpdateElement('summary-pb', this.formatNumber(data.pb_ratio));
    }    updateModelDetails() {
        if (!this.valuationResults || !this.stockData) {
            return;
        }

        const currentPrice = this.stockData.current_price;

        let eps = this.valuationResults.financial_data.eps || this.stockData.eps || 0;
        let bvps = this.stockData.book_value_per_share || 0;

        // FCFE Details
        const fcfeEquityValue = this.valuationResults.fcfe.equityValue;
        this.safeUpdateElement('fcfe-equity', this.formatCurrency(fcfeEquityValue));
        this.safeUpdateElement('fcfe-share-value', this.formatCurrency(this.valuationResults.fcfe.shareValue));
        const fcfeDiff = ((this.valuationResults.fcfe.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('fcfe-market-diff', `${fcfeDiff > 0 ? '+' : ''}${fcfeDiff.toFixed(1)}%`);

        // FCFF Details
        const fcffEquityValue = this.valuationResults.fcff.equityValue;
        const fcffEV = fcffEquityValue + (this.stockData.total_debt || 0);
        this.safeUpdateElement('fcff-ev', this.formatCurrency(fcffEV));
        this.safeUpdateElement('fcff-equity', this.formatCurrency(fcffEquityValue));
        this.safeUpdateElement('fcff-share-value', this.formatCurrency(this.valuationResults.fcff.shareValue));
        const fcffDiff = ((this.valuationResults.fcff.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('fcff-market-diff', `${fcffDiff > 0 ? '+' : ''}${fcffDiff.toFixed(1)}%`);

        // Justified P/E Details
        const justifiedPE = eps > 0 ? Math.abs(this.valuationResults.justified_pe.shareValue / eps) : 0;
        this.safeUpdateElement('pe-justified-ratio', `${justifiedPE.toFixed(2)}x`);
        this.safeUpdateElement('pe-current-eps', this.formatCurrency(eps));
        this.safeUpdateElement('pe-share-value', this.formatCurrency(this.valuationResults.justified_pe.shareValue));
        const peDiff = ((this.valuationResults.justified_pe.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('pe-market-diff', `${peDiff > 0 ? '+' : ''}${peDiff.toFixed(1)}%`);

        // Justified P/B Details
        const justifiedPB = bvps > 0 ? Math.abs(this.valuationResults.justified_pb.shareValue / bvps) : 0;
        this.safeUpdateElement('pb-justified-ratio', `${justifiedPB.toFixed(2)}x`);
        this.safeUpdateElement('pb-current-bvps', this.formatCurrency(bvps));
        this.safeUpdateElement('pb-share-value', this.formatCurrency(this.valuationResults.justified_pb.shareValue));
        const pbDiff = ((this.valuationResults.justified_pb.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('pb-market-diff', `${pbDiff > 0 ? '+' : ''}${pbDiff.toFixed(1)}%`);
          // Update target price and summary
        this.safeUpdateElement('target-price', this.formatCurrency(this.valuationResults.weighted_average));
        const upside = ((this.valuationResults.weighted_average - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('summary-potential', `${upside > 0 ? '+' : ''}${upside.toFixed(1)}%`);
        
        // Update recommendation for page 3
        this.updateRecommendation();
    }

    safeUpdateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load Chart.js dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
        new StockValuationApp();
    };
    script.onerror = () => {
        console.error('Failed to load Chart.js');
        new StockValuationApp(); // Proceed without charts
    };
    document.head.appendChild(script);
    
    // Footer legal links handlers
    setupLegalModals();
});

function setupLegalModals() {
    const disclaimerLink = document.getElementById('disclaimer-link');
    const privacyLink = document.getElementById('privacy-link');
    const termsLink = document.getElementById('terms-link');
    const contactLink = document.getElementById('contact-link');
    
    if (disclaimerLink) {
        disclaimerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLegalModal('disclaimer');
        });
    }
    
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLegalModal('privacy');
        });
    }
    
    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLegalModal('terms');
        });
    }
    
    if (contactLink) {
        contactLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLegalModal('contact');
        });
    }
}

function showLegalModal(type) {
    const currentLang = document.documentElement.getAttribute('lang') || 'en';
    
    const content = {
        disclaimer: {
            en: {
                title: 'Disclaimer',
                body: `<h3>Investment Disclaimer</h3>
                <p>The information provided on this platform is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information.</p>
                
                <h3>Not Financial Advice</h3>
                <p>The content is not intended to be a substitute for professional financial advice. Always seek the advice of your financial advisor or other qualified financial service provider with any questions you may have regarding your investment decisions.</p>
                
                <h3>No Investment Recommendations</h3>
                <p>Nothing on this platform constitutes investment advice, performance data or any recommendation that any security, portfolio of securities, investment product, transaction or investment strategy is suitable for any specific person.</p>
                
                <h3>Risk Warning</h3>
                <p>Investments in securities market are subject to market risks. Past performance is not indicative of future results. You should carefully consider your investment objectives, level of experience, and risk appetite before making any investment decisions.</p>
                
                <h3>Data Accuracy</h3>
                <p>While we strive to provide accurate and up-to-date information from reliable sources (Vietcap, TCBS), we do not guarantee the accuracy, completeness, or timeliness of the data. Users should verify all information independently before making investment decisions.</p>`
            },
            vi: {
                title: 'Miễn trừ trách nhiệm',
                body: `<h3>Miễn trừ trách nhiệm đầu tư</h3>
                <p>Thông tin được cung cấp trên nền tảng này chỉ mang tính chất tham khảo chung. Tất cả thông tin được cung cấp với thiện chí, tuy nhiên chúng tôi không đưa ra bất kỳ tuyên bố hoặc bảo đảm nào, rõ ràng hay ngụ ý, về tính chính xác, đầy đủ, hợp lệ, độ tin cậy, tính khả dụng hoặc đầy đủ của bất kỳ thông tin nào.</p>
                
                <h3>Không phải lời khuyên tài chính</h3>
                <p>Nội dung không nhằm thay thế lời khuyên tài chính chuyên nghiệp. Luôn tìm kiếm lời khuyên từ cố vấn tài chính của bạn hoặc nhà cung cấp dịch vụ tài chính có trình độ khác với bất kỳ câu hỏi nào bạn có về quyết định đầu tư của mình.</p>
                
                <h3>Không khuyến nghị đầu tư</h3>
                <p>Không có nội dung nào trên nền tảng này cấu thành lời khuyên đầu tư, dữ liệu hiệu suất hoặc bất kỳ khuyến nghị nào rằng bất kỳ chứng khoán, danh mục chứng khoán, sản phẩm đầu tư, giao dịch hoặc chiến lược đầu tư nào phù hợp với bất kỳ người cụ thể nào.</p>
                
                <h3>Cảnh báo rủi ro</h3>
                <p>Đầu tư vào thị trường chứng khoán chịu rủi ro thị trường. Hiệu suất trong quá khứ không phản ánh kết quả trong tương lai. Bạn nên xem xét cẩn thận mục tiêu đầu tư, mức độ kinh nghiệm và khẩu vị rủi ro của mình trước khi đưa ra bất kỳ quyết định đầu tư nào.</p>
                
                <h3>Độ chính xác dữ liệu</h3>
                <p>Mặc dù chúng tôi cố gắng cung cấp thông tin chính xác và cập nhật từ các nguồn đáng tin cậy (Vietcap, TCBS), chúng tôi không đảm bảo tính chính xác, đầy đủ hoặc kịp thời của dữ liệu. Người dùng nên xác minh độc lập tất cả thông tin trước khi đưa ra quyết định đầu tư.</p>`
            }
        },
        privacy: {
            en: {
                title: 'Privacy Policy',
                body: `<h3>Information Collection</h3>
                <p>This platform does not collect, store, or process any personal information from users. We do not use cookies for tracking purposes, and we do not require user registration or login.</p>
                
                <h3>Data Usage</h3>
                <p>All stock data displayed is sourced from publicly available financial information provided by Vietcap Securities and TCBS Securities. No user-specific data is collected or analyzed.</p>
                
                <h3>Local Storage</h3>
                <p>The platform may use browser local storage to save user preferences such as language selection and theme preferences. This data is stored locally on your device and is not transmitted to any server.</p>
                
                <h3>Third-Party Services</h3>
                <p>This platform uses third-party data providers (Vietcap, TCBS) for financial information. Please refer to their respective privacy policies for information on how they handle data.</p>
                
                <h3>Data Security</h3>
                <p>Since we do not collect personal information, there is no personal data at risk. However, we recommend using secure internet connections when accessing financial information.</p>
                
                <h3>Changes to Privacy Policy</h3>
                <p>We reserve the right to update this privacy policy at any time. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>`
            },
            vi: {
                title: 'Chính sách bảo mật',
                body: `<h3>Thu thập thông tin</h3>
                <p>Nền tảng này không thu thập, lưu trữ hoặc xử lý bất kỳ thông tin cá nhân nào từ người dùng. Chúng tôi không sử dụng cookies để theo dõi và không yêu cầu đăng ký hoặc đăng nhập người dùng.</p>
                
                <h3>Sử dụng dữ liệu</h3>
                <p>Tất cả dữ liệu cổ phiếu được hiển thị đều có nguồn gốc từ thông tin tài chính công khai được cung cấp bởi Chứng khoán Vietcap và Chứng khoán TCBS. Không có dữ liệu cụ thể của người dùng được thu thập hoặc phân tích.</p>
                
                <h3>Lưu trữ cục bộ</h3>
                <p>Nền tảng có thể sử dụng bộ nhớ cục bộ của trình duyệt để lưu tùy chọn của người dùng như lựa chọn ngôn ngữ và tùy chọn chủ đề. Dữ liệu này được lưu trữ cục bộ trên thiết bị của bạn và không được truyền đến bất kỳ máy chủ nào.</p>
                
                <h3>Dịch vụ bên thứ ba</h3>
                <p>Nền tảng này sử dụng các nhà cung cấp dữ liệu bên thứ ba (Vietcap, TCBS) cho thông tin tài chính. Vui lòng tham khảo chính sách bảo mật tương ứng của họ để biết thông tin về cách họ xử lý dữ liệu.</p>
                
                <h3>Bảo mật dữ liệu</h3>
                <p>Vì chúng tôi không thu thập thông tin cá nhân nên không có dữ liệu cá nhân nào có nguy cơ. Tuy nhiên, chúng tôi khuyến nghị sử dụng kết nối internet an toàn khi truy cập thông tin tài chính.</p>
                
                <h3>Thay đổi chính sách bảo mật</h3>
                <p>Chúng tôi có quyền cập nhật chính sách bảo mật này bất kỳ lúc nào. Việc tiếp tục sử dụng nền tảng sau khi có thay đổi đồng nghĩa với việc chấp nhận chính sách đã cập nhật.</p>`
            }
        },
        terms: {
            en: {
                title: 'Terms of Service',
                body: `<h3>Acceptance of Terms</h3>
                <p>By accessing and using this stock valuation platform, you accept and agree to be bound by the terms and provision of this agreement.</p>
                
                <h3>Use License</h3>
                <p>Permission is granted to temporarily access the materials (information or software) on this platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.</p>
                
                <h3>Restrictions</h3>
                <p>You may not:
                <ul>
                    <li>Modify or copy the materials</li>
                    <li>Use the materials for any commercial purpose or public display</li>
                    <li>Attempt to decompile or reverse engineer any software contained on the platform</li>
                    <li>Remove any copyright or proprietary notations from the materials</li>
                    <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
                </ul>
                </p>
                
                <h3>Service Availability</h3>
                <p>We strive to maintain high availability but do not guarantee that the platform will be available at all times. The service may be interrupted for maintenance, updates, or due to circumstances beyond our control.</p>
                
                <h3>Accuracy of Materials</h3>
                <p>The materials appearing on this platform could include technical, typographical, or photographic errors. We do not warrant that any of the materials on the platform are accurate, complete, or current.</p>
                
                <h3>Links</h3>
                <p>We have not reviewed all of the sites linked to our platform and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by us.</p>
                
                <h3>Modifications</h3>
                <p>We may revise these terms of service at any time without notice. By using this platform, you are agreeing to be bound by the current version of these terms of service.</p>
                
                <h3>Governing Law</h3>
                <p>These terms and conditions are governed by and construed in accordance with the laws of Vietnam.</p>`
            },
            vi: {
                title: 'Điều khoản sử dụng',
                body: `<h3>Chấp nhận điều khoản</h3>
                <p>Bằng cách truy cập và sử dụng nền tảng định giá cổ phiếu này, bạn chấp nhận và đồng ý bị ràng buộc bởi các điều khoản và điều khoản của thỏa thuận này.</p>
                
                <h3>Giấy phép sử dụng</h3>
                <p>Được cấp quyền truy cập tạm thời vào các tài liệu (thông tin hoặc phần mềm) trên nền tảng này chỉ để xem tạm thời, phi thương mại, cá nhân. Đây là việc cấp giấy phép, không phải chuyển nhượng quyền sở hữu.</p>
                
                <h3>Hạn chế</h3>
                <p>Bạn không được:
                <ul>
                    <li>Sửa đổi hoặc sao chép tài liệu</li>
                    <li>Sử dụng tài liệu cho bất kỳ mục đích thương mại hoặc hiển thị công khai nào</li>
                    <li>Cố gắng dịch ngược hoặc đảo ngược kỹ thuật bất kỳ phần mềm nào có trong nền tảng</li>
                    <li>Xóa bất kỳ thông báo bản quyền hoặc độc quyền nào khỏi tài liệu</li>
                    <li>Chuyển tài liệu cho người khác hoặc "sao chép" tài liệu trên bất kỳ máy chủ nào khác</li>
                </ul>
                </p>
                
                <h3>Tính khả dụng của dịch vụ</h3>
                <p>Chúng tôi cố gắng duy trì tính khả dụng cao nhưng không đảm bảo rằng nền tảng sẽ khả dụng mọi lúc. Dịch vụ có thể bị gián đoạn để bảo trì, cập nhật hoặc do các trường hợp ngoài tầm kiểm soát của chúng tôi.</p>
                
                <h3>Độ chính xác của tài liệu</h3>
                <p>Các tài liệu xuất hiện trên nền tảng này có thể bao gồm các lỗi kỹ thuật, đánh máy hoặc ảnh. Chúng tôi không đảm bảo rằng bất kỳ tài liệu nào trên nền tảng là chính xác, đầy đủ hoặc hiện tại.</p>
                
                <h3>Liên kết</h3>
                <p>Chúng tôi chưa xem xét tất cả các trang web được liên kết với nền tảng của chúng tôi và không chịu trách nhiệm về nội dung của bất kỳ trang web được liên kết nào như vậy. Việc bao gồm bất kỳ liên kết nào không ngụ ý sự chứng thực của chúng tôi.</p>
                
                <h3>Sửa đổi</h3>
                <p>Chúng tôi có thể sửa đổi các điều khoản dịch vụ này bất kỳ lúc nào mà không cần thông báo. Bằng cách sử dụng nền tảng này, bạn đồng ý bị ràng buộc bởi phiên bản hiện tại của các điều khoản dịch vụ này.</p>
                
                <h3>Luật điều chỉnh</h3>
                <p>Các điều khoản và điều kiện này được điều chỉnh và giải thích theo luật pháp Việt Nam.</p>`
            }
        },
        contact: {
            en: {
                title: 'Contact Information',
                body: `<h3>Get in Touch</h3>
                <p>For inquiries, feedback, or collaboration opportunities, please feel free to reach out through any of the following channels:</p>
                
                <h3>Email</h3>
                <p><a href="mailto:quanganh.ibd@gmail.com" style="color: var(--color-primary); text-decoration: none;">quanganh.ibd@gmail.com</a></p>
                
                <h3>Phone</h3>
                <p><a href="tel:+84813601054" style="color: var(--color-primary); text-decoration: none;">+84 813 601 054</a></p>
                
                <h3>LinkedIn</h3>
                <p><a href="https://www.linkedin.com/in/quanganhday/" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); text-decoration: none;">linkedin.com/in/quanganhday</a></p>
                
                <h3>Response Time</h3>
                <p>I typically respond to inquiries within 24-48 hours during business days. For urgent matters, please indicate "URGENT" in your email subject line.</p>`
            },
            vi: {
                title: 'Thông Tin Liên Hệ',
                body: `<h3>Liên Hệ</h3>
                <p>Để được tư vấn, góp ý hoặc cơ hội hợp tác, vui lòng liên hệ qua các kênh sau:</p>
                
                <h3>Email</h3>
                <p><a href="mailto:quanganh.ibd@gmail.com" style="color: var(--color-primary); text-decoration: none;">quanganh.ibd@gmail.com</a></p>
                
                <h3>Điện Thoại</h3>
                <p><a href="tel:+84813601054" style="color: var(--color-primary); text-decoration: none;">+84 813 601 054</a></p>
                
                <h3>LinkedIn</h3>
                <p><a href="https://www.linkedin.com/in/quanganhday/" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); text-decoration: none;">linkedin.com/in/quanganhday</a></p>
                
                <h3>Thời Gian Phản Hồi</h3>
                <p>Tôi thường phản hồi các yêu cầu trong vòng 24-48 giờ trong ngày làm việc. Đối với các vấn đề khẩn cấp, vui lòng ghi "KHẨN CẤP" trong tiêu đề email.</p>`
            }
        }
    };
    
    const data = content[type][currentLang];
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'legal-modal-overlay';
    overlay.innerHTML = `
        <div class="legal-modal">
            <div class="legal-modal-header">
                <h2>${data.title}</h2>
                <button class="legal-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="legal-modal-body">
                ${data.body}
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close handlers
    const closeBtn = overlay.querySelector('.legal-modal-close');
    closeBtn.addEventListener('click', () => {
        overlay.remove();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
    
    // Escape key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}
