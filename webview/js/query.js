/**
 * Aura Query Language — minimal boolean DSL to filter graph nodes.
 *
 * Grammar:
 *   expr     := orExpr
 *   orExpr   := andExpr ( ("OR"|"||") andExpr )*
 *   andExpr  := notExpr ( ("AND"|"&&") notExpr )*
 *   notExpr  := ("NOT"|"!") notExpr | primary
 *   primary  := "(" expr ")" | comparison | identifier | functionCall
 *   comparison := IDENT OP value
 *   OP       := "==" | "!=" | ">=" | "<=" | ">" | "<" | "~" | "!~" | "in"
 *   value    := NUMBER | STRING | REGEX | LIST
 *   LIST     := "[" value ("," value)* "]"
 *
 * Comparisons are case-insensitive for strings, except for ~ / !~ (regex).
 *
 * Public API: window.AuraQuery
 *   - compile(expr): { ok, fn?, error?, fields }
 *   - listFields(): string[]
 *   - boolFields: string[]
 *   - evaluate(expr, node, ctx): boolean (compile + run, no caching)
 */
(function () {
    'use strict';

    var NUMBER_FIELDS = {
        complexity: 'complexity',
        cognitive: 'cognitive',
        linesofcode: 'linesOfCode',
        loc: 'linesOfCode',
        fanin: 'fanIn',
        fanout: 'fanOut',
        size: 'size',
        mtime: 'lastModified',
        churn: 'churn',
        cochange: '_cochange',
        lastmodified: 'lastModified',
        deadexports: '_deadCount',
        symbolscount: '_symbolsCount',
        symbols: '_symbolsCount'
    };
    var STRING_FIELDS = {
        language: 'language',
        name: 'name',
        path: 'path',
        community: '_communityName',
        group: 'group',
        extension: 'extension'
    };
    var BOOL_FIELDS = {
        isorphan: '_isOrphan',
        isdead: '_isDead',
        incycle: '_inCycle',
        ispinned: '_isPinned',
        dirty: '_isDirty',
        hasnote: '_hasNote',
        stalenote: '_staleNote'
    };

    function buildContextNode(node, ctx) {
        // Compute derived properties on the fly (cheap, no caching needed
        // since node ids are evaluated at most once per query run).
        node._deadCount = (node.deadExports && node.deadExports.length) || 0;
        node._symbolsCount = (node.symbols && node.symbols.totalSymbols) || 0;
        node._communityName = ctx.communityName(node.id) || '';
        node._isOrphan = (node.fanIn === 0 && node.fanOut === 0);
        node._isDead = node._deadCount > 0;
        node._inCycle = ctx.cycleNodeIds ? ctx.cycleNodeIds.has(node.id) : false;
        node._isPinned = ctx.pinnedNodes ? ctx.pinnedNodes.has(node) : false;
        node._isDirty = ctx.dirtySet ? (ctx.dirtySet.has(node.id) || (node.path ? ctx.dirtySet.has(node.path) : false)) : false;
        var note = ctx.notes ? (ctx.notes[node.id] || (node.path ? ctx.notes[node.path] : null)) : null;
        node._hasNote = !!note;
        node._staleNote = !!(note && window.AuraNotes && window.AuraNotes.isStale(note, node.lastModified));
        node._cochange = ctx.cochangeScore ? (ctx.cochangeScore(node.id) || 0) : 0;
        return node;
    }

    // ---------------- Lexer ----------------
    var TOK = { NUMBER: 1, STRING: 2, IDENT: 3, OP: 4, LPAREN: 5, RPAREN: 6, COMMA: 7, LBRACK: 8, RBRACK: 9, REGEX: 10, EOF: 11 };
    var OPS = ['==', '!=', '>=', '<=', '>', '<', '!~', '~'];
    var KEYWORDS = { 'and': 'AND', '&&': 'AND', 'or': 'OR', '||': 'OR', 'not': 'NOT', '!': 'NOT', 'in': 'IN', 'true': 'TRUE', 'false': 'FALSE' };

    function lex(src) {
        var tokens = [];
        var i = 0, n = src.length;
        while (i < n) {
            var c = src[i];
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
            // Number
            if ((c >= '0' && c <= '9') || (c === '-' && i + 1 < n && src[i+1] >= '0' && src[i+1] <= '9' && (tokens.length === 0 || tokens[tokens.length-1].type === TOK.OP || tokens[tokens.length-1].type === TOK.LPAREN || tokens[tokens.length-1].type === TOK.COMMA))) {
                var s = i;
                if (c === '-') i++;
                while (i < n && (src[i] >= '0' && src[i] <= '9')) i++;
                if (i < n && src[i] === '.') { i++; while (i < n && (src[i] >= '0' && src[i] <= '9')) i++; }
                tokens.push({ type: TOK.NUMBER, value: parseFloat(src.slice(s, i)), pos: s });
                continue;
            }
            // String
            if (c === '"' || c === "'") {
                var quote = c, s2 = i; i++;
                var buf = '';
                while (i < n && src[i] !== quote) {
                    if (src[i] === '\\' && i + 1 < n) { buf += src[i+1]; i += 2; }
                    else { buf += src[i]; i++; }
                }
                if (i >= n) throw qerr('Unterminated string', s2);
                i++; // closing quote
                tokens.push({ type: TOK.STRING, value: buf, pos: s2 });
                continue;
            }
            // Regex /.../flags
            if (c === '/') {
                var s3 = i; i++;
                var rbuf = '';
                while (i < n && src[i] !== '/') {
                    if (src[i] === '\\' && i + 1 < n) { rbuf += src[i] + src[i+1]; i += 2; }
                    else { rbuf += src[i]; i++; }
                }
                if (i >= n) throw qerr('Unterminated regex', s3);
                i++;
                var flags = '';
                while (i < n && /[gimsuy]/.test(src[i])) { flags += src[i]; i++; }
                tokens.push({ type: TOK.REGEX, value: { source: rbuf, flags: flags }, pos: s3 });
                continue;
            }
            // 2-char operators
            var two = src.slice(i, i + 2);
            if (OPS.indexOf(two) !== -1) { tokens.push({ type: TOK.OP, value: two, pos: i }); i += 2; continue; }
            if (two === '&&' || two === '||') { tokens.push({ type: TOK.IDENT, value: KEYWORDS[two], pos: i }); i += 2; continue; }
            // 1-char operators
            if (c === '>' || c === '<') { tokens.push({ type: TOK.OP, value: c, pos: i }); i++; continue; }
            if (c === '~') { tokens.push({ type: TOK.OP, value: '~', pos: i }); i++; continue; }
            if (c === '(') { tokens.push({ type: TOK.LPAREN, pos: i }); i++; continue; }
            if (c === ')') { tokens.push({ type: TOK.RPAREN, pos: i }); i++; continue; }
            if (c === '[') { tokens.push({ type: TOK.LBRACK, pos: i }); i++; continue; }
            if (c === ']') { tokens.push({ type: TOK.RBRACK, pos: i }); i++; continue; }
            if (c === ',') { tokens.push({ type: TOK.COMMA, pos: i }); i++; continue; }
            if (c === '!') { tokens.push({ type: TOK.IDENT, value: 'NOT', pos: i }); i++; continue; }
            // Identifier / keyword
            if (/[A-Za-z_]/.test(c)) {
                var s4 = i;
                while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
                var word = src.slice(s4, i);
                var lw = word.toLowerCase();
                if (KEYWORDS[lw]) tokens.push({ type: TOK.IDENT, value: KEYWORDS[lw], pos: s4 });
                else tokens.push({ type: TOK.IDENT, value: word, pos: s4 });
                continue;
            }
            throw qerr('Unexpected character "' + c + '"', i);
        }
        tokens.push({ type: TOK.EOF, pos: n });
        return tokens;
    }

    function qerr(msg, pos) {
        var e = new Error(msg + (typeof pos === 'number' ? ' at column ' + (pos + 1) : ''));
        e.isQueryError = true; e.pos = pos;
        return e;
    }

    // ---------------- Parser ----------------
    function parse(tokens) {
        var i = 0;

        function peek() { return tokens[i]; }
        function eat(type, value) {
            var t = tokens[i];
            if (t.type !== type || (value !== undefined && t.value !== value)) {
                throw qerr('Expected ' + (value || type) + ', got ' + (t.value !== undefined ? t.value : t.type), t.pos);
            }
            i++; return t;
        }

        function parseExpr() { return parseOr(); }

        function parseOr() {
            var left = parseAnd();
            while (peek().type === TOK.IDENT && peek().value === 'OR') { i++; left = { kind: 'or', left: left, right: parseAnd() }; }
            return left;
        }
        function parseAnd() {
            var left = parseNot();
            while (peek().type === TOK.IDENT && peek().value === 'AND') { i++; left = { kind: 'and', left: left, right: parseNot() }; }
            return left;
        }
        function parseNot() {
            if (peek().type === TOK.IDENT && peek().value === 'NOT') { i++; return { kind: 'not', expr: parseNot() }; }
            return parsePrimary();
        }
        function parsePrimary() {
            var t = peek();
            if (t.type === TOK.LPAREN) { i++; var e = parseExpr(); eat(TOK.RPAREN); return e; }
            if (t.type === TOK.IDENT && t.value === 'TRUE') { i++; return { kind: 'lit', value: true }; }
            if (t.type === TOK.IDENT && t.value === 'FALSE') { i++; return { kind: 'lit', value: false }; }
            if (t.type === TOK.IDENT) {
                var name = t.value; i++;
                // Function call?
                if (peek().type === TOK.LPAREN) {
                    i++;
                    var args = [];
                    if (peek().type !== TOK.RPAREN) {
                        args.push(parseValue());
                        while (peek().type === TOK.COMMA) { i++; args.push(parseValue()); }
                    }
                    eat(TOK.RPAREN);
                    return { kind: 'call', name: name.toLowerCase(), args: args, pos: t.pos };
                }
                // Comparison or bare identifier (boolean field)
                if (peek().type === TOK.OP) {
                    var op = peek().value; i++;
                    var rhs = parseValue();
                    return { kind: 'cmp', field: name.toLowerCase(), op: op, rhs: rhs, pos: t.pos };
                }
                if (peek().type === TOK.IDENT && peek().value === 'IN') {
                    i++;
                    var listVal = parseValue();
                    if (!Array.isArray(listVal)) throw qerr('"in" expects a list "[...]"', t.pos);
                    return { kind: 'cmp', field: name.toLowerCase(), op: 'in', rhs: listVal, pos: t.pos };
                }
                // Bare identifier → boolean field
                return { kind: 'bool', field: name.toLowerCase(), pos: t.pos };
            }
            throw qerr('Unexpected token ' + (t.value !== undefined ? t.value : t.type), t.pos);
        }

        function parseValue() {
            var t = peek();
            if (t.type === TOK.NUMBER) { i++; return t.value; }
            if (t.type === TOK.STRING) { i++; return t.value; }
            if (t.type === TOK.REGEX) {
                i++;
                try { return new RegExp(t.value.source, t.value.flags); }
                catch (e) { throw qerr('Invalid regex: ' + e.message, t.pos); }
            }
            if (t.type === TOK.IDENT && t.value === 'TRUE') { i++; return true; }
            if (t.type === TOK.IDENT && t.value === 'FALSE') { i++; return false; }
            if (t.type === TOK.LBRACK) {
                i++;
                var arr = [];
                if (peek().type !== TOK.RBRACK) {
                    arr.push(parseValue());
                    while (peek().type === TOK.COMMA) { i++; arr.push(parseValue()); }
                }
                eat(TOK.RBRACK);
                return arr;
            }
            // Bare identifiers treated as strings for convenience (e.g. language == javascript)
            if (t.type === TOK.IDENT) { i++; return t.value; }
            throw qerr('Expected literal value', t.pos);
        }

        var ast = parseExpr();
        if (peek().type !== TOK.EOF) throw qerr('Unexpected trailing token', peek().pos);
        return ast;
    }

    // ---------------- Resolver / Evaluator ----------------
    function resolveField(name) {
        var k = name.toLowerCase();
        if (NUMBER_FIELDS[k]) return { type: 'number', prop: NUMBER_FIELDS[k] };
        if (STRING_FIELDS[k]) return { type: 'string', prop: STRING_FIELDS[k] };
        if (BOOL_FIELDS[k]) return { type: 'bool', prop: BOOL_FIELDS[k] };
        return null;
    }

    function evalNode(ast, node) {
        switch (ast.kind) {
            case 'lit': return !!ast.value;
            case 'not': return !evalNode(ast.expr, node);
            case 'and': return evalNode(ast.left, node) && evalNode(ast.right, node);
            case 'or':  return evalNode(ast.left, node) || evalNode(ast.right, node);
            case 'bool': {
                var f = resolveField(ast.field);
                if (!f) return false;
                return !!node[f.prop];
            }
            case 'call': {
                if (ast.name === 'isorphan') return !!node._isOrphan;
                if (ast.name === 'isdead') return !!node._isDead;
                if (ast.name === 'incycle') return !!node._inCycle;
                if (ast.name === 'ispinned') return !!node._isPinned;
                return false;
            }
            case 'cmp': {
                var info = resolveField(ast.field);
                if (!info) return false;
                var lhs = node[info.prop];
                var rhs = ast.rhs;
                if (ast.op === 'in') {
                    if (!Array.isArray(rhs)) return false;
                    var lhsCmp = (typeof lhs === 'string') ? lhs.toLowerCase() : lhs;
                    for (var k = 0; k < rhs.length; k++) {
                        var rv = (typeof rhs[k] === 'string') ? rhs[k].toLowerCase() : rhs[k];
                        if (lhsCmp === rv) return true;
                    }
                    return false;
                }
                if (ast.op === '~' || ast.op === '!~') {
                    var re = (rhs instanceof RegExp) ? rhs : new RegExp(String(rhs));
                    var match = re.test(String(lhs == null ? '' : lhs));
                    return ast.op === '~' ? match : !match;
                }
                if (info.type === 'string') {
                    var a = String(lhs == null ? '' : lhs).toLowerCase();
                    var b = String(rhs == null ? '' : rhs).toLowerCase();
                    switch (ast.op) {
                        case '==': return a === b;
                        case '!=': return a !== b;
                        case '>':  return a > b;
                        case '<':  return a < b;
                        case '>=': return a >= b;
                        case '<=': return a <= b;
                    }
                    return false;
                }
                // numeric / boolean compared as number
                var ln = (lhs === true) ? 1 : (lhs === false ? 0 : Number(lhs));
                var rn = (rhs === true) ? 1 : (rhs === false ? 0 : Number(rhs));
                if (isNaN(ln) || isNaN(rn)) return false;
                switch (ast.op) {
                    case '==': return ln === rn;
                    case '!=': return ln !== rn;
                    case '>':  return ln > rn;
                    case '<':  return ln < rn;
                    case '>=': return ln >= rn;
                    case '<=': return ln <= rn;
                }
                return false;
            }
        }
        return false;
    }

    function compile(expr) {
        if (!expr || !expr.trim()) return { ok: false, error: 'Empty expression' };
        try {
            var tokens = lex(expr);
            var ast = parse(tokens);
            return {
                ok: true,
                fn: function (node) {
                    try { return evalNode(ast, node); } catch (_) { return false; }
                }
            };
        } catch (e) {
            return { ok: false, error: e.message, pos: e.pos };
        }
    }

    function listFields() {
        var out = [];
        Object.keys(NUMBER_FIELDS).forEach(function (k) { out.push(k); });
        Object.keys(STRING_FIELDS).forEach(function (k) { out.push(k); });
        Object.keys(BOOL_FIELDS).forEach(function (k) { out.push(k); });
        return out.sort();
    }

    function fieldType(name) {
        var k = (name || '').toLowerCase();
        if (NUMBER_FIELDS[k]) return 'number';
        if (STRING_FIELDS[k]) return 'string';
        if (BOOL_FIELDS[k]) return 'bool';
        return null;
    }

    function fieldProp(name) {
        var k = (name || '').toLowerCase();
        return NUMBER_FIELDS[k] || STRING_FIELDS[k] || BOOL_FIELDS[k] || null;
    }

    window.AuraQuery = {
        compile: compile,
        listFields: listFields,
        fieldType: fieldType,
        fieldProp: fieldProp,
        prepareNode: buildContextNode,
        boolFields: Object.keys(BOOL_FIELDS),
        numberFields: Object.keys(NUMBER_FIELDS),
        stringFields: Object.keys(STRING_FIELDS),
        operators: ['==', '!=', '>=', '<=', '>', '<', '~', '!~', 'in']
    };
})();
