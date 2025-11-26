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
        this.apiBaseUrl = 'https://api.quanganh.org'; // Production API endpoint
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
        document.querySelector('.search-form').addEventListener('submit', function(e) {
            e.preventDefault();
        });

        // Stock search
        document.getElementById('load-data-btn').addEventListener('click', () => this.loadStockData());
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
        document.getElementById('export-report-btn').addEventListener('click', () => this.exportReport());
        
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
        this.applyLanguage(savedLang);
        
        languageToggle.addEventListener('click', () => {
            // Toggle between English and Vietnamese
            const newLang = this.currentLanguage === 'en' ? 'vi' : 'en';
            this.currentLanguage = newLang;
            langText.textContent = newLang.toUpperCase();
            localStorage.setItem('language', newLang);
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
                
                // Download from VPS backend with error handling
                const fileUrl = `${this.apiBaseUrl}/api/download/${symbol}`;
                
                try {
                    // First, check if file exists with a HEAD request
                    const checkResponse = await fetch(fileUrl, { method: 'HEAD' });
                    
                    if (checkResponse.status === 404) {
                        this.showStatus(`Financial data for ${symbol} is not available`, 'error');
                        return;
                    }
                    
                    if (checkResponse.status === 429) {
                        // Rate limit exceeded
                        const errorData = await fetch(fileUrl).then(r => r.json());
                        const minutes = errorData.retry_after_minutes || Math.ceil(errorData.retry_after / 60);
                        this.showStatus(`Download limit exceeded. Please try again in ${minutes} minutes.`, 'error');
                        return;
                    }
                    
                    if (!checkResponse.ok) {
                        this.showStatus(`Download failed: ${checkResponse.statusText}`, 'error');
                        return;
                    }
                    
                    // File exists, proceed with download
                    const tempLink = document.createElement('a');
                    tempLink.href = fileUrl;
                    tempLink.download = `${symbol}.xlsx`;
                    tempLink.style.display = 'none';
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                    
                    // Show success message with details
                    this.showStatus(`Downloading ${symbol}.xlsx - Full financial statements (Balance Sheet, Income Statement, Cash Flow)`, 'success');
                    
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

        // Update app title
        document.querySelector('.app-title').textContent = langData.appTitle;

        // Update button texts if they have data-i18n
        const loadBtn = document.getElementById('load-data-btn');
        if (loadBtn && !loadBtn.disabled) {
            loadBtn.textContent = langData.loadCompanyData;
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

        // Update footer
        const footer = document.querySelector('.app-footer p');
        if (footer) {
            footer.textContent = langData.createdBy;
        }
    }    setupCharts() {
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
                
                if (chartData.success) {
                    // Only update if this is still the current symbol
                    if (this.currentStock === symbol) {
                        this.historicalData = chartData.data;
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

        // Update ROE/ROA Chart
        this.charts.roeRoa.data.labels = this.historicalData.years;
        this.charts.roeRoa.data.datasets[0].data = this.historicalData.roa_data;
        this.charts.roeRoa.data.datasets[1].data = this.historicalData.roe_data;
        this.charts.roeRoa.update();

        // Update Liquidity Chart
        this.charts.liquidity.data.labels = this.historicalData.years;
        this.charts.liquidity.data.datasets[0].data = this.historicalData.current_ratio_data;
        this.charts.liquidity.data.datasets[1].data = this.historicalData.quick_ratio_data;
        this.charts.liquidity.data.datasets[2].data = this.historicalData.cash_ratio_data;
        this.charts.liquidity.update();

        // Update P/E and P/B Chart
        if (this.charts.pePb) {
            this.charts.pePb.data.labels = this.historicalData.years;
            this.charts.pePb.data.datasets[0].data = this.historicalData.pe_ratio_data || [];
            this.charts.pePb.data.datasets[1].data = this.historicalData.pb_ratio_data || [];
            this.charts.pePb.update();
        }
        // Update NIM Chart
        if (this.charts.nim) {
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

    exportReport() {
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
            this.showStatus('PDF report generated and downloaded successfully!', 'success');

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

    showStatus(message, type) {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.classList.remove('hidden');

        setTimeout(() => {
            statusElement.classList.add('hidden');
        }, 5000);
    }

    showLoading(show) {
        const loadBtn = document.getElementById('load-data-btn');
        if (show) {
            loadBtn.textContent = 'Loading...';
            loadBtn.disabled = true;
        } else {
            loadBtn.textContent = 'Load Company Data';
            loadBtn.disabled = false;
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
});
