const crypto = require('crypto');

/**
 * Tokenizes code into a simplified stream.
 */
function tokenize(code) {
    // Remove comments, whitespace, and normalize to lowercase tokens
    return code
        .replace(/\/\/.*|\/\*[\s\S]*?\*\/|"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'/g, '') // remove comments and strings
        .match(/[a-zA-Z_]\w*|\d+|[^\s\w]/g) || [];
}

/**
 * Generates k-grams from tokens.
 */
function getKGrams(tokens, k = 50) {
    const n = tokens.length;
    if (n < k) return [tokens.join('')];
    const grams = [];
    for (let i = 0; i <= n - k; i++) {
        grams.push(tokens.slice(i, i + k).join(''));
    }
    return grams;
}

/**
 * Applies Winnowing algorithm to k-gram hashes.
 */
function winnow(hashes, windowSize = 4) {
    const fingerprints = new Set();
    const windows = [];
    
    for (let i = 0; i <= hashes.length - windowSize; i++) {
        windows.push(hashes.slice(i, i + windowSize));
    }
    
    let lastMinHash = -1;
    let lastMinPos = -1;
    
    windows.forEach((window, i) => {
        let minHash = window[0];
        let minPos = i;
        
        for (let j = 1; j < window.length; j++) {
            if (window[j] <= minHash) {
                minHash = window[j];
                minPos = i + j;
            }
        }
        
        if (minPos !== lastMinPos) {
            fingerprints.add(minHash);
            lastMinPos = minPos;
        }
    });
    
    return fingerprints;
}

function hash(s) {
    return crypto.createHash('md5').update(s).digest('hex').substring(0, 8);
}

/**
 * Compares two programs using Winnowing fingerprinting.
 */
function compareFingerprints(code1, code2) {
    const tokens1 = tokenize(code1);
    const tokens2 = tokenize(code2);
    
    const hashes1 = getKGrams(tokens1).map(hash);
    const hashes2 = getKGrams(tokens2).map(hash);
    
    const f1 = winnow(hashes1);
    const f2 = winnow(hashes2);
    
    if (f1.size === 0 || f2.size === 0) return 0;
    
    let common = 0;
    f1.forEach(h => {
        if (f2.has(h)) common++;
    });
    
    const similarity = (2 * common) / (f1.size + f2.size);
    return Math.round(similarity * 100);
}

module.exports = { compareFingerprints };
