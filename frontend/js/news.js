class NewsManager {
    constructor(baseUrl) {
        this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
        this.newsContainer = document.getElementById('news-list');
        this.eventsContainer = document.getElementById('events-list');
    }

    async updateNews(symbol) {
        if (!this.newsContainer) return;

        this.newsContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const response = await fetch(`${this.baseUrl}/api/news/${symbol}`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.renderNews(result.data);
            } else {
                this.newsContainer.innerHTML = '<div class="no-data">No news available</div>';
            }
        } catch (error) {
            console.error('Error fetching news:', error);
            this.newsContainer.innerHTML = '<div class="error">Failed to load news</div>';
        }
    }

    async updateEvents(symbol) {
        if (!this.eventsContainer) return;

        this.eventsContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const response = await fetch(`${this.baseUrl}/api/events/${symbol}`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.renderEvents(result.data);
            } else {
                this.eventsContainer.innerHTML = '<div class="no-data">No events available</div>';
            }
        } catch (error) {
            console.error('Error fetching events:', error);
            this.eventsContainer.innerHTML = '<div class="error">Failed to load events</div>';
        }
    }

    renderNews(newsItems) {
        this.newsContainer.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'news-list-items';

        newsItems.forEach(item => {
            const newsItem = document.createElement('div');
            newsItem.className = 'news-item';

            // Format date if available
            let dateStr = '';
            if (item.publish_date) {
                dateStr = new Date(item.publish_date).toLocaleDateString('vi-VN');
            }

            newsItem.innerHTML = `
                <div class="news-content">
                    <a href="${item.url || '#'}" target="_blank" class="news-title">${item.title}</a>
                    <div class="news-meta">
                        <span class="news-date">${dateStr}</span>
                        <span class="news-source">${item.source || 'N/A'}</span>
                    </div>
                </div>
            `;
            list.appendChild(newsItem);
        });

        this.newsContainer.appendChild(list);
    }

    renderEvents(eventsItems) {
        this.eventsContainer.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'events-list-items';

        eventsItems.forEach(item => {
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';

            // Format date
            let dateStr = '';
            if (item.notify_date) {
                let d = new Date(item.notify_date);
                if (isNaN(d.getTime())) {
                    // Try parsing manual format if needed, or leave as string
                    dateStr = item.notify_date;
                } else {
                    dateStr = d.toLocaleDateString('vi-VN');
                }
            }

            const titleHtml = item.url && item.url !== '#'
                ? `<a href="${item.url}" target="_blank" class="event-title-link">${item.event_desc || item.event_name}</a>`
                : `<div class="event-title">${item.event_desc || item.event_name}</div>`;

            eventItem.innerHTML = `
                <div class="event-content">
                    ${titleHtml}
                    <div class="event-meta">
                        <span class="event-date">${dateStr}</span>
                        <span class="event-type">${item.event_code || 'Event'}</span>
                    </div>
                </div>
            `;
            list.appendChild(eventItem);
        });

        this.eventsContainer.appendChild(list);
    }
}
