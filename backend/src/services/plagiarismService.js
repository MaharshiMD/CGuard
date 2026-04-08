const astEngine = require('../engines/astEngine');
const fingerprintEngine = require('../engines/fingerprintEngine');
const stylometryEngine = require('../engines/stylometryEngine');
const tokenizer = require('../engines/tokenizer');

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

module.exports = { analyzePlagiarism };