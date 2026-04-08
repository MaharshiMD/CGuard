const acorn = require('acorn');
const walk = require('acorn-walk');

function normalizeAST(ast) {
  walk.simple(ast, {
    Identifier(node) {
      node.name = 'VAR';
    },
    Literal(node) {
      if (typeof node.value === 'string') {
        node.value = 'STR';
      } else if (typeof node.value === 'number') {
        node.value = 'NUM';
      }
    }
  });
  return ast;
}

function hashAST(ast) {
  const str = JSON.stringify(ast);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function calculateStringSimilarity(str1, str2) {
  const set1 = new Set(str1);
  const set2 = new Set(str2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

function compareAST(code1, code2) {
  try {
    const ast1 = acorn.parse(code1, { ecmaVersion: 2020 });
    const ast2 = acorn.parse(code2, { ecmaVersion: 2020 });
    const norm1 = normalizeAST(ast1);
    const norm2 = normalizeAST(ast2);
    const str1 = JSON.stringify(norm1);
    const str2 = JSON.stringify(norm2);
    const similarity = calculateStringSimilarity(str1, str2);
    return similarity;
  } catch (error) {
    return 0; // If parsing fails, assume no similarity
  }
}

module.exports = { compareAST };