// ==================== STORAGE UTILITIES ====================

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
 * @property {string} id - Unique identifier
 * @property {string} text - Message content
 * @property {string} originalText - Original text before translation
 * @property {boolean} translated - Whether the message is translated
 * @property {string} language - Target language for translation
 * @property {number} timestamp - Creation timestamp
 * @property {string} date - Formatted date string
 * @property {Object} stats - Text statistics
 */

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

// Initialize storage on load
document.addEventListener('DOMContentLoaded', () => {
    startSession();
    updateStats();
});

// End session on page unload
window.addEventListener('beforeunload', () => {
    endSession();
});

// Export functions for global use
window.storage = storage;
window.StorageManager = StorageManager;