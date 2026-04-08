function calculateMetrics(code) {
  const lines = code.split('\n').filter(l => l.trim());
  const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length || 0;
  const indentationConsistency = calculateIndentationConsistency(lines);
  const identifierLengths = extractIdentifierLengths(code);
  const whitespacePatterns = calculateWhitespacePatterns(code);
  return {
    avgLineLength,
    indentationConsistency,
    identifierLengths,
    whitespacePatterns
  };
}

function calculateIndentationConsistency(lines) {
  const indents = lines.map(l => l.length - l.trimStart().length);
  const avg = indents.reduce((a, b) => a + b, 0) / indents.length || 0;
  const variance = indents.reduce((sum, i) => sum + (i - avg) ** 2, 0) / indents.length;
  return 1 / (1 + variance); // Higher consistency, higher score
}

function extractIdentifierLengths(code) {
  const ids = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
  const lengths = ids.map(id => id.length);
  return lengths;
}

function calculateWhitespacePatterns(code) {
  const spaces = (code.match(/ /g) || []).length;
  const tabs = (code.match(/\t/g) || []).length;
  const newlines = (code.match(/\n/g) || []).length;
  return { spaces, tabs, newlines };
}

function cosineSimilarity(vec1, vec2) {
  const dot = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  return dot / (mag1 * mag2) || 0;
}

function vectorizeMetrics(metrics) {
  const vec = [
    metrics.avgLineLength,
    metrics.indentationConsistency,
    ...metrics.identifierLengths.slice(0, 10), // Take first 10 lengths
    metrics.whitespacePatterns.spaces,
    metrics.whitespacePatterns.tabs,
    metrics.whitespacePatterns.newlines
  ];
  return vec;
}

function compareStylometry(code1, code2) {
  const m1 = calculateMetrics(code1);
  const m2 = calculateMetrics(code2);
  const vec1 = vectorizeMetrics(m1);
  const vec2 = vectorizeMetrics(m2);
  return cosineSimilarity(vec1, vec2);
}

module.exports = { compareStylometry };