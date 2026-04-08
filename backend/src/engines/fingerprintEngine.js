function generateKGrams(tokens, k = 5) {
  const grams = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    grams.push(tokens.slice(i, i + k).map(t => t.type + ':' + t.value).join(' '));
  }
  return grams;
}

function rollingHash(str, base = 256, mod = 1e9 + 7) {
  let hash = 0;
  for (let char of str) {
    hash = (hash * base + char.charCodeAt(0)) % mod;
  }
  return hash;
}

function generateFingerprints(grams) {
  return new Set(grams.map(g => rollingHash(g)));
}

function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

function compareFingerprints(tokens1, tokens2, k = 5) {
  const grams1 = generateKGrams(tokens1, k);
  const grams2 = generateKGrams(tokens2, k);
  const fp1 = generateFingerprints(grams1);
  const fp2 = generateFingerprints(grams2);
  return jaccardSimilarity(fp1, fp2);
}

module.exports = { compareFingerprints };