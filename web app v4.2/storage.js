// ==================== STORAGE UTILITIES - ENHANCED WITH QUICK ACTIONS SUPPORT ====================

const STORAGE_KEYS = {
    MESSAGES: 'eyeblink_messages_v2',
    SETTINGS: 'eyeblink_settings_v2',
    SESSION: 'eyeblink_session_v2',
    STATS: 'eyeblink_stats_v2'
};

// Default settings
const DEFAULT_SETTINGS = {
    theme: 'light',
    fontSize: 'medium',
    voiceGender: 'female',
    speechSpeed: 1.0,
    voicePitch: 1.0,
    autoConnect: false,
    baudRate: 115200,
    targetLanguage: 'bn',
    autoTranslate: false,
    autoSave: true,
    messageLimit: 100
};

/**
 * Storage management class
 */
class StorageManager {
    constructor() {
        this.isAvailable = this.checkStorageAvailability();
        this.cache = new Map();
    }

    /**
     * Check if localStorage is available
     * @returns {boolean}
     */
    checkStorageAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage not available, using memory storage');
            return false;
        }
    }

    /**
     * Get item from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} - Stored value or default
     */
    get(key, defaultValue = null) {
        try {
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }

            if (this.isAvailable) {
                const item = localStorage.getItem(key);
                if (item !== null) {
                    const parsed = JSON.parse(item);
                    this.cache.set(key, parsed);
                    return parsed;
                }
            }
            
            this.cache.set(key, defaultValue);
            return defaultValue;
        } catch (error) {
            console.error('Error getting item from storage:', error);
            return defaultValue;
        }
    }

    /**
     * Set item in storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} - Success status
     */
    set(key, value) {
        try {
            this.cache.set(key, value);
            
            if (this.isAvailable) {
                localStorage.setItem(key, JSON.stringify(value));
            }
            
            return true;
        } catch (error) {
            console.error('Error setting item in storage:', error);
            return false;
        }
    }

    /**
     * Remove item from storage
     * @param {string} key - Storage key
     * @returns {boolean} - Success status
     */
    remove(key) {
        try {
            this.cache.delete(key);
            
            if (this.isAvailable) {
                localStorage.removeItem(key);
            }
            
            return true;
        } catch (error) {
            console.error('Error removing item from storage:', error);
            return false;
        }
    }

    /**
     * Clear all storage
     * @returns {boolean} - Success status
     */
    clear() {
        try {
            this.cache.clear();
            
            if (this.isAvailable) {
                // Only clear our app's keys
                Object.values(STORAGE_KEYS).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }

    /**
     * Get storage size information
     * @returns {Object} - Storage size info
     */
    getStorageInfo() {
        try {
            if (!this.isAvailable) {
                return { used: 0, available: 0, total: 0 };
            }

            let used = 0;
            Object.values(STORAGE_KEYS).forEach(key => {
                const item = localStorage.getItem(key);
                if (item) {
                    used += item.length;
                }
            });

            // Estimate available space (rough calculation)
            const total = 5 * 1024 * 1024; // Assume 5MB limit
            const available = total - used;

            return {
                used: Math.round(used / 1024), // KB
                available: Math.round(available / 1024), // KB
                total: Math.round(total / 1024) // KB
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return { used: 0, available: 0, total: 0 };
        }
    }
}

// Create global storage instance
const storage = new StorageManager();

// ==================== MESSAGE MANAGEMENT ====================

/**
 * Message object structure
 * @typedef {Object} Message
 * @property {string} date - Formatted date string
 * @property {Object} stats - Text statistics
 */

/**
 * Get text statistics
 * @param {string} text - Text to analyze
 * @returns {Object} - Text statistics
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
 * Save a new message
 * @param {string} text - Message text
 * @param {boolean} translated - Whether message is translated
 * @param {string} language - Target language (if translated)
 * @returns {string} - Message ID
 */
function saveMessage(text, translated = false, language = 'en') {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid message text');
    }

    const messages = getAllMessages();
    const settings = getSettings();
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const stats = getTextStatistics(text);
    
    const message = {
        id: messageId,
        text: text.trim(),
        originalText: translated ? '' : text.trim(),
        translated,
        language: translated ? language : 'en',
        timestamp,
        date: new Date(timestamp).toLocaleString(),
        stats
    };

    messages.unshift(message); // Add to beginning

    // Apply message limit
    if (settings.messageLimit > 0 && messages.length > settings.messageLimit) {
        messages.splice(settings.messageLimit);
    }

    storage.set(STORAGE_KEYS.MESSAGES, messages);
    updateStats();
    
    return messageId;
}

/**
 * Get all messages
 * @returns {Array<Message>} - Array of messages
 */
function getAllMessages() {
    return storage.get(STORAGE_KEYS.MESSAGES, []);
}

/**
 * Get message by ID
 * @param {string} messageId - Message ID
 * @returns {Message|null} - Message object or null
 */
function getMessageById(messageId) {
    const messages = getAllMessages();
    return messages.find(msg => msg.id === messageId) || null;
}

/**
 * Delete message by ID
 * @param {string} messageId - Message ID
 * @returns {boolean} - Success status
 */
function deleteMessage(messageId) {
    const messages = getAllMessages();
    const index = messages.findIndex(msg => msg.id === messageId);
    
    if (index !== -1) {
        messages.splice(index, 1);
        storage.set(STORAGE_KEYS.MESSAGES, messages);
        updateStats();
        return true;
    }
    
    return false;
}

/**
 * Update existing message
 * @param {string} messageId - Message ID
 * @param {Object} updates - Updates to apply
 * @returns {boolean} - Success status
 */
function updateMessage(messageId, updates) {
    const messages = getAllMessages();
    const index = messages.findIndex(msg => msg.id === messageId);
    
    if (index !== -1) {
        messages[index] = { ...messages[index], ...updates };
        
        // Recalculate stats if text changed
        if (updates.text) {
            messages[index].stats = getTextStatistics(updates.text);
        }
        
        storage.set(STORAGE_KEYS.MESSAGES, messages);
        return true;
    }
    
    return false;
}

/**
 * Clear all messages
 * @returns {boolean} - Success status
 */
function clearAllMessages() {
    const success = storage.set(STORAGE_KEYS.MESSAGES, []);
    if (success) {
        updateStats();
    }
    return success;
}

/**
 * Search messages
 * @param {string} query - Search query
 * @param {Object} filters - Filter options
 * @returns {Array<Message>} - Filtered messages
 */
function searchMessages(query = '', filters = {}) {
    let messages = getAllMessages();
    
    // Text search
    if (query) {
        const searchTerm = query.toLowerCase();
        messages = messages.filter(msg => 
            msg.text.toLowerCase().includes(searchTerm) ||
            msg.originalText.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply filters
    if (filters.translated !== undefined) {
        if (filters.translated === 'original') {
            messages = messages.filter(msg => !msg.translated);
        } else if (filters.translated === 'translated') {
            messages = messages.filter(msg => msg.translated);
        }
    }
    
    if (filters.language) {
        messages = messages.filter(msg => msg.language === filters.language);
    }
    
    if (filters.dateFrom) {
        messages = messages.filter(msg => msg.timestamp >= filters.dateFrom);
    }
    
    if (filters.dateTo) {
        messages = messages.filter(msg => msg.timestamp <= filters.dateTo);
    }
    
    // Sort messages
    if (filters.sortBy) {
        switch (filters.sortBy) {
            case 'newest':
                messages.sort((a, b) => b.timestamp - a.timestamp);
                break;
            case 'oldest':
                messages.sort((a, b) => a.timestamp - b.timestamp);
                break;
            case 'longest':
                messages.sort((a, b) => b.stats.characters - a.stats.characters);
                break;
            case 'shortest':
                messages.sort((a, b) => a.stats.characters - b.stats.characters);
                break;
        }
    }
    
    return messages;
}

// ==================== QUICK ACTIONS DATA EXPORT UTILITIES ====================

/**
 * NEW: Export messages to JSON format
 * @param {Array} messages - Messages to export (optional, defaults to all)
 * @returns {Object} - Export data object
 */
function exportMessagesToJSON(messages = null) {
    const messagesToExport = messages || getAllMessages();
    const stats = getStats();
    
    return {
        meta: {
            exportDate: new Date().toISOString(),
            exportedBy: 'Eye-Blink Morse Communication System',
            version: '2.0',
            totalMessages: messagesToExport.length,
            appStats: stats
        },
        messages: messagesToExport,
        settings: getSettings()
    };
}

/**
 * NEW: Convert messages to CSV format
 * @param {Array} messages - Messages to convert (optional, defaults to all)
 * @returns {string} - CSV string
 */
function convertMessagesToCSV(messages = null) {
    const messagesToExport = messages || getAllMessages();
    
    if (messagesToExport.length === 0) {
        return 'No messages to export';
    }
    
    // CSV headers
    const headers = [
        'ID',
        'Date',
        'Text',
        'Original Text',
        'Translated',
        'Language',
        'Word Count',
        'Character Count',
        'Sentence Count',
        'Timestamp'
    ];
    
    // Convert messages to CSV rows
    const csvRows = [headers.join(',')];
    
    messagesToExport.forEach(message => {
        const row = [
            `"${(message.id || '').replace(/"/g, '""')}"`,
            `"${(message.date || '').replace(/"/g, '""')}"`,
            `"${(message.text || '').replace(/"/g, '""')}"`,
            `"${(message.originalText || '').replace(/"/g, '""')}"`,
            message.translated ? 'Yes' : 'No',
            `"${(message.language || 'en').replace(/"/g, '""')}"`,
            message.stats?.words || 0,
            message.stats?.characters || 0,
            message.stats?.sentences || 0,
            message.timestamp || ''
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

/**
 * NEW: Format messages for sharing/printing
 * @param {Array} messages - Messages to format
 * @param {string} format - Format type ('plain', 'markdown', 'html')
 * @returns {string} - Formatted text
 */
function formatMessagesForSharing(messages, format = 'plain') {
    if (!messages || messages.length === 0) {
        return 'No messages to share';
    }
    
    const timestamp = new Date().toLocaleString();
    
    switch (format) {
        case 'markdown':
            return formatMessagesAsMarkdown(messages, timestamp);
        case 'html':
            return formatMessagesAsHTML(messages, timestamp);
        default:
            return formatMessagesAsPlainText(messages, timestamp);
    }
}

/**
 * NEW: Format messages as plain text
 * @param {Array} messages - Messages to format
 * @param {string} timestamp - Export timestamp
 * @returns {string} - Plain text format
 */
function formatMessagesAsPlainText(messages, timestamp) {
    let output = `📱 Eye-Blink Morse Messages (${messages.length} messages)\n`;
    output += `📅 Exported on: ${timestamp}\n`;
    output += '='.repeat(60) + '\n\n';
    
    messages.forEach((message, index) => {
        output += `📝 Message ${index + 1}\n`;
        output += `📅 Date: ${message.date || 'Unknown'}\n`;
        output += `💬 Text: ${message.text || ''}\n`;
        
        if (message.originalText && message.originalText !== message.text) {
            output += `🔤 Original: ${message.originalText}\n`;
        }
        
        if (message.translated) {
            output += `🌐 Language: ${(message.language || 'unknown').toUpperCase()}\n`;
        }
        
        const stats = message.stats || {};
        output += `📊 Stats: ${stats.words || 0} words, ${stats.characters || 0} characters, ${stats.sentences || 0} sentences\n`;
        output += '-'.repeat(40) + '\n\n';
    });
    
    output += `Generated by Eye-Blink Morse Communication System`;
    return output;
}

/**
 * NEW: Format messages as Markdown
 * @param {Array} messages - Messages to format
 * @param {string} timestamp - Export timestamp
 * @returns {string} - Markdown format
 */
function formatMessagesAsMarkdown(messages, timestamp) {
    let output = `# 👁️ Eye-Blink Morse Messages\n\n`;
    output += `**Total Messages:** ${messages.length}  \n`;
    output += `**Exported:** ${timestamp}\n\n`;
    output += `---\n\n`;
    
    messages.forEach((message, index) => {
        output += `## Message ${index + 1}\n\n`;
        output += `**Date:** ${message.date || 'Unknown'}  \n`;
        
        if (message.translated) {
            output += `**Language:** ${(message.language || 'unknown').toUpperCase()}  \n`;
        }
        
        const stats = message.stats || {};
        output += `**Stats:** ${stats.words || 0} words, ${stats.characters || 0} characters  \n\n`;
        
        output += `### Content\n`;
        output += `${message.text || ''}\n\n`;
        
        if (message.originalText && message.originalText !== message.text) {
            output += `### Original Text\n`;
            output += `${message.originalText}\n\n`;
        }
        
        output += `---\n\n`;
    });
    
    output += `*Generated by Eye-Blink Morse Communication System*`;
    return output;
}

/**
 * NEW: Format messages as HTML
 * @param {Array} messages - Messages to format
 * @param {string} timestamp - Export timestamp
 * @returns {string} - HTML format
 */
function formatMessagesAsHTML(messages, timestamp) {
    let output = `<div class="eyeblink-export">\n`;
    output += `<h1>👁️ Eye-Blink Morse Messages</h1>\n`;
    output += `<div class="export-meta">\n`;
    output += `<p><strong>Total Messages:</strong> ${messages.length}</p>\n`;
    output += `<p><strong>Exported:</strong> ${timestamp}</p>\n`;
    output += `</div>\n<hr>\n`;
    
    messages.forEach((message, index) => {
        output += `<div class="message" data-message-id="${message.id}">\n`;
        output += `<h2>Message ${index + 1}</h2>\n`;
        output += `<div class="message-meta">\n`;
        output += `<p><strong>Date:</strong> ${message.date || 'Unknown'}</p>\n`;
        
        if (message.translated) {
            output += `<p><strong>Language:</strong> <span class="language-badge">${(message.language || 'unknown').toUpperCase()}</span></p>\n`;
        }
        
        const stats = message.stats || {};
        output += `<p><strong>Stats:</strong> ${stats.words || 0} words, ${stats.characters || 0} characters</p>\n`;
        output += `</div>\n`;
        
        output += `<div class="message-content">\n`;
        output += `<h3>Content</h3>\n`;
        output += `<div class="message-text">${escapeHTML(message.text || '')}</div>\n`;
        
        if (message.originalText && message.originalText !== message.text) {
            output += `<h3>Original Text</h3>\n`;
            output += `<div class="original-text">${escapeHTML(message.originalText)}</div>\n`;
        }
        
        output += `</div>\n</div>\n<hr>\n`;
    });
    
    output += `<div class="footer"><em>Generated by Eye-Blink Morse Communication System</em></div>\n`;
    output += `</div>`;
    
    return output;
}

/**
 * NEW: Escape HTML entities
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHTML(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * NEW: Get messages by IDs
 * @param {Array<string>} messageIds - Array of message IDs
 * @returns {Array<Message>} - Array of messages
 */
function getMessagesByIds(messageIds) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return [];
    }
    
    const allMessages = getAllMessages();
    return allMessages.filter(message => messageIds.includes(message.id));
}

/**
 * NEW: Bulk delete messages by IDs
 * @param {Array<string>} messageIds - Array of message IDs to delete
 * @returns {number} - Number of messages deleted
 */
function bulkDeleteMessages(messageIds) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return 0;
    }
    
    const messages = getAllMessages();
    const initialCount = messages.length;
    
    // Filter out messages to be deleted
    const filteredMessages = messages.filter(message => !messageIds.includes(message.id));
    
    storage.set(STORAGE_KEYS.MESSAGES, filteredMessages);
    updateStats();
    
    return initialCount - filteredMessages.length;
}

/**
 * NEW: Create download blob for data
 * @param {string} data - Data to download
 * @param {string} mimeType - MIME type
 * @returns {Blob} - Blob object
 */
function createDownloadBlob(data, mimeType = 'text/plain') {
    return new Blob([data], { type: mimeType + ';charset=utf-8;' });
}

/**
 * NEW: Trigger file download
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 * @returns {boolean} - Success status
 */
function triggerDownload(blob, filename) {
    try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        return true;
    } catch (error) {
        console.error('Error triggering download:', error);
        return false;
    }
}

// ==================== SETTINGS MANAGEMENT ====================

/**
 * Get all settings
 * @returns {Object} - Settings object
 */
function getSettings() {
    return { ...DEFAULT_SETTINGS, ...storage.get(STORAGE_KEYS.SETTINGS, {}) };
}

/**
 * Update settings
 * @param {Object} newSettings - Settings to update
 * @returns {boolean} - Success status
 */
function updateSettings(newSettings) {
    const currentSettings = getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    return storage.set(STORAGE_KEYS.SETTINGS, updatedSettings);
}

/**
 * Reset settings to default
 * @returns {boolean} - Success status
 */
function resetSettings() {
    return storage.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

/**
 * Get specific setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value
 * @returns {*} - Setting value
 */
function getSetting(key, defaultValue = null) {
    const settings = getSettings();
    return settings.hasOwnProperty(key) ? settings[key] : defaultValue;
}

/**
 * Set specific setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {boolean} - Success status
 */
function setSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    return storage.set(STORAGE_KEYS.SETTINGS, settings);
}

// ==================== STATISTICS MANAGEMENT ====================

/**
 * Update app statistics
 */
function updateStats() {
    const messages = getAllMessages();
    const totalMessages = messages.length;
    const translatedMessages = messages.filter(msg => msg.translated).length;
    const totalWords = messages.reduce((sum, msg) => sum + (msg.stats?.words || 0), 0);
    const totalCharacters = messages.reduce((sum, msg) => sum + (msg.stats?.characters || 0), 0);
    
    const stats = {
        totalMessages,
        translatedMessages,
        totalWords,
        totalCharacters,
        lastUpdated: Date.now(),
        sessionsCount: (storage.get(STORAGE_KEYS.STATS, {}).sessionsCount || 0)
    };
    
    storage.set(STORAGE_KEYS.STATS, stats);
}

/**
 * Get app statistics
 * @returns {Object} - Statistics object
 */
function getStats() {
    return storage.get(STORAGE_KEYS.STATS, {
        totalMessages: 0,
        translatedMessages: 0,
        totalWords: 0,
        totalCharacters: 0,
        sessionsCount: 0,
        lastUpdated: Date.now()
    });
}

/**
 * Increment session count
 */
function incrementSessionCount() {
    const stats = getStats();
    stats.sessionsCount++;
    stats.lastUpdated = Date.now();
    storage.set(STORAGE_KEYS.STATS, stats);
}

// ==================== DATA EXPORT/IMPORT ====================

/**
 * Export all data
 * @returns {Object} - Exported data
 */
function exportAllData() {
    return {
        messages: getAllMessages(),
        settings: getSettings(),
        stats: getStats(),
        exportDate: new Date().toISOString(),
        version: '2.0'
    };
}

/**
 * Import data
 * @param {Object} data - Data to import
 * @returns {boolean} - Success status
 */
function importData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }
        
        // Validate data structure
        if (data.messages && Array.isArray(data.messages)) {
            storage.set(STORAGE_KEYS.MESSAGES, data.messages);
        }
        
        if (data.settings && typeof data.settings === 'object') {
            const validSettings = { ...DEFAULT_SETTINGS, ...data.settings };
            storage.set(STORAGE_KEYS.SETTINGS, validSettings);
        }
        
        if (data.stats && typeof data.stats === 'object') {
            storage.set(STORAGE_KEYS.STATS, data.stats);
        }
        
        updateStats();
        return true;
    } catch (error) {
        console.error('Error importing data:', error);
        return false;
    }
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Start new session
 */
function startSession() {
    const sessionData = {
        startTime: Date.now(),
        messagesAtStart: getAllMessages().length,
        deviceConnected: false
    };
    
    storage.set(STORAGE_KEYS.SESSION, sessionData);
    incrementSessionCount();
}

/**
 * End current session
 */
function endSession() {
    const sessionData = storage.get(STORAGE_KEYS.SESSION, {});
    if (sessionData.startTime) {
        sessionData.endTime = Date.now();
        sessionData.duration = sessionData.endTime - sessionData.startTime;
        sessionData.messagesCreated = getAllMessages().length - (sessionData.messagesAtStart || 0);
        
        storage.set(STORAGE_KEYS.SESSION, sessionData);
    }
}

/**
 * Get current session data
 * @returns {Object} - Session data
 */
function getCurrentSession() {
    return storage.get(STORAGE_KEYS.SESSION, {});
}

// ==================== THEME & UI MANAGEMENT ====================

/**
 * Apply theme to document
 * @param {boolean} isDark - Whether to apply dark theme
 */
function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

/**
 * Apply font size to document
 * @param {string} Size - Font size setting
 */
function applyFontSize(Size) {
    // Remove existing font size classes
    document.body.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    // Add new font size class
    document.body.classList.add(`font-${Size}`);
}

/**
 * Apply all settings immediately when page loads
 * This function should be called as early as possible
 */
function applySettingsImmediately() {
    const settings = getSettings();
    
    // Apply theme immediately
    applyTheme(settings.theme === 'dark');
    
    // Apply font size immediately
    if (document.body) {
        applyFontSize(settings.fontSize);
    } else {
        // If body not ready, apply when DOM loads
        document.addEventListener('DOMContentLoaded', () => {
            applyFontSize(settings.fontSize);
        });
    }
}

/**
 * Toast notification system
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Toast styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--surface, #f8fafc);
        color: var(--text, #1e293b);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 0.5rem;
        padding: 1rem 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Type-specific styles
    if (type === 'success') {
        toast.style.borderLeft = '4px solid #10b981';
    } else if (type === 'error') {
        toast.style.borderLeft = '4px solid #ef4444';
    } else if (type === 'warning') {
        toast.style.borderLeft = '4px solid #f59e0b';
    } else {
        toast.style.borderLeft = '4px solid #3b82f6';
    }
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide toast
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// ==================== INITIALIZATION ====================

// Initialize storage on load
document.addEventListener('DOMContentLoaded', () => {
    startSession();
    updateStats();
});

// End session on page unload
window.addEventListener('beforeunload', () => {
    endSession();
});

// Apply settings immediately when script loads
applySettingsImmediately();

// Global utility functions - ENHANCED WITH QUICK ACTIONS SUPPORT
window.EyeBlinkStorage = {
    // Settings
    getSettings,
    getSetting,
    setSetting,
    updateSettings,
    resetSettings,
    
    // Messages
    saveMessage,
    getAllMessages,
    getMessageById,
    deleteMessage,
    updateMessage,
    clearAllMessages,
    searchMessages,
    
    // Quick Actions - NEW
    exportMessagesToJSON,
    convertMessagesToCSV,
    formatMessagesForSharing,
    getMessagesByIds,
    bulkDeleteMessages,
    createDownloadBlob,
    triggerDownload,
    
    // Data management
    exportAllData,
    importData,
    
    // Statistics
    getStats,
    updateStats,
    
    // UI
    applyTheme,
    applyFontSize,
    applySettingsImmediately,
    showToast,
    
    // Storage info
    getStorageInfo: () => storage.getStorageInfo()
};

