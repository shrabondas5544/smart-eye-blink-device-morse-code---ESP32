// ==================== HOME PAGE LOGIC ====================

let sessionTimer = null;
let sessionStartTime = Date.now();
let deviceConnected = false;

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    updateDashboard();
    renderMorseReference();
    setupEventListeners();
    startSessionTimer();
    applyThemeSettings();
    
    // Check connection status periodically
    setInterval(checkDeviceStatus, 5000);
});

/**
 * Initialize the home page
 */
function initializePage() {
    showToast('Welcome to Eye-Blink Morse Communicator!', 'info', 2000);
    updateStats();
    
    // Load session data
    const session = getCurrentSession();
    if (session.startTime) {
        sessionStartTime = session.startTime;
    } else {
        // Start new session if none exists
        startSession();
    }
}

/**
 * Update dashboard statistics
 */
function updateDashboard() {
    try {
        const stats = getStats();
        const messages = getAllMessages();
        
        // Update message count
        const messageCountEl = document.getElementById('messageCount');
        if (messageCountEl) {
            messageCountEl.textContent = messages.length || 0;
        }
        
        // Update device status
        updateDeviceStatus();
        
        // Update recent messages
        updateRecentMessages(messages.slice(0, 3));
        
        // Update additional stats
        updateAdditionalStats(stats, messages);
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
        // Fallback display
        const messageCountEl = document.getElementById('messageCount');
        if (messageCountEl) messageCountEl.textContent = '0';
    }
}

/**
 * Update device status display
 */
function updateDeviceStatus() {
    const deviceStatusEl = document.getElementById('deviceStatus');
    
    if (!deviceStatusEl) return;
    
    // Check if device is connected (look for connection in localStorage)
    const connectionStatus = localStorage.getItem('device_connected') || 'false';
    const isConnected = connectionStatus === 'true';
    
    if (isConnected) {
        deviceStatusEl.textContent = 'Online';
        deviceStatusEl.className = 'stat-status online';
        deviceConnected = true;
        
        // Update session with connection status
        const session = getCurrentSession();
        session.deviceConnected = true;
        if (typeof storage !== 'undefined') {
            storage.set('eyeblink_session_v2', session);
        }
    } else {
        deviceStatusEl.textContent = 'Offline';
        deviceStatusEl.className = 'stat-status offline';
        deviceConnected = false;
    }
}

/**
 * Check device status from other pages
 */
function checkDeviceStatus() {
    updateDeviceStatus();
}

/**
 * Update additional statistics
 */
function updateAdditionalStats(stats, messages) {
    // You can add more stat elements here as needed
    const totalWordsEl = document.getElementById('totalWords');
    const translatedCountEl = document.getElementById('translatedCount');
    
    if (totalWordsEl) {
        const totalWords = messages.reduce((sum, msg) => {
            return sum + (msg.stats?.words || 0);
        }, 0);
        totalWordsEl.textContent = totalWords;
    }
    
    if (translatedCountEl) {
        const translatedCount = messages.filter(msg => msg.translated).length;
        translatedCountEl.textContent = translatedCount;
    }
}

/**
 * Update recent messages display
 * @param {Array} messages - Recent messages to display
 */
function updateRecentMessages(messages) {
    const recentMessagesEl = document.getElementById('recentMessages');
    
    if (!recentMessagesEl) return;
    
    if (!messages || messages.length === 0) {
        recentMessagesEl.innerHTML = '<div class="empty-state">No messages yet. <a href="communication.html">Start communicating!</a></div>';
        return;
    }
    
    const messagesHtml = messages.map(msg => `
        <div class="recent-item">
            <div class="recent-text">
                <strong>${truncateText(msg.text, 60)}</strong>
            </div>
            <div class="recent-meta muted">
                ${msg.translated ? `🌐 Translated • ` : ''}
                ${formatDate(msg.timestamp)} • ${msg.stats?.words || 0} words
            </div>
        </div>
    `).join('');
    
    recentMessagesEl.innerHTML = messagesHtml;
}

/**
 * Render Morse code reference
 */
function renderMorseReference() {
    try {
        // Use the morse code map from the global scope or define it locally
        const morseCodeMap = window.MORSE_CODE || {
            ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
            "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
            "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
            ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
            "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
            "--..": "Z", "-----": "0", ".----": "1", "..---": "2", "...--": "3", 
            "....-": "4", ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9"
        };
        
        const letters = {};
        const numbers = {};
        
        // Separate letters and numbers
        Object.entries(morseCodeMap).forEach(([morse, char]) => {
            if (char >= 'A' && char <= 'Z') {
                letters[char] = morse;
            } else if (char >= '0' && char <= '9') {
                numbers[char] = morse;
            }
        });
        
        // Render letters
        const lettersEl = document.getElementById('morseLetters');
        if (lettersEl) {
            const lettersHtml = Object.entries(letters)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([char, morse]) => `
                    <div class="morse-item">
                        <span class="morse-char">${char}</span> — 
                        <code class="morse-code">${formatMorseForDisplay(morse)}</code>
                    </div>
                `).join('');
            lettersEl.innerHTML = lettersHtml;
        }
        
        // Render numbers
        const numbersEl = document.getElementById('morseNumbers');
        if (numbersEl) {
            const numbersHtml = Object.entries(numbers)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([char, morse]) => `
                    <div class="morse-item">
                        <span class="morse-char">${char}</span> — 
                        <code class="morse-code">${formatMorseForDisplay(morse)}</code>
                    </div>
                `).join('');
            numbersEl.innerHTML = numbersHtml;
        }
    } catch (error) {
        console.error('Error rendering morse reference:', error);
    }
}

/**
 * Format morse for display
 */
function formatMorseForDisplay(morse) {
    if (!morse) return '';
    return morse.replace(/\./g, '•').replace(/-/g, '—');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Connect device button
    const connectBtn = document.getElementById('connectDeviceBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', handleConnectDevice);
    }
    
    // Morse chart toggle
    const toggleChartBtn = document.getElementById('toggleMorseChart');
    const chartContent = document.getElementById('morseChartContent');
    
    if (toggleChartBtn && chartContent) {
        toggleChartBtn.addEventListener('click', () => {
            const isVisible = chartContent.style.display !== 'none';
            
            if (isVisible) {
                chartContent.style.display = 'none';
                toggleChartBtn.textContent = 'Show Chart';
            } else {
                chartContent.style.display = 'block';
                toggleChartBtn.textContent = 'Hide Chart';
                
                // Scroll to chart
                setTimeout(() => {
                    chartContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        });
    }
    
    // Refresh dashboard periodically
    setInterval(updateDashboard, 10000); // Every 10 seconds
}

/**
 * Handle connect device button click
 */
function handleConnectDevice() {
    if (!('serial' in navigator)) {
        showToast('Web Serial API not supported. Please use Chrome or Edge browser.', 'error', 5000);
        return;
    }
    
    if (confirm('This will open the Communication page to connect your device. Continue?')) {
        window.location.href = 'communication.html';
    }
}

/**
 * Start session timer
 */
function startSessionTimer() {
    const sessionTimeEl = document.getElementById('sessionTime');
    
    if (!sessionTimeEl) return;
    
    // Clear existing timer
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
    
    sessionTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        
        if (hours > 0) {
            sessionTimeEl.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            sessionTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

/**
 * Apply theme settings
 */
function applyThemeSettings() {
    const settings = getSettings();
    
    // Apply theme
    if (settings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Apply font size
    if (settings.fontSize) {
        document.body.className = (document.body.className || '').replace(/font-\w+/g, '') + ` font-${settings.fontSize}`;
    }
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    } catch (error) {
        return 'Unknown';
    }
}

// Helper functions (provide fallbacks if storage functions not available)
function getStats() {
    try {
        if (typeof storage !== 'undefined' && storage.get) {
            return storage.get('eyeblink_stats_v2', {
                totalMessages: 0,
                translatedMessages: 0,
                totalWords: 0,
                totalCharacters: 0,
                sessionsCount: 0
            });
        } else {
            // Fallback: calculate from messages
            const messages = getAllMessages();
            return {
                totalMessages: messages.length,
                translatedMessages: messages.filter(m => m.translated).length,
                totalWords: messages.reduce((sum, m) => sum + (m.stats?.words || 0), 0),
                totalCharacters: messages.reduce((sum, m) => sum + (m.stats?.characters || 0), 0),
                sessionsCount: 1
            };
        }
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            totalMessages: 0,
            translatedMessages: 0,
            totalWords: 0,
            totalCharacters: 0,
            sessionsCount: 0
        };
    }
}

function getAllMessages() {
    try {
        if (typeof storage !== 'undefined' && storage.get) {
            return storage.get('eyeblink_messages_v2', []);
        } else {
            // Fallback to localStorage
            const messages = localStorage.getItem('eyeblink_messages_v2');
            return messages ? JSON.parse(messages) : [];
        }
    } catch (error) {
        console.error('Error getting messages:', error);
        return [];
    }
}

function getSettings() {
    try {
        if (typeof storage !== 'undefined' && storage.get) {
            return storage.get('eyeblink_settings_v2', {
                theme: 'light',
                fontSize: 'medium'
            });
        } else {
            // Fallback to localStorage
            const settings = localStorage.getItem('eyeblink_settings_v2');
            return settings ? JSON.parse(settings) : {
                theme: 'light',
                fontSize: 'medium'
            };
        }
    } catch (error) {
        console.error('Error getting settings:', error);
        return {
            theme: 'light',
            fontSize: 'medium'
        };
    }
}

function getCurrentSession() {
    try {
        if (typeof storage !== 'undefined' && storage.get) {
            return storage.get('eyeblink_session_v2', {
                startTime: Date.now(),
                deviceConnected: false
            });
        } else {
            // Fallback to localStorage
            const session = localStorage.getItem('eyeblink_session_v2');
            return session ? JSON.parse(session) : {
                startTime: Date.now(),
                deviceConnected: false
            };
        }
    } catch (error) {
        console.error('Error getting session:', error);
        return {
            startTime: Date.now(),
            deviceConnected: false
        };
    }
}

function startSession() {
    const sessionData = {
        startTime: Date.now(),
        messagesAtStart: getAllMessages().length,
        deviceConnected: false
    };
    
    try {
        if (typeof storage !== 'undefined' && storage.set) {
            storage.set('eyeblink_session_v2', sessionData);
        } else {
            localStorage.setItem('eyeblink_session_v2', JSON.stringify(sessionData));
        }
        sessionStartTime = sessionData.startTime;
    } catch (error) {
        console.error('Error starting session:', error);
    }
}

function showToast(message, type = 'info', duration = 3000) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1000;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}

/**
 * Clean up when leaving page
 */
window.addEventListener('beforeunload', () => {
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
});

/**
 * Handle visibility change to pause/resume timers
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden');
    } else {
        console.log('Page visible');
        updateDashboard(); // Refresh data when returning
    }
});