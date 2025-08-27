// ==================== MORSE CODE UTILITIES ====================

const MORSE_CODE = {
    // Letters
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
    "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
    "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
    ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
    "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
    "--..": "Z",
    
    // Numbers
    "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
    ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
    
    // Special characters
    "/": " ", ".-.-.-": ".", "--..--": ",", "..--..": "?", ".----.": "'",
    "-.-.--": "!", "-..-.": "/", "-.--.": "(", "-.--.-": ")", ".-...": "&",
    "---...": ":", "-.-.-.": ";", "-...-": "=", ".-.-.": "+", "-....-": "-",
    "..--.-": "_", ".-..-.": '"', "...-..-": "$", ".--.-.": "@"
};

// Reverse lookup for encoding
const CHAR_TO_MORSE = {};
Object.keys(MORSE_CODE).forEach(morse => {
    CHAR_TO_MORSE[MORSE_CODE[morse]] = morse;
});

/**
 * Decode a Morse code sequence to text
 * @param {string} morse - Morse code sequence (dots, dashes, spaces, slashes)
 * @returns {string} - Decoded text
 */
function decodeMorse(morse) {
    if (!morse || typeof morse !== 'string') return '';
    
    // Handle word separator
    if (morse === '/' || morse === ' / ' || morse.trim() === '/') {
        return ' ';
    }
    
    // Clean and normalize the input
    const cleanMorse = morse.trim().replace(/\s+/g, ' ');
    
    // Split by spaces to get individual letters
    const letters = cleanMorse.split(' ').filter(letter => letter.length > 0);
    
    return letters.map(letter => {
        if (letter === '/') return ' ';
        return MORSE_CODE[letter] || '?';
    }).join('');
}

/**
 * Encode text to Morse code
 * @param {string} text - Text to encode
 * @returns {string} - Morse code sequence
 */
function encodeToMorse(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text.toUpperCase().split('').map(char => {
        if (char === ' ') return '/';
        return CHAR_TO_MORSE[char] || '';
    }).filter(morse => morse.length > 0).join(' ');
}

/**
 * Validate if a string is valid Morse code
 * @param {string} morse - Morse code to validate
 * @returns {boolean} - True if valid
 */
function isValidMorse(morse) {
    if (!morse || typeof morse !== 'string') return false;
    
    // Allow only dots, dashes, spaces, and slashes
    return /^[.\-\s/]+$/.test(morse);
}

/**
 * Get all Morse code mappings for display
 * @returns {Object} - Object with letters and numbers
 */
function getMorseCodeReference() {
    const letters = {};
    const numbers = {};
    const special = {};
    
    Object.keys(MORSE_CODE).forEach(morse => {
        const char = MORSE_CODE[morse];
        if (char >= 'A' && char <= 'Z') {
            letters[char] = morse;
        } else if (char >= '0' && char <= '9') {
            numbers[char] = morse;
        } else if (char !== ' ') {
            special[char] = morse;
        }
    });
    
    return { letters, numbers, special };
}

/**
 * Format Morse code for better display
 * @param {string} morse - Raw morse code
 * @returns {string} - Formatted morse code
 */
function formatMorseForDisplay(morse) {
    if (!morse) return '';
    
    return morse
        .replace(/\./g, '•')  // Replace dots with bullets
        .replace(/-/g, '—')   // Replace dashes with em-dashes
        .replace(/\//g, ' / ') // Add spaces around word separators
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();
}

/**
 * Clean and normalize Morse input
 * @param {string} morse - Raw morse input
 * @returns {string} - Cleaned morse code
 */
function cleanMorseInput(morse) {
    if (!morse || typeof morse !== 'string') return '';
    
    return morse
        .replace(/•/g, '.')    // Convert bullets back to dots
        .replace(/—/g, '-')    // Convert em-dashes back to dashes
        .replace(/[^\.\-\s/]/g, '') // Remove invalid characters
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();
}

/**
 * Calculate timing for Morse playback
 * @param {string} morse - Morse code sequence
 * @param {number} wpm - Words per minutes (default 20)
 * @returns {Array} - Array of timing objects
 */
function getMorseTimings(morse, wpm = 20) {
    if (!morse) return [];
    
    // Standard timing: 1 unit = 60ms at 20 WPM
    const unitTime = 60000 / (50 * wpm); // 50 units = 1 word at standard timing
    
    const timings = [];
    let currentTime = 0;
    
    for (const char of morse) {
        switch (char) {
            case '.':
                timings.push({ type: 'dot', start: currentTime, duration: unitTime });
                currentTime += unitTime * 2; // dot + inter-element space
                break;
            case '-':
                timings.push({ type: 'dash', start: currentTime, duration: unitTime * 3 });
                currentTime += unitTime * 4; // dash + inter-element space
                break;
            case ' ':
                currentTime += unitTime * 3; // inter-letter space (total 7 units)
                break;
            case '/':
                currentTime += unitTime * 7; // inter-word space
                timings.push({ type: 'word-break', start: currentTime, duration: 0 });
                break;
        }
    }
    
    return timings;
}

/**
 * Convert text statistics
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
 * Generate practice sequences for learning
 * @param {string} level - Difficulty level ('beginner', 'intermediate', 'advanced')
 * @returns {Array} - Array of practice sequences
 */
function generatePracticeSequences(level = 'beginner') {
    const sequences = {
        beginner: [
            // Single letters - most common first
            'E', 'T', 'I', 'A', 'N', 'M', 'S', 'U', 'R', 'W',
            'D', 'K', 'G', 'O', 'H', 'V', 'F', 'L', 'P', 'J',
            'B', 'X', 'C', 'Y', 'Z', 'Q',
            
            // Two-letter combinations
            'ET', 'IT', 'AT', 'AN', 'IN', 'ON', 'UN', 'RE',
            'HE', 'ED', 'ND', 'ER', 'ST', 'TO', 'EN', 'TI',
            
            // Common short words
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU',
            'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT',
            'HAD', 'HIS', 'HAS', 'HOW', 'WHO', 'ITS', 'DID'
        ],
        
        intermediate: [
            // Longer common words
            'WITH', 'THIS', 'THAT', 'FROM', 'THEY', 'KNOW', 'WANT',
            'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN',
            'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY',
            'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE',
            
            // Numbers
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            '12', '34', '56', '78', '90', '123', '456', '789',
            
            // Simple punctuation
            'HELLO.', 'YES,', 'NO?', "I'M", 'DON\'T', 'CAN\'T'
        ],
        
        advanced: [
            // Complex sentences
            'QUICK BROWN FOX JUMPS',
            'THE FIVE BOXING WIZARDS',
            'PACK MY BOX WITH LIQUOR JUGS',
            'WALTZ BAD NYMPH FOR QUICK JIGS VEX',
            
            // Mixed content with punctuation
            'SOS! HELP NEEDED.',
            'QTH: NEW YORK, NY',
            'WX: SUNNY, 72F',
            'TIME: 14:30 UTC',
            
            // Technical terms
            'FREQUENCY', 'ANTENNA', 'PROPAGATION', 'MODULATION',
            'AMPLIFIER', 'OSCILLATOR', 'BANDWIDTH', 'IMPEDANCE'
        ]
    };
    
    return sequences[level] || sequences.beginner;
}

/**
 * Generate random Morse practice text
 * @param {number} length - Number of characters to generate
 * @param {string} type - Type of content ('letters', 'numbers', 'mixed', 'words')
 * @returns {string} - Generated practice text
 */
function generateRandomPractice(length = 50, type = 'letters') {
    const letterPool = 'ETIANMSURWDKGOHVFLPJBXCYZQ';
    const numberPool = '1234567890';
    const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER'];
    
    let result = '';
    
    switch (type) {
        case 'letters':
            for (let i = 0; i < length; i++) {
                result += letterPool[Math.floor(Math.random() * letterPool.length)];
                if (i < length - 1 && Math.random() < 0.2) result += ' ';
            }
            break;
            
        case 'numbers':
            for (let i = 0; i < length; i++) {
                result += numberPool[Math.floor(Math.random() * numberPool.length)];
                if (i < length - 1 && Math.random() < 0.3) result += ' ';
            }
            break;
            
        case 'mixed':
            const mixedPool = letterPool + numberPool;
            for (let i = 0; i < length; i++) {
                result += mixedPool[Math.floor(Math.random() * mixedPool.length)];
                if (i < length - 1 && Math.random() < 0.2) result += ' ';
            }
            break;
            
        case 'words':
            while (result.length < length) {
                const word = commonWords[Math.floor(Math.random() * commonWords.length)];
                if (result.length + word.length <= length) {
                    result += (result ? ' ' : '') + word;
                } else {
                    break;
                }
            }
            break;
    }
    
    return result.trim();
}

/**
 * Calculate Morse code complexity score
 * @param {string} text - Text to analyze
 * @returns {Object} - Complexity analysis
 */
function calculateComplexity(text) {
    if (!text) return { score: 0, factors: [] };
    
    let score = 0;
    const factors = [];
    const morse = encodeToMorse(text);
    
    // Length factor
    const lengthScore = Math.min(text.length / 100, 1) * 20;
    score += lengthScore;
    factors.push(`Length: ${lengthScore.toFixed(1)}`);
    
    // Character complexity (dashes are harder than dots)
    const dots = (morse.match(/\./g) || []).length;
    const dashes = (morse.match(/-/g) || []).length;
    const complexityScore = (dots * 1 + dashes * 2) / (dots + dashes) * 15;
    score += complexityScore || 0;
    factors.push(`Character complexity: ${complexityScore?.toFixed(1) || 0}`);
    
    // Numbers add complexity
    const numbers = (text.match(/[0-9]/g) || []).length;
    const numberScore = numbers * 2;
    score += numberScore;
    if (numbers > 0) factors.push(`Numbers: ${numberScore}`);
    
    // Punctuation adds complexity
    const punctuation = (text.match(/[.,!?'"()&:;=+\-_$@]/g) || []).length;
    const punctScore = punctuation * 3;
    score += punctScore;
    if (punctuation > 0) factors.push(`Punctuation: ${punctScore}`);
    
    return {
        score: Math.round(score),
        factors,
        difficulty: score < 20 ? 'Easy' : score < 50 ? 'Medium' : score < 80 ? 'Hard' : 'Expert'
    };
}

/**
 * Get learning recommendations based on text analysis
 * @param {string} text - Text to analyze
 * @returns {Object} - Learning recommendations
 */
function getLearningRecommendations(text) {
    if (!text) return { level: 'beginner', suggestions: [] };
    
    const complexity = calculateComplexity(text);
    const morse = encodeToMorse(text);
    const uniqueChars = [...new Set(text.toUpperCase().split(''))];
    
    const suggestions = [];
    
    // Character recommendations
    const difficultChars = uniqueChars.filter(char => {
        const morseChar = CHAR_TO_MORSE[char];
        return morseChar && morseChar.length > 3;
    });
    
    if (difficultChars.length > 0) {
        suggestions.push(`Practice these complex characters: ${difficultChars.join(', ')}`);
    }
    
    // Speed recommendations
    if (complexity.score < 30) {
        suggestions.push('Good for beginners - start at 5-10 WPM');
    } else if (complexity.score < 60) {
        suggestions.push('Intermediate level - try 15-20 WPM');
    } else {
        suggestions.push('Advanced level - challenge yourself at 20+ WPM');
    }
    
    // Content recommendations
    if (text.match(/[0-9]/)) {
        suggestions.push('Contains numbers - practice number sequences first');
    }
    
    if (text.match(/[.,!?'"]/)) {
        suggestions.push('Contains punctuation - review punctuation codes');
    }
    
    return {
        level: complexity.difficulty.toLowerCase(),
        suggestions,
        complexity: complexity.score
    };
}

/**
 * Export all functions for use
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MORSE_CODE,
        CHAR_TO_MORSE,
        decodeMorse,
        encodeToMorse,
        isValidMorse,
        getMorseCodeReference,
        formatMorseForDisplay,
        cleanMorseInput,
        getMorseTimings,
        getTextStatistics,
        generatePracticeSequences,
        generateRandomPractice,
        calculateComplexity,
        getLearningRecommendations
    };
}

// For browser usage
if (typeof window !== 'undefined') {
    window.MorseUtils = {
        MORSE_CODE,
        CHAR_TO_MORSE,
        decodeMorse,
        encodeToMorse,
        isValidMorse,
        getMorseCodeReference,
        formatMorseForDisplay,
        cleanMorseInput,
        getMorseTimings,
        getTextStatistics,
        generatePracticeSequences,
        generateRandomPractice,
        calculateComplexity,
        getLearningRecommendations
    };
}