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
        // chartCache managed by ChartManager
        this.valuationCache = null; // Cache full valuation results (per symbol + assumptions)
        this.abortControllers = {
            stockData: null,
            chartData: null
        };
        this.debounceTimer = null; // For debouncing symbol input
        this.valuationDebounceTimer = null; // For debouncing valuation calculation
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
        this.currentLanguage = 'en'; // Default to English

        // Initialize modular managers
        this.companyProfileManager = new CompanyProfileManager(this.apiBaseUrl);
        this.tradingViewManager = new TradingViewManager(this.apiBaseUrl);
        this.chartManager = new ChartManager();

        // Initialize API Client
        this.api = new ApiClient(this.apiBaseUrl);

        // Initialize Report Generator
        this.reportGenerator = new ReportGenerator(this.api, {
            show: (msg, type) => this.showStatus(msg, type)
        });

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultAssumptions();
        this.setupThemeToggle();
        this.setupDownloadModal();
        this.applyLanguage(this.currentLanguage);
        this.chartManager.init();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                if (tabId) this.switchTab(tabId);
            });
        });

        // Prevent form submit from reloading/clearing input
        const searchForm = document.querySelector('.header-search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', function (e) {
                e.preventDefault();
            });
        }

        // Stock search - Search button and Enter key
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Clear any pending debounce to prevent duplicate request
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = null;
                }
                this.loadStockData();
            });
        }

        document.getElementById('stock-symbol').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Clear any pending debounce to prevent duplicate request
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = null;
                }
                this.loadStockData();
            }
        });

        // Reset cache when symbol input changes and enable download button
        document.getElementById('stock-symbol').addEventListener('input', (e) => {
            this.chartManager.resetState();
            this.historicalData = null;

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

            // Auto-load disabled - user must press Enter or click search button to load data
        });

        // Period Toggle Button (New UI V2)
        const periodToggleBtn = document.getElementById('period-toggle-btn');
        if (periodToggleBtn) {
            periodToggleBtn.addEventListener('click', () => {
                const select = document.getElementById('period-select');
                const periodText = document.getElementById('period-text');

                // Toggle
                select.value = select.value === 'year' ? 'quarter' : 'year';

                // Update UI text
                if (periodText) {
                    periodText.textContent = select.value === 'year' ? 'Year' : 'Quarter';
                }

                // Trigger change event
                select.dispatchEvent(new Event('change'));
            });
        }

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
        document.getElementById('reset-assumptions-btn').addEventListener('click', () => {
            this.resetAssumptions();
            this.debouncedCalculateValuation();
        });

        // Real-time updates on assumption changes
        document.querySelectorAll('#assumptions-form input').forEach(input => {
            input.addEventListener('input', () => {
                this.updateAssumptions();
                this.debouncedCalculateValuation();
            });
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
        const enFlag = languageToggle.querySelector('.en-flag');
        const viFlag = languageToggle.querySelector('.vi-flag');

        // Get saved language or default to English
        const savedLang = localStorage.getItem('language') || 'en';
        this.currentLanguage = savedLang;

        // Show appropriate flag
        if (savedLang === 'en') {
            enFlag.style.display = 'inline';
            viFlag.style.display = 'none';
        } else {
            enFlag.style.display = 'none';
            viFlag.style.display = 'inline';
        }

        document.documentElement.setAttribute('lang', savedLang);
        this.applyLanguage(savedLang);

        languageToggle.addEventListener('click', () => {
            // Toggle between English and Vietnamese
            const newLang = this.currentLanguage === 'en' ? 'vi' : 'en';
            this.currentLanguage = newLang;

            // Toggle flag visibility
            if (newLang === 'en') {
                enFlag.style.display = 'inline';
                viFlag.style.display = 'none';
            } else {
                enFlag.style.display = 'none';
                viFlag.style.display = 'inline';
            }

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
                const fileUrl = this.api.getDownloadUrl(symbol);

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
    } async loadStockData() {
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
        this.chartManager.resetState();
        this.historicalData = null;

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

        this.showLoading(true, `Loading ${symbol}...`);
        this.showStatus('Loading data...', 'loading');
        this.loadingState.stockData = true;

        // Create new abort controller for this request
        this.abortControllers.stockData = new AbortController();
        const controller = this.abortControllers.stockData;

        try {
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced timeout for stock data

            // Always fetch current price for accurate valuation comparison
            const fetchPrice = true;

            // Fetch stock data only - fastest possible loading
            // Fetch stock data using ApiClient
            const stockData = await this.api.getAppData(symbol, period, fetchPrice, controller.signal);

            clearTimeout(timeoutId);

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

            // Auto-calculate valuation when data is loaded (Preload)
            this.calculateValuation();

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
        if (this.chartManager.hasCache(symbol)) {
            this.historicalData = this.chartManager.getCache(symbol);
            this.chartsLoaded = true;
            this.chartManager.updateCharts(this.historicalData, this.stockData);
            return;
        }

        // Only load charts if we don't have them cached
        if (this.chartsLoaded && this.currentStock === symbol) {
            return; // Charts already loaded for this symbol
        }

        this.loadingState.chartData = true;
        this.chartManager.showLoading(true);

        // Create new abort controller for this chart request
        this.abortControllers.chartData = new AbortController();
        const controller = this.abortControllers.chartData;

        try {
            const timeoutId = setTimeout(() => controller.abort(), 20000); // Longer timeout for chart data

            const chartData = await this.api.getHistoricalChart(symbol, controller.signal);

            clearTimeout(timeoutId);

            if (chartData) {

                console.log('📊 Chart data response:', chartData);

                if (chartData.success) {
                    // Only update if this is still the current symbol
                    if (this.currentStock === symbol) {
                        this.historicalData = chartData.data;
                        console.log('📈 Historical data set:', this.historicalData);
                        this.chartsLoaded = true;

                        // Cache the chart data for future use
                        this.chartManager.setCache(symbol, chartData.data);

                        this.chartManager.updateCharts(this.historicalData, this.stockData);
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
            this.chartManager.showLoading(false);

            // Clear the abort controller reference
            if (this.abortControllers.chartData === controller) {
                this.abortControllers.chartData = null;
            }
        }
    }



    debouncedCalculateValuation() {
        if (this.valuationDebounceTimer) {
            clearTimeout(this.valuationDebounceTimer);
        }
        this.valuationDebounceTimer = setTimeout(() => {
            this.calculateValuation();
        }, 500);
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

            const result = await this.api.calculateValuation(this.currentStock, requestData);

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
                financial_data: result.financial_data,
                sensitivity_analysis: result.sensitivity_analysis
            };

            // Cache the valuation results
            this.valuationCache = {
                cacheKey: cacheKey,
                results: JSON.parse(JSON.stringify(this.valuationResults)) // Deep copy
            };

            this.updateValuationDisplay();
            this.updateWeightedResults();
            this.updateRecommendation();

            if (this.valuationResults.sensitivity_analysis) {
                this.renderSensitivityMatrix(this.valuationResults.sensitivity_analysis);
            }

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



    updateValuationDisplay() {
        const currentPrice = this.stockData.current_price;

        // FCFE Results
        document.getElementById('fcfe-result').textContent = AppUtils.formatCurrency(this.valuationResults.fcfe.shareValue);
        const fcfeDiff = ((this.valuationResults.fcfe.shareValue - currentPrice) / currentPrice) * 100;
        const fcfeDiffElement = document.getElementById('fcfe-diff');
        fcfeDiffElement.textContent = `${fcfeDiff > 0 ? '+' : ''}${fcfeDiff.toFixed(1)}%`;
        fcfeDiffElement.className = `result-diff ${fcfeDiff > 0 ? 'positive' : 'negative'}`;

        // FCFF Results
        document.getElementById('fcff-result').textContent = AppUtils.formatCurrency(this.valuationResults.fcff.shareValue);
        const fcffDiff = ((this.valuationResults.fcff.shareValue - currentPrice) / currentPrice) * 100;
        const fcffDiffElement = document.getElementById('fcff-diff');
        fcffDiffElement.textContent = `${fcffDiff > 0 ? '+' : ''}${fcffDiff.toFixed(1)}%`;
        fcffDiffElement.className = `result-diff ${fcffDiff > 0 ? 'positive' : 'negative'}`;

        // Justified P/E Results
        document.getElementById('pe-result').textContent = AppUtils.formatCurrency(this.valuationResults.justified_pe.shareValue);
        const peDiff = ((this.valuationResults.justified_pe.shareValue - currentPrice) / currentPrice) * 100;
        const peDiffElement = document.getElementById('pe-diff');
        peDiffElement.textContent = `${peDiff > 0 ? '+' : ''}${peDiff.toFixed(1)}%`;
        peDiffElement.className = `result-diff ${peDiff > 0 ? 'positive' : 'negative'}`;

        // Justified P/B Results
        document.getElementById('pb-result').textContent = AppUtils.formatCurrency(this.valuationResults.justified_pb.shareValue);
        const pbDiff = ((this.valuationResults.justified_pb.shareValue - currentPrice) / currentPrice) * 100;
        const pbDiffElement = document.getElementById('pb-diff');
        pbDiffElement.textContent = `${pbDiff > 0 ? '+' : ''}${pbDiff.toFixed(1)}%`;
        pbDiffElement.className = `result-diff ${pbDiff > 0 ? 'positive' : 'negative'}`;

        // Weighted Average Results
        const weightedValue = this.valuationResults.weighted_average;
        document.getElementById('weighted-result').textContent = AppUtils.formatCurrency(weightedValue);
        const weightedDiff = ((weightedValue - currentPrice) / currentPrice) * 100;
        const weightedDiffElement = document.getElementById('weighted-diff');
        weightedDiffElement.textContent = `${weightedDiff > 0 ? '+' : ''}${weightedDiff.toFixed(1)}%`;
        weightedDiffElement.className = `result-diff ${weightedDiff > 0 ? 'positive' : 'negative'}`;

        // Update summary
        this.safeUpdateElement('target-price', AppUtils.formatCurrency(weightedValue));
        this.safeUpdateElement('summary-potential', `${weightedDiff.toFixed(1)}%`);
        this.safeUpdateElement('return-value', `${weightedDiff.toFixed(1)}%`);

        // Update model details with PE/PB ratios
        this.updateModelDetails();
    }

    updateWeightedResults() {
        const weightedValue = this.valuationResults.weighted_average;
        const currentPrice = this.stockData.current_price;
        const weightedDiff = ((weightedValue - currentPrice) / currentPrice) * 100;

        document.getElementById('weighted-result').textContent = AppUtils.formatCurrency(weightedValue);
        const weightedDiffElement = document.getElementById('weighted-diff');
        weightedDiffElement.textContent = `${weightedDiff > 0 ? '+' : ''}${weightedDiff.toFixed(1)}%`;
        weightedDiffElement.className = `result-diff ${weightedDiff > 0 ? 'positive' : 'negative'}`;

        this.safeUpdateElement('target-price', AppUtils.formatCurrency(weightedValue));
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
            reasoning = `Based on 4-model average of ${AppUtils.formatCurrency(weightedValue)} vs current price ${AppUtils.formatCurrency(currentPrice)}`;
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

    renderSensitivityMatrix(matrix) {
        const table = document.getElementById('sensitivity-table');
        if (!table || !matrix) return;

        // Header (Growth Rate)
        let theadHtml = '<tr><th style="text-align: left">WACC \\ Growth</th>';
        matrix.col_headers.forEach(h => {
            theadHtml += `<th>${h}%</th>`;
        });
        theadHtml += '</tr>';
        table.querySelector('thead').innerHTML = theadHtml;

        // Body (WACC Rows)
        let tbodyHtml = '';
        const midRow = Math.floor(matrix.row_headers.length / 2);
        const midCol = Math.floor(matrix.col_headers.length / 2);
        const baseValue = matrix.values[midRow][midCol];

        matrix.row_headers.forEach((wacc, rIndex) => {
            tbodyHtml += `<tr><th>${wacc}%</th>`; // Row Header

            matrix.values[rIndex].forEach((val, cIndex) => {
                let cellClass = '';

                // Base case highlight
                if (rIndex === midRow && cIndex === midCol) {
                    cellClass = 'sensitivity-cell-base sensitivity-cell-med';
                } else {
                    // Color grading (Heatmap)
                    const diffPct = (val - baseValue) / baseValue;
                    if (diffPct > 0.15) cellClass = 'sensitivity-cell-very-high';
                    else if (diffPct > 0.05) cellClass = 'sensitivity-cell-high';
                    else if (diffPct > -0.05) cellClass = 'sensitivity-cell-med';
                    else if (diffPct > -0.15) cellClass = 'sensitivity-cell-low';
                    else cellClass = 'sensitivity-cell-very-low';
                }

                tbodyHtml += `<td class="${cellClass}">${AppUtils.formatCurrency(val)}</td>`;
            });

            tbodyHtml += '</tr>';
        });

        table.querySelector('tbody').innerHTML = tbodyHtml;
    }

    async exportReport() {
        await this.reportGenerator.exportReport(
            this.stockData,
            this.valuationResults,
            this.assumptions,
            this.modelWeights,
            this.currentStock,
            this.currentLanguage
        );
    }



    async exportExcelReport() {
        await this.reportGenerator.exportExcelReport(
            this.stockData,
            this.valuationResults,
            this.assumptions,
            this.modelWeights,
            this.currentStock,
            this.currentLanguage
        );
    }















    showStatus(message, type = 'info') {
        // Use external Toast module
        if (typeof Toast !== 'undefined') {
            Toast.show(message, type);
        }
    }

    hideStatus() {
        // Use external Toast module
        if (typeof Toast !== 'undefined') {
            Toast.hide();
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

        // Clear company description and TradingView widget using managers
        if (this.companyProfileManager) {
            this.companyProfileManager.clear();
        }
        if (this.tradingViewManager) {
            this.tradingViewManager.clear();
        }
    }



    /**
     * Fetch company profile/description from backend API
     * Delegates to CompanyProfileManager module
     */
    fetchCompanyProfile(symbol) {
        if (this.companyProfileManager) {
            this.companyProfileManager.fetchProfile(symbol);
        }
    }

    /**
     * Initialize TradingView Advanced Chart Widget
     * Delegates to TradingViewManager module
     */
    initTradingViewWidget(symbol, exchange) {
        if (this.tradingViewManager) {
            this.tradingViewManager.initWidget(symbol, exchange);
        }
    }

    updateOverviewDisplay(data) {
        // Normalize VCI data (UPCOM stocks) if present
        if (data.vci_data || data['(ST+LT borrowings)/Equity'] !== undefined) {
            console.log('Normalizing VCI data for display', data);

            // Map VCI keys to standard keys
            data.pe_ratio = data.pe_ratio ?? data['P/E'];
            data.pb_ratio = data.pb_ratio ?? data['P/B'];
            data.ps_ratio = data.ps_ratio ?? data['P/S'];
            data.pcf_ratio = data.pcf_ratio ?? data['P/Cash Flow'];

            // EPS & Book Value
            data.eps = data.eps ?? data['EPS (VND)'];
            data.book_value_per_share = data.book_value_per_share ?? (data['BVPS (VND)'] || data['book_value_per_share']);

            // Market Data
            data.shares_outstanding = data.shares_outstanding ?? data['Outstanding Share (Mil. Shares)'];
            data.market_cap = data.market_cap ?? data['Market Capital (Bn. VND)'];

            // Financials
            data.ebitda = data.ebitda ?? data['EBITDA (Bn. VND)'];
            // VCI usually provides these if available, map if they exist
            data.revenue_ttm = data.revenue_ttm ?? (data['Net Revenue'] || data['Revenue'] || 0);
            data.net_income_ttm = data.net_income_ttm ?? (data['Net Profit After Tax'] || data['Net Income'] || 0);

            // Debt
            data.debt_to_equity = data.debt_to_equity ?? data['Debt/Equity'];

            // Percentages (convert decimal to percent if needed)
            // VCI returns 0.42 for 42%, app expects 42 (sometimes) or handles decimals?
            // formatPercent does .toFixed(1) + '%'. So 0.42 becomes "0.4%".
            // We need to multiply by 100 for ratios like ROE, ROA, Margins.

            const toPercent = (val) => val != null ? val * 100 : null;

            if (data['ROE (%)'] != null && data.roe == null) data.roe = toPercent(data['ROE (%)']);
            if (data['ROA (%)'] != null && data.roa == null) data.roa = toPercent(data['ROA (%)']);

            // Margins
            if (data['Gross Profit Margin (%)'] != null) data.gross_profit_margin = toPercent(data['Gross Profit Margin (%)']);
            if (data['EBIT Margin (%)'] != null) data.ebit_margin = toPercent(data['EBIT Margin (%)']);
            if (data['Net Profit Margin (%)'] != null) data.net_profit_margin = toPercent(data['Net Profit Margin (%)']);

            // Ratios (these are usually raw numbers 0.7, 1.2 etc, formatNumber handles them fine)
            data.current_ratio = data.current_ratio ?? data['Current Ratio'];
            data.quick_ratio = data.quick_ratio ?? data['Quick Ratio'];
            data.cash_ratio = data.cash_ratio ?? data['Cash Ratio'];
            data.interest_coverage = data.interest_coverage ?? data['Interest Coverage'];

            data.asset_turnover = data.asset_turnover ?? data['Asset Turnover'];
            data.inventory_turnover = data.inventory_turnover ?? data['Inventory Turnover'];
            data.fixed_asset_turnover = data.fixed_asset_turnover ?? data['Fixed Asset Turnover'];
        }

        // Update company info
        this.safeUpdateElement('company-name', data.name || '--');
        this.safeUpdateElement('company-symbol', data.symbol || '--');
        this.safeUpdateElement('company-sector', data.sector || '--');
        this.safeUpdateElement('company-exchange', data.exchange || '--');

        // Update market data
        this.safeUpdateElement('current-price', AppUtils.formatCurrency(data.current_price));
        this.safeUpdateElement('market-cap', AppUtils.formatLargeNumber(data.market_cap));
        this.safeUpdateElement('shares-outstanding', AppUtils.formatLargeNumber(data.shares_outstanding));
        this.safeUpdateElement('pe-ratio', AppUtils.formatNumber(data.pe_ratio));
        this.safeUpdateElement('pb-ratio', AppUtils.formatNumber(data.pb_ratio));
        this.safeUpdateElement('ps-ratio', AppUtils.formatNumber(data.ps_ratio));
        this.safeUpdateElement('pcf-ratio', AppUtils.formatNumber(data.pcf_ratio));
        this.safeUpdateElement('eps', AppUtils.formatCurrency(data.eps));
        this.safeUpdateElement('book-value-per-share', AppUtils.formatCurrency(data.book_value_per_share));
        this.safeUpdateElement('ev-ebitda', AppUtils.formatNumber(data.ev_ebitda));

        // Update financial metrics
        this.safeUpdateElement('revenue', AppUtils.formatLargeNumber(data.revenue_ttm));
        this.safeUpdateElement('net-income', AppUtils.formatLargeNumber(data.net_income_ttm));
        this.safeUpdateElement('ebitda', AppUtils.formatLargeNumber(data.ebitda));
        this.safeUpdateElement('roe', AppUtils.formatPercent(data.roe));
        this.safeUpdateElement('roa', AppUtils.formatPercent(data.roa));
        this.safeUpdateElement('debt-equity', AppUtils.formatNumber(data.debt_to_equity));

        // Update ratio metrics
        this.safeUpdateElement('asset-turnover', AppUtils.formatNumber(data.asset_turnover));
        this.safeUpdateElement('inventory-turnover', AppUtils.formatNumber(data.inventory_turnover));
        this.safeUpdateElement('fixed-asset-turnover', AppUtils.formatNumber(data.fixed_asset_turnover));
        this.safeUpdateElement('current-ratio', AppUtils.formatNumber(data.current_ratio));
        this.safeUpdateElement('quick-ratio', AppUtils.formatNumber(data.quick_ratio));
        this.safeUpdateElement('cash-ratio', AppUtils.formatNumber(data.cash_ratio));
        this.safeUpdateElement('interest-coverage', AppUtils.formatNumber(data.interest_coverage));
        this.safeUpdateElement('gross-profit-margin', AppUtils.formatPercent(data.gross_profit_margin));
        this.safeUpdateElement('ebit-margin', AppUtils.formatPercent(data.ebit_margin));
        this.safeUpdateElement('net-profit-margin', AppUtils.formatPercent(data.net_profit_margin));

        // Update summary tab
        this.safeUpdateElement('summary-symbol', data.symbol || '--');
        this.safeUpdateElement('summary-name', data.name || '--');
        this.safeUpdateElement('summary-sector', data.sector || '--');
        this.safeUpdateElement('summary-exchange', data.exchange || '--');
        this.safeUpdateElement('summary-price', AppUtils.formatCurrency(data.current_price));
        this.safeUpdateElement('summary-market-cap', AppUtils.formatLargeNumber(data.market_cap));
        this.safeUpdateElement('summary-pe', AppUtils.formatNumber(data.pe_ratio));
        this.safeUpdateElement('summary-pb', AppUtils.formatNumber(data.pb_ratio));

        // Fetch and display company profile/description
        if (data.symbol) {
            this.fetchCompanyProfile(data.symbol);
            this.initTradingViewWidget(data.symbol, data.exchange);
        }
    }

    updateModelDetails() {
        if (!this.valuationResults || !this.stockData) {
            return;
        }

        const currentPrice = this.stockData.current_price;

        let eps = this.valuationResults.financial_data.eps || this.stockData.eps || 0;
        let bvps = this.stockData.book_value_per_share || 0;

        // FCFE Details
        const fcfeEquityValue = this.valuationResults.fcfe.equityValue;
        this.safeUpdateElement('fcfe-equity', AppUtils.formatCurrency(fcfeEquityValue));
        this.safeUpdateElement('fcfe-share-value', AppUtils.formatCurrency(this.valuationResults.fcfe.shareValue));
        const fcfeDiff = ((this.valuationResults.fcfe.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('fcfe-market-diff', `${fcfeDiff > 0 ? '+' : ''}${fcfeDiff.toFixed(1)}%`);

        // FCFF Details
        const fcffEquityValue = this.valuationResults.fcff.equityValue;
        const fcffEV = fcffEquityValue + (this.stockData.total_debt || 0);
        this.safeUpdateElement('fcff-ev', AppUtils.formatCurrency(fcffEV));
        this.safeUpdateElement('fcff-equity', AppUtils.formatCurrency(fcffEquityValue));
        this.safeUpdateElement('fcff-share-value', AppUtils.formatCurrency(this.valuationResults.fcff.shareValue));
        const fcffDiff = ((this.valuationResults.fcff.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('fcff-market-diff', `${fcffDiff > 0 ? '+' : ''}${fcffDiff.toFixed(1)}%`);

        // Justified P/E Details
        const justifiedPE = eps > 0 ? Math.abs(this.valuationResults.justified_pe.shareValue / eps) : 0;
        this.safeUpdateElement('pe-justified-ratio', `${justifiedPE.toFixed(2)}x`);
        this.safeUpdateElement('pe-current-eps', AppUtils.formatCurrency(eps));
        this.safeUpdateElement('pe-share-value', AppUtils.formatCurrency(this.valuationResults.justified_pe.shareValue));
        const peDiff = ((this.valuationResults.justified_pe.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('pe-market-diff', `${peDiff > 0 ? '+' : ''}${peDiff.toFixed(1)}%`);

        // Justified P/B Details
        const justifiedPB = bvps > 0 ? Math.abs(this.valuationResults.justified_pb.shareValue / bvps) : 0;
        this.safeUpdateElement('pb-justified-ratio', `${justifiedPB.toFixed(2)}x`);
        this.safeUpdateElement('pb-current-bvps', AppUtils.formatCurrency(bvps));
        this.safeUpdateElement('pb-share-value', AppUtils.formatCurrency(this.valuationResults.justified_pb.shareValue));
        const pbDiff = ((this.valuationResults.justified_pb.shareValue - currentPrice) / currentPrice) * 100;
        this.safeUpdateElement('pb-market-diff', `${pbDiff > 0 ? '+' : ''}${pbDiff.toFixed(1)}%`);
        // Update target price and summary
        this.safeUpdateElement('target-price', AppUtils.formatCurrency(this.valuationResults.weighted_average));
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

    showLoading(show, message = 'Loading...') {
        // Toggle search button state
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

        // Use subtle inline loading indicator instead of full-screen blur
        const tabContent = document.querySelector('.tab-content');
        const existingIndicator = document.getElementById('data-loading-indicator');

        if (show) {
            if (!existingIndicator && tabContent) {
                const indicator = document.createElement('div');
                indicator.id = 'data-loading-indicator';
                indicator.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--color-primary, #007AFF);
                    color: white;
                    padding: 10px 24px;
                    border-radius: 20px;
                    z-index: 1000;
                    font-size: 14px;
                    font-weight: 500;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideDown 0.3s ease-out;
                `;
                indicator.innerHTML = `
                    <div class="loader" style="width: 20px; height: 20px; transform: scale(0.5);"></div>
                    <span>${message}</span>
                `;
                document.body.appendChild(indicator);
            } else if (existingIndicator) {
                existingIndicator.querySelector('span').textContent = message;
            }
        } else {
            if (existingIndicator) {
                existingIndicator.style.animation = 'slideUp 0.2s ease-in forwards';
                setTimeout(() => existingIndicator.remove(), 200);
            }
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

    // Position overlay at current scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    overlay.style.top = scrollTop + 'px';

    // Prevent body scroll and ensure modal content starts at top
    document.body.style.overflow = 'hidden';
    const modalBody = overlay.querySelector('.legal-modal-body');
    if (modalBody) {
        modalBody.scrollTop = 0;
    }

    // Close handlers
    const closeBtn = overlay.querySelector('.legal-modal-close');
    closeBtn.addEventListener('click', () => {
        document.body.style.overflow = '';
        overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.style.overflow = '';
            overlay.remove();
        }
    });

    // Escape key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.style.overflow = '';
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

