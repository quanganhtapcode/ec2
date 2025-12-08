class HistoryManager {
    constructor(baseUrl) {
        this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
        this.tableBody = document.querySelector('#history-table tbody');
        this.downloadBtn = document.getElementById('download-history-btn');
        this.currentSymbol = null;
        this.data = [];
        this.currentRange = '1Y'; // Default range

        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadExcel());
        }

        // Setup range buttons
        const rangeBtns = document.querySelectorAll('[data-history-range]');
        rangeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.currentTarget.dataset.historyRange;
                this.handleRangeChange(range);
            });
        });
    }

    handleRangeChange(range) {
        if (range === this.currentRange) return;

        this.currentRange = range;

        // Update UI
        document.querySelectorAll('[data-history-range]').forEach(btn => {
            if (btn.dataset.historyRange === range) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reload data if symbol exists
        if (this.currentSymbol) {
            this.updateHistory(this.currentSymbol);
        }
    }

    getDateRange(range) {
        const end = new Date();
        const start = new Date();

        switch (range) {
            case '1M':
                start.setMonth(end.getMonth() - 1);
                break;
            case '3M':
                start.setMonth(end.getMonth() - 3);
                break;
            case '6M':
                start.setMonth(end.getMonth() - 6);
                break;
            case '1Y':
                start.setFullYear(end.getFullYear() - 1);
                break;
            case '2Y':
                start.setFullYear(end.getFullYear() - 2);
                break;
            case '5Y':
                start.setFullYear(end.getFullYear() - 5);
                break;
            case 'All':
                start.setFullYear(end.getFullYear() - 20); // Effective "All"
                break;
            default: // 1Y default
                start.setFullYear(end.getFullYear() - 1);
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    async updateHistory(symbol) {
        this.currentSymbol = symbol;
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

        const { start, end } = this.getDateRange(this.currentRange);

        try {
            const response = await fetch(`${this.baseUrl}/api/history/${symbol}?start=${start}&end=${end}`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.data = result.data;
                this.renderTable(result.data);
            } else {
                this.tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No historical data available</td></tr>';
                this.data = [];
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            this.tableBody.innerHTML = '<tr><td colspan="6" class="text-center error-text">Failed to load history</td></tr>';
        }
    }

    renderTable(data) {
        this.tableBody.innerHTML = '';

        // Data usually comes sorted earliest first or latest first. Let's ensure latest first.
        // Assuming data has 'time' or similar field.
        // vnstock history 'time' is usually YYYY-MM-DD string or object

        const sortedData = [...data].sort((a, b) => {
            const dateA = new Date(a.time || a.date || a.Date);
            const dateB = new Date(b.time || b.date || b.Date);
            return dateB - dateA; // Descending
        });

        sortedData.forEach(row => {
            const tr = document.createElement('tr');

            // Map fields based on common VNStock return format
            // time, open, high, low, close, volume
            const date = row.time || row.date || row.Date || '--';
            const open = this.formatNumber(row.open || row.Open);
            const high = this.formatNumber(row.high || row.High);
            const low = this.formatNumber(row.low || row.Low);
            const close = this.formatNumber(row.close || row.Close);
            const volume = this.formatVolume(row.volume || row.Volume);

            tr.innerHTML = `
                <td>${date}</td>
                <td>${open}</td>
                <td>${high}</td>
                <td>${low}</td>
                <td>${close}</td>
                <td>${volume}</td>
            `;
            this.tableBody.appendChild(tr);
        });
    }

    formatNumber(val) {
        if (!val) return '-';
        return new Intl.NumberFormat('en-US').format(val);
    }

    formatVolume(val) {
        if (!val) return '-';
        return new Intl.NumberFormat('en-US').format(val);
    }

    downloadExcel() {
        if (!this.data || this.data.length === 0) {
            alert('No data to download');
            return;
        }

        // Simple CSV export
        const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
        const csvContent = [
            headers.join(','),
            ...this.data.map(row => {
                const date = row.time || row.date || row.Date || '';
                const open = row.open || row.Open || '';
                const high = row.high || row.High || '';
                const low = row.low || row.Low || '';
                const close = row.close || row.Close || '';
                const volume = row.volume || row.Volume || '';
                return `${date},${open},${high},${low},${close},${volume}`;
            })
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.currentSymbol}_history_${this.currentRange}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
