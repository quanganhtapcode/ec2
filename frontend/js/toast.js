/**
 * Toast Notification System
 * A premium centered toast notification module
 * 
 * Usage:
 *   Toast.show('Loading data...', 'loading');
 *   Toast.show('Success!', 'success');
 *   Toast.show('Error occurred', 'error');
 *   Toast.show('Warning message', 'warning');
 *   Toast.show('Info message', 'info');
 *   Toast.hide();
 */

const Toast = (function () {
    let container = null;
    let toast = null;
    let hideTimer = null;

    // SVG icons for each type
    const icons = {
        loading: '<div class="toast-spinner"></div>',
        success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    // Auto-hide delays (in ms)
    const autoHideDelays = {
        loading: 0,      // Never auto-hide loading
        success: 3000,
        error: 5000,
        warning: 4000,
        info: 3000
    };

    /**
     * Initialize the toast container and element
     */
    function init() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.className = 'toast';
            container.appendChild(toast);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of toast: 'loading', 'success', 'error', 'warning', 'info'
     */
    function show(message, type = 'info') {
        init();

        // Clear any existing hide timer
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }

        // Get icon for this type
        const icon = icons[type] || icons.info;

        // Update content
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <span class="toast-message">${message}</span>
        `;

        // Update classes
        toast.className = `toast toast-${type} toast-visible`;

        // Set auto-hide timer for non-loading types
        const delay = autoHideDelays[type];
        if (delay > 0) {
            hideTimer = setTimeout(() => {
                hide();
            }, delay);
        }
    }

    /**
     * Hide the current toast
     */
    function hide() {
        if (toast) {
            toast.classList.remove('toast-visible');
            toast.classList.add('toast-hidden');
        }

        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    /**
     * Show loading toast (convenience method)
     * @param {string} message - Loading message
     */
    function loading(message = 'Loading...') {
        show(message, 'loading');
    }

    /**
     * Show success toast (convenience method)
     * @param {string} message - Success message
     */
    function success(message) {
        show(message, 'success');
    }

    /**
     * Show error toast (convenience method)
     * @param {string} message - Error message
     */
    function error(message) {
        show(message, 'error');
    }

    /**
     * Show warning toast (convenience method)
     * @param {string} message - Warning message
     */
    function warning(message) {
        show(message, 'warning');
    }

    /**
     * Show info toast (convenience method)
     * @param {string} message - Info message
     */
    function info(message) {
        show(message, 'info');
    }

    // Public API
    return {
        show,
        hide,
        loading,
        success,
        error,
        warning,
        info
    };
})();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toast;
}
