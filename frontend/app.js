/**
 * Vietnamese Stock Valuation - Client-side application logic
 * Uses vanilla JavaScript for state management and DOM manipulation
 * Integrates with Chart.js for historical trend visualization
 * Exports Excel reports using ExcelJS
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

        // Auto-refresh price interval (30 seconds)
        this.priceRefreshInterval = null;
        this.priceRefreshRate = 30000; // 30 seconds
        this.lastPrice = null; // Track last price for change calculation
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
        this.apiBaseUrl = 'https://api.quanganh.org'; // Production API
        // this.apiBaseUrl = 'http://localhost:5000'; // Local testing
        this.currentLanguage = 'en'; // Default to English

        // Initialize modular managers
        this.companyProfileManager = new CompanyProfileManager(this.apiBaseUrl);
        this.tradingViewManager = new TradingViewManager(this.apiBaseUrl);
        this.chartManager = new ChartManager();
        this.financialsManager = new FinancialsManager();
        this.newsManager = new NewsManager(this.apiBaseUrl);
        this.historyManager = new HistoryManager(this.apiBaseUrl);

        // Initialize API Client
        this.api = new ApiClient(this.apiBaseUrl);

        // Initialize Report Generator
        this.reportGenerator = new ReportGenerator(this.api, {
            show: (msg, type) => this.showStatus(msg, type)
        });

        this.init();
    }

    init() {
        // Suppress console logs in production to hide data/code
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            const noop = () => { };
            console.log = noop;
            console.info = noop;
        }

        this.setupEventListeners();
        this.loadDefaultAssumptions();
        this.setupThemeToggle();
        this.setupDownloadModal();
        this.applyLanguage(this.currentLanguage);
        this.chartManager.init();

        // Setup visibility change listener for auto-refresh
        this.setupVisibilityListener();
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

        // Export functionality (Excel only - PDF removed)
        const exportExcelBtn = document.getElementById('export-excel-btn');

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

        // Get saved language, or auto-detect from browser, default to English
        let savedLang = localStorage.getItem('language');
        if (!savedLang) {
            // Auto-detect browser language
            const browserLang = navigator.language || navigator.userLanguage || 'en';
            savedLang = browserLang.toLowerCase().startsWith('vi') ? 'vi' : 'en';
            console.log(`🌐 Auto-detected language: ${savedLang} (browser: ${browserLang})`);
        }
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

        // Get saved theme, or auto-detect from system preference
        let currentTheme = localStorage.getItem('theme');
        if (!currentTheme) {
            // Auto-detect system dark mode preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentTheme = prefersDark ? 'dark' : 'light';
            console.log(`🎨 Auto-detected theme: ${currentTheme}`);
        }
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

                // Download happens instantly - no need for loading toast

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

        // Re-render Stock Price Hero with updated language for market cap formatting
        if (this.stockData) {
            this.updateStockPriceHero(this.stockData);
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

        // Lazy load history if selected
        if (tabName === 'history' && this.currentStock) {
            this.historyManager.updateHistory(this.currentStock);
        }
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
        this.chartsLoaded = false; // CRITICAL: Reset app's chartsLoaded flag too!
        this.historicalData = null;

        // IMPORTANT: Clear chart cache for the new symbol to force fresh data fetch
        // This ensures charts are always updated with the latest data from API
        console.log(`🗑️ Clearing cache for ${symbol}, period: ${period}`);
        this.chartManager.clearCacheForSymbol(symbol);

        // Also clear API cache for this symbol to ensure fresh data
        this.api.clearCache(`chart_${symbol}`);
        this.api.clearCache(`appData_${symbol}_${period}`);

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
        // Removed: showStatus loading toast - too noisy
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

            // If current_price is missing (common for UPCOM stocks), fetch it separately
            if (!this.stockData.current_price) {
                console.log(`⚠️ current_price missing for ${symbol}, fetching separately...`);
                try {
                    const priceData = await this.api.getRealTimePrice(symbol);
                    if (priceData && priceData.current_price) {
                        this.stockData.current_price = priceData.current_price;
                        this.stockData.price_change = priceData.price_change;
                        this.stockData.price_change_percent = priceData.price_change_percent;
                        console.log(`✓ Fetched current_price for ${symbol}: ${priceData.current_price}`);
                    }
                } catch (priceError) {
                    console.warn(`Could not fetch price for ${symbol}:`, priceError.message);
                }
            }

            // Enable download button when stock data is loaded
            const downloadBtn = document.getElementById('download-financials-btn');
            if (downloadBtn) {
                downloadBtn.disabled = false;
            }

            this.updateOverviewDisplay(this.stockData);

            // Removed: showStatus success toast - loading indicator already shows completion

            // Auto-calculate valuation when data is loaded (Preload)
            this.calculateValuation();

            // Start auto-refreshing price every 30 seconds
            this.startPriceRefresh();

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
                // Stop auto-refresh on error
                this.stopPriceRefresh();
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
            console.log('⚠️ Cancelling previous chart request');
            this.abortControllers.chartData.abort();
        }

        console.log(`📊 Loading charts for ${symbol}...`);

        // Check if we have cached chart data for this symbol
        if (this.chartManager.hasCache(symbol)) {
            console.log(`📦 Using cached chart data for ${symbol}`);
            this.historicalData = this.chartManager.getCache(symbol);
            this.chartsLoaded = true;
            this.chartManager.updateCharts(this.historicalData, this.stockData);
            return;
        }

        console.log(`🔄 No cache found for ${symbol}, fetching from API...`);

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
                        // Removed: showStatus charts loaded toast - unnecessary
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
                    // Charts failed silently - not critical for user
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
            // Removed: loading toast - showLoading indicator is sufficient
            const period = document.getElementById('period-select').value || 'year';

            // IMPORTANT: Clear cache for new symbol to ensure fresh data
            console.log(`🗑️ Clearing cache for ${symbol} (from calculateValuation)`);
            this.chartManager.clearCacheForSymbol(symbol);
            this.api.clearCache(`chart_${symbol}`);
            this.api.clearCache(`appData_${symbol}_${period}`);

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
            document.getElementById('export-excel-btn').disabled = false;
            // Removed: cached valuation toast - too noisy when adjusting weights
            return;
        }

        try {
            // Removed: calculating toast - valuation is fast, no need to announce

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
                    eps: this.stockData.eps_ttm || this.stockData.earnings_per_share,
                    bvps: this.stockData.bvps || this.stockData.book_value_per_share,
                    net_income: this.stockData.net_income_ttm,
                    equity: this.stockData.total_assets - this.stockData.total_debt,
                    shares_outstanding: this.stockData.shares_outstanding,
                    sector: this.stockData.industry || this.stockData.sector // Send sector/industry info
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
                sensitivity_analysis: result.sensitivity_analysis,
                // Include detailed FCFE/FCFF data for Excel export
                fcfe_details: result.fcfe_details || {},
                fcff_details: result.fcff_details || {},
                // Include sector peers data for Excel export
                sector_peers: result.sector_peers || {}
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

            document.getElementById('export-excel-btn').disabled = false;

            // Removed: success toast - results are visible, no need to announce

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
        if (!this.valuationResults) return;  // Safety check

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
        if (!this.valuationResults) return; // Guard clause

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
        // Clear Stock Price Hero
        this.clearStockPriceHero();

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
        this.safeUpdateElement('overview-pe', '--');

        // Clear financial ratios via manager
        if (this.financialsManager) {
            this.financialsManager.clear();
        }

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
        const exportExcelBtn = document.getElementById('export-excel-btn');
        if (exportExcelBtn) exportExcelBtn.disabled = true;

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

        // Update Stock Price Hero (prominent display at top)
        this.updateStockPriceHero(data);

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

        this.safeUpdateElement('eps', AppUtils.formatCurrency(data.eps_ttm || data.eps));
        this.safeUpdateElement('book-value-per-share', AppUtils.formatCurrency(data.bvps || data.book_value_per_share));
        this.safeUpdateElement('ev-ebitda', AppUtils.formatNumber(data.ev_ebitda));

        // Update financial metrics (Key Metrics)
        this.safeUpdateElement('revenue', AppUtils.formatLargeNumber(data.revenue_ttm));
        this.safeUpdateElement('net-income', AppUtils.formatLargeNumber(data.net_income_ttm));
        this.safeUpdateElement('ebitda', AppUtils.formatLargeNumber(data.ebitda));
        this.safeUpdateElement('roe', AppUtils.formatPercent(data.roe));
        this.safeUpdateElement('roa', AppUtils.formatPercent(data.roa));
        this.safeUpdateElement('debt-equity', AppUtils.formatNumber(data.debt_to_equity));
        this.safeUpdateElement('overview-pe', AppUtils.formatNumber(data.pe_ratio));
        this.safeUpdateElement('overview-pb', AppUtils.formatNumber(data.pb_ratio));
        this.safeUpdateElement('profit-growth', data.net_profit_growth ? AppUtils.formatPercent(data.net_profit_growth) : '--');
        this.safeUpdateElement('overview-de', data.debt_to_equity ? data.debt_to_equity.toFixed(2) : '--');

        // Net Profit Margin (from ratio_summary)
        this.safeUpdateElement('overview-npm', data.net_profit_margin ? AppUtils.formatPercent(data.net_profit_margin) : '--');

        // Update detailed financial ratios via manager
        if (this.financialsManager) {
            this.financialsManager.updateDisplay(data);
        }

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
            this.newsManager.updateNews(data.symbol);
            this.newsManager.updateEvents(data.symbol);
        }
    }


    updateModelDetails() {
        if (!this.valuationResults || !this.stockData) {
            return;
        }

        const currentPrice = this.stockData.current_price;

        let eps = this.valuationResults.financial_data.eps_ttm || this.valuationResults.financial_data.eps || this.stockData.eps_ttm || this.stockData.eps || 0;
        let bvps = this.stockData.bvps || this.stockData.book_value_per_share || 0;

        // FCFE Details
        // Fix: robust bank detection checking both result flag and sector name
        let isBank = this.valuationResults.is_bank;
        if (!isBank && this.stockData && this.stockData.sector) {
            const sector = this.stockData.sector.toLowerCase();
            isBank = sector.includes('bank') || sector.includes('ngân hàng');
        }



        const resultsGrid = document.querySelector('.results-grid');
        const fcfeCheckboxDir = document.getElementById('fcfe-enabled')?.closest('.form-group');
        const fcffCheckboxDir = document.getElementById('fcff-enabled')?.closest('.form-group');

        if (isBank) {
            // Add class for CSS handling (hides cards and fixes layout)
            if (resultsGrid) {
                resultsGrid.classList.add('bank-mode');

                // FORCE INJECT CSS to bypass any cache issues
                if (!document.getElementById('bank-override-css')) {
                    const style = document.createElement('style');
                    style.id = 'bank-override-css';
                    style.innerHTML = `
                        .results-grid.bank-mode #fcfe-card, 
                        .results-grid.bank-mode #fcff-card { 
                            display: none !important; 
                        }
                        .results-grid.bank-mode { 
                            grid-template-columns: repeat(2, 1fr) !important; 
                        }
                        #bank-valuation-note {
                            display: block !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            }

            // Hide input options
            if (fcfeCheckboxDir) fcfeCheckboxDir.style.display = 'none';
            if (fcffCheckboxDir) fcffCheckboxDir.style.display = 'none';

            this.safeUpdateElement('fcfe-equity', 'N/A (Bank)');
            this.safeUpdateElement('fcfe-share-value', '--');
            this.safeUpdateElement('fcfe-market-diff', '--');

            // FCFF Details
            this.safeUpdateElement('fcff-ev', 'N/A (Bank)');
            this.safeUpdateElement('fcff-equity', 'N/A (Bank)');
            this.safeUpdateElement('fcff-share-value', '--');
            this.safeUpdateElement('fcff-market-diff', '--');
        } else {
            // Remove class
            if (resultsGrid) {
                resultsGrid.classList.remove('bank-mode');
                // Remove injected CSS if exists
                const overrideCss = document.getElementById('bank-override-css');
                if (overrideCss) overrideCss.remove();
            }

            // Show input options
            if (fcfeCheckboxDir) fcfeCheckboxDir.style.display = 'block';
            if (fcffCheckboxDir) fcffCheckboxDir.style.display = 'block';

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
        }

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

        // Show/Hide Bank Note
        const bankNote = document.getElementById('bank-valuation-note');
        if (bankNote) {
            if (this.valuationResults.is_bank) {
                bankNote.style.display = 'block';
            } else {
                bankNote.style.display = 'none';
            }
        }
    }

    safeUpdateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Update Stock Price Hero section with prominent price display
     * @param {Object} data - Stock data object
     */
    updateStockPriceHero(data) {
        // Logo - show first 2 letters of symbol
        const logoEl = document.getElementById('stock-hero-logo');
        if (logoEl) {
            logoEl.textContent = (data.symbol || '--').substring(0, 2);
        }

        // Company name, symbol and industry
        this.safeUpdateElement('stock-hero-company-name', data.name || '--');
        this.safeUpdateElement('stock-hero-symbol', data.symbol || '--');
        this.safeUpdateElement('stock-hero-industry', data.sector || data.industry || '--');

        // Price - THE MAIN ATTRACTION (integer format, no decimals)
        const priceEl = document.getElementById('stock-hero-price');
        if (priceEl) {
            priceEl.textContent = data.current_price
                ? Math.round(data.current_price).toLocaleString('en-US')
                : '--';
        }

        // Price change (if available)
        const changeContainer = document.getElementById('stock-hero-change');
        const changeValueEl = document.getElementById('stock-hero-change-value');
        const changePercentEl = document.getElementById('stock-hero-change-percent');

        if (data.price_change !== undefined && data.price_change !== null) {
            const change = data.price_change;
            const changePercent = data.price_change_percent || 0;

            if (changeContainer) {
                changeContainer.classList.remove('positive', 'negative', 'neutral');
                changeContainer.classList.add(change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral');
            }

            if (changeValueEl) {
                const sign = change > 0 ? '+' : '';
                // Format as full integer with thousand separators
                changeValueEl.textContent = `${sign}${Math.round(change).toLocaleString('en-US')}`;
            }

            if (changePercentEl) {
                const sign = changePercent > 0 ? '+' : '';
                changePercentEl.textContent = `${sign}${changePercent.toFixed(2)}%`;
            }
        } else {
            // No change data available
            if (changeContainer) {
                changeContainer.classList.remove('positive', 'negative');
                changeContainer.classList.add('neutral');
            }
            if (changeValueEl) changeValueEl.textContent = '--';
            if (changePercentEl) changePercentEl.textContent = '--';
        }

        // Market Cap
        this.safeUpdateElement('stock-hero-market-cap', AppUtils.formatLargeNumber(data.market_cap));

        // Shares Outstanding
        this.safeUpdateElement('stock-hero-shares', AppUtils.formatLargeNumber(data.shares_outstanding));

        // Exchange
        this.safeUpdateElement('stock-hero-exchange', data.exchange || '--');
    }

    /**
     * Clear Stock Price Hero section
     */
    clearStockPriceHero() {
        const logoEl = document.getElementById('stock-hero-logo');
        if (logoEl) logoEl.textContent = '--';

        this.safeUpdateElement('stock-hero-company-name', '--');
        this.safeUpdateElement('stock-hero-symbol', '--');
        this.safeUpdateElement('stock-hero-industry', '--');

        const priceEl = document.getElementById('stock-hero-price');
        if (priceEl) priceEl.textContent = '--';

        const changeContainer = document.getElementById('stock-hero-change');
        if (changeContainer) {
            changeContainer.classList.remove('positive', 'negative');
            changeContainer.classList.add('neutral');
        }

        this.safeUpdateElement('stock-hero-change-value', '--');
        this.safeUpdateElement('stock-hero-change-percent', '--');
        this.safeUpdateElement('stock-hero-market-cap', '--');
        this.safeUpdateElement('stock-hero-shares', '--');
        this.safeUpdateElement('stock-hero-exchange', '--');
    }

    /**
     * Setup visibility change listener to pause/resume auto-refresh
     */
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, pause refresh to save resources
                this.stopPriceRefresh();
            } else {
                // Page is visible again, resume if we have a stock loaded
                if (this.currentStock) {
                    this.startPriceRefresh();
                    // Immediately refresh price when becoming visible
                    this.refreshPrice();
                }
            }
        });
    }

    /**
     * Start auto-refreshing stock price
     */
    startPriceRefresh() {
        // Clear any existing interval first
        this.stopPriceRefresh();

        if (!this.currentStock) return;

        console.log(`🔄 Starting price auto-refresh for ${this.currentStock} every ${this.priceRefreshRate / 1000}s`);

        // Store current price for change calculation
        if (this.stockData && this.stockData.current_price) {
            this.lastPrice = this.stockData.current_price;
        }

        this.priceRefreshInterval = setInterval(() => {
            this.refreshPrice();
        }, this.priceRefreshRate);
    }

    /**
     * Stop auto-refreshing stock price
     */
    stopPriceRefresh() {
        if (this.priceRefreshInterval) {
            console.log('⏹️ Stopping price auto-refresh');
            clearInterval(this.priceRefreshInterval);
            this.priceRefreshInterval = null;
        }
    }

    /**
     * Refresh current stock price (lightweight API call)
     */
    async refreshPrice() {
        if (!this.currentStock || !this.stockData) return;

        try {
            const priceData = await this.api.getRealTimePrice(this.currentStock);

            if (priceData && priceData.current_price) {
                const oldPrice = this.stockData.current_price;
                const newPrice = priceData.current_price;

                // Calculate price change
                const priceChange = newPrice - (this.lastPrice || oldPrice);
                const priceChangePercent = this.lastPrice ? ((newPrice - this.lastPrice) / this.lastPrice) * 100 : 0;

                // Update stockData with new price
                this.stockData.current_price = newPrice;
                this.stockData.price_change = priceChange;
                this.stockData.price_change_percent = priceChangePercent;

                // Add server-provided change data if available
                if (priceData.price_change !== undefined) {
                    this.stockData.price_change = priceData.price_change;
                }
                if (priceData.price_change_percent !== undefined) {
                    this.stockData.price_change_percent = priceData.price_change_percent;
                }

                // Update the Stock Price Hero display
                this.updateStockPriceHero(this.stockData);

                // Log for debugging
                if (newPrice !== oldPrice) {
                    console.log(`📈 Price updated: ${oldPrice} → ${newPrice} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(0)})`);
                }
            }
        } catch (error) {
            // Silently fail - don't interrupt user experience
            console.warn('Price refresh failed:', error.message);
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
        window.app = new StockValuationApp();
    };
    script.onerror = () => {
        console.error('Failed to load Chart.js');
        window.app = new StockValuationApp(); // Proceed without charts
    };
    document.head.appendChild(script);

    // Footer legal modals are now handled in index.html
});
