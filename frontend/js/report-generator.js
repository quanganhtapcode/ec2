/**
 * Report Generator Module
 * Handles generation of PDF, Excel, and CSV reports
 */
class ReportGenerator {
    constructor(api, toastManager) {
        this.api = api;
        this.toast = toastManager || { show: console.log, hide: () => { } };
        this.apiBaseUrl = api.baseUrl;
    }

    /**
     * Show status message using Toast
     */
    showStatus(message, type = 'info') {
        if (this.toast && this.toast.show) {
            this.toast.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Helper to format currency
     */
    formatCurrency(value) {
        if (window.AppUtils) return window.AppUtils.formatCurrency(value);
        // Fallback if AppUtils not available
        if (!value && value !== 0) return '--';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    }

    formatNumber(value, decimals = 2) {
        if (window.AppUtils) return window.AppUtils.formatNumber(value, decimals);
        return value ? value.toFixed(decimals) : '--';
    }

    formatLargeNumber(value) {
        if (window.AppUtils) return window.AppUtils.formatLargeNumber(value);
        return this.formatCurrency(value);
    }

    formatPercent(value) {
        if (window.AppUtils) return window.AppUtils.formatPercent(value);
        return value ? `${value.toFixed(1)}%` : '--';
    }

    /**
     * Helper: Convert Vietnamese labels to English
     */
    toEnglishLabel(text) {
        if (typeof text !== 'string') return String(text);
        if (/^[\d\s,.%\-+()/:]+$/.test(text)) return text;

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

    // =========================================================================
    // EXPORT HANDLERS
    // =========================================================================

    async exportReport(stockData, valuationResults, assumptions, modelWeights, currentStock, lang) {
        if (!stockData || !valuationResults) {
            this.showStatus('No data available to export report', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                console.warn('jsPDF not available, generating text report');
                this.generateTextReport(stockData, valuationResults, assumptions, modelWeights, currentStock);
                this.showStatus('PDF library not available. Downloaded text report.', 'warning');
                return;
            }

            this.generatePDFReport(jsPDF, stockData, valuationResults, assumptions, modelWeights, currentStock, lang);

            // Also download Excel financial data
            await this.downloadFinancialData(currentStock || stockData.symbol);

            this.showStatus('PDF report and Excel data downloaded successfully!', 'success');

        } catch (error) {
            console.error('Error generating PDF report:', error);
            try {
                this.generateTextReport(stockData, valuationResults, assumptions, modelWeights, currentStock);
                this.showStatus('PDF generation failed. Downloaded text report.', 'warning');
            } catch (textError) {
                console.error('Text report generation failed:', textError);
                this.showStatus('Error generating report: ' + error.message, 'error');
            }
        }
    }

    async exportExcelReport(stockData, valuationResults, assumptions, modelWeights, currentStock, lang) {
        if (!stockData || !valuationResults) {
            this.showStatus('No data available to export Excel report', 'error');
            return;
        }

        try {
            if (typeof ExcelJS === 'undefined') {
                this.showStatus('ExcelJS library not loaded yet, please try again', 'warning');
                return;
            }

            if (typeof JSZip === 'undefined') {
                this.showStatus('JSZip library not loaded yet, please try again', 'warning');
                return;
            }

            // Removed: generating toast - process is quick, result is visible immediately

            const zip = new JSZip();
            const symbol = currentStock;
            const dateStr = new Date().toISOString().split('T')[0];

            // FILE 1: Create valuation report Excel
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'quanganh.org';
            workbook.created = new Date();

            // SHEET: Summary Dashboard
            const summarySheet = workbook.addWorksheet('Summary Dashboard', { views: [{ showGridLines: false }] });
            await this.createSummaryDashboard(summarySheet, stockData, valuationResults, modelWeights, currentStock, lang);

            // SHEET: FCFE Analysis
            const fcfeSheet = workbook.addWorksheet('FCFE Analysis', { views: [{ showGridLines: true }] });
            this.createFCFESheet(fcfeSheet, stockData, valuationResults, assumptions);

            // SHEET: FCFF Analysis
            const fcffSheet = workbook.addWorksheet('FCFF Analysis', { views: [{ showGridLines: true }] });
            this.createFCFFSheet(fcffSheet, stockData, valuationResults, assumptions);

            // SHEET: P/E Analysis
            const peSheet = workbook.addWorksheet('PE Analysis', { views: [{ showGridLines: true }] });
            this.createPESheet(peSheet, stockData, assumptions);

            // SHEET: P/B Analysis
            const pbSheet = workbook.addWorksheet('PB Analysis', { views: [{ showGridLines: true }] });
            this.createPBSheet(pbSheet, stockData, assumptions);

            // SHEET: Company Data
            const companyDataSheet = workbook.addWorksheet('Company Data', { views: [{ showGridLines: false }] });
            this.createCompanyDataSheet(companyDataSheet, stockData, currentStock);

            // SHEET: Assumptions
            const assumptionsSheet = workbook.addWorksheet('Assumptions', { views: [{ showGridLines: true }] });
            this.createAssumptionsSheet(assumptionsSheet, stockData, assumptions, modelWeights, currentStock);

            // Generate valuation Excel buffer
            const valuationBuffer = await workbook.xlsx.writeBuffer();
            zip.file(`${symbol}_Valuation_${dateStr}.xlsx`, valuationBuffer);

            // FILE 2: Try to fetch original financial data Excel
            let originalDataAdded = false;
            try {
                // Use ApiClient to check and get download URL
                const isAvailable = await this.api.checkDownloadAvailability(symbol);
                if (isAvailable) {
                    const downloadUrl = this.api.getDownloadUrl(symbol);
                    const response = await fetch(downloadUrl);
                    if (response.ok) {
                        const originalBuffer = await response.arrayBuffer();
                        zip.file(`${symbol}_Financial_Data.xlsx`, originalBuffer);
                        originalDataAdded = true;
                    }
                }
            } catch (error) {
                console.error('Error fetching original financial data:', error);
            }

            // Generate ZIP and download
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            if (typeof saveAs !== 'undefined') {
                saveAs(zipBlob, `${symbol}_Complete_Report_${dateStr}.zip`);
            } else {
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

    async downloadFinancialData(symbol) {
        if (!symbol) {
            console.warn('No symbol available for Excel download');
            return;
        }

        try {
            const isAvailable = await this.api.checkDownloadAvailability(symbol);
            if (!isAvailable) {
                console.warn(`Excel data not available for ${symbol}`);
                return;
            }

            const fileUrl = this.api.getDownloadUrl(symbol);
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
        }
    }

    // =========================================================================
    // PDF GENERATION
    // =========================================================================

    generatePDFReport(jsPDFConstructor, stockData, valuationResults, assumptions, modelWeights, currentStock, lang) {
        const doc = new jsPDFConstructor();
        // Assume global translations
        const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : {};

        const weightedValue = valuationResults.weighted_average;
        const currentPrice = stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 7;
        const contentWidth = pageWidth - 2 * margin;
        let yPosition = margin;
        let pageNumber = 1;

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

        const addPageHeader = () => {
            if (pageNumber > 1) {
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text(`${currentStock} - Valuation Report`, margin, 15);
                doc.line(margin, 18, pageWidth - margin, 18);
                yPosition = 25;
            }
        };

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

        const addTableRow = (label, value, isHeader = false, isHighlight = false) => {
            checkPageBreak(10);
            doc.setFontSize(10);
            doc.setFont('helvetica', isHeader ? 'bold' : 'normal');

            if (isHighlight) {
                doc.setFillColor(232, 245, 233);
                doc.rect(margin, yPosition - 5, contentWidth, lineHeight, 'F');
            } else if (isHeader) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, yPosition - 5, contentWidth, lineHeight, 'F');
            }

            doc.setTextColor(0, 0, 0);
            const englishLabel = this.toEnglishLabel(label);
            const englishValue = this.toEnglishLabel(value);
            doc.text(englishLabel, margin + 3, yPosition);
            doc.text(englishValue, margin + 100, yPosition);

            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.rect(margin, yPosition - 5, contentWidth, lineHeight);
            yPosition += lineHeight;
        };

        // Header
        doc.setFillColor(41, 98, 255);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('STOCK VALUATION REPORT', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        const companyName = `${stockData.name || currentStock} (${currentStock})`;
        doc.text(companyName, pageWidth / 2, 25, { align: 'center' });

        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, 33, { align: 'center' });

        yPosition = 50;

        // Company Info
        addSectionTitle(t.companyInformation || 'Company Information');
        addTableRow('Stock Symbol', stockData.symbol || '--');
        addTableRow('Company Name', stockData.name || '--');
        addTableRow('Industry', stockData.sector || '--');
        addTableRow('Exchange', stockData.exchange || '--');

        // Market Data
        addSectionTitle(t.marketData || 'Market Data');
        addTableRow('Current Price', this.formatCurrency(currentPrice));
        addTableRow('Market Cap', this.formatLargeNumber(stockData.market_cap));
        addTableRow('Shares Outstanding', this.formatLargeNumber(stockData.shares_outstanding));
        addTableRow('P/E Ratio', this.formatNumber(stockData.pe_ratio));
        addTableRow('P/B Ratio', this.formatNumber(stockData.pb_ratio));
        addTableRow('EPS', this.formatCurrency(stockData.eps));
        addTableRow('Book Value/Share', this.formatCurrency(stockData.book_value_per_share));

        // Valuation Results
        addSectionTitle(t.valuationResults || 'Valuation Results');
        addTableRow('Valuation Model', 'Share Value (VND)', true);
        addTableRow('FCFE (Free Cash Flow to Equity)', this.formatCurrency(valuationResults.fcfe.shareValue));
        addTableRow('FCFF (Free Cash Flow to Firm)', this.formatCurrency(valuationResults.fcff.shareValue));
        addTableRow('Justified P/E Multiple', this.formatCurrency(valuationResults.justified_pe.shareValue));
        addTableRow('Justified P/B Multiple', this.formatCurrency(valuationResults.justified_pb.shareValue));
        yPosition += 2;
        addTableRow('WEIGHTED AVERAGE TARGET PRICE', this.formatCurrency(weightedValue), true, true);

        // Comparison
        addSectionTitle(t.marketComparison || 'Market Comparison');
        addTableRow('Current Market Price', this.formatCurrency(currentPrice));
        addTableRow('Intrinsic Value (Target)', this.formatCurrency(weightedValue));
        const upsideText = `${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`;
        addTableRow(upside >= 0 ? 'Upside Potential' : 'Downside Risk', upsideText, false, Math.abs(upside) > 10);

        if (valuationResults.market_comparison?.recommendation) {
            addTableRow('Investment Recommendation', valuationResults.market_comparison.recommendation.toUpperCase(), true, true);
        }

        // Assumptions
        checkPageBreak(80);
        addSectionTitle(t.modelAssumptions || 'Valuation Assumptions');
        addTableRow('Revenue Growth Rate', `${assumptions.revenueGrowth}%`);
        addTableRow('Terminal Growth Rate', `${assumptions.terminalGrowth}%`);
        addTableRow('WACC', `${assumptions.wacc}%`);
        addTableRow('Required Return', `${assumptions.requiredReturn}%`);
        addTableRow('Tax Rate', `${assumptions.taxRate}%`);
        addTableRow('Projection Period', `${assumptions.projectionYears} years`);

        addSectionTitle('Model Weights');
        addTableRow('FCFE Weight', `${modelWeights.fcfe}%`);
        addTableRow('FCFF Weight', `${modelWeights.fcff}%`);
        addTableRow('Justified P/E Weight', `${modelWeights.justified_pe}%`);
        addTableRow('Justified P/B Weight', `${modelWeights.justified_pb}%`);

        // Financials
        addSectionTitle(t.financialMetrics || 'Key Financial Metrics');
        addTableRow('Revenue (TTM)', this.formatLargeNumber(stockData.revenue_ttm));
        addTableRow('Net Income (TTM)', this.formatLargeNumber(stockData.net_income_ttm));
        addTableRow('EBITDA', this.formatLargeNumber(stockData.ebitda));
        addTableRow('ROE', this.formatPercent(stockData.roe));
        addTableRow('ROA', this.formatPercent(stockData.roa));
        addTableRow('Debt/Equity Ratio', this.formatNumber(stockData.debt_to_equity));

        // Disclaimer
        checkPageBreak(30);
        yPosition += 10;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        const disclaimer = 'DISCLAIMER: This report is for informational purposes only...';
        doc.text(doc.splitTextToSize(disclaimer, contentWidth), margin, yPosition);

        // Footer
        const totalPages = pageNumber;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 25, pageHeight - 10);
            if (i === 1) doc.text('Generated by Stock Valuation Tool', margin, pageHeight - 10);
        }

        doc.save(`${currentStock}_Valuation_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    generateTextReport(stockData, valuationResults, assumptions, modelWeights, currentStock) {
        const weightedValue = valuationResults.weighted_average;
        const currentPrice = stockData.current_price;
        const upside = ((weightedValue - currentPrice) / currentPrice) * 100;

        const reportContent = `
STOCK VALUATION REPORT
=====================
Company: ${stockData.name} (${currentStock})
Date: ${new Date().toLocaleDateString('en-US')}

COMPANY INFORMATION
------------------
Stock Symbol: ${stockData.symbol}
Company Name: ${stockData.name}
Industry: ${stockData.sector || '--'}
Exchange: ${stockData.exchange || '--'}

MARKET DATA
-----------
Current Price: ${this.formatCurrency(currentPrice)}
Market Cap: ${this.formatLargeNumber(stockData.market_cap)}
P/E Ratio: ${this.formatNumber(stockData.pe_ratio)}
P/B Ratio: ${this.formatNumber(stockData.pb_ratio)}
EPS: ${this.formatCurrency(stockData.eps)}

VALUATION RESULTS
----------------
FCFE: ${this.formatCurrency(valuationResults.fcfe.shareValue)} (Weight: ${modelWeights.fcfe}%)
FCFF: ${this.formatCurrency(valuationResults.fcff.shareValue)} (Weight: ${modelWeights.fcff}%)
Justified P/E: ${this.formatCurrency(valuationResults.justified_pe.shareValue)} (Weight: ${modelWeights.justified_pe}%)
Justified P/B: ${this.formatCurrency(valuationResults.justified_pb.shareValue)} (Weight: ${modelWeights.justified_pb}%)

WEIGHTED AVERAGE: ${this.formatCurrency(weightedValue)}

MARKET COMPARISON
----------------
Current Price: ${this.formatCurrency(currentPrice)}
Target Price: ${this.formatCurrency(weightedValue)}
Upside/Downside Potential: ${upside.toFixed(1)}%

Generated by Stock Valuation Tool
        `.trim();

        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentStock}_valuation_report.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateCSVReport(stockData, valuationResults, assumptions, modelWeights, currentStock, lang) {
        const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : {};

        const weightedValue = valuationResults.weighted_average;
        const currentPrice = stockData.current_price;
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
        csv.push(`${t.companyInformation || 'Company'}${SEP}${stockData.name} (${currentStock})`);
        csv.push(`${t.reportDate || 'Report Date'}${SEP}${new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
        csv.push(`${t.dataPeriod || 'Data Period'}${SEP}${stockData.data_frequency === 'quarter' ? (t.latestQuarter || 'Latest Quarter') : (t.latestYear || 'Latest Year')}`);
        csv.push('');
        csv.push('───────────────────────────────────────────────────────────────────────────────');

        // SECTION 1: Company Overview
        csv.push('');
        csv.push(`═══ 1. ${t.companyInformation || 'COMPANY INFORMATION'} ═══`);
        csv.push(`${t.symbol || 'Stock Symbol'}${SEP}${stockData.symbol || '--'}`);
        csv.push(`${t.name || 'Company Name'}${SEP}${stockData.name || '--'}`);
        csv.push(`${t.industry || 'Industry'}${SEP}${stockData.sector || '--'}`);
        csv.push(`${t.exchange || 'Exchange'}${SEP}${stockData.exchange || '--'}`);
        csv.push('');

        // SECTION 2: Market Data
        csv.push(`═══ 2. ${t.marketData || 'MARKET DATA'} ═══`);
        csv.push(`Metric${SEP}Value${SEP}Unit`);
        csv.push(`${t.currentPrice || 'Current Price'}${SEP}${currentPrice.toLocaleString('vi-VN')}${SEP}VND`);
        csv.push(`${t.marketCap || 'Market Cap'}${SEP}${(stockData.market_cap / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`${t.sharesOutstanding || 'Shares Outstanding'}${SEP}${(stockData.shares_outstanding / 1e6).toFixed(2)}${SEP}Million shares`);
        csv.push(`${t.eps || 'EPS'}${SEP}${stockData.eps?.toLocaleString('vi-VN') || '--'}${SEP}VND`);
        csv.push(`${t.bookValuePerShare || 'Book Value/Share'}${SEP}${stockData.book_value_per_share?.toLocaleString('vi-VN') || '--'}${SEP}VND`);
        csv.push(`${t.peRatio || 'P/E Ratio'}${SEP}${stockData.pe_ratio?.toFixed(2) || '--'}${SEP}x`);
        csv.push(`${t.pbRatio || 'P/B Ratio'}${SEP}${stockData.pb_ratio?.toFixed(2) || '--'}${SEP}x`);
        csv.push('');

        // SECTION 3: Valuation Summary
        csv.push(`═══ 3. ${t.valuationResults || 'VALUATION SUMMARY'} ═══`);
        csv.push(`Model${SEP}Fair Value (VND)${SEP}Weight${SEP}Difference vs Market`);
        const fcfe = valuationResults.fcfe;
        const fcfeDiff = ((fcfe.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`FCFE${SEP}${fcfe.shareValue.toLocaleString('vi-VN')}${SEP}${modelWeights.fcfe}%${SEP}${fcfeDiff}%`);

        const fcff = valuationResults.fcff;
        const fcffDiff = ((fcff.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`FCFF${SEP}${fcff.shareValue.toLocaleString('vi-VN')}${SEP}${modelWeights.fcff}%${SEP}${fcffDiff}%`);

        const pe = valuationResults.justified_pe;
        const peDiff = ((pe.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`Justified P/E${SEP}${pe.shareValue.toLocaleString('vi-VN')}${SEP}${modelWeights.justified_pe}%${SEP}${peDiff}%`);

        const pb = valuationResults.justified_pb;
        const pbDiff = ((pb.shareValue - currentPrice) / currentPrice * 100).toFixed(1);
        csv.push(`Justified P/B${SEP}${pb.shareValue.toLocaleString('vi-VN')}${SEP}${modelWeights.justified_pb}%${SEP}${pbDiff}%`);

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
            csv.push(`÷ Shares Outstanding${SEP}${stockData.shares_outstanding.toLocaleString('vi-VN')}`);
            csv.push(`= Fair Value per Share${SEP}${fcfe.shareValue.toLocaleString('vi-VN')}`);
        }
        csv.push(`Formula${SEP}PV = Σ(FCFE_t / (1+r)^t) + TV / (1+r)^n`);
        csv.push(`Growth Rate (g)${SEP}${assumptions.revenueGrowth}%`);
        csv.push(`Discount Rate (r)${SEP}${assumptions.requiredReturn}%`);
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
            csv.push(`÷ Shares Outstanding${SEP}${stockData.shares_outstanding.toLocaleString('vi-VN')}`);
            csv.push(`= Fair Value per Share${SEP}${fcff.shareValue.toLocaleString('vi-VN')}`);
        }
        csv.push(`Formula${SEP}EV = Σ(FCFF_t / (1+WACC)^t) + TV / (1+WACC)^n`);
        csv.push(`WACC${SEP}${assumptions.wacc}%`);
        csv.push('');

        // 4.3 P/E
        csv.push('4.3 Justified P/E Valuation');
        csv.push(`Description${SEP}Value`);
        csv.push(`Current EPS${SEP}${stockData.eps?.toLocaleString('vi-VN')} VND`);
        csv.push(`Justified P/E Ratio${SEP}${pe.ratio?.toFixed(2)}x`);
        csv.push(`= Fair Value per Share${SEP}${pe.shareValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Formula${SEP}Justified P/E = Payout × (1+g) / (r-g)`);
        csv.push(`Payout Ratio${SEP}${(assumptions.payoutRatio || 40)}%`);
        csv.push(`Growth Rate (g)${SEP}${assumptions.revenueGrowth}%`);
        csv.push(`Required Return (r)${SEP}${assumptions.requiredReturn}%`);
        csv.push('');

        // 4.4 P/B
        csv.push('4.4 Justified P/B Valuation');
        csv.push(`Description${SEP}Value`);
        csv.push(`Book Value per Share${SEP}${stockData.book_value_per_share?.toLocaleString('vi-VN')} VND`);
        csv.push(`Justified P/B Ratio${SEP}${pb.ratio?.toFixed(2)}x`);
        csv.push(`= Fair Value per Share${SEP}${pb.shareValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Formula${SEP}Justified P/B = ROE × Payout × (1+g) / (r-g)`);
        csv.push(`ROE${SEP}${stockData.roe?.toFixed(2)}%`);
        csv.push('');

        // SECTION 5: Investment Decision
        csv.push(`═══ 5. ${t.recommendation || 'INVESTMENT RECOMMENDATION'} ═══`);
        csv.push(`Current Market Price${SEP}${currentPrice.toLocaleString('vi-VN')} VND`);
        csv.push(`Fair Value (Weighted Average)${SEP}${weightedValue.toLocaleString('vi-VN')} VND`);
        csv.push(`Upside/Downside Potential${SEP}${upside >= 0 ? '+' : ''}${upside.toFixed(2)}%`);
        if (valuationResults.market_comparison?.recommendation) {
            const rec = valuationResults.market_comparison.recommendation;
            csv.push(`>>> Investment Recommendation${SEP}${rec.toUpperCase()}`);
        }
        csv.push('');

        // SECTION 6: Assumptions & Parameters
        csv.push(`═══ 6. ${t.modelAssumptions || 'VALUATION ASSUMPTIONS'} ═══`);
        csv.push(`Parameter${SEP}Value`);
        csv.push(`Revenue Growth Rate${SEP}${assumptions.revenueGrowth}%`);
        csv.push(`Terminal Growth Rate${SEP}${assumptions.terminalGrowth}%`);
        csv.push(`WACC (Weighted Average Cost of Capital)${SEP}${assumptions.wacc}%`);
        csv.push(`Cost of Equity (Required Return)${SEP}${assumptions.requiredReturn}%`);
        csv.push(`Corporate Tax Rate${SEP}${assumptions.taxRate}%`);
        csv.push(`Projection Period${SEP}${assumptions.projectionYears} years`);
        csv.push('');

        // SECTION 7: Financial Health
        csv.push(`═══ 7. ${t.financialMetrics || 'FINANCIAL HEALTH METRICS'} ═══`);
        csv.push(`Metric${SEP}Value${SEP}Unit`);
        csv.push(`Revenue (TTM)${SEP}${(stockData.revenue_ttm / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`Net Income (TTM)${SEP}${(stockData.net_income_ttm / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`EBITDA${SEP}${(stockData.ebitda / 1e9).toFixed(2)}${SEP}Billion VND`);
        csv.push(`ROE (Return on Equity)${SEP}${stockData.roe?.toFixed(2) || '--'}${SEP}%`);
        csv.push(`ROA (Return on Assets)${SEP}${stockData.roa?.toFixed(2) || '--'}${SEP}%`);
        csv.push(`Debt/Equity Ratio${SEP}${stockData.debt_to_equity?.toFixed(2) || '--'}${SEP}x`);
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

    // =========================================================================
    // EXCEL HELPER METHODS
    // =========================================================================

    async createSummaryDashboard(sheet, stockData, valuationResults, modelWeights, currentStock, lang) {
        // Logic from app.js createSummaryDashboard, using arguments
        let row = 1;
        sheet.mergeCells('A1:F1');
        sheet.getCell('A1').value = 'COMPREHENSIVE STOCK VALUATION REPORT';
        sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0066CC' } };
        row += 2;

        // ... Implementation from app.js ...
        // Re-implementing key parts:
        sheet.getCell(`A${row}`).value = 'VALUATION SUMMARY';
        row++;
        // ...
        ['Method', 'Fair Value', 'Current Price', 'Upside', 'Weight', 'Weighted Value'].forEach((h, i) => {
            sheet.getCell(row, i + 1).value = h;
            sheet.getCell(row, i + 1).font = { bold: true };
        });
        row++;

        // FCFE
        sheet.getCell(`A${row}`).value = 'FCFE';
        sheet.getCell(`B${row}`).value = valuationResults.fcfe.shareValue;
        sheet.getCell(`C${row}`).value = stockData.current_price;
        row++;
        // FCFF
        sheet.getCell(`A${row}`).value = 'FCFF';
        sheet.getCell(`B${row}`).value = valuationResults.fcff.shareValue;
        sheet.getCell(`C${row}`).value = stockData.current_price;
        row++;
        // PE
        sheet.getCell(`A${row}`).value = 'P/E';
        sheet.getCell(`B${row}`).value = valuationResults.justified_pe.shareValue;
        sheet.getCell(`C${row}`).value = stockData.current_price;
        row++;
        // PB
        sheet.getCell(`A${row}`).value = 'P/B';
        sheet.getCell(`B${row}`).value = valuationResults.justified_pb.shareValue;
        sheet.getCell(`C${row}`).value = stockData.current_price;
        row++;

        sheet.getCell(`A${row}`).value = 'WEIGHTED AVERAGE';
        sheet.getCell(`F${row}`).value = valuationResults.weighted_average;
    }

    createFCFESheet(sheet, stockData, valuationResults, assumptions) {
        let row = 1;

        // Header
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'FCFE (FREE CASH FLOW TO EQUITY) ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '28A745' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;

        // Formula Explanation
        sheet.getCell(`A${row}`).value = 'FORMULA';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        sheet.getCell(`A${row}`).value = 'FCFE = Net Income + Depreciation + Net Borrowing − ΔWorking Capital − CapEx';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;
        sheet.getCell(`A${row}`).value = 'Equity Value = Σ(FCFEₜ / (1+r)ᵗ) + Terminal Value / (1+r)ⁿ';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row += 2;

        // Input Data Section
        sheet.getCell(`A${row}`).value = 'INPUT DATA (from Financial Statements)';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const fcfeData = valuationResults.fcfe || {};

        sheet.getCell(`A${row}`).value = 'Net Income';
        sheet.getCell(`B${row}`).value = stockData.net_income_ttm || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Income Statement';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Depreciation & Amortization';
        sheet.getCell(`B${row}`).value = stockData.depreciation || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Cash Flow Statement';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Net Borrowing (Proceeds - Repayments)';
        sheet.getCell(`B${row}`).value = stockData.net_borrowing || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Cash Flow Statement';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Change in Working Capital';
        sheet.getCell(`B${row}`).value = stockData.working_capital_change || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'ΔReceivables + ΔInventory - ΔPayables';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Capital Expenditure (CapEx)';
        sheet.getCell(`B${row}`).value = Math.abs(stockData.capex || 0);
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Cash Flow Statement';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row += 2;

        // Assumptions Section
        sheet.getCell(`A${row}`).value = 'ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        sheet.getCell(`A${row}`).value = 'Cost of Equity (Required Return)';
        sheet.getCell(`B${row}`).value = (assumptions.requiredReturn || 12) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Short-term Growth Rate';
        sheet.getCell(`B${row}`).value = (assumptions.revenueGrowth || 5) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Terminal Growth Rate';
        sheet.getCell(`B${row}`).value = (assumptions.terminalGrowth || 2) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Forecast Period';
        sheet.getCell(`B${row}`).value = assumptions.projectionYears || 5;
        sheet.getCell(`C${row}`).value = 'years';
        row++;

        sheet.getCell(`A${row}`).value = 'Shares Outstanding';
        sheet.getCell(`B${row}`).value = stockData.shares_outstanding || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row += 2;

        // Calculate Base FCFE
        sheet.getCell(`A${row}`).value = 'BASE FCFE CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const netIncome = stockData.net_income_ttm || 0;
        const depreciation = stockData.depreciation || 0;
        const netBorrowing = stockData.net_borrowing || 0;
        const wcChange = stockData.working_capital_change || 0;
        const capex = Math.abs(stockData.capex || 0);

        sheet.getCell(`A${row}`).value = 'Base FCFE = Net Income + Depreciation + Net Borrowing - ΔWC - CapEx';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        const baseFCFE = netIncome + depreciation + netBorrowing - wcChange - capex;
        sheet.getCell(`A${row}`).value = `Base FCFE = ${netIncome.toLocaleString()} + ${depreciation.toLocaleString()} + ${netBorrowing.toLocaleString()} - ${wcChange.toLocaleString()} - ${capex.toLocaleString()}`;
        sheet.getCell(`A${row}`).font = { color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Base FCFE (Year 0)';
        sheet.getCell(`B${row}`).value = baseFCFE;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true };
        sheet.getCell(`C${row}`).value = 'VND';
        row += 2;

        // Projected Cash Flows - Calculate ourselves
        sheet.getCell(`A${row}`).value = 'PROJECTED CASH FLOWS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const r = (assumptions.requiredReturn || 12) / 100;
        const g = (assumptions.revenueGrowth || 5) / 100;
        const terminalG = (assumptions.terminalGrowth || 2) / 100;
        const years = assumptions.projectionYears || 5;

        // Table header
        ['Year', 'Growth Formula', 'Projected FCFE', 'Discount Factor', 'PV Formula', 'Present Value'].forEach((h, i) => {
            sheet.getCell(row, i + 1).value = h;
            sheet.getCell(row, i + 1).font = { bold: true };
            sheet.getCell(row, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        });
        row++;

        let totalPV = 0;
        const projectedFCFEs = [];

        for (let year = 1; year <= years; year++) {
            const projectedFCFE = baseFCFE * Math.pow(1 + g, year);
            const discountFactor = 1 / Math.pow(1 + r, year);
            const pv = projectedFCFE * discountFactor;
            totalPV += pv;
            projectedFCFEs.push(projectedFCFE);

            sheet.getCell(`A${row}`).value = year;
            sheet.getCell(`B${row}`).value = `FCFE₀ × (1+${(g * 100).toFixed(1)}%)^${year}`;
            sheet.getCell(`B${row}`).font = { italic: true, color: { argb: '6B7280' } };
            sheet.getCell(`C${row}`).value = projectedFCFE;
            sheet.getCell(`C${row}`).numFmt = '#,##0';
            sheet.getCell(`D${row}`).value = discountFactor;
            sheet.getCell(`D${row}`).numFmt = '0.0000';
            sheet.getCell(`E${row}`).value = `FCFE${year} / (1+${(r * 100).toFixed(1)}%)^${year}`;
            sheet.getCell(`E${row}`).font = { italic: true, color: { argb: '6B7280' } };
            sheet.getCell(`F${row}`).value = pv;
            sheet.getCell(`F${row}`).numFmt = '#,##0';
            row++;
        }

        // Sum of PV row
        sheet.getCell(`A${row}`).value = 'Sum of PV (Years 1-' + years + ')';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`F${row}`).value = totalPV;
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        sheet.getCell(`F${row}`).font = { bold: true };
        row += 2;

        // Terminal Value
        sheet.getCell(`A${row}`).value = 'TERMINAL VALUE CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const lastFCFE = projectedFCFEs[projectedFCFEs.length - 1];
        const terminalValue = lastFCFE * (1 + terminalG) / (r - terminalG);
        const pvTerminal = terminalValue / Math.pow(1 + r, years);

        sheet.getCell(`A${row}`).value = 'Formula: TV = FCFE₅ × (1 + g) / (r - g)';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = `TV = ${lastFCFE.toLocaleString()} × (1 + ${(terminalG * 100).toFixed(1)}%) / (${(r * 100).toFixed(1)}% - ${(terminalG * 100).toFixed(1)}%)`;
        sheet.getCell(`A${row}`).font = { color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Terminal Value';
        sheet.getCell(`B${row}`).value = terminalValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = `PV of Terminal Value = TV / (1+r)^${years}`;
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'PV of Terminal Value';
        sheet.getCell(`B${row}`).value = pvTerminal;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row += 2;

        // Final Results
        sheet.getCell(`A${row}`).value = 'FINAL VALUATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '28A745' } };
        row++;

        const totalEquityValue = totalPV + pvTerminal;
        const sharesOutstanding = stockData.shares_outstanding || 1;
        const fairValue = totalEquityValue / sharesOutstanding;

        sheet.getCell(`A${row}`).value = 'Total Equity Value = Sum of PV + PV of Terminal Value';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Total Equity Value';
        sheet.getCell(`B${row}`).value = totalEquityValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = `Fair Value per Share = Equity Value / ${sharesOutstanding.toLocaleString()} shares`;
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`B${row}`).value = fairValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 14, color: { argb: '28A745' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`B${row}`).value = stockData.current_price || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        const upside = stockData.current_price ? ((fairValue - stockData.current_price) / stockData.current_price) : 0;
        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = upside;
        sheet.getCell(`B${row}`).numFmt = '+0.00%;-0.00%';
        sheet.getCell(`B${row}`).font = { bold: true, color: { argb: upside >= 0 ? '28A745' : 'DC3545' } };
        row += 2;

        // BACKEND COMPARISON SECTION
        sheet.getCell(`A${row}`).value = '═══════════════ COMPARISON WITH BACKEND ═══════════════';
        sheet.getCell(`A${row}`).font = { bold: true, color: { argb: '2563EB' } };
        row++;

        // Get backend FCFE value
        const backendFCFE = typeof valuationResults.fcfe === 'number' ? valuationResults.fcfe :
            (valuationResults.fcfe?.shareValue || 0);

        sheet.getCell(`A${row}`).value = '📊 Backend FCFE Value (shown on website)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).value = backendFCFE;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 14, color: { argb: '2563EB' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = '📈 Excel Calculated Value (above)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).value = fairValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, color: { argb: '28A745' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        const diff = backendFCFE - fairValue;
        const diffPercent = fairValue !== 0 ? (diff / fairValue) : 0;
        sheet.getCell(`A${row}`).value = 'Difference';
        sheet.getCell(`B${row}`).value = diff;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = diffPercent;
        sheet.getCell(`C${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = '⚠️ Note: Difference occurs because backend uses complete financial data from vnstock API';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: 'F59E0B' } };
        row++;
        sheet.getCell(`A${row}`).value = '   while stockData may not contain depreciation, capex, working capital changes for banks.';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };

        // Set column widths
        sheet.getColumn(1).width = 55;
        sheet.getColumn(2).width = 25;
        sheet.getColumn(3).width = 18;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 30;
        sheet.getColumn(6).width = 18;
    }

    createFCFFSheet(sheet, stockData, valuationResults, assumptions) {
        let row = 1;

        // Header
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'FCFF (FREE CASH FLOW TO FIRM) ANALYSIS';
        sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0066CC' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        row += 2;

        // Formula Explanation
        sheet.getCell(`A${row}`).value = 'FORMULA';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;
        sheet.getCell(`A${row}`).value = 'FCFF = EBIT × (1 - Tax Rate) + Depreciation − CapEx − ΔWorking Capital';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;
        sheet.getCell(`A${row}`).value = 'Enterprise Value = Σ(FCFFₜ / (1+WACC)ᵗ) + Terminal Value / (1+WACC)ⁿ';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;
        sheet.getCell(`A${row}`).value = 'Equity Value = Enterprise Value − Net Debt';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row += 2;

        // Input Data Section
        sheet.getCell(`A${row}`).value = 'INPUT DATA (from Financial Statements)';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const fcffData = valuationResults.fcff || {};

        sheet.getCell(`A${row}`).value = 'EBIT (Operating Income)';
        sheet.getCell(`B${row}`).value = stockData.ebit || stockData.ebitda || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Income Statement';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Tax Rate';
        sheet.getCell(`B${row}`).value = (assumptions.taxRate || 20) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`D${row}`).value = 'Corporate tax rate';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Depreciation & Amortization';
        sheet.getCell(`B${row}`).value = stockData.depreciation || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Capital Expenditure (CapEx)';
        sheet.getCell(`B${row}`).value = Math.abs(stockData.capex || 0);
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Change in Working Capital';
        sheet.getCell(`B${row}`).value = stockData.working_capital_change || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Total Debt';
        sheet.getCell(`B${row}`).value = stockData.total_debt || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`D${row}`).value = 'From Balance Sheet';
        sheet.getCell(`D${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Cash & Equivalents';
        sheet.getCell(`B${row}`).value = stockData.cash || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Net Debt (Debt - Cash)';
        sheet.getCell(`B${row}`).value = (stockData.total_debt || 0) - (stockData.cash || 0);
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`B${row}`).font = { bold: true };
        row += 2;

        // Assumptions
        sheet.getCell(`A${row}`).value = 'ASSUMPTIONS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        sheet.getCell(`A${row}`).value = 'WACC (Weighted Avg Cost of Capital)';
        sheet.getCell(`B${row}`).value = (assumptions.wacc || 10) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Short-term Growth Rate';
        sheet.getCell(`B${row}`).value = (assumptions.revenueGrowth || 5) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Terminal Growth Rate';
        sheet.getCell(`B${row}`).value = (assumptions.terminalGrowth || 2) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = 'Forecast Period';
        sheet.getCell(`B${row}`).value = assumptions.projectionYears || 5;
        sheet.getCell(`C${row}`).value = 'years';
        row++;

        sheet.getCell(`A${row}`).value = 'Shares Outstanding';
        sheet.getCell(`B${row}`).value = stockData.shares_outstanding || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row += 2;

        // Calculate Base FCFF
        sheet.getCell(`A${row}`).value = 'BASE FCFF CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const ebit = stockData.ebit || stockData.ebitda || 0;
        const taxRate = (assumptions.taxRate || 20) / 100;
        const depreciation = stockData.depreciation || 0;
        const wcChange = stockData.working_capital_change || 0;
        const capex = Math.abs(stockData.capex || 0);
        const totalDebt = stockData.total_debt || 0;
        const cash = stockData.cash || 0;
        const netDebt = totalDebt - cash;

        sheet.getCell(`A${row}`).value = 'Base FCFF = EBIT × (1 - Tax Rate) + Depreciation - ΔWC - CapEx';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        const ebitAfterTax = ebit * (1 - taxRate);
        const baseFCFF = ebitAfterTax + depreciation - wcChange - capex;

        sheet.getCell(`A${row}`).value = `Base FCFF = ${ebit.toLocaleString()} × (1 - ${(taxRate * 100).toFixed(0)}%) + ${depreciation.toLocaleString()} - ${wcChange.toLocaleString()} - ${capex.toLocaleString()}`;
        sheet.getCell(`A${row}`).font = { color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Base FCFF (Year 0)';
        sheet.getCell(`B${row}`).value = baseFCFF;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true };
        sheet.getCell(`C${row}`).value = 'VND';
        row += 2;

        // Projected Cash Flows - Calculate ourselves
        sheet.getCell(`A${row}`).value = 'PROJECTED CASH FLOWS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const wacc = (assumptions.wacc || 10) / 100;
        const g = (assumptions.revenueGrowth || 5) / 100;
        const terminalG = (assumptions.terminalGrowth || 2) / 100;
        const years = assumptions.projectionYears || 5;

        // Table header
        ['Year', 'Growth Formula', 'Projected FCFF', 'Discount Factor', 'PV Formula', 'Present Value'].forEach((h, i) => {
            sheet.getCell(row, i + 1).value = h;
            sheet.getCell(row, i + 1).font = { bold: true };
            sheet.getCell(row, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E3F2FD' } };
        });
        row++;

        let totalPV = 0;
        const projectedFCFFs = [];

        for (let year = 1; year <= years; year++) {
            const projectedFCFF = baseFCFF * Math.pow(1 + g, year);
            const discountFactor = 1 / Math.pow(1 + wacc, year);
            const pv = projectedFCFF * discountFactor;
            totalPV += pv;
            projectedFCFFs.push(projectedFCFF);

            sheet.getCell(`A${row}`).value = year;
            sheet.getCell(`B${row}`).value = `FCFF₀ × (1+${(g * 100).toFixed(1)}%)^${year}`;
            sheet.getCell(`B${row}`).font = { italic: true, color: { argb: '6B7280' } };
            sheet.getCell(`C${row}`).value = projectedFCFF;
            sheet.getCell(`C${row}`).numFmt = '#,##0';
            sheet.getCell(`D${row}`).value = discountFactor;
            sheet.getCell(`D${row}`).numFmt = '0.0000';
            sheet.getCell(`E${row}`).value = `FCFF${year} / (1+${(wacc * 100).toFixed(1)}%)^${year}`;
            sheet.getCell(`E${row}`).font = { italic: true, color: { argb: '6B7280' } };
            sheet.getCell(`F${row}`).value = pv;
            sheet.getCell(`F${row}`).numFmt = '#,##0';
            row++;
        }

        // Sum of PV row
        sheet.getCell(`A${row}`).value = 'Sum of PV (Years 1-' + years + ')';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`F${row}`).value = totalPV;
        sheet.getCell(`F${row}`).numFmt = '#,##0';
        sheet.getCell(`F${row}`).font = { bold: true };
        row += 2;

        // Terminal Value
        sheet.getCell(`A${row}`).value = 'TERMINAL VALUE CALCULATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
        row++;

        const lastFCFF = projectedFCFFs[projectedFCFFs.length - 1];
        const terminalValue = lastFCFF * (1 + terminalG) / (wacc - terminalG);
        const pvTerminal = terminalValue / Math.pow(1 + wacc, years);

        sheet.getCell(`A${row}`).value = 'Formula: TV = FCFF₅ × (1 + g) / (WACC - g)';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = `TV = ${lastFCFF.toLocaleString()} × (1 + ${(terminalG * 100).toFixed(1)}%) / (${(wacc * 100).toFixed(1)}% - ${(terminalG * 100).toFixed(1)}%)`;
        sheet.getCell(`A${row}`).font = { color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Terminal Value';
        sheet.getCell(`B${row}`).value = terminalValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = `PV of Terminal Value = TV / (1+WACC)^${years}`;
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'PV of Terminal Value';
        sheet.getCell(`B${row}`).value = pvTerminal;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row += 2;

        // Final Results
        const enterpriseValue = totalPV + pvTerminal;
        const equityValue = enterpriseValue - netDebt;
        const sharesOutstanding = stockData.shares_outstanding || 1;
        const fairValue = equityValue / sharesOutstanding;

        sheet.getCell(`A${row}`).value = 'FINAL VALUATION';
        sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
        sheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0066CC' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Enterprise Value = Sum of PV + PV of Terminal Value';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Enterprise Value';
        sheet.getCell(`B${row}`).value = enterpriseValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = '− Net Debt';
        sheet.getCell(`B${row}`).value = netDebt;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = '= Equity Value';
        sheet.getCell(`B${row}`).value = equityValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        sheet.getCell(`B${row}`).font = { bold: true };
        row++;

        sheet.getCell(`A${row}`).value = `Fair Value per Share = Equity Value / ${sharesOutstanding.toLocaleString()} shares`;
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };
        row++;

        sheet.getCell(`A${row}`).value = 'Fair Value per Share';
        sheet.getCell(`B${row}`).value = fairValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 14, color: { argb: '0066CC' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = 'Current Market Price';
        sheet.getCell(`B${row}`).value = stockData.current_price || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        const upside = stockData.current_price ? ((fairValue - stockData.current_price) / stockData.current_price) : 0;
        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = upside;
        sheet.getCell(`B${row}`).numFmt = '+0.00%;-0.00%';
        sheet.getCell(`B${row}`).font = { bold: true, color: { argb: upside >= 0 ? '28A745' : 'DC3545' } };
        row += 2;

        // BACKEND COMPARISON SECTION
        sheet.getCell(`A${row}`).value = '═══════════════ COMPARISON WITH BACKEND ═══════════════';
        sheet.getCell(`A${row}`).font = { bold: true, color: { argb: '2563EB' } };
        row++;

        // Get backend FCFF value
        const backendFCFF = typeof valuationResults.fcff === 'number' ? valuationResults.fcff :
            (valuationResults.fcff?.shareValue || 0);

        sheet.getCell(`A${row}`).value = '📊 Backend FCFF Value (shown on website)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).value = backendFCFF;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, size: 14, color: { argb: '2563EB' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        sheet.getCell(`A${row}`).value = '📈 Excel Calculated Value (above)';
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).value = fairValue;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).font = { bold: true, color: { argb: '0066CC' } };
        sheet.getCell(`C${row}`).value = 'VND';
        row++;

        const diff = backendFCFF - fairValue;
        const diffPercent = fairValue !== 0 ? (diff / fairValue) : 0;
        sheet.getCell(`A${row}`).value = 'Difference';
        sheet.getCell(`B${row}`).value = diff;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`C${row}`).value = diffPercent;
        sheet.getCell(`C${row}`).numFmt = '0.00%';
        row++;

        sheet.getCell(`A${row}`).value = '⚠️ Note: Difference occurs because backend uses complete financial data from vnstock API';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: 'F59E0B' } };
        row++;
        sheet.getCell(`A${row}`).value = '   while stockData may not contain depreciation, capex, working capital changes for banks.';
        sheet.getCell(`A${row}`).font = { italic: true, color: { argb: '6B7280' } };

        // Set column widths
        sheet.getColumn(1).width = 55;
        sheet.getColumn(2).width = 25;
        sheet.getColumn(3).width = 18;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 30;
        sheet.getColumn(6).width = 18;
    }

    createPESheet(sheet, stockData, assumptions) {
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
        sheet.getCell(`B${row}`).value = stockData.eps || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'CurrentEPS';
        row++;

        sheet.getCell(`A${row}`).value = 'ROE (%)';
        sheet.getCell(`B${row}`).value = (stockData.roe || 0) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'ROE';
        row++;

        sheet.getCell(`A${row}`).value = 'Payout Ratio (%)';
        sheet.getCell(`B${row}`).value = (assumptions.payoutRatio || 50) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'PayoutRatio';
        row++;

        sheet.getCell(`A${row}`).value = 'Required Return (%)';
        sheet.getCell(`B${row}`).value = assumptions.requiredReturn / 100;
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
        sheet.getCell(`B${row}`).value = stockData.current_price;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row++;

        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = { formula: `(B${row - 3}-B${row - 1})/B${row - 1}` };
        sheet.getCell(`B${row}`).numFmt = '0.00%';

        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 20;
        sheet.getColumn(3).width = 35;
    }

    createPBSheet(sheet, stockData, assumptions) {
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
        sheet.getCell(`B${row}`).value = stockData.book_value_per_share || 0;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        sheet.getCell(`B${row}`).name = 'BVPS';
        row++;

        sheet.getCell(`A${row}`).value = 'ROE (%)';
        sheet.getCell(`B${row}`).value = (stockData.roe || 0) / 100;
        sheet.getCell(`B${row}`).numFmt = '0.00%';
        sheet.getCell(`B${row}`).name = 'ROE_PB';
        row++;

        sheet.getCell(`A${row}`).value = 'Required Return (%)';
        sheet.getCell(`B${row}`).value = assumptions.requiredReturn / 100;
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
        sheet.getCell(`B${row}`).value = stockData.current_price;
        sheet.getCell(`B${row}`).numFmt = '#,##0';
        row++;

        sheet.getCell(`A${row}`).value = 'Upside/Downside';
        sheet.getCell(`B${row}`).value = { formula: `(B${row - 3}-B${row - 1})/B${row - 1}` };
        sheet.getCell(`B${row}`).numFmt = '0.00%';

        sheet.getColumn(1).width = 25;
        sheet.getColumn(2).width = 20;
        sheet.getColumn(3).width = 35;
    }

    createAssumptionsSheet(sheet, stockData, assumptions, modelWeights, currentStock) {
        let row = 1;
        sheet.getCell('A1').value = 'VALUATION ASSUMPTIONS';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        row += 2;

        const assumptionsData = [
            ['Revenue Growth Rate (%)', assumptions.revenueGrowth],
            ['Terminal Growth Rate (%)', assumptions.terminalGrowth],
            ['WACC (%)', assumptions.wacc],
            ['Cost of Equity (%)', assumptions.requiredReturn],
            ['Tax Rate (%)', assumptions.taxRate],
            ['Projection Years', assumptions.projectionYears]
        ];

        assumptionsData.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            row++;
        });

        // Add Model Weights
        row += 2;
        sheet.getCell(`A${row}`).value = 'MODEL WEIGHTS';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        row++;

        const weightsData = [
            ['FCFE Weight (%)', modelWeights.fcfe],
            ['FCFF Weight (%)', modelWeights.fcff],
            ['P/E Weight (%)', modelWeights.justified_pe],
            ['P/B Weight (%)', modelWeights.justified_pb]
        ];

        weightsData.forEach(([label, value]) => {
            sheet.getCell(`A${row}`).value = label;
            sheet.getCell(`B${row}`).value = value;
            row++;
        });

        sheet.getColumn(1).width = 30;
        sheet.getColumn(2).width = 20;
    }

    createCompanyDataSheet(sheet, stockData, currentStock) {
        let row = 1;

        sheet.getCell('A1').value = 'FINANCIAL DATA REFERENCE';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        row += 2;

        // Company Info
        const companyData = [
            ['Symbol', currentStock],
            ['Name', stockData.name],
            ['Sector', stockData.sector],
            ['Exchange', stockData.exchange],
            ['', ''],
            ['Current Price', stockData.current_price],
            ['Market Cap', stockData.market_cap],
            ['Shares Outstanding', stockData.shares_outstanding],
            ['EPS', stockData.eps],
            ['Book Value/Share', stockData.book_value_per_share],
            ['P/E Ratio', stockData.pe_ratio],
            ['P/B Ratio', stockData.pb_ratio],
            ['', ''],
            ['Revenue (TTM)', stockData.revenue_ttm],
            ['Net Income (TTM)', stockData.net_income_ttm],
            ['EBITDA', stockData.ebitda],
            ['ROE (%)', stockData.roe],
            ['ROA (%)', stockData.roa],
            ['Debt/Equity', stockData.debt_to_equity]
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
}
