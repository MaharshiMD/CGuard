const acorn = require('acorn');
const walk = require('acorn-walk');

/**
 * Normalizes an AST by removing specific identifiers and literal values,
 * focusing only on the structure.
 */
function normalizeAST(code) {
    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
        const structure = [];
        
        walk.simple(ast, {
            VariableDeclaration(node) { structure.push('VarDec'); },
            FunctionDeclaration(node) { structure.push('FuncDec'); },
            IfStatement(node) { structure.push('If'); },
            ForStatement(node) { structure.push('For'); },
            WhileStatement(node) { structure.push('While'); },
            AssignmentExpression(node) { structure.push('Assign'); },
            CallExpression(node) { structure.push('Call'); },
            ReturnStatement(node) { structure.push('Return'); },
            BinaryExpression(node) { structure.push('BinExp'); },
            LogicalExpression(node) { structure.push('LogExp'); }
        });
        
        return structure.join('-');
    } catch (e) {
        console.error("AST Parsing failed", e);
        return null;
    }
}

/**
 * Compares two programs based on their AST structure.
 */
function compareAST(code1, code2) {
    const struct1 = normalizeAST(code1);
    const struct2 = normalizeAST(code2);
    
    if (!struct1 || !struct2) return 0;
    
    // Simple sequence similarity (Levenshtein or similar could be used for better accuracy)
    if (struct1 === struct2) return 100;
    
    const parts1 = struct1.split('-');
    const parts2 = struct2.split('-');
    
    let matches = 0;
    const minLength = Math.min(parts1.length, parts2.length);
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < minLength; i++) {
        if (parts1[i] === parts2[i]) matches++;
    }
    
    return Math.round((matches / maxLength) * 100);
}

module.exports = { compareAST };
