/**
 * Simple Stylometry Analysis
 */
function analyzeStylometry(code) {
    const stats = {
        avgLineLength: 0,
        commentDensity: 0,
        indentStyle: 'unknown', // space or tab
        varNaming: 'unknown' // camelCase, snake_case
    };
    
    const lines = code.split('\n');
    if (lines.length === 0) return stats;
    
    stats.avgLineLength = Math.round(code.length / lines.length);
    
    const comments = code.match(/\/\/|\/\*/g) || [];
    stats.commentDensity = (comments.length / lines.length).toFixed(2);
    
    const spaces = code.match(/^ +/gm) || [];
    const tabs = code.match(/^\t+/gm) || [];
    stats.indentStyle = spaces.length > tabs.length ? 'spaces' : 'tabs';
    
    const camel = code.match(/[a-z][A-Z]/g) || [];
    const snake = code.match(/[a-z]_[a-z]/g) || [];
    stats.varNaming = camel.length > snake.length ? 'camelCase' : 'snake_case';
    
    return stats;
}

function compareStylometry(code1, code2) {
    const s1 = analyzeStylometry(code1);
    const s2 = analyzeStylometry(code2);
    
    let score = 0;
    if (s1.indentStyle === s2.indentStyle) score += 25;
    if (s1.varNaming === s2.varNaming) score += 25;
    
    const lenDiff = Math.abs(s1.avgLineLength - s2.avgLineLength);
    if (lenDiff < 10) score += 25;
    else if (lenDiff < 20) score += 15;
    
    const densDiff = Math.abs(s1.commentDensity - s2.commentDensity);
    if (densDiff < 0.1) score += 25;
    else if (densDiff < 0.3) score += 15;
    
    return score;
}

module.exports = { compareStylometry, analyzeStylometry };
