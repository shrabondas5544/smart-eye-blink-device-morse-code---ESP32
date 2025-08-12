// ==================== HOME PAGE LOGIC ====================

let sessionTimer = null;
let sessionStartTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    updateDashboard();
    renderMorseReference();
    setupEventListeners();
    startSessionTimer();
    applyThemeSettings();
});

/**
 * Initialize the home page
 */
function initializePage() {
    showToast('Welcome to Eye-Blink Morse Communicator!', 'info', 2000);
    updateStats();
}

/**
 * Update dashboard statistics
 */
function updateDashboard() {
    const stats = getStats();
    const messages = getAllMessages();
    
    // Update message count
    document.getElementById('messageCount').textContent = stats.totalMessages || 0;
    
    // Update device status
    const deviceStatusEl = document.getElementById('deviceStatus');
    const session = getCurrentSession();
    
    if (session.deviceConnected) {
        deviceStatusEl.textContent = 'Online';
        deviceStatusEl.className = 'stat-status online';
    } else {
        deviceStatusEl.textContent = 'Offline';
        deviceStatusEl.className = 'stat-status offline';
    }
    
    // Update recent messages
    updateRecentMessages(messages.slice(0, 3));
}

/**
 * Update recent messages display
 * @param {Array} messages - Recent messages to display
 */
function updateRecentMessages(messages) {
    const recentMessagesEl = document.getElementById('recentMessages');
    
    if (!messages || messages.length === 0) {
        recentMessagesEl.innerHTML = '<div class="empty-state">No messages yet</div>';
        return;
    }
    
    const messagesHtml = messages.map(msg => `
        <div class="recent-item">
            <strong>${truncateText(msg.text, 80)}</strong>
            <div class="muted">
                ${msg.translated ? `🌐 Translated • ` : ''}
                ${msg.date} • ${msg.stats.words} words
            </div>
        </div>
    `).join('');
    
    recentMessagesEl.innerHTML = messagesHtml;
}

/**
 * Render Morse code reference
 */
function renderMorseReference() {
    const { letters, numbers } = getMorseCodeReference();
    
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
            chartContent.style.display = isVisible ? 'none' : 'block';
            toggleChartBtn.textContent = isVisible ? 'Show Chart' : 'Hide Chart';
            
            if (!isVisible) {
                chartContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
    
    // Tutorial button
    const tutorialBtn = document.getElementById('showTutorialBtn');
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', showTutorial);
    }
    
    // Quick actions
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', handleQuickAction);
    });
    
    // Welcome message
    updateWelcomeMessage();
    
    // Refresh dashboard periodically
    setInterval(updateDashboard, 30000); // Every 30 seconds
    
    // Update welcome message every hour
    setInterval(updateWelcomeMessage, 3600000); // Every hour
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
 * Handle quick action button clicks
 * @param {Event} event - Click event
 */
function handleQuickAction(event) {
    const action = event.target.dataset.action;
    
    switch (action) {
        case 'newMessage':
            window.location.href = 'communication.html';
            break;
        case 'viewMessages':
            window.location.href = 'messages.html';
            break;
        case 'settings':
            window.location.href = 'settings.html';
            break;
        case 'practice':
            window.location.href = 'practice.html';
            break;
        case 'help':
            showTutorial();
            break;
        case 'clearData':
            handleClearData();
            break;
        default:
            console.warn('Unknown quick action:', action);
    }
}

/**
 * Handle clear data action
 */
function handleClearData() {
    if (confirm('Are you sure you want to clear all messages and data? This cannot be undone.')) {
        if (confirm('This will permanently delete all your messages. Are you absolutely sure?')) {
            try {
                clearAllData();
                updateDashboard();
                showToast('All data cleared successfully', 'success');
            } catch (error) {
                console.error('Error clearing data:', error);
                showToast('Error clearing data', 'error');
            }
        }
    }
}

/**
 * Start session timer
 */
function startSessionTimer() {
    const sessionTimeEl = document.getElementById('sessionTime');
    
    if (!sessionTimeEl) return;
    
    sessionTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        sessionTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    document.body.className = (document.body.className || '').replace(/font-\w+/g, '') + ` font-${settings.fontSize}`;
    
    // Apply animation preferences
    if (!settings.animations) {
        document.documentElement.style.setProperty('--animation-duration', '0ms');
    }
}

/**
 * Update welcome message based on time of day
 */
function updateWelcomeMessage() {
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) {
        welcomeEl.textContent = getWelcomeMessage();
    }
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

/**
 * Get welcome message based on time of day
 * @returns {string} - Welcome message
 */
function getWelcomeMessage() {
    const hour = new Date().getHours();
    
    if (hour < 12) {
        return 'Good morning! Ready to communicate?';
    } else if (hour < 17) {
        return 'Good afternoon! Let\'s start blinking!';
    } else {
        return 'Good evening! Time for some Morse code!';
    }
}

/**
 * Show app tutorial
 */
function showTutorial() {
    const tutorialSteps = [
        {
            title: 'Welcome!',
            content: 'This app converts eye blinks into Morse code for communication.',
            element: null
        },
        {
            title: 'Connect Your Device',
            content: 'First, connect your ESP32 device using the Connect Device button.',
            element: '#connectDeviceBtn'
        },
        {
            title: 'Start Communication',
            content: 'Use the Communication page to receive and decode Morse signals.',
            element: 'nav a[href="communication.html"]'
        },
        {
            title: 'View Messages',
            content: 'All your decoded messages are saved and can be viewed in the Messages section.',
            element: 'nav a[href="messages.html"]'
        },
        {
            title: 'Customize Settings',
            content: 'Adjust themes, voice settings, and more in the Settings page.',
            element: 'nav a[href="settings.html"]'
        },
        {
            title: 'Practice Mode',
            content: 'Use the Practice page to learn and improve your Morse code skills.',
            element: 'nav a[href="practice.html"]'
        }
    ];
    
    let currentStep = 0;
    
    function showStep(step) {
        // Remove any existing tutorial modal
        const existingModal = document.querySelector('.tutorial-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'tutorial-modal';
        modal.innerHTML = `
            <div class="tutorial-overlay"></div>
            <div class="tutorial-content">
                <div class="tutorial-header">
                    <h3>${tutorialSteps[step].title}</h3>
                    <button class="tutorial-close" onclick="closeTutorial()">×</button>
                </div>
                <div class="tutorial-body">
                    <p>${tutorialSteps[step].content}</p>
                </div>
                <div class="tutorial-controls">
                    <button class="btn btn-outline" onclick="closeTutorial()">Skip Tutorial</button>
                    <div class="tutorial-navigation">
                        ${step > 0 ? '<button class="btn btn-secondary" onclick="previousTutorialStep()">Previous</button>' : ''}
                        <button class="btn btn-primary" onclick="nextTutorialStep()">${step < tutorialSteps.length - 1 ? 'Next' : 'Finish'}</button>
                    </div>
                </div>
                <div class="tutorial-progress">
                    <div class="tutorial-progress-bar">
                        <div class="tutorial-progress-fill" style="width: ${((step + 1) / tutorialSteps.length) * 100}%"></div>
                    </div>
                    <span class="tutorial-step-indicator">Step ${step + 1} of ${tutorialSteps.length}</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Highlight element if specified
        if (tutorialSteps[step].element) {
            const element = document.querySelector(tutorialSteps[step].element);
            if (element) {
                element.classList.add('tutorial-highlight');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        // Add keyboard navigation
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeTutorial();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                nextTutorialStep();
            } else if (e.key === 'ArrowLeft' && step > 0) {
                previousTutorialStep();
            }
        });
        
        // Focus the modal for keyboard navigation
        modal.tabIndex = -1;
        modal.focus();
    }
    
    window.nextTutorialStep = function() {
        clearTutorialHighlight();
        currentStep++;
        
        if (currentStep < tutorialSteps.length) {
            showStep(currentStep);
        } else {
            closeTutorial();
            setSetting('hasSeenTutorial', true);
            showToast('Tutorial completed! You can access it anytime from the Help button.', 'success', 3000);
        }
    };
    
    window.previousTutorialStep = function() {
        if (currentStep > 0) {
            clearTutorialHighlight();
            currentStep--;
            showStep(currentStep);
        }
    };
    
    window.closeTutorial = function() {
        clearTutorialHighlight();
        const modal = document.querySelector('.tutorial-modal');
        if (modal) {
            modal.remove();
        }
        setSetting('hasSeenTutorial', true);
    };
    
    function clearTutorialHighlight() {
        const highlighted = document.querySelectorAll('.tutorial-highlight');
        highlighted.forEach(el => el.classList.remove('tutorial-highlight'));
    }
    
    // Check if user has seen tutorial
    const hasSeenTutorial = getSetting('hasSeenTutorial', false);
    if (!hasSeenTutorial) {
        setTimeout(() => {
            if (confirm('Would you like to see a quick tutorial of the app?')) {
                showStep(0);
            } else {
                setSetting('hasSeenTutorial', true);
            }
        }, 2000); // Show after 2 seconds
    }
    
    // If called manually, always show tutorial
    if (hasSeenTutorial) {
        showStep(0);
    }
}

/**
 * Show app statistics
 */
function showAppStatistics() {
    const stats = getDetailedStats();
    const modal = document.createElement('div');
    modal.className = 'stats-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 App Statistics</h3>
                <button class="modal-close" onclick="this.closest('.stats-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${formatNumber(stats.totalMessages)}</div>
                        <div class="stat-label">Total Messages</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${formatNumber(stats.totalWords)}</div>
                        <div class="stat-label">Words Decoded</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${formatNumber(stats.totalCharacters)}</div>
                        <div class="stat-label">Characters</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.sessionsCount}</div>
                        <div class="stat-label">Sessions</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Math.round(stats.averageWPM)}%</div>
                        <div class="stat-label">Avg Accuracy</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.longestMessage}</div>
                        <div class="stat-label">Longest Message</div>
                    </div>
                </div>
                <div class="stats-charts">
                    <h4>Usage Over Time</h4>
                    <canvas id="usageChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Simple usage chart (would need Chart.js in real implementation)
    setTimeout(() => {
        const canvas = document.getElementById('usageChart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'var(--primary)';
            ctx.fillText('Usage chart would be rendered here with Chart.js', 10, 100);
        }
    }, 100);
}

/**
 * Export data functionality
 */
function exportAppData() {
    try {
        const data = {
            messages: getAllMessages(),
            stats: getStats(),
            settings: getSettings(),
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `morse-communicator-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        showToast('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Error exporting data', 'error');
    }
}

/**
 * Import data functionality
 */
function importAppData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (confirm('This will overwrite all existing data. Continue?')) {
                    // Import messages
                    if (data.messages) {
                        data.messages.forEach(msg => saveMessage(msg));
                    }
                    
                    // Import settings
                    if (data.settings) {
                        Object.keys(data.settings).forEach(key => {
                            setSetting(key, data.settings[key]);
                        });
                    }
                    
                    showToast('Data imported successfully!', 'success');
                    updateDashboard();
                    applyThemeSettings();
                }
            } catch (error) {
                console.error('Import error:', error);
                showToast('Error importing data - invalid file format', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
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
        // Page is hidden, could pause timers
        console.log('Page hidden');
    } else {
        // Page is visible again
        console.log('Page visible');
        updateDashboard(); // Refresh data when returning
    }
});