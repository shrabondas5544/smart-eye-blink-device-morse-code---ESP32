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
// Enhanced Translation Function with Multiple Online APIs
// Replace the translateCurrentMessage function in communication.js

async function translateCurrentMessage() {
    const text = decodedText.trim();
    
    if (!text) {
        showToast('No text to translate', 'warning', 2000);
        return;
    }
    
    const settings = getSettings() || {};
    const targetLang = settings.targetLanguage || 'bn'; // Bengali
    
    try {
        showToast('Translating to Bengali...', 'info', 2000);
        
        // Try multiple translation services in order of preference
        let translatedText = null;
        let usedService = '';
        
        // Method 1: Try MyMemory API (most reliable, free)
        try {
            translatedText = await translateWithMyMemory(text, 'en', targetLang);
            usedService = 'MyMemory API';
        } catch (error) {
            console.log('MyMemory translation failed:', error.message);
        }
        
        // Method 2: Try LibreTranslate as fallback
        if (!translatedText) {
            try {
                translatedText = await translateWithLibreTranslate(text, 'en', targetLang);
                usedService = 'LibreTranslate API';
            } catch (error) {
                console.log('LibreTranslate failed:', error.message);
            }
        }
        
        // Method 3: Try Google Translate API (using CORS proxy)
        if (!translatedText) {
            try {
                translatedText = await translateWithGoogleFallback(text, 'en', targetLang);
                usedService = 'Google Translate API';
            } catch (error) {
                console.log('Google Translate fallback failed:', error.message);
            }
        }
        
        // Method 4: Try Microsoft Translator as final fallback
        if (!translatedText) {
            try {
                translatedText = await translateWithMicrosoftFallback(text, 'en', targetLang);
                usedService = 'Microsoft Translator';
            } catch (error) {
                console.log('Microsoft Translator failed:', error.message);
            }
        }
        
        if (translatedText && translatedText.trim() !== text.trim()) {
            // Show translation result in a modal
            showTranslationModal(text, translatedText, usedService);
            
        } else {
            throw new Error('All translation services failed or returned identical text');
        }
        
    } catch (error) {
        console.error('Translation error:', error);
        showTranslationError(text, error.message);
    }
}

// MyMemory Translation API (Free, reliable, supports Bengali)
async function translateWithMyMemory(text, sourceLang, targetLang) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Eye-Blink-Morse-App/1.0',
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
        const translated = data.responseData.translatedText.trim();
        if (translated && translated.toLowerCase() !== text.toLowerCase()) {
            return translated;
        } else {
            throw new Error('MyMemory returned identical or empty translation');
        }
    } else {
        throw new Error('MyMemory translation failed: ' + (data.responseDetails || 'Unknown error'));
    }
}

// LibreTranslate API with multiple instances
async function translateWithLibreTranslate(text, sourceLang, targetLang) {
    const instances = [
        'https://libretranslate.de',
        'https://translate.argosopentech.com',
        'https://libretranslate.com'
    ];
    
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        try {
            console.log(`Trying LibreTranslate instance: ${instance}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${instance}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang,
                    format: 'text'
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.translatedText && result.translatedText.trim()) {
                const translated = result.translatedText.trim();
                if (translated.toLowerCase() !== text.toLowerCase()) {
                    return translated;
                } else {
                    throw new Error('LibreTranslate returned identical text');
                }
            } else {
                throw new Error('No translation text in response');
            }
            
        } catch (error) {
            console.log(`LibreTranslate instance ${instance} failed:`, error.message);
            
            // If this is the last instance, throw the error
            if (i === instances.length - 1) {
                throw new Error(`All LibreTranslate instances failed. Last error: ${error.message}`);
            }
            
            continue;
        }
    }
}

// Google Translate fallback using CORS proxy
async function translateWithGoogleFallback(text, sourceLang, targetLang) {
    const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://api.codetabs.com/v1/proxy?quest='
    ];
    
    for (const proxyUrl of proxies) {
        try {
            const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const response = await fetch(proxyUrl + encodeURIComponent(googleUrl), {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Proxy error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const translated = data[0][0][0].trim();
                if (translated && translated.toLowerCase() !== text.toLowerCase()) {
                    return translated;
                } else {
                    throw new Error('Google Translate returned identical text');
                }
            } else {
                throw new Error('Invalid response format from Google Translate');
            }
            
        } catch (error) {
            console.log(`Google Translate proxy failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('All Google Translate proxies failed');
}

// Microsoft Translator fallback
async function translateWithMicrosoftFallback(text, sourceLang, targetLang) {
    try {
        // Using a public Microsoft Translator endpoint
        const response = await fetch('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + targetLang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify([{
                'text': text
            }])
        });
        
        if (!response.ok) {
            throw new Error(`Microsoft Translator error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data[0] && data[0].translations && data[0].translations[0] && data[0].translations[0].text) {
            const translated = data[0].translations[0].text.trim();
            if (translated && translated.toLowerCase() !== text.toLowerCase()) {
                return translated;
            } else {
                throw new Error('Microsoft Translator returned identical text');
            }
        } else {
            throw new Error('Invalid response from Microsoft Translator');
        }
        
    } catch (error) {
        throw new Error('Microsoft Translator failed: ' + error.message);
    }
}

// Enhanced translation modal
function showTranslationModal(originalText, translatedText, service) {
    // Remove existing modal if any
    const existingModal = document.getElementById('translationModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'translationModal';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem;">Translation Result</h3>
            <button id="closeTranslationModal" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
            " title="Close">✕</button>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px;">Original (English):</label>
            <div style="
                padding: 12px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-family: system-ui, -apple-system, sans-serif;
                line-height: 1.5;
                color: #1f2937;
            ">${originalText}</div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px;">Translated (Bengali):</label>
            <div style="
                padding: 12px;
                background: #ecfdf5;
                border: 1px solid #10b981;
                border-radius: 6px;
                font-family: system-ui, -apple-system, sans-serif;
                line-height: 1.5;
                color: #1f2937;
                font-size: 1.1rem;
            " id="translatedTextContent">${translatedText}</div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <small style="color: #6b7280;">Translated using: <strong>${service}</strong></small>
        </div>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="saveTranslationBtn" style="
                background: #10b981;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
            ">💾 Save Translation</button>
            
            <button id="copyTranslationBtn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
            ">📋 Copy Bengali Text</button>
            
            <button id="speakTranslationBtn" style="
                background: #8b5cf6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
            ">🔊 Speak Bengali</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Event listeners
    document.getElementById('closeTranslationModal').addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    document.getElementById('saveTranslationBtn').addEventListener('click', () => {
        saveTranslatedMessage(originalText, translatedText, 'bn');
        modalOverlay.remove();
    });
    
    document.getElementById('copyTranslationBtn').addEventListener('click', () => {
        copyToClipboard(translatedText);
    });
    
    document.getElementById('speakTranslationBtn').addEventListener('click', () => {
        speakText(translatedText, 'bn');
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
    
    // Close on escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Show translation error
function showTranslationError(originalText, errorMessage) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        ">
            <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin: 0 0 15px 0; color: #dc2626;">Translation Failed</h3>
            <p style="color: #6b7280; margin-bottom: 20px;">All translation services are currently unavailable.</p>
            <p style="font-size: 14px; color: #9ca3af; margin-bottom: 25px;">Error: ${errorMessage}</p>
            
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick="copyToClipboard('${originalText.replace(/'/g, "\\'")}'); this.parentElement.parentElement.parentElement.remove();" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                ">📋 Copy Original Text</button>
                
                <button onclick="this.parentElement.parentElement.parentElement.remove();" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 10000);
    
    showToast('Translation failed. Please check your internet connection and try again.', 'error', 4000);
}

// Helper functions
function saveTranslatedMessage(originalText, translatedText, language) {
    try {
        if (typeof saveMessage === 'function') {
            const messageId = saveMessage(translatedText, true, language);
            showToast('Bengali translation saved successfully!', 'success', 3000);
        } else {
            const messages = JSON.parse(localStorage.getItem('eyeblink_messages_v2') || '[]');
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const stats = getTextStatistics(translatedText);
            
            messages.unshift({
                id: messageId,
                text: translatedText,
                originalText: originalText,
                translated: true,
                language: language,
                timestamp: Date.now(),
                date: new Date().toLocaleString(),
                stats: stats
            });
            
            if (messages.length > 100) {
                messages.splice(100);
            }
            
            localStorage.setItem('eyeblink_messages_v2', JSON.stringify(messages));
            showToast('Bengali translation saved successfully!', 'success', 3000);
        }
    } catch (error) {
        console.error('Save translation error:', error);
        showToast('Failed to save translation: ' + error.message, 'error', 3000);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Text copied to clipboard!', 'success', 2000);
        }).catch(err => {
            console.error('Clipboard error:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

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
            showToast('Text copied to clipboard!', 'success', 2000);
        } else {
            showToast('Failed to copy text', 'error', 2000);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showToast('Copy not supported on this browser', 'error', 3000);
    } finally {
        document.body.removeChild(textArea);
    }
}

function speakText(text, language = 'bn') {
    if (!('speechSynthesis' in window)) {
        showToast('Speech synthesis not supported on this browser', 'error', 3000);
        return;
    }
    
    try {
        speechSynthesis.cancel(); // Cancel any ongoing speech
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US'; // Bengali Bangladesh
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        const voices = speechSynthesis.getVoices();
        const bengaliVoice = voices.find(voice => 
            voice.lang.startsWith('bn') || 
            voice.name.toLowerCase().includes('bengali') ||
            voice.name.toLowerCase().includes('bangla')
        );
        
        if (bengaliVoice && language === 'bn') {
            utterance.voice = bengaliVoice;
        }
        
        utterance.onstart = () => showToast('Speaking Bengali text...', 'info', 1000);
        utterance.onend = () => showToast('Speech completed', 'success', 2000);
        utterance.onerror = (event) => {
            console.error('Speech error:', event.error);
            showToast('Speech failed: ' + event.error, 'error', 3000);
        };
        
        speechSynthesis.speak(utterance);
        
    } catch (error) {
        console.error('Speech error:', error);
        showToast('Speech failed: ' + error.message, 'error', 3000);
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