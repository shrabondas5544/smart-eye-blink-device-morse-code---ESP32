// ==================== SETTINGS PAGE LOGIC ====================

// Wait for DOM and storage to be ready
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    loadCurrentSettings();
    setupEventListeners();
    updateStorageInfo();
});

/**
 * Initialize the settings page
 */
function initializePage() {
    // Apply current settings immediately
    const settings = getSettings();
    applyTheme(settings.theme === 'dark');
    applyFontSize(settings.fontSize);
    
    showToast('Settings page loaded', 'info', 1500);
}

/**
 * Load and display current settings
 */
function loadCurrentSettings() {
    const settings = getSettings();
    
    // Theme settings
    const themeCheckbox = document.getElementById('themeCheckbox');
    if (themeCheckbox) {
        themeCheckbox.checked = settings.theme === 'dark';
    }
    
    // Font size
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
        fontSizeSelect.value = settings.fontSize || 'medium';
    }
    
    // Voice settings
    const voiceGenderSelect = document.getElementById('voiceGenderSelect');
    if (voiceGenderSelect) {
        voiceGenderSelect.value = settings.voiceGender || 'female';
    }
    
    const speechSpeedSlider = document.getElementById('speechSpeedSlider');
    const speedValue = document.getElementById('speedValue');
    if (speechSpeedSlider && speedValue) {
        speechSpeedSlider.value = settings.speechSpeed || 1.0;
        speedValue.textContent = `${settings.speechSpeed || 1.0}x`;
    }
    
    const voicePitchSlider = document.getElementById('voicePitchSlider');
    const pitchValue = document.getElementById('pitchValue');
    if (voicePitchSlider && pitchValue) {
        voicePitchSlider.value = settings.voicePitch || 1.0;
        pitchValue.textContent = (settings.voicePitch || 1.0).toFixed(1);
    }
    
    // Device settings
    const autoConnectCheckbox = document.getElementById('autoConnectCheckbox');
    if (autoConnectCheckbox) {
        autoConnectCheckbox.checked = settings.autoConnect || false;
    }
    
    const baudRateSelect = document.getElementById('baudRateSelect');
    if (baudRateSelect) {
        baudRateSelect.value = settings.baudRate || 115200;
    }
    
    // Translation settings
    const targetLanguageSelect = document.getElementById('targetLanguageSelect');
    if (targetLanguageSelect) {
        targetLanguageSelect.value = settings.targetLanguage || 'bn';
    }
    
    const autoTranslateCheckbox = document.getElementById('autoTranslateCheckbox');
    if (autoTranslateCheckbox) {
        autoTranslateCheckbox.checked = settings.autoTranslate || false;
    }
    
    // Data management settings
    const autoSaveCheckbox = document.getElementById('autoSaveCheckbox');
    if (autoSaveCheckbox) {
        autoSaveCheckbox.checked = settings.autoSave !== false; // Default to true
    }
    
    const messageLimitSelect = document.getElementById('messageLimitSelect');
    if (messageLimitSelect) {
        messageLimitSelect.value = settings.messageLimit || 100;
    }
}

/**
 * Setup event listeners for all settings controls
 */
function setupEventListeners() {
    // Theme toggle
    const themeCheckbox = document.getElementById('themeCheckbox');
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', handleThemeChange);
    }
    
    // Font size
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', handleFontSizeChange);
    }
    
    // Voice settings
    const voiceGenderSelect = document.getElementById('voiceGenderSelect');
    if (voiceGenderSelect) {
        voiceGenderSelect.addEventListener('change', handleVoiceGenderChange);
    }
    
    const speechSpeedSlider = document.getElementById('speechSpeedSlider');
    if (speechSpeedSlider) {
        speechSpeedSlider.addEventListener('input', handleSpeechSpeedChange);
    }
    
    const voicePitchSlider = document.getElementById('voicePitchSlider');
    if (voicePitchSlider) {
        voicePitchSlider.addEventListener('input', handleVoicePitchChange);
    }
    
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', testVoiceSettings);
    }
    
    // Device settings
    const autoConnectCheckbox = document.getElementById('autoConnectCheckbox');
    if (autoConnectCheckbox) {
        autoConnectCheckbox.addEventListener('change', handleAutoConnectChange);
    }
    
    const baudRateSelect = document.getElementById('baudRateSelect');
    if (baudRateSelect) {
        baudRateSelect.addEventListener('change', handleBaudRateChange);
    }
    
    // Translation settings
    const targetLanguageSelect = document.getElementById('targetLanguageSelect');
    if (targetLanguageSelect) {
        targetLanguageSelect.addEventListener('change', handleTargetLanguageChange);
    }
    
    const autoTranslateCheckbox = document.getElementById('autoTranslateCheckbox');
    if (autoTranslateCheckbox) {
        autoTranslateCheckbox.addEventListener('change', handleAutoTranslateChange);
    }
    
    // Data management settings
    const autoSaveCheckbox = document.getElementById('autoSaveCheckbox');
    if (autoSaveCheckbox) {
        autoSaveCheckbox.addEventListener('change', handleAutoSaveChange);
    }
    
    const messageLimitSelect = document.getElementById('messageLimitSelect');
    if (messageLimitSelect) {
        messageLimitSelect.addEventListener('change', handleMessageLimitChange);
    }
    
    // Data management buttons
    const exportSettingsBtn = document.getElementById('exportSettingsBtn');
    if (exportSettingsBtn) {
        exportSettingsBtn.addEventListener('click', exportSettings);
    }
    
    const importSettingsBtn = document.getElementById('importSettingsBtn');
    if (importSettingsBtn) {
        importSettingsBtn.addEventListener('click', importSettings);
    }
    
    // Reset buttons
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', handleResetSettings);
    }
    
    const resetAllBtn = document.getElementById('resetAllBtn');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', handleResetAll);
    }
}

// ==================== EVENT HANDLERS ====================

/**
 * Handle theme change
 */
function handleThemeChange(event) {
    const isDark = event.target.checked;
    setSetting('theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
    showToast(`Switched to ${isDark ? 'dark' : 'light'} theme`, 'success', 2000);
}

/**
 * Handle font size change
 */
function handleFontSizeChange(event) {
    const fontSize = event.target.value;
    setSetting('fontSize', fontSize);
    applyFontSize(fontSize);
    showToast(`Font size changed to ${fontSize}`, 'success', 2000);
}

/**
 * Handle voice gender change
 */
function handleVoiceGenderChange(event) {
    const gender = event.target.value;
    setSetting('voiceGender', gender);
    showToast(`Voice preference set to ${gender}`, 'success', 2000);
}

/**
 * Handle speech speed change
 */
function handleSpeechSpeedChange(event) {
    const speed = parseFloat(event.target.value);
    setSetting('speechSpeed', speed);
    
    const speedValue = document.getElementById('speedValue');
    if (speedValue) {
        speedValue.textContent = `${speed}x`;
    }
}

/**
 * Handle voice pitch change
 */
function handleVoicePitchChange(event) {
    const pitch = parseFloat(event.target.value);
    setSetting('voicePitch', pitch);
    
    const pitchValue = document.getElementById('pitchValue');
    if (pitchValue) {
        pitchValue.textContent = pitch.toFixed(1);
    }
}

/**
 * Test voice settings
 */
function testVoiceSettings() {
    if (!('speechSynthesis' in window)) {
        showToast('Speech synthesis not supported in this browser', 'error', 3000);
        return;
    }
    
    const settings = getSettings();
    const testText = 'Hello! This is a test of your voice settings in Eye-Blink Morse Communicator.';
    
    try {
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.rate = settings.speechSpeed || 1.0;
        utterance.pitch = settings.voicePitch || 1.0;
        utterance.volume = 1.0;
        
        // Select voice based on gender preference
        const voices = speechSynthesis.getVoices();
        const genderPref = settings.voiceGender || 'female';
        
        let selectedVoice = null;
        
        if (genderPref !== 'auto') {
            selectedVoice = voices.find(voice => {
                const name = voice.name.toLowerCase();
                return name.includes(genderPref) || 
                       (genderPref === 'female' && (name.includes('female') || name.includes('woman'))) ||
                       (genderPref === 'male' && (name.includes('male') || name.includes('man')));
            });
        }
        
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.default) || voices[0];
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.onstart = () => showToast('Testing voice...', 'info', 1000);
        utterance.onend = () => showToast('Voice test completed', 'success', 2000);
        utterance.onerror = () => showToast('Voice test failed', 'error', 2000);
        
        speechSynthesis.speak(utterance);
        
    } catch (error) {
        console.error('Voice test error:', error);
        showToast('Voice test failed', 'error', 2000);
    }
}

/**
 * Handle auto-connect change
 */
function handleAutoConnectChange(event) {
    const autoConnect = event.target.checked;
    setSetting('autoConnect', autoConnect);
    showToast(`Auto-connect ${autoConnect ? 'enabled' : 'disabled'}`, 'success', 2000);
}

/**
 * Handle baud rate change
 */
function handleBaudRateChange(event) {
    const baudRate = parseInt(event.target.value);
    setSetting('baudRate', baudRate);
    showToast(`Baud rate set to ${baudRate}`, 'success', 2000);
}

/**
 * Handle target language change
 */
function handleTargetLanguageChange(event) {
    const language = event.target.value;
    setSetting('targetLanguage', language);
    
    const languageName = event.target.selectedOptions[0].textContent.split(' (')[0];
    showToast(`Default translation language set to ${languageName}`, 'success', 2000);
}

/**
 * Handle auto-translate change
 */
function handleAutoTranslateChange(event) {
    const autoTranslate = event.target.checked;
    setSetting('autoTranslate', autoTranslate);
    showToast(`Auto-translate ${autoTranslate ? 'enabled' : 'disabled'}`, 'success', 2000);
}

/**
 * Handle auto-save change
 */
function handleAutoSaveChange(event) {
    const autoSave = event.target.checked;
    setSetting('autoSave', autoSave);
    showToast(`Auto-save ${autoSave ? 'enabled' : 'disabled'}`, 'success', 2000);
}

/**
 * Handle message limit change
 */
function handleMessageLimitChange(event) {
    const limit = parseInt(event.target.value);
    setSetting('messageLimit', limit);
    
    const limitText = limit === -1 ? 'unlimited' : `${limit} messages`;
    showToast(`Message limit set to ${limitText}`, 'success', 2000);
}

// ==================== IMPORT/EXPORT ====================

/**
 * Export settings to file
 */
function exportSettings() {
    try {
        const data = exportAllData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `eyeblink-backup-${new Date().toISOString().split('T')[0]}.json`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        showToast('Settings exported successfully!', 'success', 3000);
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export settings', 'error', 3000);
    }
}

/**
 * Import settings from file
 */
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (importData(data)) {
                showToast('Settings imported successfully!', 'success', 3000);
                
                // Reload the page to apply imported settings
                setTimeout(() => {
                    if (confirm('Settings imported! Reload page to see changes?')) {
                        location.reload();
                    }
                }, 1000);
            } else {
                throw new Error('Invalid data format');
            }
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('Failed to import settings - invalid file format', 'error', 3000);
        }
    };
    
    input.click();
}

/**
 * Handle reset settings
 */
function handleResetSettings() {
    if (confirm('Reset all settings to default values?\n\nThis will not delete your messages.')) {
        resetSettings();
        showToast('Settings reset to defaults', 'success', 2000);
        
        // Reload settings display
        setTimeout(() => {
            loadCurrentSettings();
            const settings = getSettings();
            applyTheme(settings.theme === 'dark');
            applyFontSize(settings.fontSize);
        }, 1000);
    }
}

/**
 * Handle reset all data
 */
function handleResetAll() {
    const confirmText = 'Clear ALL application data?\n\nThis will delete:\n• All messages\n• All settings\n• All statistics\n\nThis action cannot be undone!';
    
    if (confirm(confirmText)) {
        const finalConfirm = confirm('Are you absolutely sure? This will permanently delete everything!');
        
        if (finalConfirm) {
            // Clear all data
            storage.clear();
            
            showToast('All data cleared', 'success', 2000);
            
            // Redirect to home page after a delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }
}

// ==================== STORAGE INFO ====================

/**
 * Update storage information display
 */
function updateStorageInfo() {
    const storageInfo = storage.getStorageInfo();
    const messages = getAllMessages();
    
    const storageUsedEl = document.getElementById('storageUsed');
    const messagesStoredEl = document.getElementById('messagesStored');
    const lastBackupEl = document.getElementById('lastBackup');
    
    if (storageUsedEl) {
        const usedKB = storageInfo.used;
        const totalKB = storageInfo.total;
        const percentage = totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0;
        
        storageUsedEl.textContent = `${usedKB} KB (${percentage}% of ${totalKB} KB)`;
    }
    
    if (messagesStoredEl) {
        messagesStoredEl.textContent = messages.length;
    }
    
    if (lastBackupEl) {
        const lastBackup = getSetting('lastBackupDate', null);
        lastBackupEl.textContent = lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never';
    }
    
    // Update periodically
    setTimeout(updateStorageInfo, 30000); // Every 30 seconds
}

// ==================== VOICE INITIALIZATION ====================

// Ensure voices are loaded for speech synthesis
if ('speechSynthesis' in window) {
    // Load voices immediately
    speechSynthesis.getVoices();
    
    // Handle voice loading event
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            // Voices are now loaded and available
            console.log('Speech synthesis voices loaded:', speechSynthesis.getVoices().length);
        };
    }
}

// ==================== GLOBAL SETTINGS APPLICATION ====================

/**
 * Global function to get device settings for ESP32 integration
 * @returns {Object} - Device settings
 */
window.getDeviceSettings = function() {
    const settings = getSettings();
    return {
        autoConnect: settings.autoConnect || false,
        baudRate: settings.baudRate || 115200
    };
};

/**
 * Global function to get voice settings for TTS integration
 * @returns {Object} - Voice settings
 */
window.getVoiceSettings = function() {
    const settings = getSettings();
    return {
        gender: settings.voiceGender || 'female',
        speed: settings.speechSpeed || 1.0,
        pitch: settings.voicePitch || 1.0
    };
};

/**
 * Global function to get translation settings
 * @returns {Object} - Translation settings
 */
window.getTranslationSettings = function() {
    const settings = getSettings();
    return {
        targetLanguage: settings.targetLanguage || 'bn',
        autoTranslate: settings.autoTranslate || false
    };
};

/**
 * Global function to apply current settings (for other pages)
 * @returns {Object} - Current settings
 */
window.applyEyeBlinkSettings = function() {
    const settings = getSettings();
    applyTheme(settings.theme === 'dark');
    applyFontSize(settings.fontSize);
    return settings;
};

// Apply settings when this script loads
setTimeout(() => {
    const settings = getSettings();
    applyTheme(settings.theme === 'dark');
    applyFontSize(settings.fontSize || 'medium');
}, 100);