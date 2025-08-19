// ==================== MESSAGES PAGE LOGIC - FIXED ====================

let currentMessages = [];
let filteredMessages = [];
let currentPage = 1;
const messagesPerPage = 10;

// UI elements
let messagesList, emptyState, pagination;
let searchInput, filterSelect, sortSelect;
let showingCount, totalCount, currentPageEl, totalPagesEl;
let totalMessagesEl, translatedCountEl, totalWordsEl;
let exportPdfBtn, clearAllBtn, prevPageBtn, nextPageBtn;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage.js to load completely
    setTimeout(() => {
        initializeMessagesPage();
        loadMessages();
        setupEventListeners();
    }, 200);
});

/**
 * Initialize the messages page
 */
function initializeMessagesPage() {
    try {
        // Add enhanced button styles first
        addMessageButtonStyles();
        
        // Get UI elements
        messagesList = document.getElementById('messagesList');
        emptyState = document.getElementById('emptyState');
        pagination = document.getElementById('pagination');
        
        // Search and filter elements
        searchInput = document.getElementById('searchInput');
        filterSelect = document.getElementById('filterSelect');
        sortSelect = document.getElementById('sortSelect');
        
        // Count elements
        showingCount = document.getElementById('showingCount');
        totalCount = document.getElementById('totalCount');
        currentPageEl = document.getElementById('currentPage');
        totalPagesEl = document.getElementById('totalPages');
        
        // Stats elements
        totalMessagesEl = document.getElementById('totalMessages');
        translatedCountEl = document.getElementById('translatedCount');
        totalWordsEl = document.getElementById('totalWords');
        
        // Action buttons
        exportPdfBtn = document.getElementById('exportPdfBtn');
        clearAllBtn = document.getElementById('clearAllBtn');
        prevPageBtn = document.getElementById('prevPage');
        nextPageBtn = document.getElementById('nextPage');
        
        console.log('Messages page initialized successfully');
        showToast('Messages page loaded', 'info', 2000);
    } catch (error) {
        console.error('Error initializing messages page:', error);
        showToast('Error loading messages page', 'error', 3000);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    try {
        // Search and filter listeners
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                currentPage = 1;
                filterAndDisplayMessages();
            }, 300));
        }
        
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                currentPage = 1;
                filterAndDisplayMessages();
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                currentPage = 1;
                filterAndDisplayMessages();
            });
        }
        
        // Pagination listeners
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    displayCurrentPage();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    displayCurrentPage();
                }
            });
        }
        
        // Action button listeners
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', exportMessagesToPDF);
        }
        
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', clearAllMessages);
        }
        
        console.log('Event listeners setup complete');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

/**
 * Load messages from storage
 */
function loadMessages() {
    try {
        // Get messages using the storage system
        if (typeof getAllMessages === 'function') {
            currentMessages = getAllMessages();
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem('eyeblink_messages_v2');
            currentMessages = stored ? JSON.parse(stored) : [];
        }
        
        console.log('Loaded messages:', currentMessages.length);
        
        // Initial filter and display
        filterAndDisplayMessages();
        updateStats();
        
    } catch (error) {
        console.error('Error loading messages:', error);
        currentMessages = [];
        showToast('Error loading messages', 'error', 3000);
        displayEmptyState();
    }
}

/**
 * Filter and display messages based on current filters
 */
function filterAndDisplayMessages() {
    try {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterValue = filterSelect ? filterSelect.value : 'all';
        const sortValue = sortSelect ? sortSelect.value : 'newest';
        
        // Start with all messages
        filteredMessages = [...currentMessages];
        
        // Apply text search
        if (searchTerm) {
            filteredMessages = filteredMessages.filter(msg => 
                (msg.text && msg.text.toLowerCase().includes(searchTerm)) ||
                (msg.originalText && msg.originalText.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply filter
        switch (filterValue) {
            case 'original':
                filteredMessages = filteredMessages.filter(msg => !msg.translated);
                break;
            case 'translated':
                filteredMessages = filteredMessages.filter(msg => msg.translated);
                break;
            // 'all' - no additional filtering
        }
        
        // Apply sorting
        switch (sortValue) {
            case 'newest':
                filteredMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                break;
            case 'oldest':
                filteredMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                break;
            case 'longest':
                filteredMessages.sort((a, b) => {
                    const aLen = (a.stats && a.stats.characters) || (a.text ? a.text.length : 0);
                    const bLen = (b.stats && b.stats.characters) || (b.text ? b.text.length : 0);
                    return bLen - aLen;
                });
                break;
            case 'shortest':
                filteredMessages.sort((a, b) => {
                    const aLen = (a.stats && a.stats.characters) || (a.text ? a.text.length : 0);
                    const bLen = (b.stats && b.stats.characters) || (b.text ? b.text.length : 0);
                    return aLen - bLen;
                });
                break;
        }
        
        // Reset to first page
        currentPage = 1;
        
        // Display results
        displayCurrentPage();
        updateCounts();
        
    } catch (error) {
        console.error('Error filtering messages:', error);
        showToast('Error filtering messages', 'error', 3000);
    }
}

/**
 * Display current page of messages
 */
function displayCurrentPage() {
    try {
        if (filteredMessages.length === 0) {
            displayEmptyState();
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
        const startIndex = (currentPage - 1) * messagesPerPage;
        const endIndex = Math.min(startIndex + messagesPerPage, filteredMessages.length);
        const pageMessages = filteredMessages.slice(startIndex, endIndex);
        
        // Hide empty state and show messages
        if (emptyState) emptyState.style.display = 'none';
        if (messagesList) {
            messagesList.style.display = 'block';
            messagesList.innerHTML = '';
            
            // Create message elements
            pageMessages.forEach(message => {
                const messageElement = createMessageElement(message);
                messagesList.appendChild(messageElement);
            });
        }
        
        // Update pagination
        updatePagination(totalPages);
        
        // Show pagination if needed
        if (pagination) {
            pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        }
        
    } catch (error) {
        console.error('Error displaying current page:', error);
        showToast('Error displaying messages', 'error', 3000);
    }
}

/**
 * Create a message element
 * @param {Object} message - Message data
 * @returns {HTMLElement} - Message element
 */
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.dataset.messageId = message.id || '';
    
    const date = message.date || (message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Unknown date');
    const stats = message.stats || { words: 0, characters: message.text ? message.text.length : 0 };
    const isTranslated = message.translated || false;
    const language = message.language || 'en';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <span class="message-date">📅 ${date}</span>
                <span class="message-stats">📊 ${stats.words || 0} words, ${stats.characters || 0} chars</span>
                ${isTranslated ? `<span class="message-language">🌐 ${language.toUpperCase()}</span>` : ''}
            </div>
            <div class="message-actions">
                <button class="message-btn message-btn-copy" onclick="copyMessage('${message.id}')" title="Copy Message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                </button>
                <button class="message-btn message-btn-edit" onclick="editMessage('${message.id}')" title="Edit Message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                </button>
                <button class="message-btn message-btn-delete" onclick="deleteMessage('${message.id}')" title="Delete Message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6V20a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6M8,6V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2V6"></path>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
        <div class="message-content">
            <div class="message-text">${escapeHtml(message.text || '')}</div>
            ${message.originalText && message.originalText !== message.text ? 
                `<div class="message-original">
                    <small><strong>Original:</strong> ${escapeHtml(message.originalText)}</small>
                </div>` : ''
            }
        </div>
    `;
    
    // Add the enhanced CSS styles for the buttons
    addMessageButtonStyles();
    
    return messageDiv;
}

/**
 * Display empty state
 */
function displayEmptyState() {
    if (messagesList) messagesList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (pagination) pagination.style.display = 'none';
    updateCounts();
}

/**
 * Update pagination controls
 * @param {number} totalPages - Total number of pages
 */
function updatePagination(totalPages) {
    // Update page info
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    
    // Update button states
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
}

/**
 * Update message counts display
 */
function updateCounts() {
    if (showingCount) {
        const startIndex = filteredMessages.length > 0 ? (currentPage - 1) * messagesPerPage + 1 : 0;
        const endIndex = Math.min(currentPage * messagesPerPage, filteredMessages.length);
        showingCount.textContent = filteredMessages.length > 0 ? 
            `${startIndex}-${endIndex}` : '0';
    }
    
    if (totalCount) {
        totalCount.textContent = filteredMessages.length;
    }
}

/**
 * Update statistics display
 */
function updateStats() {
    try {
        const total = currentMessages.length;
        const translated = currentMessages.filter(msg => msg.translated).length;
        const totalWords = currentMessages.reduce((sum, msg) => {
            return sum + ((msg.stats && msg.stats.words) || 0);
        }, 0);
        
        if (totalMessagesEl) totalMessagesEl.textContent = total;
        if (translatedCountEl) translatedCountEl.textContent = translated;
        if (totalWordsEl) totalWordsEl.textContent = totalWords;
        
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

/**
 * Copy message to clipboard
 * @param {string} messageId - Message ID
 */
function copyMessage(messageId) {
    try {
        const message = currentMessages.find(msg => msg.id === messageId);
        if (!message) {
            showToast('Message not found', 'error', 2000);
            return;
        }
        
        const textToCopy = message.text || '';
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Message copied to clipboard', 'success', 2000);
            }).catch(err => {
                console.error('Clipboard error:', err);
                fallbackCopyToClipboard(textToCopy);
            });
        } else {
            fallbackCopyToClipboard(textToCopy);
        }
        
    } catch (error) {
        console.error('Error copying message:', error);
        showToast('Error copying message', 'error', 2000);
    }
}

/**
 * Fallback copy to clipboard method
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Message copied to clipboard', 'success', 2000);
        } else {
            showToast('Copy failed', 'error', 2000);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showToast('Copy not supported', 'error', 2000);
    }
    
    document.body.removeChild(textArea);
}

/**
 * Edit message
 * @param {string} messageId - Message ID
 */
function editMessage(messageId) {
    try {
        const message = currentMessages.find(msg => msg.id === messageId);
        if (!message) {
            showToast('Message not found', 'error', 2000);
            return;
        }
        
        const newText = prompt('Edit message:', message.text || '');
        if (newText !== null && newText.trim() !== message.text) {
            // Update message
            message.text = newText.trim();
            message.stats = getTextStatistics(newText.trim());
            
            // Save to storage
            if (typeof updateMessage === 'function') {
                updateMessage(messageId, { 
                    text: newText.trim(), 
                    stats: message.stats 
                });
            } else {
                // Fallback - update in localStorage
                localStorage.setItem('eyeblink_messages_v2', JSON.stringify(currentMessages));
            }
            
            // Refresh display
            filterAndDisplayMessages();
            showToast('Message updated', 'success', 2000);
        }
        
    } catch (error) {
        console.error('Error editing message:', error);
        showToast('Error editing message', 'error', 2000);
    }
}

/**
 * Delete message
 * @param {string} messageId - Message ID
 */
function deleteMessage(messageId) {
    try {
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }
        
        // Remove from current messages array
        const index = currentMessages.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
            currentMessages.splice(index, 1);
            
            // Save to storage
            if (typeof storage !== 'undefined' && storage.set) {
                storage.set('eyeblink_messages_v2', currentMessages);
            } else {
                localStorage.setItem('eyeblink_messages_v2', JSON.stringify(currentMessages));
            }
            
            // Refresh display
            filterAndDisplayMessages();
            updateStats();
            showToast('Message deleted', 'success', 2000);
        } else {
            showToast('Message not found', 'error', 2000);
        }
        
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Error deleting message', 'error', 2000);
    }
}

/**
 * Clear all messages
 */
function clearAllMessages() {
    try {
        if (!currentMessages.length) {
            showToast('No messages to clear', 'info', 2000);
            return;
        }
        
        if (!confirm('Are you sure you want to delete ALL messages? This action cannot be undone.')) {
            return;
        }
        
        // Clear messages
        currentMessages = [];
        
        // Save to storage
        if (typeof clearAllMessages === 'function') {
            clearAllMessages();
        } else if (typeof storage !== 'undefined' && storage.set) {
            storage.set('eyeblink_messages_v2', []);
        } else {
            localStorage.setItem('eyeblink_messages_v2', JSON.stringify([]));
        }
        
        // Refresh display
        filterAndDisplayMessages();
        updateStats();
        showToast('All messages cleared', 'success', 2000);
        
    } catch (error) {
        console.error('Error clearing messages:', error);
        showToast('Error clearing messages', 'error', 2000);
    }
}

/**
 * Export messages to PDF
 */
function exportMessagesToPDF() {
    try {
        if (!currentMessages.length) {
            showToast('No messages to export', 'warning', 2000);
            return;
        }
        
        showToast('Generating PDF...', 'info', 2000);
        
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF library not loaded');
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // PDF settings
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const lineHeight = 6;
        let yPosition = margin;
        
        // Title
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('Eye-Blink Morse Messages Export', margin, yPosition);
        yPosition += 15;
        
        // Export info
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
        yPosition += 8;
        doc.text(`Total Messages: ${currentMessages.length}`, margin, yPosition);
        yPosition += 15;
        
        // Messages
        doc.setFontSize(12);
        
        currentMessages.forEach((message, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = margin;
            }
            
            // Message header
            doc.setFont(undefined, 'bold');
            doc.text(`Message ${index + 1}`, margin, yPosition);
            yPosition += lineHeight;
            
            doc.setFont(undefined, 'normal');
            const date = message.date || (message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Unknown');
            doc.text(`Date: ${date}`, margin + 5, yPosition);
            yPosition += lineHeight;
            
            if (message.translated) {
                doc.text(`Language: ${(message.language || 'unknown').toUpperCase()}`, margin + 5, yPosition);
                yPosition += lineHeight;
            }
            
            // Message content
            const messageText = message.text || '';
            const maxWidth = pageWidth - (margin * 2);
            const lines = doc.splitTextToSize(messageText, maxWidth);
            
            doc.text('Content:', margin + 5, yPosition);
            yPosition += lineHeight;
            
            lines.forEach(line => {
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(line, margin + 10, yPosition);
                yPosition += lineHeight;
            });
            
            // Original text if translated
            if (message.originalText && message.originalText !== message.text) {
                yPosition += 3;
                doc.text('Original:', margin + 5, yPosition);
                yPosition += lineHeight;
                
                const originalLines = doc.splitTextToSize(message.originalText, maxWidth);
                originalLines.forEach(line => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin + 10, yPosition);
                    yPosition += lineHeight;
                });
            }
            
            yPosition += 10; // Space between messages
        });
        
        // Save PDF
        const fileName = `Morseblink-messages-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        showToast('PDF exported successfully', 'success', 3000);
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showToast('Error exporting PDF: ' + error.message, 'error', 4000);
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Add enhanced CSS styles for message buttons
 */
function addMessageButtonStyles() {
    if (document.getElementById('message-button-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'message-button-styles';
    style.textContent = `
        .message-item {
            background: white;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            margin-bottom: 16px;
            padding: 0;
            overflow: hidden;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .message-item:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: #d1d5db;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e5e5;
        }

        .message-info {
            display: flex;
            gap: 12px;
            align-items: center;
            flex: 1;
        }

        .message-date,
        .message-stats,
        .message-language {
            font-size: 12px;
            color: #6b7280;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .message-language {
            background: #dbeafe;
            color: #1d4ed8;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
        }

        .message-actions {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .message-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
            color: #374151;
            text-decoration: none;
            min-height: 28px;
            font-family: inherit;
        }

        .message-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .message-btn svg {
            flex-shrink: 0;
        }

        .message-btn-copy {
            border-color: #d1d5db;
            color: #374151;
        }

        .message-btn-copy:hover {
            background: #f3f4f6;
            border-color: #9ca3af;
        }

        .message-btn-edit {
            border-color: #fbbf24;
            color: #d97706;
        }

        .message-btn-edit:hover {
            background: #fef3c7;
            border-color: #f59e0b;
        }

        .message-btn-delete {
            border-color: #f87171;
            color: #dc2626;
        }

        .message-btn-delete:hover {
            background: #fee2e2;
            border-color: #ef4444;
        }

        .message-content {
            padding: 16px;
        }

        .message-text {
            font-size: 14px;
            line-height: 1.5;
            color: #111827;
            word-break: break-word;
            white-space: pre-wrap;
            margin-bottom: 8px;
        }

        .message-original {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #e5e5e5;
        }

        .message-original small {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.4;
        }

        /* Dark theme support */
        [data-theme="dark"] .message-item {
            background: #1f2937;
            border-color: #374151;
        }

        [data-theme="dark"] .message-header {
            background: #111827;
            border-color: #374151;
        }

        [data-theme="dark"] .message-text {
            color: #f9fafb;
        }

        [data-theme="dark"] .message-date,
        [data-theme="dark"] .message-stats {
            color: #9ca3af;
        }

        [data-theme="dark"] .message-btn {
            background: #374151;
            color: #f9fafb;
        }

        [data-theme="dark"] .message-btn-copy:hover {
            background: #4b5563;
        }

        [data-theme="dark"] .message-btn-edit:hover {
            background: #451a03;
        }

        [data-theme="dark"] .message-btn-delete:hover {
            background: #7f1d1d;
        }

        /* Responsive design */
        @media (max-width: 768px) {
            .message-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .message-actions {
                align-self: flex-end;
                width: 100%;
                justify-content: flex-end;
            }

            .message-btn {
                font-size: 11px;
                padding: 4px 8px;
            }
        }

        /* Loading state */
        .message-item.loading {
            opacity: 0.6;
            pointer-events: none;
        }

        .message-item.loading .message-btn {
            opacity: 0.5;
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Get text statistics
 * @param {string} text - Text to analyze
 * @returns {Object} - Statistics object
 */
function getTextStatistics(text) {
    if (!text || typeof text !== 'string') {
        return { characters: 0, words: 0, sentences: 0 };
    }
    
    const characters = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    return { characters, words, sentences };
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type of toast
 * @param {number} duration - Duration in ms
 */
function showToast(message, type = 'info', duration = 3000) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1000;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add slide-in animation
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally available for onclick handlers
window.copyMessage = copyMessage;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;

// Refresh messages when page becomes visible (in case they were updated elsewhere)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadMessages();
    }
});

console.log('Messages page script loaded successfully');