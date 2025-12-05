/**
 * Translation file for Vietnamese Stock Valuation App
 * Supports Vietnamese (vi) and English (en)
 */

const translations = {
    vi: {
        // Header
        appTitle: "Định Giá Cổ Phiếu Việt Nam",
        dataPeriod: "Chu kỳ dữ liệu:",
        latestYear: "Năm gần nhất",
        latestQuarter: "Quý gần nhất",

        // Search section
        stockSymbolSearch: "Tìm kiếm mã cổ phiếu",
        enterStockSymbol: "Nhập mã cổ phiếu (VD: VCB)",
        search: "Tìm kiếm",
        loadCompanyData: "Tải dữ liệu công ty",

        // Tabs
        companyOverview: "Tổng quan công ty",
        valuationAssumptions: "Định giá & Giả định",
        summaryReport: "Báo cáo tổng hợp",

        // Company Information
        companyInformation: "Thông tin công ty",
        symbol: "Mã:",
        name: "Tên:",
        industry: "Ngành:",
        exchange: "Sàn:",

        // Market Data
        marketData: "Dữ liệu thị trường",
        currentPrice: "Giá hiện tại:",
        marketCap: "Vốn hóa:",
        sharesOutstanding: "Cổ phiếu lưu hành:",
        eps: "EPS:",
        bookValuePerShare: "Giá trị sổ sách mỗi CP:",
        evEbitda: "EV/EBITDA:",

        // Financial Metrics
        financialMetrics: "Chỉ số tài chính",
        revenue: "Doanh thu:",
        netIncome: "Lợi nhuận ròng:",
        ebitda: "EBITDA:",
        roe: "ROE (%):",
        roa: "ROA (%):",
        debtEquity: "Nợ/Vốn CSH:",

        // Valuation Ratios
        valuationRatios: "Tỷ lệ định giá",
        peRatio: "P/E:",
        pbRatio: "P/B:",
        psRatio: "P/S:",
        pcfRatio: "P/CF:",

        // Efficiency Ratios
        efficiencyRatios: "Tỷ lệ hiệu quả",
        assetTurnover: "Vòng quay tài sản:",
        inventoryTurnover: "Vòng quay hàng tồn:",
        fixedAssetTurnover: "Vòng quay TSCĐ:",

        // Liquidity Ratios
        liquidityRatios: "Tỷ lệ thanh khoản",
        currentRatio: "Tỷ lệ hiện hành:",
        quickRatio: "Tỷ lệ thanh toán nhanh:",
        cashRatio: "Tỷ lệ tiền mặt:",
        interestCoverage: "Khả năng thanh toán lãi:",

        // Profitability Margins
        profitabilityMargins: "Biên lợi nhuận",
        grossProfitMargin: "Biên lợi nhuận gộp:",
        ebitMargin: "Biên EBIT:",
        netProfitMargin: "Biên lợi nhuận ròng:",

        // Charts
        roeRoaTrends: "Xu hướng ROE & ROA (5 năm)",
        liquidityTrends: "Xu hướng thanh khoản (5 năm)",
        pePbTrends: "Xu hướng P/E & P/B (5 năm)",
        nimTrend: "Xu hướng NIM (TTM)",

        // Language Modal
        selectLanguage: "Chọn ngôn ngữ",
        selectLanguageDesc: "Vui lòng chọn ngôn ngữ của bạn",

        // Download Modal
        downloadFinancialData: "Excel Data",
        downloadFinancialDesc: "Tải xuống báo cáo tài chính của 694 công ty niêm yết trên HOSE, HNX và UPCOM",
        fileFormat: "Định dạng file:",
        excelFormat: "Excel (.xlsx)",
        dataIncludes: "Bao gồm:",
        balanceSheet: "Bảng cân đối kế toán",
        incomeStatement: "Báo cáo kết quả kinh doanh",
        cashFlow: "Báo cáo lưu chuyển tiền tệ",
        totalFiles: "Tổng số file:",
        filesCount: "694 công ty",
        downloadNow: "Tải xuống",
        downloadNote: "Lưu ý: File được lưu trữ trên GitHub, có thể mất vài giây để tải xuống.",

        // Model Assumptions
        modelAssumptions: "Giả định mô hình",
        revenueGrowth: "Tăng trưởng doanh thu (%):",
        terminalGrowth: "Tăng trưởng dài hạn (%):",
        wacc: "WACC (%):",
        requiredReturn: "Lợi nhuận yêu cầu (%):",
        taxRate: "Thuế suất (%):",
        projectionYears: "Số năm dự báo:",
        calculateValuation: "Tính định giá",
        resetAssumptions: "Đặt lại giả định",

        // Valuation Models
        selectValuationModels: "Chọn mô hình định giá",
        selectModelsDesc: "Chọn mô hình để bao gồm. Trọng số tự động phân bổ đều.",
        fcfe: "FCFE",
        fcfeDesc: "Dòng tiền tự do đến vốn chủ",
        fcff: "FCFF",
        fcffDesc: "Dòng tiền tự do đến doanh nghiệp",
        justifiedPE: "P/E hợp lý",
        justifiedPB: "P/B hợp lý",
        modelsSelected: "mô hình đã chọn",
        selectAll: "Chọn tất cả",
        deselectAll: "Bỏ chọn tất cả",

        // Valuation Results
        weightedAverage: "Trung bình gia quyền",

        // Investment Recommendation
        investmentRecommendation: "Khuyến nghị đầu tư",
        potentialReturn: "Lợi nhuận tiềm năng:",
        waitingForData: "Đang chờ dữ liệu",

        // Summary
        valuationSummary: "Tổng kết định giá",
        marketIndicators: "Chỉ số thị trường",
        modelDetails: "Chi tiết mô hình",

        // FCFE Details
        fcfeEquityValue: "Giá trị vốn chủ:",
        fcfeShareValue: "Giá trị mỗi cổ phiếu:",
        fcfeMarketDiff: "Chênh lệch so với thị trường:",

        // FCFF Details
        fcffEV: "Giá trị doanh nghiệp (EV):",
        fcffEquityValue: "Giá trị vốn chủ:",
        fcffShareValue: "Giá trị mỗi cổ phiếu:",
        fcffMarketDiff: "Chênh lệch so với thị trường:",

        // PE Valuation
        justifiedPERatio: "Tỷ lệ P/E hợp lý:",
        currentEPS: "EPS hiện tại:",
        peShareValue: "Giá trị mỗi cổ phiếu:",
        peMarketDiff: "Chênh lệch so với thị trường:",

        // PB Valuation
        justifiedPBRatio: "Tỷ lệ P/B hợp lý:",
        bookValuePerShare: "Giá trị sổ sách/CP:",
        pbShareValue: "Giá trị mỗi cổ phiếu:",
        pbMarketDiff: "Chênh lệch so với thị trường:",

        // Final Recommendation
        conclusionRecommendation: "Kết luận và khuyến nghị",
        targetPrice: "Giá mục tiêu:",
        upsideDownside: "Tiềm năng tăng/giảm:",
        confidenceLevel: "Mức độ tin cậy:",
        recommendation: "Khuyến nghị",
        exportReports: "Xuất báo cáo",
        exportPDFReport: "📄 Xuất PDF",
        exportExcelReport: "📊 Xuất Excel",
        exportHint: "Hoàn tất tính toán định giá để xuất báo cáo",

        // CSV Export specific translations
        valuationReport: "BÁO CÁO ĐỊNH GIÁ CỔ PHIẾU",
        reportDate: "Ngày báo cáo",
        shareValue: "Giá trị mỗi CP (VND)",
        weight: "Trọng số",
        formula: "Công thức/Phương pháp",
        valuationModel: "Mô hình định giá",
        projectedCashFlows: "Dòng tiền dự báo",
        year: "Năm",
        terminalValue: "Giá trị cuối kỳ",
        totalPV: "Tổng giá trị hiện tại",
        enterpriseValue: "Giá trị doanh nghiệp",
        netDebt: "Nợ ròng",
        equityValue: "Giá trị vốn chủ sở hữu",
        valuationResults: "KẾT QUẢ ĐỊNH GIÁ",
        marketComparison: "SO SÁNH VỚI THỊ TRƯỜNG",
        weightedAverageTargetPrice: "GIÁ MỤC TIÊU TRUNG BÌNH GIA QUYỀN",
        modelAssumptions: "GIẢ ĐỊNH ĐỊNH GIÁ",
        modelWeights: "TRỌNG SỐ MÔ HÌNH",
        years: "năm",
        generatedBy: "Được tạo bởi Công cụ Định giá Cổ phiếu",
        disclaimer: "TUYÊN BỐ MIỄN TRỪ TRÁCH NHIỆM",
        disclaimerText: "Báo cáo này chỉ nhằm mục đích cung cấp thông tin và không cấu thành lời khuyên đầu tư. Hiệu suất trong quá khứ không đảm bảo kết quả trong tương lai. Vui lòng tham khảo ý kiến của chuyên gia tài chính có trình độ trước khi đưa ra quyết định đầu tư.",

        // Status messages
        loadingData: "Đang tải dữ liệu...",
        dataLoadedSuccessfully: "Dữ liệu đã được tải thành công",
        errorLoadingData: "Lỗi khi tải dữ liệu",
        pleaseEnterSymbol: "Vui lòng nhập mã cổ phiếu",
        calculatingValuation: "Đang tính toán định giá...",
        valuationCompleted: "Định giá hoàn tất",
        loadDataMessage: "Vui lòng tải dữ liệu công ty và thực hiện tính toán định giá để nhận khuyến nghị đầu tư",

        // Buttons
        loading: "Đang tải...",
        calculate: "Tính toán",
        reset: "Đặt lại",
        export: "Xuất",

        // Recommendations
        buy: "MUA",
        sell: "BÁN",
        hold: "GIỮ",
        strongBuy: "MUA MẠNH",
        strongSell: "BÁN MẠNH"
    },
    en: {
        // Header
        appTitle: "Vietnam Stock Valuation",
        dataPeriod: "Data Period:",
        latestYear: "Latest Year",
        latestQuarter: "Latest Quarter",

        // Search section
        stockSymbolSearch: "Stock Symbol Search",
        enterStockSymbol: "Enter stock symbol (e.g., VCB)",
        search: "Search",
        loadCompanyData: "Load Company Data",

        // Tabs
        companyOverview: "Company Overview",
        valuationAssumptions: "Valuation & Assumptions",
        summaryReport: "Summary Report",

        // Company Information
        companyInformation: "Company Information",
        symbol: "Symbol:",
        name: "Name:",
        industry: "Industry:",
        exchange: "Exchange:",

        // Market Data
        marketData: "Market Data",
        currentPrice: "Current Price:",
        marketCap: "Market Cap:",
        sharesOutstanding: "Shares Outstanding:",
        eps: "EPS:",
        bookValuePerShare: "Book Value/Share:",
        evEbitda: "EV/EBITDA:",

        // Financial Metrics
        financialMetrics: "Financial Metrics",
        revenue: "Revenue:",
        netIncome: "Net Income:",
        ebitda: "EBITDA:",
        roe: "ROE (%):",
        roa: "ROA (%):",
        debtEquity: "Debt/Equity:",

        // Valuation Ratios
        valuationRatios: "Valuation Ratios",
        peRatio: "P/E Ratio:",
        pbRatio: "P/B Ratio:",
        psRatio: "P/S Ratio:",
        pcfRatio: "P/Cash Flow:",

        // Efficiency Ratios
        efficiencyRatios: "Efficiency Ratios",
        assetTurnover: "Asset Turnover:",
        inventoryTurnover: "Inventory Turnover:",
        fixedAssetTurnover: "Fixed Asset Turnover:",

        // Liquidity Ratios
        liquidityRatios: "Liquidity Ratios",
        currentRatio: "Current Ratio:",
        quickRatio: "Quick Ratio:",
        cashRatio: "Cash Ratio:",
        interestCoverage: "Interest Coverage:",

        // Profitability Margins
        profitabilityMargins: "Profitability Margins",
        grossProfitMargin: "Gross Profit Margin:",
        ebitMargin: "EBIT Margin:",
        netProfitMargin: "Net Profit Margin:",

        // Charts
        roeRoaTrends: "ROE & ROA Trends (Last 5 Years)",
        liquidityTrends: "Liquidity Ratios Trends (Last 5 Years)",
        pePbTrends: "P/E & P/B Ratios Trends (Last 5 Years)",
        nimTrend: "Net Interest Margin (NIM) Trend (TTM)",

        // Language Modal
        selectLanguage: "Select Language",
        selectLanguageDesc: "Please choose your language",

        // Download Modal
        downloadFinancialData: "Excel Data",
        downloadFinancialDesc: "Download financial statements for 694 listed companies on HOSE, HNX and UPCOM",
        fileFormat: "File Format:",
        excelFormat: "Excel (.xlsx)",
        dataIncludes: "Includes:",
        balanceSheet: "Balance Sheet",
        incomeStatement: "Income Statement",
        cashFlow: "Cash Flow Statement",
        totalFiles: "Total Files:",
        filesCount: "694 companies",
        downloadNow: "Download",
        downloadNote: "Note: Files are hosted on GitHub, download may take a few seconds.",

        // Model Assumptions
        modelAssumptions: "Model Assumptions",
        revenueGrowth: "Revenue Growth (%):",
        terminalGrowth: "Terminal Growth (%):",
        wacc: "WACC (%):",
        requiredReturn: "Required Return (%):",
        taxRate: "Tax Rate (%):",
        projectionYears: "Projection Years:",
        calculateValuation: "Calculate Valuation",
        resetAssumptions: "Reset Assumptions",

        // Valuation Models
        selectValuationModels: "Select Valuation Models",
        selectModelsDesc: "Choose models to include. Weights auto-distribute evenly.",
        fcfe: "FCFE",
        fcfeDesc: "Free Cash Flow to Equity",
        fcff: "FCFF",
        fcffDesc: "Free Cash Flow to Firm",
        justifiedPE: "Justified P/E",
        justifiedPB: "Justified P/B",
        modelsSelected: "models selected",
        selectAll: "Select All",
        deselectAll: "Deselect All",

        // Valuation Results
        weightedAverage: "Weighted Average",

        // Investment Recommendation
        investmentRecommendation: "Investment Recommendation",
        potentialReturn: "Potential Return:",
        waitingForData: "Waiting for data",

        // Summary
        valuationSummary: "Valuation Summary",
        marketIndicators: "Market Indicators",
        modelDetails: "Model Details",

        // FCFE Details
        fcfeEquityValue: "Equity Value:",
        fcfeShareValue: "Share Value:",
        fcfeMarketDiff: "Difference vs Market:",

        // FCFF Details
        fcffEV: "Enterprise Value (EV):",
        fcffEquityValue: "Equity Value:",
        fcffShareValue: "Share Value:",
        fcffMarketDiff: "Difference vs Market:",

        // PE Valuation
        justifiedPERatio: "Justified P/E Ratio:",
        currentEPS: "Current EPS:",
        peShareValue: "Share Value:",
        peMarketDiff: "Difference vs Market:",

        // PB Valuation
        justifiedPBRatio: "Justified P/B Ratio:",
        bookValuePerShare: "Book Value per Share:",
        pbShareValue: "Share Value:",
        pbMarketDiff: "Difference vs Market:",

        // Final Recommendation
        conclusionRecommendation: "Conclusion and Recommendation",
        targetPrice: "Target Price:",
        upsideDownside: "Upside/Downside Potential:",
        confidenceLevel: "Confidence Level:",
        recommendation: "Recommendation",
        exportReports: "Export Reports",
        exportPDFReport: "📄 Export PDF",
        exportExcelReport: "📊 Export Excel",
        exportHint: "Complete valuation calculations to enable exports",

        // CSV Export specific translations
        valuationReport: "STOCK VALUATION REPORT",
        reportDate: "Report Date",
        shareValue: "Share Value (VND)",
        weight: "Weight",
        formula: "Formula/Method",
        valuationModel: "Valuation Model",
        projectedCashFlows: "Projected Cash Flows",
        year: "Year",
        terminalValue: "Terminal Value",
        totalPV: "Total Present Value",
        enterpriseValue: "Enterprise Value",
        netDebt: "Net Debt",
        equityValue: "Equity Value",
        valuationResults: "VALUATION RESULTS",
        marketComparison: "MARKET COMPARISON",
        weightedAverageTargetPrice: "WEIGHTED AVERAGE TARGET PRICE",
        modelAssumptions: "VALUATION ASSUMPTIONS",
        modelWeights: "MODEL WEIGHTS",
        years: "years",
        generatedBy: "Generated by Stock Valuation Tool",
        disclaimer: "DISCLAIMER",
        disclaimerText: "This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Please consult with a qualified financial advisor before making investment decisions.",

        // Status messages
        loadingData: "Loading data...",
        dataLoadedSuccessfully: "Data loaded successfully",
        errorLoadingData: "Error loading data",
        pleaseEnterSymbol: "Please enter a stock symbol",
        calculatingValuation: "Calculating valuation...",
        valuationCompleted: "Valuation completed",
        loadDataMessage: "Please load company data and perform valuation calculations to receive investment recommendations",

        // Buttons
        loading: "Loading...",
        calculate: "Calculate",
        reset: "Reset",
        export: "Export",

        // Recommendations
        buy: "BUY",
        sell: "SELL",
        hold: "HOLD",
        strongBuy: "STRONG BUY",
        strongSell: "STRONG SELL"
    }
};

// Export translations for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = translations;
}