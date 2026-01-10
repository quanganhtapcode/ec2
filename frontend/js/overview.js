/**
 * OVERVIEW PAGE JAVASCRIPT (index.html)
 * Separated for easier maintenance
 */

// ============ API ENDPOINTS ============
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://api.quanganh.org/v1/valuation';

const API = {
    PE_CHART: `${API_BASE}/market/pe-chart`,
    REALTIME: `${API_BASE}/market/realtime`,
    INDICES: `${API_BASE}/market/indices`,
    REALTIME_CHART: `${API_BASE}/market/realtime-chart`,
    REALTIME_MARKET: `${API_BASE}/market/realtime-market`,
    REPORTS: `${API_BASE}/market/reports`,
    NEWS: `${API_BASE}/market/news?page=1&size=100`,
    TOP_MOVERS: `${API_BASE}/market/top-movers`,
    FOREIGN_FLOW: `${API_BASE}/market/foreign-flow`,
    GOLD: `${API_BASE}/market/gold`
};

// Index IDs from CafeF: 1=VNINDEX, 2=HNX, 9=UPCOM, 11=VN30
const INDEX_MAP = {
    '1': { id: 'vnindex', name: 'VN-Index' },
    '2': { id: 'hnx', name: 'HNX-Index' },
    '9': { id: 'upcom', name: 'UPCOM' },
    '11': { id: 'vn30', name: 'VN30' }
};

// ============ STOCK LOGO HELPER ============
// Logos are served locally from 'logos' folder (via GitHub/Vercel)
// Fallback: If image fails, show text abbreviation
const LOGO_BASE_URL = 'logos/';

/**
 * Generate HTML for stock logo with image fallback to text
 * @param {string} symbol - Stock symbol (e.g., VCB, FPT)
 * @param {string} bgColor - Optional background color for fallback (default: gradient)
 * @param {string} textColor - Optional text color for fallback
 * @returns {string} HTML string for logo container
 */
function getStockLogoHtml(symbol, bgColor = null, textColor = null) {
    const fallbackStyle = bgColor
        ? `background: ${bgColor}; color: ${textColor || '#666'};`
        : 'background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); color: #0369a1;';

    return `
        <div class="stock-logo-wrapper" style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <img src="${LOGO_BASE_URL}${symbol}.jpg" alt="${symbol}" 
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="stock-logo-fallback" style="display: none; width: 100%; height: 100%; ${fallbackStyle} align-items: center; justify-content: center; font-size: 10px; font-weight: 700;">
                ${symbol.slice(0, 3)}
            </div>
        </div>
    `;
}


// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function () {
    // Load data first (most important)
    loadAllIndicesWithCharts();
    loadNews();
    loadTopMovers('gainers');
    setupMoverTabs();
    setupForeignTabs();
    setupLotteryTabs();
    setupTimeRangeButtons();
    loadPEChart();

    // Auto-refresh realtime data every 30 seconds
    setInterval(() => {
        loadAllIndicesWithCharts();

        // Refresh Top Movers (based on active tab)
        const activeMover = document.querySelector('.mover-tab.active');
        if (activeMover) loadTopMovers(activeMover.dataset.type);

        // Refresh Foreign Flows (based on active tab)
        const activeForeign = document.querySelector('.foreign-tab.active');
        if (activeForeign) loadForeignFlows(activeForeign.dataset.type);

        // Refresh Lottery
        if (window.refreshLottery) window.refreshLottery(true);

        console.log('📊 Refreshed market data at', new Date().toLocaleTimeString('vi-VN'));
    }, 30000); // 30 seconds

    // Search functionality - use correct ID
    const searchInput = document.getElementById('symbol-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const symbol = this.value.trim().toUpperCase();
                if (symbol) window.location.href = `?symbol=${symbol}`;
            }
        });
    }
});

// ============ LOAD ALL INDICES WITH SPARKLINE CHARTS ============
async function loadAllIndicesWithCharts() {
    try {
        // Fetch market data for all indices
        const marketResponse = await fetch(`${API.REALTIME_MARKET}?indices=1;2;9;11`);
        const marketData = await marketResponse.json();

        // Process each index
        for (const [indexId, info] of Object.entries(INDEX_MAP)) {
            const data = marketData[indexId];
            if (!data) continue;

            const currentIndex = data.CurrentIndex;
            const prevIndex = data.PrevIndex;
            const change = currentIndex - prevIndex;
            const percent = prevIndex > 0 ? (change / prevIndex) * 100 : 0;
            const isUp = change >= 0;

            // Update UI
            const valueEl = document.getElementById(`${info.id}-value`);
            const changeEl = document.getElementById(`${info.id}-change`);
            const percentEl = document.getElementById(`${info.id}-percent`);

            if (valueEl) valueEl.textContent = currentIndex?.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (changeEl) changeEl.textContent = (isUp ? '+' : '') + change.toFixed(2);
            if (percentEl) {
                percentEl.textContent = (isUp ? '+' : '') + percent.toFixed(2) + '%';
                percentEl.className = 'change-percent ' + (isUp ? 'positive' : 'negative');
            }

            // Update P/E sidebar if VN-Index
            if (indexId === '1') {
                const vnindexPe = document.getElementById('vnindex-pe');
                if (vnindexPe) vnindexPe.textContent = currentIndex?.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            // Load sparkline chart for this index
            loadIndexChart(indexId, info.id, isUp);
        }

        // Update fetch time display for indices
        const indicesFetchTimeEl = document.getElementById('indices-fetch-time');
        if (indicesFetchTimeEl) {
            const now = new Date();
            indicesFetchTimeEl.textContent = `📅 Cập nhật lúc: ${now.toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })}`;
        }
    } catch (error) {
        console.error('Error loading indices:', error);
    }
}

async function loadIndexChart(indexId, elementId, isUp) {
    try {
        const response = await fetch(`${API.REALTIME_CHART}?index=${indexId}`);
        const data = await response.json();

        // Data comes as {"1": [...]} format
        const chartData = data[indexId];
        if (chartData && chartData.length > 0) {
            // Extract "Data" field (index value) from each point
            const values = chartData.map(point => point.Data).reverse(); // Reverse to show oldest->newest
            createMiniChart(`${elementId}-chart`, values, isUp);
        }
    } catch (error) {
        console.error(`Error loading chart for index ${indexId}:`, error);
    }
}

// ============ MINI SPARKLINE CHART ============
// Store chart instances so we can destroy them before creating new ones
const chartInstances = {};

function createMiniChart(canvasId, data, isUp) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart on this canvas if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    const color = isUp ? '#10b981' : '#ef4444';

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: color,
                borderWidth: 2,
                fill: true,
                backgroundColor: isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            interaction: { enabled: false }
        }
    });
}

// ============ LOAD MARKET SUMMARY ============
async function loadNews() {
    const container = document.getElementById('news-list');
    try {
        // Try fetching News first
        const response = await fetch(API.NEWS);
        const result = await response.json();

        // CafeF News API usually wraps content in "Data"
        const data = result.Data || (Array.isArray(result) ? result : []);

        if (data && data.length > 0) {
            container.innerHTML = data.slice(0, 10).map(item => {
                // Correct keys from debug_news.json
                const title = item.Title || '';
                const link = item.Link || item.NewsUrl || '#';
                const url = link.startsWith('http') ? link : `https://cafef.vn${link}`;

                // Image field: Debug shows "ImageThumb"
                const img = item.ImageThumb || item.Avatar || item.Image || '';

                // Parse date: Debug shows "PostDate": "/Date(1766901060000)/"
                const dateStr = item.PostDate || item.PublishDate || item.Date;
                const timeDisplay = formatDate(dateStr);

                // Parse stock info: Debug shows "Symbol", "Price", "ChangePrice"
                const symbol = item.Symbol || '';
                let stockHtml = '';
                if (symbol) {
                    const change = item.ChangePrice || 0;
                    const isUp = change >= 0;
                    const changeClass = isUp ? 'positive' : 'negative';
                    // Ensure numeric formatting
                    const priceDisplay = item.Price ? `${item.Price} ` : '';
                    const changeDisplay = change ? `${isUp ? '+' : ''}${change}` : '';

                    stockHtml = `
                        <div class="stock-tag ${changeClass}" onclick="event.stopPropagation(); window.location.href='?symbol=${symbol}'" style="cursor: pointer;">
                            ${symbol} ${priceDisplay}${changeDisplay}
                        </div>
                    `;
                }

                // Image logic: if error, hide parent.
                const imageHtml = img ? `
                    <div class="news-thumb">
                        <img src="${img}" alt="${title}" loading="lazy" onerror="this.parentElement.style.display='none'">
                    </div>
                ` : '';

                return `
                <div class="news-item" onclick="window.open('${url}', '_blank')" style="cursor: pointer;">
                    ${imageHtml}
                    <div class="news-content">
                        <div class="news-title">
                            ${title}
                        </div>
                        <div class="news-meta">
                            ${stockHtml}
                            <span>${timeDisplay}</span>
                        </div>
                    </div>
                </div>
            `}).join('');
        } else {
            // Fallback to Reports if News is empty
            console.warn('News data empty, using fallback.');
            await loadReportsAsFallback(container);
        }
    } catch (error) {
        console.error('Error loading news, falling back to reports:', error);
        await loadReportsAsFallback(container);
    }
}

async function loadReportsAsFallback(container) {
    try {
        const response = await fetch(`${API.REPORTS}?take=6`);
        const result = await response.json();

        // Handle both array and {Data: [...]} format
        const data = Array.isArray(result) ? result : (result.Data || []);

        if (data.length > 0) {
            container.innerHTML = data.map(item => `
                <div class="news-item">
                    <div class="news-title">
                        <a href="${item.url || '#'}" target="_blank">${item.title}</a>
                    </div>
                    <div class="news-excerpt">${item.organName || ''} · ${formatDate(item.createdDate)}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="loading">Không có tin tức</div>';
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        container.innerHTML = '<div class="loading">Không có tin tức</div>';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        let date;
        if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
            const ms = parseInt(dateStr.match(/\d+/)[0]);
            date = new Date(ms);
        } else {
            date = new Date(dateStr);
        }

        // Format: HH:mm dd/MM/yyyy
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch { return ''; }
}

// ============ TOP MOVERS ============
async function loadTopMovers(type) {
    const container = document.getElementById('movers-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';

    try {
        let url;
        if (type === 'gainers') {
            url = `${API.TOP_MOVERS}?centerID=HOSE&type=UP`;
        } else if (type === 'losers') {
            url = `${API.TOP_MOVERS}?centerID=HOSE&type=DOWN`;
        } else if (type === 'foreign-buy') {
            url = `${API.FOREIGN_FLOW}?type=buy`;
        }

        const response = await fetch(url);
        const result = await response.json();
        const data = (result.Data || []).slice(0, 6);

        if (data.length === 0) {
            container.innerHTML = '<div class="loading">Không có dữ liệu</div>';
            return;
        }

        const isForeign = type === 'foreign-buy';
        container.innerHTML = data.map(item => {
            const percent = item.ChangePricePercent;
            const isUp = type === 'gainers' || (type === 'foreign-buy');
            const changeClass = type === 'losers' ? 'negative' : 'positive';
            const changeText = isForeign
                ? (Math.abs(item.Value) / 1e9).toFixed(1) + ' tỷ'
                : (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%';

            // Truncate company name to ~25 chars
            const companyName = item.CompanyName?.slice(0, 28) || item.Symbol;
            const companyNameDisplay = companyName.length >= 28 ? companyName + '...' : companyName;

            // Exchange mapping
            const exchange = item.Exchange || 'HOSE';

            return `
                <div class="mover-item" onclick="location.href='?symbol=${item.Symbol}'">
                    ${getStockLogoHtml(item.Symbol)}
                    <div class="mover-info">
                        <div class="mover-name">${companyNameDisplay}</div>
                        <div class="mover-symbol">${item.Symbol} · ${exchange}</div>
                    </div>
                    <div class="mover-price-info">
                        <div class="mover-price">${item.CurrentPrice?.toLocaleString('vi-VN')}</div>
                        <div class="mover-change ${changeClass}">${changeText}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading top movers:', error);
        container.innerHTML = '<div class="loading">Lỗi tải dữ liệu</div>';
    }
}

function setupMoverTabs() {
    document.querySelectorAll('.mover-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.mover-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadTopMovers(this.dataset.type);
        });
    });
}

// ============ LOTTERY LOGIC ============
const PROVINCES = {
    mn: [
        { name: "TP Hồ Chí Minh", slug: "tp-ho-chi-minh" },
        { name: "Đồng Tháp", slug: "dong-thap" },
        { name: "Cà Mau", slug: "ca-mau" },
        { name: "Bến Tre", slug: "ben-tre" },
        { name: "Vũng Tàu", slug: "vung-tau" },
        { name: "Bạc Liêu", slug: "bac-lieu" },
        { name: "Đồng Nai", slug: "dong-nai" },
        { name: "Cần Thơ", slug: "can-tho" },
        { name: "Sóc Trăng", slug: "soc-trang" },
        { name: "Tây Ninh", slug: "tay-ninh" },
        { name: "An Giang", slug: "an-giang" },
        { name: "Bình Thuận", slug: "binh-thuan" },
        { name: "Vĩnh Long", slug: "vinh-long" },
        { name: "Bình Dương", slug: "binh-duong" },
        { name: "Trà Vinh", slug: "tra-vinh" },
        { name: "Long An", slug: "long-an" },
        { name: "Bình Phước", slug: "binh-phuoc" },
        { name: "Hậu Giang", slug: "hau-giang" },
        { name: "Tiền Giang", slug: "tien-giang" },
        { name: "Kiên Giang", slug: "kien-giang" },
        { name: "Đà Lạt", slug: "da-lat" }
    ],
    mt: [
        { name: "Thừa Thiên Huế", slug: "thua-thien-hue" },
        { name: "Phú Yên", slug: "phu-yen" },
        { name: "Đắk Lắk", slug: "dac-lac" },
        { name: "Quảng Nam", slug: "quang-nam" },
        { name: "Đà Nẵng", slug: "da-nang" },
        { name: "Khánh Hòa", slug: "khanh-hoa" },
        { name: "Bình Định", slug: "binh-dinh" },
        { name: "Quảng Trị", slug: "quang-tri" },
        { name: "Quảng Bình", slug: "quang-binh" },
        { name: "Gia Lai", slug: "gia-lai" },
        { name: "Ninh Thuận", slug: "ninh-thuan" },
        { name: "Quảng Ngãi", slug: "quang-ngai" },
        { name: "Đắk Nông", slug: "dac-nong" },
        { name: "Kon Tum", slug: "kon-tum" }
    ],
    mb: [
        { name: "Hà Nội", slug: "ha-noi" },
        { name: "Quảng Ninh", slug: "quang-ninh" },
        { name: "Bắc Ninh", slug: "bac-ninh" },
        { name: "Hải Phòng", slug: "hai-phong" },
        { name: "Nam Định", slug: "nam-dinh" },
        { name: "Thái Bình", slug: "thai-binh" }
    ]
};

function setupLotteryTabs() {
    // Simplified Lottery Logic: Just 3 Regions via Tabs
    const tabs = document.querySelectorAll('.lottery-tab');
    const container = document.getElementById('lottery-container');
    const dateDisplay = document.getElementById('lottery-display-date');

    if (!container || !tabs.length) return;

    async function loadLottery(region, silent = false) {
        // Update Active Tab
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.region === region);
            // Cleanup inline styles to let CSS take over
            t.style.background = '';
            t.style.color = '';
        });

        if (!silent) {
            container.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải dữ liệu xổ số...</div>';
        }
        try {
            const resp = await fetch(`${API_BASE}/market/lottery?region=${region}`);
            const data = await resp.json();

            if (data.pubDate && dateDisplay) {
                const dateParts = data.pubDate.split(' ');
                if (dateParts[0]) dateDisplay.textContent = `📅 ${dateParts[0]}`;
            }

            renderLotteryTable(data, region);
        } catch (e) {
            console.error(e);
            if (!silent) {
                container.innerHTML = '<div class="error" style="text-align: center; color: red; padding: 20px;">Lỗi tải dữ liệu xổ số</div>';
            }
        }
    }

    // Expose refresh function globally
    window.refreshLottery = (silent = false) => {
        const activeTab = document.querySelector('.lottery-tab.active');
        if (activeTab) {
            loadLottery(activeTab.dataset.region, silent);
        }
    };

    function renderLotteryTable(data, region) {
        if (!data.results) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">Chưa có dữ liệu</div>';
            return;
        }

        let html = '<div class="lottery-table-container" style="overflow-x: auto;">';

        if (region === 'mb') {
            const res = data.results;
            html += `<table style="width:100%; font-size: 13px; border-collapse: collapse; text-align: center;">
                <tr style="background:#f0f0f0; font-weight:bold;"><td style="padding:8px; border:1px solid #ddd; width: 80px;">G.ĐB</td><td style="padding:8px; border:1px solid #ddd; color: #ef4444; font-size: 16px; font-weight: 700;">${(res.DB || ['...']).join(' ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.1</td><td style="padding:8px; border:1px solid #ddd;">${(res.G1 || []).join(' ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.2</td><td style="padding:8px; border:1px solid #ddd;">${(res.G2 || []).join(' - ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.3</td><td style="padding:8px; border:1px solid #ddd;">${(res.G3 || []).join('<br>')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.4</td><td style="padding:8px; border:1px solid #ddd;">${(res.G4 || []).join(' - ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.5</td><td style="padding:8px; border:1px solid #ddd;">${(res.G5 || []).join(' - ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.6</td><td style="padding:8px; border:1px solid #ddd;">${(res.G6 || []).join(' - ')}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;">G.7</td><td style="padding:8px; border:1px solid #ddd;">${(res.G7 || []).join(' - ')}</td></tr>
            </table>`;
        } else {
            // MN/MT Render - Always show FULL MATRIX
            const displayProvinces = data.results.provinces || [];

            if (displayProvinces.length === 0) {
                container.innerHTML = '<div style="padding:20px; text-align:center;">Chưa có dữ liệu hôm nay</div>';
                return;
            }

            const prizesOrder = ['G8', 'G7', 'G6', 'G5', 'G4', 'G3', 'G2', 'G1', 'DB'];
            html += `<table style="width:100%; font-size: 13px; border-collapse: collapse; text-align: center;">
                <thead>
                    <tr style="background:#f0f0f0;">
                       <th style="padding:8px; border:1px solid #ddd; width: 40px; position: sticky; left: 0; background: #e5e7eb; z-index: 10;">Giải</th>
                       ${displayProvinces.map(p => `<th style="padding:8px; border:1px solid #ddd; min-width: 90px;">${p.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>`;

            prizesOrder.forEach((prize, index) => {
                const bg = index % 2 === 0 ? '#fff' : '#f9f9f9';
                const stickyBg = index % 2 === 0 ? '#fff' : '#f9f9f9';
                html += `<tr style="background: ${bg};">
                    <td style="padding:8px; border:1px solid #ddd; font-weight: bold; position: sticky; left: 0; background: ${stickyBg}; z-index: 5; box-shadow: 1px 0 2px rgba(0,0,0,0.1);">${prize}</td>
                    ${displayProvinces.map(p => {
                    const val = p.prizes[prize] || [];
                    const cellStyle = prize === 'DB' ? 'color: #ef4444; font-weight: 700;' : '';
                    return `<td style="padding:8px; border:1px solid #ddd; ${cellStyle}">${val.join('<br>')}</td>`;
                }).join('')}
                 </tr>`;
            });
            html += `</tbody></table>`;
        }

        if (data.pubDate) {
            const dateParts = data.pubDate.split(' ');
            const dateStr = dateParts[0] || data.pubDate;
            html += `<div style="margin-top: 8px; text-align: center; font-size: 11px; color: #9ca3af; font-style: italic;">Kết quả ngày: ${dateStr}</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const r = tab.dataset.region;
            loadLottery(r);
        });
    });

    // Initial Load
    loadLottery('mb');
}


// ============ FOREIGN FLOWS ============
async function loadForeignFlows(type) {
    const container = document.getElementById('foreign-list');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';

    try {
        const apiType = type === 'foreign-buy' ? 'buy' : 'sell';
        const url = `${API.FOREIGN_FLOW}?type=${apiType}`;

        const response = await fetch(url);
        const result = await response.json();
        const data = (result.Data || []).slice(0, 5); // Top 5

        if (data.length === 0) {
            container.innerHTML = '<div class="loading">Không có dữ liệu</div>';
            return;
        }

        container.innerHTML = data.map(item => {
            const valueDisplay = (item.Value / 1e9).toFixed(1) + ' tỷ';
            const isBuy = type === 'foreign-buy';

            // Truncate company name
            const companyName = item.CompanyName?.slice(0, 28) || item.Symbol;
            const companyNameDisplay = companyName.length >= 28 ? companyName + '...' : companyName;

            const exchange = item.Exchange || 'HOSE';
            const iconBg = isBuy ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
            const iconColor = isBuy ? '#059669' : '#dc2626';

            return `
                <div class="mover-item" onclick="location.href='?symbol=${item.Symbol}'">
                    ${getStockLogoHtml(item.Symbol, iconBg, iconColor)}
                    <div class="mover-info">
                        <div class="mover-name">${companyNameDisplay}</div>
                        <div class="mover-symbol">${item.Symbol} · ${exchange}</div>
                    </div>
                    <div class="mover-price-info">
                        <div class="mover-price">${item.CurrentPrice?.toLocaleString('vi-VN')}</div>
                        <div class="mover-change ${isBuy ? 'positive' : 'negative'}">${valueDisplay}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading foreign flows:', error);
        container.innerHTML = '<div class="loading">Lỗi tải dữ liệu</div>';
    }
}

function setupForeignTabs() {
    document.querySelectorAll('.foreign-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.foreign-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadForeignFlows(this.dataset.type);
        });
    });
    // Initial load
    loadForeignFlows('foreign-buy');
}

// ============ P/E CHART & TIME RANGE ============
let fullPEData = [];
let peChart = null;

async function loadPEChart() {
    try {
        const response = await fetch(API.PE_CHART);
        const result = await response.json();

        if (result.Data && result.Data.DataChart) {
            // Parse data from CafeF structure
            fullPEData = result.Data.DataChart.map(p => ({
                date: new Date(p.TimeStamp * 1000),
                index: p.Index,
                pe: p.Pe,
                vnindex: p.Index // Map Index to vnindex for compatibility
            })).reverse();

            // Ensure ascending order (old -> new) for Chart.js
            if (fullPEData.length > 1 && fullPEData[0].date > fullPEData[1].date) {
                fullPEData.reverse();
            }

            // Update latest values (last item in array)
            const latest = fullPEData[fullPEData.length - 1];
            const peValueEl = document.getElementById('pe-value');
            const vnindexPeEl = document.getElementById('vnindex-pe');

            if (peValueEl) peValueEl.textContent = latest.pe.toFixed(2);
            if (vnindexPeEl) vnindexPeEl.textContent = latest.vnindex.toLocaleString('vi-VN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            // Default to 1 Year (12 months)
            updatePEChart(12);
        }
    } catch (error) {
        console.error('Error loading P/E chart:', error);
    }
}

function setupTimeRangeButtons() {
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updatePEChart(parseInt(this.dataset.months));
        });
    });
}

function updatePEChart(months) {
    const canvas = document.getElementById('pe-main-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let filteredData = fullPEData;
    if (months > 0) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        filteredData = fullPEData.filter(d => d.date >= cutoffDate);
    }

    if (peChart) {
        peChart.destroy();
    }

    const isMobile = window.innerWidth < 768;

    peChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: filteredData.map(d => d.date.toLocaleDateString('vi-VN')),
            datasets: [
                {
                    label: 'P/E',
                    data: filteredData.map(d => d.pe),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.1,
                    yAxisID: 'y',
                    fill: true
                },
                {
                    label: 'VN-Index',
                    data: filteredData.map(d => d.vnindex),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.1,
                    yAxisID: 'y1',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1a1a1a',
                    bodyColor: '#666',
                    borderColor: '#e5e5e5',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
                            }
                            return label;
                        }
                    }
                }
            },
            layout: {
                padding: {
                    bottom: 10
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: isMobile ? 4 : 8,
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: isMobile ? 10 : 12
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { borderDash: [4, 4], color: '#f0f0f0' },
                    title: { display: false }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { display: false },
                    title: { display: false }
                }
            }
        }
    });
}

// ========== TICKER AUTOCOMPLETE FOR NAVIGATION ==========
class OverviewAutocomplete {
    constructor(inputElement) {
        this.input = inputElement;
        this.tickers = [];
        this.dropdown = null;
        this.selectedIndex = -1;
        this.init();
    }

    async init() {
        this.createDropdown();
        await this.loadTickerData();
        this.setupEventListeners();
    }

    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'ticker-dropdown';
        this.dropdown.style.display = 'none';
        const container = this.input.closest('.search-container-v2') || this.input.closest('.header-search-form') || this.input.parentElement;
        if (container) {
            container.style.position = 'relative';
            container.appendChild(this.dropdown);
        }
    }

    async loadTickerData() {
        try {
            const response = await fetch('ticker_data.json');
            if (response.ok) {
                const data = await response.json();
                this.tickers = data.tickers || [];
                console.log(`📋 Loaded ${this.tickers.length} tickers for overview autocomplete`);
            }
        } catch (error) {
            console.error('Failed to load ticker data:', error);
        }
    }

    setupEventListeners() {
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('focus', (e) => this.handleInput(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.input.addEventListener('blur', () => setTimeout(() => this.close(), 200));
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        });
    }

    handleInput(e) {
        const query = this.input.value.trim();
        if (query.length < 1) {
            this.close();
            return;
        }
        const results = this.search(query);
        this.render(results);
    }

    handleKeydown(e) {
        const items = this.dropdown.querySelectorAll('.ticker-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection(items);
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                e.preventDefault();
                this.selectItem(items[this.selectedIndex].dataset.symbol);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
            if (index === this.selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    search(query) {
        const q = query.toUpperCase();
        const ql = query.toLowerCase();
        return this.tickers
            .map(t => {
                let score = 0;
                const sym = t.symbol.toUpperCase();
                const name = (t.name || '').toLowerCase();
                if (sym === q) score = 1000;
                else if (sym.startsWith(q)) score = 500;
                else if (sym.includes(q)) score = 200;
                else if (name.includes(ql)) score = 100;
                return { ...t, score };
            })
            .filter(t => t.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    render(results) {
        if (!results.length) {
            this.close();
            return;
        }
        const query = this.input.value.trim().toUpperCase();
        this.dropdown.innerHTML = results.map((t, i) => `
            <div class="ticker-item ${i === this.selectedIndex ? 'selected' : ''}" data-symbol="${t.symbol}">
                <div class="ticker-item-left">
                    <span class="ticker-symbol">${this.highlight(t.symbol, query)}</span>
                    <span class="ticker-exchange">${t.exchange || ''}</span>
                </div>
                <div class="ticker-item-right">
                    <span class="ticker-name">${t.name || ''}</span>
                    ${t.sector ? `<span class="ticker-sector">${t.sector}</span>` : ''}
                </div>
            </div>
        `).join('');

        this.dropdown.querySelectorAll('.ticker-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.background = '#f9fafb');
            item.addEventListener('mouseleave', () => item.style.background = '');
            item.addEventListener('click', () => this.selectItem(item.dataset.symbol));
        });

        this.dropdown.style.display = 'block';
        this.selectedIndex = -1;
    }

    highlight(text, query) {
        const idx = text.toUpperCase().indexOf(query);
        if (idx === -1) return text;
        return text.slice(0, idx) + '<mark style="background: #d1fae5; padding: 0 2px; border-radius: 2px;">' + text.slice(idx, idx + query.length) + '</mark>' + text.slice(idx + query.length);
    }

    selectItem(symbol) {
        this.close();
        // Navigate to valuation page with the selected symbol
        window.location.href = `?symbol=${symbol}`;
    }

    close() {
        this.dropdown.style.display = 'none';
        this.selectedIndex = -1;
    }
}

// Initialize autocomplete for overview page
const symbolSearchInput = document.getElementById('symbol-search');
if (symbolSearchInput) {
    new OverviewAutocomplete(symbolSearchInput);
}

// ============ GOLD PRICE MANAGEMENT ============
async function loadGoldPrice(retryCount = 0) {
    const MAX_RETRIES = 3;
    const container = document.getElementById('gold-price-list');
    if (!container) return;

    // Show loading on first attempt only
    if (retryCount === 0) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';
    }

    try {
        const response = await fetch(API.GOLD);
        const result = await response.json();

        // Handle result format { data: [...], updated_at: "..." } from backend
        let goldData = [];
        let updatedAt = '';

        if (result.data && Array.isArray(result.data)) {
            goldData = result.data;
            updatedAt = result.updated_at || '';
        } else if (Array.isArray(result)) {
            goldData = result;
        }

        if (!goldData || goldData.length === 0) {
            // Retry up to MAX_RETRIES times if no data
            if (retryCount < MAX_RETRIES) {
                console.log(`⏳ Giá vàng trống, thử lại lần ${retryCount + 1}/${MAX_RETRIES}...`);
                container.innerHTML = `<div class="loading"><div class="spinner"></div>Đang thử lại (${retryCount + 1}/${MAX_RETRIES})...</div>`;
                await new Promise(resolve => setTimeout(resolve, 1000));
                return loadGoldPrice(retryCount + 1);
            }
            container.innerHTML = '<div class="loading">Không có dữ liệu vàng</div>';
            return;
        }

        // Render gold items directly (backend already filtered)
        renderGoldItems(container, goldData, updatedAt);

    } catch (error) {
        console.error('Error loading gold price:', error);
        // Retry on network errors too
        if (retryCount < MAX_RETRIES) {
            console.log(`⏳ Lỗi tải giá vàng, thử lại lần ${retryCount + 1}/${MAX_RETRIES}...`);
            container.innerHTML = `<div class="loading"><div class="spinner"></div>Đang thử lại (${retryCount + 1}/${MAX_RETRIES})...</div>`;
            await new Promise(resolve => setTimeout(resolve, 1000));
            return loadGoldPrice(retryCount + 1);
        }
        container.innerHTML = '<div class="loading">Lỗi tải giá vàng</div>';
    }
}

function renderGoldItems(container, items, updatedAt = '') {
    let html = items.map(item => {
        const buy = item.Buy;
        const sell = item.Sell;
        const name = item.TypeName || 'Vàng';

        return `
            <div class="mover-item" style="cursor: default;">
                <div class="stock-logo-wrapper" style="width: 32px; height: 32px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border-radius: 50%;">
                    Au
                </div>
                <div class="mover-info">
                    <div class="mover-name" style="font-weight: 600; color: #4b5563;">${name}</div>
                    <div class="mover-symbol" style="font-size: 11px; color: #9ca3af;">${item.BranchName}</div>
                </div>
                <div class="mover-price-info" style="align-items: flex-end; font-family: 'Inter', sans-serif;">
                    <div class="mover-price" style="font-size: 12px; color: #6b7280;">Mua: <span style="color: #059669; font-weight: 600;">${buy}</span></div>
                    <div class="mover-price" style="font-size: 12px; color: #6b7280;">Bán: <span style="color: #dc2626; font-weight: 600;">${sell}</span></div>
                </div>
            </div>
        `;
    }).join('');

    // Add update time footer
    if (updatedAt) {
        html += `<div style="text-align: center; font-size: 10px; color: #9ca3af; margin-top: 8px; font-style: italic;">Cập nhật: ${updatedAt} (BTMC)</div>`;
    }

    container.innerHTML = html;
}

// Initialize Gold Price on page load
document.addEventListener('DOMContentLoaded', function () {
    loadGoldPrice();

    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadGoldPrice();
    }, 30000);
});
