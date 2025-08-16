// ==================== MESSAGES PAGE LOGIC ====================

let currentMessages = [];
let filteredMessages = [];
let currentPage = 1;
const messagesPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    loadMessages();
    updateStats();
});

/**
 * Initialize the messages page
 */
function initializePage() {
    applySettings();
    showToast('Messages page loaded', 'info', 1500);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Export and clear buttons
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPDF);
    document.getElementById('clearAllBtn')?.addEventListener('click', handleClearAll);
    
    // Search and filters
    document.getElementById('searchInput')?.addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('filterSelect')?.addEventListener('change', handleFilter);
    document.getElementById('sortSelect')?.addEventListener('change', handleSort);
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
}

/**
 * Load and display messages
 */
function loadMessages() {
    currentMessages = getAllMessages();
    filteredMessages = [...currentMessages];
    
    // Apply current filters and sorting
    applyFiltersAndSort();
    displayMessages();
    updatePagination();
}

/**
 * Apply filters and sorting to messages
 */
function applyFiltersAndSort() {
    const searchQuery = document.getElementById('searchInput')?.value || '';
    const filterType = document.getElementById('filterSelect')?.value || 'all';
    const sortType = document.getElementById('sortSelect')?.value || 'newest';
    
    // Apply search filter
    let filtered = [...currentMessages];
    
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(msg => 
            msg.text.toLowerCase().includes(query) ||
            (msg.originalText && msg.originalText.toLowerCase().includes(query))
        );
    }
    
    // Apply type filter
    if (filterType === 'original') {
        filtered = filtered.filter(msg => !msg.translated);
    } else if (filterType === 'translated') {
        filtered = filtered.filter(msg => msg.translated);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        switch (sortType) {
            case 'oldest':
                return a.timestamp - b.timestamp;
            case 'longest':
                return (b.stats?.characters || 0) - (a.stats?.characters || 0);
            case 'shortest':
                return (a.stats?.characters || 0) - (b.stats?.characters || 0);
            case 'newest':
            default:
                return b.timestamp - a.timestamp;
        }
    });
    
    filteredMessages = filtered;
    currentPage = 1; // Reset to first page
}

/**
 * Display messages for current page
 */
function displayMessages() {
    const container = document.getElementById('messagesList');
    if (!container) return;
    
    if (filteredMessages.length === 0) {
        container.innerHTML = `
            <div class="empty-state" id="emptyState">
                <div class="empty-icon">📭</div>
                <h3>No messages found</h3>
                <p>${currentMessages.length === 0 ? 'No messages saved yet. Start communicating to see messages here!' : 'Try adjusting your search or filters.'}</p>
                <a href="communication.html" class="btn btn-primary">Start Communication</a>
            </div>
        `;
        updateMessageCount();
        return;
    }
    
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    const pageMessages = filteredMessages.slice(startIndex, endIndex);
    
    const messagesHTML = pageMessages.map(msg => createMessageHTML(msg)).join('');
    container.innerHTML = messagesHTML;
    
    // Update message count
    updateMessageCount();
}

/**
 * Create HTML for a single message
 * @param {Object} message - Message object
 * @returns {string} - HTML string
 */
function createMessageHTML(message) {
    const wordCount = message.stats?.words || 0;
    const charCount = message.stats?.characters || 0;
    const isTranslated = message.translated;
    const languageFlag = getLanguageFlag(message.language);
    const formattedDate = formatMessageDate(message.timestamp);
    
    return `
        <div class="message-item" data-id="${message.id}">
            <div class="message-content">
                ${escapeHtml(message.text)}
            </div>
            <div class="message-meta">
                <div class="message-info">
                    ${isTranslated ? `<span class="translation-badge">${languageFlag} Translated</span>` : ''}
                    <span class="message-time">${formattedDate}</span>
                    <span class="message-stats">${wordCount} words • ${charCount} chars</span>
                </div>
                <div class="message-actions">
                    <button class="btn btn-sm btn-secondary" onclick="speakMessage('${message.id}')">
                        🔊 Speak
                    </button>
                    <button class="btn btn-sm btn-info" onclick="copyMessage('${message.id}')">
                        📋 Copy
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteMessage('${message.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format message date
 */
function formatMessageDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (error) {
        return 'Invalid date';
    }
}

/**
 * Get language flag emoji
 * @param {string} language - Language code
 * @returns {string} - Flag emoji
 */
function getLanguageFlag(language) {
    const flags = {
        'en': '🇺🇸',
        'bn': '🇧🇩',
        'hi': '🇮🇳',
        'ur': '🇵🇰',
        'es': '🇪🇸',
        'fr': '🇫🇷',
        'de': '🇩🇪',
        'zh': '🇨🇳',
        'ja': '🇯🇵',
        'ar': '🇸🇦'
    };
    return flags[language] || '🌐';
}

/**
 * Update message count display
 */
function updateMessageCount() {
    const showingCountEl = document.getElementById('showingCount');
    const totalCountEl = document.getElementById('totalCount');
    const currentPageEl = document.getElementById('currentPage');
    
    if (showingCountEl) {
        const startIndex = (currentPage - 1) * messagesPerPage;
        const endIndex = Math.min(startIndex + messagesPerPage, filteredMessages.length);
        const showing = Math.max(0, endIndex - startIndex);
        showingCountEl.textContent = showing;
    }
    
    if (totalCountEl) {
        totalCountEl.textContent = filteredMessages.length;
    }
    
    if (currentPageEl) {
        const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
        currentPageEl.textContent = `${currentPage} of ${Math.max(1, totalPages)}`;
    }
}

/**
 * Update statistics display
 */
function updateStats() {
    const messages = getAllMessages();
    
    // Update main stats
    const totalMessagesEl = document.getElementById('totalMessages');
    const translatedCountEl = document.getElementById('translatedCount');
    const totalWordsEl = document.getElementById('totalWords');
    
    if (totalMessagesEl) totalMessagesEl.textContent = messages.length;
    
    if (translatedCountEl) {
        const translatedCount = messages.filter(m => m.translated).length;
        translatedCountEl.textContent = translatedCount;
    }
    
    if (totalWordsEl) {
        const totalWords = messages.reduce((sum, msg) => sum + (msg.stats?.words || 0), 0);
        totalWordsEl.textContent = totalWords;
    }
}

/**
 * Update pagination controls
 */
function updatePagination() {
    const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
    
    updateMessageCount();
}

/**
 * Handle search input
 */
function handleSearch() {
    applyFiltersAndSort();
    displayMessages();
    updatePagination();
}

/**
 * Handle filter change
 */
function handleFilter() {
    applyFiltersAndSort();
    displayMessages();
    updatePagination();
}

/**
 * Handle sort change
 */
function handleSort() {
    applyFiltersAndSort();
    displayMessages();
    updatePagination();
}

/**
 * Change page
 */
function changePage(delta) {
    const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayMessages();
        updatePagination();