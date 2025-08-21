// ==================== ENHANCED COMMUNICATION PAGE LOGIC ====================
// Supports both Serial (Desktop) and Bluetooth (Mobile) connections

let serialPort = null;
let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let reader = null;
let keepReading = false;
let currentBuilding = '';
let decodedText = '';
let isConnected = false;
let connectionType = null; // 'serial' or 'bluetooth'

// UI elements
let liveMorseEl, buildingEl, decodedEl, statusEl, connectionStatusEl;
let connectBtn, disconnectBtn, saveBtn, translateBtn, speakBtn, clearBtn;
let manualBoxEl, wordCountEl, charCountEl;

// Bluetooth configuration
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const TX_CHARACTERISTIC = '87654321-4321-4321-4321-cba987654321'; // For receiving data from ESP32
const RX_CHARACTERISTIC = '11111111-2222-3333-4444-555555555555'; // For sending commands to ESP32
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    applySettings();
    updateConnectionStatus();
    detectConnectionMethod();
});

/**
 * Detect which connection method to use based on device
 */
function detectConnectionMethod() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasSerial = 'serial' in navigator;
    const hasBluetooth = 'bluetooth' in navigator;
    
    console.log('Device detection:', { isMobile, hasSerial, hasBluetooth });
    
    // Update UI based on available APIs
    updateConnectionUI(isMobile, hasSerial, hasBluetooth);
}

/**
 * Update connection UI based on available APIs
 */
function updateConnectionUI(isMobile, hasSerial, hasBluetooth) {
    const connectBtn = document.getElementById('connectSerialBtn');
    
    if (!connectBtn) return;
    
    if (isMobile && hasBluetooth) {
        connectBtn.innerHTML = '<span>📱</span> Connect Bluetooth';
        connectBtn.title = 'Connect via Bluetooth (Mobile)';
    } else if (hasSerial) {
        connectBtn.innerHTML = '<span>🔌</span> Connect Serial';
        connectBtn.title = 'Connect via Serial Port (Desktop)';
    } else {
        connectBtn.innerHTML = '<span>❌</span> Not Supported';
        connectBtn.disabled = true;
        connectBtn.title = 'Connection not supported on this device/browser';
        showToast('Connection not supported. Use Chrome on Desktop or Android.', 'error', 5000);
    }
}

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
                connectDevice();
            }
        }, 1000);
    }
    
    showToast('Communication page loaded', 'info', 2000);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Connection buttons
    connectBtn?.addEventListener('click', connectDevice);
    disconnectBtn?.addEventListener('click', disconnectDevice);
    
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
 * Smart connection method - tries appropriate method based on device
 */
async function connectDevice() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasSerial = 'serial' in navigator;
    const hasBluetooth = 'bluetooth' in navigator;
    
    if (isMobile && hasBluetooth) {
        await connectBluetooth();
    } else if (hasSerial) {
        await connectSerial();
    } else {
        showToast('No supported connection method available', 'error', 3000);
    }
}

/**
 * Connect via Bluetooth (for mobile devices)
 */
async function connectBluetooth() {
    if (!('bluetooth' in navigator)) {
        showToast('Web Bluetooth API not supported on this browser', 'error', 3000);
        return;
    }
    
    try {
        showToast('Searching for Bluetooth devices...', 'info', 2000);
        
        // Request device with custom service or common serial service
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'ESP32' },
                { namePrefix: 'EyeBlink' },
                { namePrefix: 'Arduino' },
                { namePrefix: 'HC-' },
                { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }, // Common serial service
                { services: [BLUETOOTH_SERVICE_UUID] } // Custom service
            ],
            optionalServices: [
                '0000ffe0-0000-1000-8000-00805f9b34fb', // Serial port service
                BLUETOOTH_SERVICE_UUID,
                'battery_service',
                'device_information'
            ]
        });
        
        console.log('Selected device:', bluetoothDevice.name);
        
        // Connect to GATT server
        const server = await bluetoothDevice.gatt.connect();
        console.log('Connected to GATT server');
        
        // Try to find the correct service
        let service;
        try {
            // Try custom service first
            service = await server.getPrimaryService(BLUETOOTH_SERVICE_UUID);
            console.log('Using custom service');
        } catch (e) {
            try {
                // Fallback to common serial service
                service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
                console.log('Using standard serial service');
            } catch (e2) {
                throw new Error('No compatible service found on device');
            }
        }
        
        // Get characteristic for receiving data
        try {
            bluetoothCharacteristic = await service.getCharacteristic(BLUETOOTH_CHARACTERISTIC_UUID);
        } catch (e) {
            try {
                // Fallback to common serial characteristic
                bluetoothCharacteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
            } catch (e2) {
                throw new Error('No compatible characteristic found');
            }
        }
        
        // Start notifications
        await bluetoothCharacteristic.startNotifications();
        bluetoothCharacteristic.addEventListener('characteristicvaluechanged', handleBluetoothData);
        
        // Handle disconnection
        bluetoothDevice.addEventListener('gattserverdisconnected', handleBluetoothDisconnection);
        
        isConnected = true;
        connectionType = 'bluetooth';
        updateConnectionStatus();
        
        // Update connection status for other pages
        localStorage.setItem('device_connected', 'true');
        localStorage.setItem('connection_type', 'bluetooth');
        
        // Update session
        updateSessionConnection(true);
        
        showToast(`Bluetooth connected: ${bluetoothDevice.name}`, 'success', 3000);
        
    } catch (error) {
        console.error('Bluetooth connection failed:', error);
        
        let errorMessage = 'Bluetooth connection failed';
        if (error.message.includes('User cancelled')) {
            errorMessage = 'Connection cancelled by user';
        } else if (error.message.includes('No compatible')) {
            errorMessage = 'Device not compatible. Make sure your ESP32 has the correct Bluetooth service.';
        } else {
            errorMessage = `Bluetooth error: ${error.message}`;
        }
        
        showToast(errorMessage, 'error', 4000);
        isConnected = false;
        connectionType = null;
        updateConnectionStatus();
        localStorage.setItem('device_connected', 'false');
    }
}

/**
 * Connect via Serial (for desktop)
 */
async function connectSerial() {
    if (!('serial' in navigator)) {
        showToast('Web Serial API not available. Please use Chrome or Edge browser.', 'error', 3000);
        return;
    }
    
    try {
        showToast('Selecting serial port...', 'info', 2000);
        
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
        connectionType = 'serial';
        updateConnectionStatus();
        
        // Update connection status for other pages
        localStorage.setItem('device_connected', 'true');
        localStorage.setItem('connection_type', 'serial');
        
        // Update session
        updateSessionConnection(true);
        
        // Start reading data
        keepReading = true;
        readSerialData();
        
        showToast('Serial device connected successfully!', 'success', 3000);
        
    } catch (error) {
        console.error('Serial connection failed:', error);
        
        let errorMessage = 'Serial connection failed';
        if (error.message.includes('No port selected')) {
            errorMessage = 'No device selected';
        } else {
            errorMessage = `Serial error: ${error.message}`;
        }
        
        showToast(errorMessage, 'error', 3000);
        isConnected = false;
        connectionType = null;
        updateConnectionStatus();
        localStorage.setItem('device_connected', 'false');
    }
}

/**
 * Handle incoming Bluetooth data
 */
function handleBluetoothData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const data = decoder.decode(value);
    
    console.log('Bluetooth data received:', data);
    
    // Process each line
    const lines = data.split('\n');
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            handleDataLine(trimmedLine);
        }
    });
}

/**
 * Handle Bluetooth disconnection
 */
function handleBluetoothDisconnection() {
    console.log('Bluetooth device disconnected');
    isConnected = false;
    connectionType = null;
    bluetoothDevice = null;
    bluetoothCharacteristic = null;
    
    updateConnectionStatus();
    localStorage.setItem('device_connected', 'false');
    updateSessionConnection(false);
    
    showToast('Bluetooth device disconnected', 'warning', 3000);
}

/**
 * Disconnect device (handles both serial and bluetooth)
 */
async function disconnectDevice() {
    keepReading = false;
    
    if (connectionType === 'bluetooth' && bluetoothDevice) {
        try {
            if (bluetoothCharacteristic) {
                await bluetoothCharacteristic.stopNotifications();
                bluetoothCharacteristic.removeEventListener('characteristicvaluechanged', handleBluetoothData);
            }
            
            if (bluetoothDevice.gatt.connected) {
                bluetoothDevice.gatt.disconnect();
            }
        } catch (e) {
            console.error('Error disconnecting Bluetooth:', e);
        }
        bluetoothDevice = null;
        bluetoothCharacteristic = null;
        
    } else if (connectionType === 'serial' && serialPort) {
        try {
            if (reader) {
                await reader.cancel();
                reader = null;
            }
            await serialPort.close();
        } catch (e) {
            console.error('Error disconnecting Serial:', e);
        }
        serialPort = null;
    }
    
    isConnected = false;
    connectionType = null;
    updateConnectionStatus();
    
    // Update connection status for other pages
    localStorage.setItem('device_connected', 'false');
    localStorage.removeItem('connection_type');
    updateSessionConnection(false);
    
    showToast('Device disconnected', 'info', 2000);
}

/**
 * Read serial data loop (for desktop serial connections)
 */
async function readSerialData() {
    if (!serialPort) return;
    
    try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable
            .pipeThrough(new TransformStream(new LineBreakTransformer()))
            .getReader();
        
        // Listen to data coming from the serial device
        while (keepReading) {
            const { value, done } = await reader.read();
            
            if (done) {
                reader.releaseLock();
                break;
            }
            
            if (value) {
                handleDataLine(value.trim());
            }
        }
        
    } catch (error) {
        console.error('Read error:', error);
        showToast('Communication error with device', 'error', 3000);
        
        if (isConnected) {
            disconnectDevice();
        }
    }
}

/**
 * Handle incoming data line (unified for both serial and bluetooth)
 * @param {string} line - Data line from device
 */
function handleDataLine(line) {
    if (!line) return;
    
    console.log('Received:', line);
    
    // Update live morse display
    if (liveMorseEl) {
        liveMorseEl.textContent = line;
    }
    
    // Handle different line types
    if (line === '/' || line === 'SPACE' || line === 'WORD_END') {
        // Word separator
        if (currentBuilding) {
            const decoded = decodeMorse(currentBuilding);
            if (decoded && decoded !== '?') {
                decodedText += decoded;
            }
        }
        decodedText += ' ';
        currentBuilding = '';
        updateBuilding('—');
    } else if (line === '|' || line === 'LETTER' || line === 'LETTER_END') {
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
        // Complete Morse code sequence
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
    } else if (line.startsWith('BLINK:') || line.startsWith('MORSE:')) {
        // Handle formatted messages from device
        const morseData = line.split(':')[1]?.trim();
        if (morseData) {
            currentBuilding = morseData;
            updateBuilding(morseData);
        }
    } else {
        // Raw data - try to extract morse if present
        console.log('Raw data:', line);
        
        if (line.includes('.') || line.includes('-')) {
            const morseMatch = line.match(/([.\-\s/]+)/);
            if (morseMatch) {
                currentBuilding = morseMatch[1].trim();
                updateBuilding(currentBuilding);
            }
        }
    }
    
    updateDecoded();
    
    // Auto-save if enabled
    const settings = getSettings() || {};
    if (settings.autoSave && decodedText.length > 0) {
        if (decodedText.length % 10 === 0) {
            saveCurrentMessage(true);
        }
    }
}

/**
 * Update session connection status
 */
function updateSessionConnection(connected) {
    try {
        const session = getCurrentSession();
        session.deviceConnected = connected;
        session.connectionType = connectionType;
        
        if (typeof storage !== 'undefined' && storage.set) {
            storage.set('eyeblink_session_v2', session);
        } else {
            localStorage.setItem('eyeblink_session_v2', JSON.stringify(session));
        }
    } catch (error) {
        console.error('Error updating session:', error);
    }
}

/**
 * Update building display
 */
function updateBuilding(pattern) {
    const buildingText = buildingEl?.querySelector('.building-text');
    if (buildingText) {
        buildingText.textContent = pattern || '—';
    }
    
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
        statusEl.textContent = `Connected (${connectionType})`;
        indicator?.classList.remove('offline');
        indicator?.classList.add('online');
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        
        // Show device info
        const deviceInfo = document.getElementById('deviceInfo');
        if (deviceInfo) {
            deviceInfo.style.display = 'block';
            const portName = document.getElementById('portName');
            if (portName) {
                const deviceName = bluetoothDevice?.name || 'Serial Device';
                portName.textContent = `${deviceName} (${connectionType})`;
            }
        }
        
        // Update connection status text
        const deviceStatusText = document.getElementById('deviceStatusText');
        if (deviceStatusText) {
            deviceStatusText.textContent = 'Ready and listening';
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
 */
function saveCurrentMessage(silent = false) {
    const text = decodedText.trim();
    
    if (!text) {
        if (!silent) showToast('No text to save', 'warning', 2000);
        return;
    }
    
    try {
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
            
            if (messages.length > 100) {
                messages.splice(100);
            }
            
            localStorage.setItem('eyeblink_messages_v2', JSON.stringify(messages));
            
            if (!silent) {
                showToast('Message saved successfully!', 'success', 2000);
            }
        }
        
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
            alert(`Original: ${text}\n\nTranslated to ${targetLang.toUpperCase()}:\n${result.translatedText}`);
            
            const saveTranslation = confirm('Save translated version?');
            
            if (saveTranslation) {
                try {
                    if (typeof saveMessage === 'function') {
                        saveMessage(result.translatedText, true, targetLang);
                    } else {
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
        
        if (error.message.includes('Failed to fetch')) {
            showToast('Translation failed: Network error. Check internet connection.', 'error', 4000);
        } else if (error.message.includes('503') || error.message.includes('502')) {
            showToast('Translation service temporarily unavailable. Try again later.', 'error', 4000);
        } else {
            showToast(`Translation failed: ${error.message}`, 'error', 4000);
        }
        
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
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const settings = getSettings() || {};
        
        utterance.rate = settings.speechSpeed || 1.0;
        utterance.pitch = settings.voicePitch || 1.0;
        utterance.volume = 1.0;
        
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
 */
function addToManualInput(char) {
    if (!manualBoxEl) return;
    
    const current = manualBoxEl.textContent || '';
    
    if (char === ' ') {
        manualBoxEl.textContent = current + ' ';
    } else {
        manualBoxEl.textContent = (current + ' ' + char).trim();
    }
    
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
    
    if (settings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    if (settings.fontSize) {
        document.body.className = (document.body.className || '').replace(/font-\w+/g, '') + ` font-${settings.fontSize}`;
    }
}

/**
 * Send data to device (for testing or commands)
 */
async function sendToDevice(data) {
    if (!isConnected) {
        showToast('Device not connected', 'error', 2000);
        return false;
    }
    
    try {
        if (connectionType === 'bluetooth' && bluetoothCharacteristic) {
            const encoder = new TextEncoder();
            const dataWithNewline = data + '\n';
            await bluetoothCharacteristic.writeValue(encoder.encode(dataWithNewline));
            console.log('Sent via Bluetooth:', data);
            return true;
            
        } else if (connectionType === 'serial' && serialPort) {
            const writer = serialPort.writable.getWriter();
            const encoder = new TextEncoder();
            await writer.write(encoder.encode(data + '\n'));
            writer.releaseLock();
            console.log('Sent via Serial:', data);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Send error:', error);
        showToast('Failed to send data to device', 'error', 2000);
        return false;
    }
}

/**
 * Test device connection
 */
async function testConnection() {
    if (!isConnected) {
        showToast('Device not connected', 'error', 2000);
        return;
    }
    
    showToast('Testing connection...', 'info', 1000);
    const success = await sendToDevice('TEST');
    
    if (success) {
        showToast('Connection test sent', 'success', 2000);
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

function getCurrentSession() {
    try {
        if (typeof storage !== 'undefined' && storage.get) {
            return storage.get('eyeblink_session_v2', {
                startTime: Date.now(),
                deviceConnected: false
            });
        } else {
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
    console.log(`[${type.toUpperCase()}] ${message}`);
    
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
        word-wrap: break-word;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
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

// Add connection test button (you can add this to your HTML if needed)
function addTestButton() {
    const connectionControls = document.querySelector('.connection-controls');
    if (connectionControls && !document.getElementById('testBtn')) {
        const testBtn = document.createElement('button');
        testBtn.id = 'testBtn';
        testBtn.className = 'btn btn-info';
        testBtn.innerHTML = '<span>🧪</span> Test Connection';
        testBtn.disabled = true;
        testBtn.addEventListener('click', testConnection);
        connectionControls.appendChild(testBtn);
        
        // Enable/disable based on connection status
        const updateTestButton = () => {
            testBtn.disabled = !isConnected;
        };
        
        // Update when connection changes
        setInterval(updateTestButton, 1000);
    }
}

// Enhanced connection status monitoring
function monitorConnection() {
    setInterval(() => {
        if (connectionType === 'bluetooth' && bluetoothDevice && !bluetoothDevice.gatt.connected) {
            handleBluetoothDisconnection();
        }
    }, 2000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
    if (isConnected) {
        await disconnectDevice();
    }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isConnected) {
        const settings = getSettings();
        if (settings.disconnectOnHidden) {
            disconnectDevice();
        }
    }
});

// Start connection monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    monitorConnection();
    addTestButton();
});