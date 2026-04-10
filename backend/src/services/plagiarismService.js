const astEngine = require('../engines/astEngine');
const fingerprintEngine = require('../engines/fingerprintEngine');
const stylometryEngine = require('../engines/stylometryEngine');
const tokenizer = require('../engines/tokenizer');
const natural = require('natural');

// Sample dataset for plagiarism check (in real app, this would be a database)
const sampleCodes = [
  "def hello_world():\n    print('Hello, World!')\n    return True",
  "function factorial(n) {\n    if (n === 0) return 1;\n    return n * factorial(n - 1);\n}",
  "public class Hello {\n    public static void main(String[] args) {\n        System.out.println(\"Hello World\");\n    }\n}",
  "for (let i = 0; i < 10; i++) {\n    console.log(i);\n}",
  "#include <iostream>\nusing namespace std;\nint main() {\n    cout << \"Hello World\" << endl;\n    return 0;\n}"
];

function getShingles(text, k = 3) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const shingles = [];
  for (let i = 0; i <= words.length - k; i++) {
    shingles.push(words.slice(i, i + k).join(' '));
  }
  return shingles;
}

function cosineSimilarity(vec1, vec2) {
  const intersection = new Set([...vec1].filter(x => vec2.has(x)));
  const dotProduct = intersection.size;
  const magnitude1 = Math.sqrt(vec1.size);
  const magnitude2 = Math.sqrt(vec2.size);
  return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
}

function calculatePlagiarism(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  if (totalWords === 0) return 0;

  // Word frequency
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Repeated word occurrences
  let repeatedOccurrences = 0;
  for (const freq of Object.values(wordFreq)) {
    if (freq > 1) {
      repeatedOccurrences += freq - 1; // only the extra occurrences
    }
  }
  let plagiarism = (repeatedOccurrences / totalWords) * 100;

  // Duplicate lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const lineFreq = {};
  lines.forEach(line => {
    lineFreq[line] = (lineFreq[line] || 0) + 1;
  });
  let duplicateLineOccurrences = 0;
  for (const freq of Object.values(lineFreq)) {
    if (freq > 1) {
      duplicateLineOccurrences += freq - 1;
    }
  }
  if (lines.length > 0) {
    plagiarism += (duplicateLineOccurrences / lines.length) * 50; // add up to 50%
  }

  // Repeated phrases (3-grams)
  const phrases = [];
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(words.slice(i, i + 3).join(' '));
  }
  const phraseFreq = {};
  phrases.forEach(phrase => {
    phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
  });
  let repeatedPhraseOccurrences = 0;
  for (const freq of Object.values(phraseFreq)) {
    if (freq > 1) {
      repeatedPhraseOccurrences += freq - 1;
    }
  }
  if (phrases.length > 0) {
    plagiarism += (repeatedPhraseOccurrences / phrases.length) * 30; // add up to 30%
  }

  return Math.min(100, Math.max(0, plagiarism));
}

function calculateAI(text) {
  let aiScore = 0;

  // Repeated phrases using regex (simple: repeated words)
  const repeatedWordMatches = text.match(/\b(\w+)\b(?=.*\b\1\b)/g);
  if (repeatedWordMatches) {
    aiScore += (repeatedWordMatches.length / text.split(/\s+/).length) * 40;
  }

  // Sentence length variation
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    // Low stdDev means similar lengths, increase AI
    if (stdDev < 5) {
      aiScore += (5 - stdDev) / 5 * 30; // up to 30%
    }
  }

  // Excessive repetition (duplicate lines)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const uniqueLines = new Set(lines);
  const repetitionRatio = 1 - (uniqueLines.size / lines.length);
  aiScore += repetitionRatio * 30; // up to 30%

  return Math.min(100, Math.max(0, aiScore));
}

function calculateRisk(text) {
  const riskKeywords = ['eval', 'exec', 'os.system', 'subprocess', 'rm -rf', 'child_process', 'dangerous', 'shell', 'system'];
  const lowerText = text.toLowerCase();
  let riskCount = 0;
  riskKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) riskCount += matches.length;
  });
  return Math.min(100, riskCount * 20); // Each occurrence adds 20%
}

async function analyzePlagiarism(code1, code2, language) {
  // For now, assumes JavaScript; extensible for other languages
  const tokens1 = tokenizer.normalizeTokens(tokenizer.tokenize(code1));
  const tokens2 = tokenizer.normalizeTokens(tokenizer.tokenize(code2));

  const astScore = astEngine.compareAST(code1, code2);
  const fingerprintScore = fingerprintEngine.compareFingerprints(tokens1, tokens2);
  const stylometryScore = stylometryEngine.compareStylometry(code1, code2);

  const similarity = (astScore * 0.5) + (fingerprintScore * 0.3) + (stylometryScore * 0.2);

  let riskLevel = 'LOW';
  if (similarity > 0.7) riskLevel = 'HIGH';
  else if (similarity > 0.4) riskLevel = 'MEDIUM';

  return {
    similarity,
    astScore,
    fingerprintScore,
    stylometryScore,
    riskLevel
  };
}

async function analyzeDocument(text, filename) {
  const cleaned = (text || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (cleaned.toLowerCase().match(/\b[a-z0-9']+\b/g) || []).map(w => w.replace(/'/g, ''));
  const totalWords = words.length;
  const uniqueWords = new Set(words).size;
  const uniqueWordRatio = totalWords ? uniqueWords / totalWords : 1;
  const repeatScore = 1 - uniqueWordRatio;

  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim());
  const avgSentenceLength = sentences.length ? totalWords / sentences.length : totalWords;
  const lengthScore = Math.min(1, Math.max(0, (avgSentenceLength - 15) / 20));
  const lengthWeight = Math.min(1, totalWords / 500);

  const plagiarism_score = Math.round(Math.min(70, repeatScore * 40 + lengthScore * 20 + lengthWeight * 10));
  const ai_score = Math.round(Math.min(50, repeatScore * 30 + lengthScore * 15));
  const semantic_similarity = Math.round(Math.min(60, repeatScore * 30 + lengthScore * 20));
  const stylometry_score = Math.round(Math.min(55, lengthScore * 35 + repeatScore * 20));

  return {
    plagiarism_score,
    ai_score,
    semantic_similarity,
    stylometry_score,
    structural_score: 0,
    fingerprint_score: 0,
    pdg_similarity: 0,
    cross_language_match: false,
    matched_source: "Internal Analysis",
    source_url: "#",
    explanation: `Analyzed ${filename || 'document'} using internal heuristic metrics. This inspection uses pattern repetition and sentence structure instead of an external AI model.`,
    matched_code: ""
  };
}

async function scanFile(text, filename) {
  console.log("Text length:", text.length);
  const plagiarism = calculatePlagiarism(text);
  const ai = calculateAI(text);
  const risk = calculateRisk(text);
  const result = {
    plagiarism,
    ai,
    risk
  };
  console.log("Scores:", result);
  return result;
}

module.exports = { analyzePlagiarism, analyzeDocument, scanFile };