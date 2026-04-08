const acorn = require('acorn');

function tokenize(code) {
  const tokens = [];
  try {
    acorn.tokenizer(code, {
      onToken: (token) => {
        tokens.push(token);
      }
    });
  } catch (error) {
    // If tokenization fails, return empty
  }
  return tokens;
}

function normalizeTokens(tokens) {
  return tokens.map(token => {
    if (token.type.label === 'name') {
      return { type: 'identifier', value: 'VAR' };
    }
    if (token.type.label === 'string') {
      return { type: 'string', value: 'STR' };
    }
    if (token.type.label === 'num') {
      return { type: 'number', value: 'NUM' };
    }
    // Remove comments
    if (token.type.label === 'comment') {
      return null;
    }
    return { type: token.type.label, value: token.value };
  }).filter(t => t !== null);
}

module.exports = { tokenize, normalizeTokens };