// ==================== COMMUNICATION PAGE LOGIC ====================

let serialPort = null;
let reader = null;
let keepReading = false;
let currentBuilding = '';
let decodedText = '';
let isConnected = false;

// UI elements
let liveMorseEl, buildingEl, decodedEl, statusEl, connectionStatusEl;
let connectBtn, disconnectBtn, saveBtn, translateBtn, speakBtn, clearBtn;
let manualBoxEl, wordCountEl, charCountEl;

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    applySettings();
    updateConnectionStatus();
});

/**
 * Initialize the communication page
 */
function initializePage() {
    // Get UI elements
    liveMorseEl = document.getElementById('liveMorse');
    buildingEl = document.getElementById('building');
    decodedEl = document.getElementById('decoded');
    statusEl = document.getElementById('statusText');
    connectionStatusEl = document.getElementById('connectionStatus');
    
    connectBtn = document.getElementById('connectSerialBtn');
    disconnectBtn = document.getElementById('disconnectSerialBtn');
    saveBtn = document.getElementById('saveBtn');
    translateBtn = document.getElementById('translateBtn');
    speakBtn = document.getElementById('speakBtn');
    clearBtn = document.getElementById('clearBtn');
    
    manualBoxEl = document.getElementById('manualBox');
    wordCountEl = document.getElementById('wordCount');
    charCountEl = document.getElementById('charCount');
    
    // Initialize displays
    updateDecoded();
    updateBuilding('—');
    
    // Check for auto-connect
    const settings = getSettings() || {};
    if (settings.autoConnect) {
        setTimeout(() => {
            if (confirm('Auto-connect is enabled. Connect to device now?')) {
                connectSerial();
            }
        }, 1000);
    }
    
    showToast('Communication page loaded', 'info', 2000);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Serial connection buttons
    connectBtn?.addEventListener('click', connectSerial);
    disconnectBtn?.addEventListener('click', disconnectSerial);
    
    // Text manipulation buttons
    saveBtn?.addEventListener('click', saveCurrentMessage);
    translateBtn?.addEventListener('click', translateCurrentMessage);
    speakBtn?.addEventListener('click', speakCurrentMessage);
    clearBtn?.addEventListener('click', clearCurrentMessage);
    
    // Manual input controls
    document.getElementById('mClear')?.addEventListener('click', clearManualInput);
    document.getElementById('mSend')?.addEventListener('click', addManualInput);
    
    // Manual morse buttons
    document.querySelectorAll('.morse-btn[data-ch]').forEach(btn => {
        btn.addEventListener('click', () => {
            const char = btn.getAttribute('data-ch');
            addToManualInput(char);
        });
    });
    
    // Quick reference toggle
    document.getElementById('toggleQuickRef')?.addEventListener('click', toggleQuickReference);
    
    // Decoded text editing
    if (decodedEl) {
        decodedEl.addEventListener('input', debounce(updateWordCount, 300));
        decodedEl.addEventListener('paste', () => {
            setTimeout(updateWordCount, 100);
        });
    }
    
    // Manual input editing
    if (manualBoxEl) {
        manualBoxEl.addEventListener('input', validateManualInput);
    }
}

/**
 * Connect to serial device
 */
async function connectSerial() {
    if (!('serial' in navigator)) {
        alert('Web Serial API not available. Please use Chrome or Edge browser.');
        return;
    }
    
    try {
        // Request a port and open the connection
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ 
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        
        isConnected = true;
        updateConnectionStatus();
        
        // Update connection status for other pages
        localStorage.setItem('device_connected', 'true');
        
        // Update session with connection status
        try {
            const session = getCurrentSession();
            session.deviceConnected = true;
            if (typeof storage !== 'undefined' && storage.set) {
                storage.set('eyeblink_session_v2', session);
            } else {
                localStorage.setItem('eyeblink_session_v2', JSON.stringify(session));
            }
        } catch (error) {
            console.error('Error updating session:', error);
        }
        
        // Start reading data
        keepReading = true;
        readSerialData();
        
        showToast('Serial device connected successfully!', 'success', 3000);
        
    } catch (error) {
        console.error('Serial connection failed:', error);
        alert('Serial connection failed: ' + error.message);
        isConnected = false;
        updateConnectionStatus();
        // Update connection status for other pages
        localStorage.setItem('device_connected', 'false');
    }
}

/**
 * Disconnect from serial device
 */
async function disconnectSerial() {
    keepReading = false;
    
    if (reader) {
        try {
            await reader.cancel();
        } catch (e) {
            console.error('Error canceling reader:', e);
        }
        reader = null;
    }
    
    if (serialPort) {
        try {
            await serialPort.close();
        } catch (e) {
            console.error('Error closing port:', e);
        }
        serialPort = null;
    }
    
    isConnected = false;
    updateConnectionStatus();
    
    // Update connection status for other pages
    localStorage.setItem('device_connected', 'false');
    
    // Update session with disconnection status
    try {
        const session = getCurrentSession();
        session.deviceConnected = false;
        if (typeof storage !== 'undefined' && storage.set) {
            storage.set('eyeblink_session_v2', session);
        } else {
            localStorage.setItem('eyeblink_session_v2', JSON.stringify(session));
        }
    } catch (error) {
        console.error('Error updating session:', error);
    }
    
    showToast('Serial device disconnected', 'info', 2000);
}

/**
 * Read serial data loop
 */
async function readSerialData() {
    if (!serialPort) return;
    
    try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable
            .pipeThrough(new TransformStream(new LineBreakTransformer()))
            .getReader();
        
        // Listen to data coming from the serial device
        while (keepReading) {
            const { value, done } = await reader.read();
            
            if (done) {
                // Allow the serial port to be closed later
                reader.releaseLock();
                break;
            }
            
            if (value) {
                handleSerialLine(value.trim());
            }
        }
        
    } catch (error) {
        console.error('Read error:', error);
        showToast('Communication error with device', 'error', 3000);
        
        // Try to reconnect or handle the error gracefully
        if (isConnected) {
            disconnectSerial();
        }
    }
}

/**
 * Handle incoming serial line
 * @param {string} line - Serial data line
 */
function handleSerialLine(line) {
    if (!line) return;
    
    console.log('Received:', line);
    
    // Update live morse display
    liveMorseEl.textContent = line;
    
    // Handle different line types
    if (line === '/' || line === 'SPACE') {
        // Word separator
        if (currentBuilding) {
            // Decode the current building pattern first
            const decoded = decodeMorse(currentBuilding);
            if (decoded && decoded !== '?') {
                decodedText += decoded;
            }
        }
        decodedText += ' ';
        currentBuilding = '';
        updateBuilding('—');
    } else if (line === '|' || line === 'LETTER') {
        // Letter separator - decode current building and start new
        if (currentBuilding) {
            const decoded = decodeMorse(currentBuilding);
            if (decoded && decoded !== '?') {
                decodedText += decoded;
            }
        }
        currentBuilding = '';
        updateBuilding('—');
    } else if (isValidMorse(line)) {
        // Complete Morse code sequence - decode it
        const decoded = decodeMorse(line);
        if (decoded && decoded !== '?') {
            decodedText += decoded;
        }
        currentBuilding = line;
        updateBuilding(line);
    } else if (line.match(/^[.\-]+$/)) {
        // Building morse pattern
        currentBuilding = line;
        updateBuilding(line);
    } else {
        // Raw data or command
        console.log('Raw data:', line);
        
        // If it looks like morse being built, show it
        if (line.includes('.') || line.includes('-')) {
            currentBuilding = line;
            updateBuilding(line);
        }
    }
    
    updateDecoded();
    
    // Auto-save if enabled
    const settings = getSettings() || {};
    if (settings.autoSave && decodedText.length > 0) {
        // Auto-save every 10 characters
        if (decodedText.length % 10 === 0) {
            saveCurrentMessage(true); // Silent save
        }
    }
}

/**
 * Update building display
 * @param {string} pattern - Current building pattern
 */
function updateBuilding(pattern) {
    const buildingText = buildingEl?.querySelector('.building-text');
    if (buildingText) {
        buildingText.textContent = pattern || '—';
    }
    
    // Add visual feedback based on pattern
    if (buildingEl) {
        buildingEl.classList.remove('building-dot', 'building-dash', 'active');
        
        if (pattern && pattern !== '—') {
            buildingEl.classList.add('active');
            
            if (pattern.includes('.') && !pattern.includes('-')) {
                buildingEl.classList.add('building-dot');
            } else if (pattern.includes('-') && !pattern.includes('.')) {
                buildingEl.classList.add('building-dash');
            }
        }
    }
}

/**
 * Update decoded text display
 */
function updateDecoded() {
    if (decodedEl) {
        decodedEl.textContent = decodedText;
    }
    updateWordCount();
}

/**
 * Update word and character count
 */
function updateWordCount() {
    const text = decodedEl ? decodedEl.textContent : decodedText;
    const stats = getTextStatistics(text);
    
    if (wordCountEl) wordCountEl.textContent = stats.words;
    if (charCountEl) charCountEl.textContent = stats.characters;
}

/**
 * Update connection status display
 */
function updateConnectionStatus() {
    const indicator = document.querySelector('.status-indicator');
    
    if (isConnected) {
        statusEl.textContent = 'Connected';
        indicator?.classList.remove('offline');
        indicator?.classList.add('online');
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        
        // Show device info
        const deviceInfo = document.getElementById('deviceInfo');
        if (deviceInfo) {
            deviceInfo.style.display = 'block';
            const portName = document.getElementById('portName');
            if (portName) portName.textContent = 'COM9 (ESP32)';
        }
        
    } else {
        statusEl.textContent = 'Disconnected';
        indicator?.classList.remove('online');
        indicator?.classList.add('offline');
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        
        // Hide device info
        const deviceInfo = document.getElementById('deviceInfo');
        if (deviceInfo) {
            deviceInfo.style.display = 'none';
        }
    }
}

/**
 * Save current message
 * @param {boolean} silent - Whether to show toast notification
 */
function saveCurrentMessage(silent = false) {
    const text = decodedText.trim();
    
    if (!text) {
        if (!silent) showToast('No text to save', 'warning', 2000);
        return;
    }
    
    try {
        // Use the storage system if available, fallback to localStorage
        if (typeof saveMessage === 'function') {
            const messageId = saveMessage(text, false, 'en');
            if (!silent) {
                showToast('Message saved successfully!', 'success', 2000);
            }
        } else {
            // Fallback to direct localStorage
            const messages = JSON.parse(localStorage.getItem('eyeblink_messages_v2') || '[]');
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const stats = getTextStatistics(text);
            
            messages.unshift({
                id: messageId,
                text: text,
                originalText: text,
                translated: false,
                language: 'en',
                timestamp: Date.now(),
                date: new Date().toLocaleString(),
                stats: stats
            });
            
            // Keep only last 100 messages
            if (messages.length > 100) {
                messages.splice(100);
            }
            
            localStorage.setItem('eyeblink_messages_v2', JSON.stringify(messages));
            
            if (!silent) {
                showToast('Message saved successfully!', 'success', 2000);
            }
        }
        
        // Update stats display
        setTimeout(updateWordCount, 100);
        
    } catch (error) {
        console.error('Save error:', error);
        if (!silent) {
            showToast('Failed to save message: ' + error.message, 'error', 3000);
        }
    }
}

/**
 * Translate current message
 */
async function translateCurrentMessage() {
    const text = decodedText.trim();
    
    if (!text) {
        showToast('No text to translate', 'warning', 2000);
        return;
    }
    
    const settings = getSettings() || {};
    const targetLang = settings.targetLanguage || 'bn';
    
    try {
        showToast('Translating...', 'info', 2000);
        
        const response = await fetch('https://libretranslate.de/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                source: 'en',
                target: targetLang,
                format: 'text'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Translation service error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.translatedText) {
            // Show translation in alert
            alert(`Original: ${text}\n\nTranslated to ${targetLang.toUpperCase()}:\n${result.translatedText}`);
            
            const saveTranslation = confirm('Save translated version?');
            
            if (saveTranslation) {
                try {
                    if (typeof saveMessage === 'function') {
                        saveMessage(result.translatedText, true, targetLang);
                    } else {
                        // Fallback to localStorage
                        const messages = JSON.parse(localStorage.getItem('eyeblink_messages_v2') || '[]');
                        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const stats = getTextStatistics(result.translatedText);
                        
                        messages.unshift({
                            id: messageId,
                            text: result.translatedText,
                            originalText: text,
                            translated: true,
                            language: targetLang,
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            stats: stats
                        });
                        
                        localStorage.setItem('eyeblink_messages_v2', JSON.stringify(messages));
                    }
                    
                    showToast('Translated message saved!', 'success', 3000);
                } catch (saveError) {
                    console.error('Save translation error:', saveError);
                    showToast('Translation succeeded but save failed', 'warning', 3000);
                }
            }
        } else {
            throw new Error('No translation received from service');
        }
        
    } catch (error) {
        console.error('Translation error:', error);
        
        // More specific error messages
        if (error.message.includes('Failed to fetch')) {
            showToast('Translation failed: Network error. Check internet connection.', 'error', 4000);
        } else if (error.message.includes('503') || error.message.includes('502')) {
            showToast('Translation service temporarily unavailable. Try again later.', 'error', 4000);
        } else {
            showToast(`Translation failed: ${error.message}`, 'error', 4000);
        }
        
        // Fallback: Show simple alert with text to copy
        const fallbackTranslate = confirm(`Translation service failed. Copy text to translate manually?\n\nText: ${text}`);
        if (fallbackTranslate) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Text copied to clipboard', 'success', 2000);
            }).catch(() => {
                showToast('Could not copy text', 'error', 2000);
            });
        }
    }
}

/**
 * Speak current message
 */
function speakCurrentMessage() {
    const text = decodedText.trim();
    
    if (!text) {
        showToast('No text to speak', 'warning', 2000);
        return;
    }
    
    if (!('speechSynthesis' in window)) {
        showToast('Speech synthesis not supported', 'error', 3000);
        return;
    }
    
    try {
        speechSynthesis.cancel(); // Stop any ongoing speech
        
        const utterance = new SpeechSynthesisUtterance(text);
        const settings = getSettings() || {};
        
        // Apply voice settings
        utterance.rate = settings.speechSpeed || 1.0;
        utterance.pitch = settings.voicePitch || 1.0;
        utterance.volume = 1.0;
        
        // Select voice based on preference
        const voices = speechSynthesis.getVoices();
        const genderPref = settings.voiceGender || 'female';
        
        let selectedVoice = voices.find(voice => 
            voice.name.toLowerCase().includes(genderPref) ||
            voice.name.toLowerCase().includes('female') && genderPref === 'female' ||
            voice.name.toLowerCase().includes('male') && genderPref === 'male'
        );
        
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.default) || voices[0];
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        // Event handlers
        utterance.onstart = () => showToast('Speaking...', 'info', 1000);
        utterance.onend = () => showToast('Speech completed', 'success', 2000);
        utterance.onerror = (event) => {
            console.error('Speech error:', event.error);
            showToast('Speech failed', 'error', 2000);
        };
        
        speechSynthesis.speak(utterance);
        
    } catch (error) {
        console.error('Speech error:', error);
        showToast('Speech failed', 'error', 3000);
    }
}

/**
 * Clear current message
 */
function clearCurrentMessage() {
    if (decodedText && !confirm('Clear current message?')) {
        return;
    }
    
    decodedText = '';
    currentBuilding = '';
    updateDecoded();
    updateBuilding('—');
    
    if (liveMorseEl) liveMorseEl.textContent = '(waiting for input)';
    
    showToast('Message cleared', 'info', 1500);
}

/**
 * Add character to manual input
 * @param {string} char - Character to add
 */
function addToManualInput(char) {
    if (!manualBoxEl) return;
    
    const current = manualBoxEl.textContent || '';
    
    if (char === ' ') {
        manualBoxEl.textContent = current + ' ';
    } else {
        manualBoxEl.textContent = (current + ' ' + char).trim();
    }
    
    // Focus and move cursor to end
    manualBoxEl.focus();
    const range = document.createRange();
    range.selectNodeContents(manualBoxEl);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Clear manual input
 */
function clearManualInput() {
    if (manualBoxEl) {
        manualBoxEl.textContent = '';
        manualBoxEl.focus();
    }
}

/**
 * Add manual input to decoded text
 */
function addManualInput() {
    if (!manualBoxEl) return;
    
    const manualText = manualBoxEl.textContent.trim();
    if (!manualText) return;
    
    // Split by spaces and decode each morse sequence
    const tokens = manualText.split(/\s+/);
    let addedText = '';
    
    for (const token of tokens) {
        if (token === '/' || token === 'SPACE') {
            addedText += ' ';
        } else if (isValidMorse(token)) {
            const decoded = decodeMorse(token);
            addedText += decoded;
        }
    }
    
    if (addedText) {
        decodedText += addedText;
        updateDecoded();
        clearManualInput();
        showToast(`Added: ${addedText}`, 'success', 2000);
    } else {
        showToast('No valid Morse code found', 'warning', 2000);
    }
}

/**
 * Validate manual input in real-time
 */
function validateManualInput() {
    if (!manualBoxEl) return;
    
    const text = manualBoxEl.textContent;
    const isValid = !text || isValidMorse(text) || text.includes('/') || text.includes('SPACE');
    
    if (isValid) {
        manualBoxEl.style.borderColor = '';
        manualBoxEl.style.background = '';
    } else {
        manualBoxEl.style.borderColor = 'var(--danger)';
        manualBoxEl.style.background = 'rgba(239, 68, 68, 0.1)';
    }
}

/**
 * Toggle quick reference display
 */
function toggleQuickReference() {
    const content = document.getElementById('quickRefContent');
    const button = document.getElementById('toggleQuickRef');
    
    if (content && button) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? 'Show' : 'Hide';
    }
}

/**
 * Apply user settings
 */
function applySettings() {
    const settings = getSettings() || {};
    
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
 * Line break transformer for serial data
 */
class LineBreakTransformer {
    constructor() {
        this.chunks = '';
    }
    
    transform(chunk, controller) {
        this.chunks += chunk;
        const lines = this.chunks.split('\n');
        this.chunks = lines.pop() || '';
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                controller.enqueue(trimmed);
            }
        }
    }
    
    flush(controller) {
        const trimmed = this.chunks.trim();
        if (trimmed) {
            controller.enqueue(trimmed);
        }
    }
}

// Helper functions (fallbacks if not defined elsewhere)
function getSettings() {
    try {
        return JSON.parse(localStorage.getItem('eyeblink_settings_v2') || '{}');
    } catch {
        return {};
    }
}

function getTextStatistics(text) {
    if (!text || typeof text !== 'string') {
        return { characters: 0, words: 0, sentences: 0 };
    }
    
    const characters = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    return { characters, words, sentences };
}

// Morse Code utilities (fallback if morse.js not loaded)
const MORSE_CODE_MAP = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
    "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
    "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
    ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
    "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
    "--..": "Z", "-----": "0", ".----": "1", "..---": "2", "...--": "3", 
    "....-": "4", ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9"
};

function isValidMorse(morse) {
    if (!morse || typeof morse !== 'string') return false;
    return /^[.\-\s/]+$/.test(morse);
}

function decodeMorse(morse) {
    if (!morse || typeof morse !== 'string') return '';
    
    if (morse === '/' || morse === ' / ' || morse.trim() === '/') {
        return ' ';
    }
    
    const cleanMorse = morse.trim().replace(/\s+/g, ' ');
    const letters = cleanMorse.split(' ').filter(letter => letter.length > 0);
    
    return letters.map(letter => {
        if (letter === '/') return ' ';
        return MORSE_CODE_MAP[letter] || '?';
    }).join('');
}

function showToast(message, type = 'info', duration = 3000) {
    // Simple toast implementation
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You can enhance this with actual toast UI
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
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

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

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
    if (isConnected) {
        await disconnectSerial();
    }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isConnected) {
        // Optionally disconnect when tab is hidden
        const settings = getSettings();
        if (settings.disconnectOnHidden) {
            disconnectSerial();
        }
    }
});