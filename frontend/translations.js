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
        companyOverview: "Tổng quan",
        valuationAssumptions: "Định giá",
        history: "Lịch sử giá",
        summaryReport: "Báo cáo",

        // Company Information
        companyInformation: "Thông tin công ty",
        latestNews: "Tin tức mới nhất",
        events: "Sự kiện",
        priceHistory: "Lịch sử giá",
        symbol: "Mã:",
        name: "Tên:",
        industry: "Ngành:",
        exchange: "Sàn:",

        // Market Data
        marketData: "Dữ liệu thị trường",
        currentPrice: "Giá hiện tại:",
        marketCap: "Vốn hóa:",
        marketCapShort: "Vốn hóa",
        sharesShort: "SLCP",
        sharesOutstanding: "Cổ phiếu lưu hành:",
        eps: "EPS:",
        bookValuePerShare: "Giá trị sổ sách mỗi CP:",
        evEbitda: "EV/EBITDA:",

        // Financial Metrics
        keyMetrics: "Chỉ số chính",
        financialMetrics: "Chỉ số tài chính",
        revenue: "Doanh thu:",
        netIncome: "Lợi nhuận ròng:",
        ebitda: "EBITDA:",
        roe: "ROE (%):",
        roa: "ROA (%):",
        profitGrowth: "Tăng trưởng LN:",
        netProfitMargin: "Biên LN ròng:",
        debtEquity: "Nợ/Vốn CSH:",
        metricsNote: "* Dữ liệu từ quý gần nhất",

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
        roic: "ROIC:",

        // Company Description & Price Chart
        companyDescription: "Giới thiệu công ty",
        priceChart: "Biểu đồ giá cổ phiếu",
        readMore: "Xem thêm",
        showLess: "Thu gọn",

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
        methodology: "Phương pháp",
        valuationMethodology: "Phương pháp Định giá",
        methodologyDisclaimer: "Các định giá này dựa trên dữ liệu lịch sử và giả định do người dùng xác định. Chúng nên được sử dụng như một trong nhiều công cụ phân tích đầu tư, không phải là tiêu chí ra quyết định duy nhất.",
        selectModelsDescWithLink: "Chọn mô hình để bao gồm. Tìm hiểu về ",
        methodologyLink: "phương pháp tại đây",
        methodologyIntro: "Công cụ này sử dụng các phương pháp định giá sau để ước tính giá trị nội tại của cổ phiếu:",
        fcfeFull: "Dòng tiền tự do vốn chủ sở hữu",
        fcfeExplain: "Tiền mặt có sẵn cho cổ đông sau chi phí hoạt động, tái đầu tư và trả nợ. Chiết khấu theo tỷ suất sinh lợi yêu cầu trên vốn chủ.",
        fcffFull: "Dòng tiền tự do doanh nghiệp",
        fcffExplain: "Tiền mặt có sẵn cho tất cả nhà cung cấp vốn. Chiết khấu theo WACC để có giá trị doanh nghiệp, sau đó trừ nợ ròng để có giá trị vốn chủ.",
        peFull: "Mô hình Gordon Growth",
        peExplain: "Tỷ lệ P/E lý thuyết dựa trên tỷ lệ chi trả, tốc độ tăng trưởng và lợi nhuận yêu cầu. Nhân với EPS để có giá trị nội tại.",
        pbFull: "Mô hình Thu nhập Thặng dư",
        pbExplain: "Tỷ lệ P/B lý thuyết dựa trên ROE, tốc độ tăng trưởng và lợi nhuận yêu cầu. Nhân với giá trị sổ sách mỗi cổ phiếu để có giá trị nội tại.",
        weightedAverageMethod: "Trung bình Gia quyền",
        weightedExplain: "Giá trị cuối cùng là trung bình gia quyền của các mô hình đã chọn. Mặc định, trọng số bằng nhau được gán cho tất cả mô hình.",

        // Valuation Results
        weightedAverage: "Trung bình gia quyền",

        // Investment Recommendation
        investmentRecommendation: "Khuyến nghị đầu tư",
        potentialReturn: "Lợi nhuận tiềm năng:",
        waitingForData: "Đang chờ dữ liệu",

        // Bank Note
        bankNoteTitle: "Lưu ý cho ngành Ngân hàng:",
        bankNoteContent: "Các mô hình DCF truyền thống (FCFE/FCFF) không phù hợp với ngân hàng do cấu trúc vốn đặc thù. Định giá dựa chủ yếu vào phương pháp P/E và P/B so sánh ngành.",


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
        strongSell: "BÁN MẠNH",

        // Footer links
        contact: "Liên hệ",
        disclaimer: "Tuyên bố",
        privacyPolicy: "Chính sách",
        termsOfUse: "Điều khoản",

        // Contact Modal
        getInTouch: "Liên hệ với chúng tôi",
        contactIntro: "Nếu bạn có câu hỏi, góp ý hoặc phản hồi về công cụ định giá này, vui lòng liên hệ:",
        contactNote: "Công cụ này được phát triển và duy trì như một dự án cá nhân. Thời gian phản hồi có thể khác nhau.",

        // Disclaimer Modal
        disclaimerTitle: "Tuyên bố Miễn trừ Trách nhiệm",
        disclaimerP1: "Công cụ định giá cổ phiếu này chỉ nhằm mục đích cung cấp thông tin và giáo dục. Nó không cấu thành lời khuyên tài chính, đầu tư, thuế hoặc pháp lý.",
        disclaimerP2: "Các tính toán và ước tính do công cụ này cung cấp dựa trên dữ liệu có sẵn công khai và các giả định do người dùng xác định. Chúng không được đảm bảo chính xác, đầy đủ hoặc phù hợp cho bất kỳ mục đích cụ thể nào.",
        disclaimerP3: "Hiệu suất trong quá khứ không đảm bảo kết quả trong tương lai. Giá trị đầu tư có thể dao động và bạn có thể mất một phần hoặc toàn bộ số tiền đầu tư.",
        disclaimerP4: "Luôn tham khảo ý kiến của chuyên gia tài chính có trình độ trước khi đưa ra quyết định đầu tư. Tác giả của công cụ này không chịu trách nhiệm về bất kỳ tổn thất hoặc thiệt hại nào phát sinh từ việc sử dụng nó.",

        // Privacy Modal
        privacyTitle: "Chính sách Bảo mật",
        privacyP1: "Chúng tôi coi trọng quyền riêng tư của bạn. Công cụ này hoạt động hoàn toàn phía máy khách - không có dữ liệu cá nhân nào được thu thập, lưu trữ hoặc truyền đến máy chủ của chúng tôi.",
        privacyP2: "Tất cả các tính toán định giá được thực hiện trực tiếp trong trình trình duyệt của bạn. Dữ liệu tài chính được lấy từ các nguồn công khai và không liên kết với danh tính cá nhân nào.",
        privacyP3: "Chúng tôi sử dụng phân tích web cơ bản (Google Analytics) để hiểu các mẫu lưu lượng truy cập. Dữ liệu này được ẩn danh và không thể dùng để xác định danh tính cá nhân.",
        privacyP4: "Các tùy chọn của bạn (ngôn ngữ, chủ đề) được lưu trong bộ nhớ cục bộ của trình duyệt và không bao giờ rời khỏi thiết bị của bạn.",

        // Terms Modal
        termsTitle: "Điều khoản Sử dụng",
        termsP1: "Bằng cách sử dụng công cụ định giá cổ phiếu này, bạn đồng ý với các điều khoản sau:",
        termsP2: "Công cụ này được cung cấp \"nguyên trạng\" mà không có bất kỳ bảo đảm nào. Chúng tôi không đảm bảo tính chính xác hoặc độ tin cậy của các tính toán.",
        termsP3: "Bạn có trách nhiệm hoàn toàn đối với bất kỳ quyết định đầu tư nào được đưa ra. Các kết quả định giá không phải là khuyến nghị mua hoặc bán.",
        termsP4: "Việc sử dụng cho mục đích thương mại đòi hỏi sự cho phép bằng văn bản. Sử dụng cá nhân và giáo dục được hoan nghênh.",
        termsP5: "Chúng tôi có quyền sửa đổi các điều khoản này bất cứ lúc nào. Việc tiếp tục sử dụng công cụ sau khi thay đổi đồng nghĩa với việc chấp nhận các điều khoản mới.",

        // Additional modal keys used in HTML
        importantNotice: "Lưu ý Quan trọng",
        noGuarantee: "Không Đảm bảo Chính xác",
        investmentRisks: "Rủi ro Đầu tư",
        professionalAdvice: "Tham khảo Chuyên gia",
        disclaimerWarning: "⚠️ Sử dụng công cụ này theo rủi ro của bạn. Người tạo và bảo trì công cụ này không chịu trách nhiệm về bất kỳ tổn thất tài chính hoặc thiệt hại nào phát sinh từ việc sử dụng công cụ này.",

        lastUpdated: "Cập nhật lần cuối: Tháng 12 năm 2024",
        dataCollection: "Thu thập Dữ liệu",
        whatWeCollect: "Chúng tôi có thể Thu thập",
        privacyL1: "Mã cổ phiếu bạn tìm kiếm (xử lý cục bộ)",
        privacyL2: "Cài đặt tùy chọn của bạn (giao diện, ngôn ngữ) được lưu trong bộ nhớ cục bộ trình duyệt",
        privacyL3: "Phân tích sử dụng ẩn danh (nếu được bật)",
        thirdPartyServices: "Dịch vụ Bên thứ ba",
        localStorage: "Bộ nhớ Cục bộ",
        contactUs: "Liên hệ với Chúng tôi",

        acceptanceOfTerms: "Chấp nhận Điều khoản",
        useOfService: "Sử dụng Dịch vụ",
        termsL1: "Sử dụng công cụ này cho bất kỳ mục đích bất hợp pháp nào",
        termsL2: "Cố gắng truy cập trái phép vào bất kỳ phần nào của dịch vụ",
        termsL3: "Phân phối lại, bán hoặc khai thác thương mại công cụ mà không được phép",
        termsL4: "Sử dụng hệ thống tự động để thu thập hoặc trích xuất dữ liệu",
        intellectualProperty: "Sở hữu Trí tuệ",
        limitationOfLiability: "Giới hạn Trách nhiệm",
        changesToTerms: "Thay đổi Điều khoản"
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
        companyOverview: "Overview",
        valuationAssumptions: "Valuation",
        history: "History",
        summaryReport: "Report",

        // Company Information
        companyInformation: "Company Information",
        latestNews: "Latest News",
        events: "Events",
        priceHistory: "Price History",
        symbol: "Symbol:",
        name: "Name:",
        industry: "Industry:",
        exchange: "Exchange:",

        // Market Data
        marketData: "Market Data",
        currentPrice: "Current Price:",
        marketCap: "Market Cap:",
        marketCapShort: "Market Cap",
        sharesShort: "Shares",
        sharesOutstanding: "Shares Outstanding:",
        eps: "EPS:",
        bookValuePerShare: "Book Value/Share:",
        evEbitda: "EV/EBITDA:",

        // Financial Metrics
        keyMetrics: "Key Metrics",
        financialMetrics: "Financial Metrics",
        revenue: "Revenue:",
        netIncome: "Net Income:",
        ebitda: "EBITDA:",
        roe: "ROE (%):",
        roa: "ROA (%):",
        profitGrowth: "Profit Growth:",
        netProfitMargin: "Net Margin:",
        debtEquity: "Debt/Equity:",
        metricsNote: "* Data from most recent quarter",

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
        roic: "ROIC:",

        // Company Description & Price Chart
        companyDescription: "About the Company",
        priceChart: "Stock Price Chart",
        readMore: "Read more",
        showLess: "Show less",

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
        methodology: "Methodology",
        valuationMethodology: "Valuation Methodology",
        methodologyDisclaimer: "These valuations are based on historical data and user-defined assumptions. They should be used as one of many tools in investment analysis, not as sole decision-making criteria.",
        selectModelsDescWithLink: "Choose models to include. Learn about our ",
        methodologyLink: "methodology here",
        methodologyIntro: "This tool uses the following valuation methods to estimate the intrinsic value of stocks:",
        fcfeFull: "Free Cash Flow to Equity",
        fcfeExplain: "Cash available to shareholders after operating expenses, reinvestments, and debt payments. Discounted at the required return on equity.",
        fcffFull: "Free Cash Flow to Firm",
        fcffExplain: "Cash available to all capital providers. Discounted at WACC to get enterprise value, then subtract net debt for equity value.",
        peFull: "Gordon Growth Model",
        peExplain: "Theoretical P/E ratio based on payout ratio, growth rate, and required return. Multiplied by EPS for intrinsic value.",
        pbFull: "Residual Income Model",
        pbExplain: "Theoretical P/B ratio based on ROE, growth rate, and required return. Multiplied by book value per share for intrinsic value.",
        weightedAverageMethod: "Weighted Average",
        weightedExplain: "Final value is a weighted average of selected models. By default, equal weights are assigned to all selected models.",

        // Valuation Results
        weightedAverage: "Weighted Average",

        // Investment Recommendation
        investmentRecommendation: "Investment Recommendation",
        potentialReturn: "Potential Return:",
        waitingForData: "Waiting for data",

        // Bank Note
        bankNoteTitle: "Note for Banking Sector:",
        bankNoteContent: "Traditional DCF models (FCFE/FCFF) are not suitable for banks due to their unique capital structure. Valuation is based primarily on P/E and P/B methods using sector comparisons.",

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
        strongSell: "STRONG SELL",

        // Footer links
        contact: "Contact",
        disclaimer: "Disclaimer",
        privacyPolicy: "Privacy",
        termsOfUse: "Terms",

        // Contact Modal
        getInTouch: "Get in Touch",
        contactIntro: "If you have any questions, suggestions, or feedback about this valuation tool, feel free to reach out:",
        contactNote: "This tool is developed and maintained as a personal project. Response times may vary.",

        // Disclaimer Modal
        disclaimerTitle: "Disclaimer",
        disclaimerP1: "This stock valuation tool is for informational and educational purposes only. It does not constitute financial, investment, tax, or legal advice.",
        disclaimerP2: "The calculations and estimates provided by this tool are based on publicly available data and user-defined assumptions. They are not guaranteed to be accurate, complete, or suitable for any specific purpose.",
        disclaimerP3: "Past performance does not guarantee future results. Investment values can fluctuate and you may lose some or all of your investment.",
        disclaimerP4: "Always consult with a qualified financial advisor before making investment decisions. The author of this tool is not responsible for any losses or damages arising from its use.",

        // Privacy Modal
        privacyTitle: "Privacy Policy",
        privacyP1: "We respect your privacy. This tool operates entirely client-side - no personal data is collected, stored, or transmitted to our servers.",
        privacyP2: "All valuation calculations are performed directly in your browser. Financial data is fetched from public sources and is not linked to any personal identity.",
        privacyP3: "We use basic web analytics (Google Analytics) to understand traffic patterns. This data is anonymized and cannot personally identify you.",
        privacyP4: "Your preferences (language, theme) are stored in your browser's local storage and never leave your device.",

        // Terms Modal
        termsTitle: "Terms of Use",
        termsP1: "By using this stock valuation tool, you agree to the following terms:",
        termsP2: "This tool is provided \"as is\" without any warranties. We make no guarantees about the accuracy or reliability of calculations.",
        termsP3: "You are solely responsible for any investment decisions you make. The valuation results are not recommendations to buy or sell.",
        termsP4: "Commercial use requires written permission. Personal and educational use is welcome.",
        termsP5: "We reserve the right to modify these terms at any time. Continued use of the tool after changes constitutes acceptance of the new terms.",

        // Additional modal keys used in HTML
        importantNotice: "Important Notice",
        noGuarantee: "No Guarantee of Accuracy",
        investmentRisks: "Investment Risks",
        professionalAdvice: "Seek Professional Advice",
        disclaimerWarning: "⚠️ Use this tool at your own risk. The creators and maintainers of this tool are not responsible for any financial losses or damages resulting from the use of this tool.",

        lastUpdated: "Last Updated: December 2024",
        dataCollection: "Data Collection",
        whatWeCollect: "What We May Collect",
        privacyL1: "Stock symbols you search for (processed locally)",
        privacyL2: "Your preference settings (theme, language) stored in your browser's local storage",
        privacyL3: "Anonymous usage analytics (if enabled)",
        thirdPartyServices: "Third-Party Services",
        localStorage: "Local Storage",
        contactUs: "Contact Us",

        acceptanceOfTerms: "Acceptance of Terms",
        useOfService: "Use of Service",
        termsL1: "Use this tool for any unlawful purpose",
        termsL2: "Attempt to gain unauthorized access to any part of the service",
        termsL3: "Redistribute, sell, or commercially exploit the tool without permission",
        termsL4: "Use automated systems to scrape or extract data",
        intellectualProperty: "Intellectual Property",
        limitationOfLiability: "Limitation of Liability",
        changesToTerms: "Changes to Terms"
    }
};

// Export translations for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = translations;
}