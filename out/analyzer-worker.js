"use strict";

// src/analyzer-worker.ts
var import_worker_threads = require("worker_threads");

// src/analyzer/scanner.ts
var import_promises = require("fs/promises");
var import_path = require("path");
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".c", ".h", ".js", ".ts", ".py", ".css", ".html", ".htm", ".java", ".go", ".rs"]);
var LANGUAGE_MAP = {
  ".c": "c",
  ".h": "c",
  ".js": "javascript",
  ".ts": "typescript",
  ".py": "python",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".java": "java",
  ".go": "go",
  ".rs": "rust"
};
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  ".next",
  "__pycache__",
  ".vscode",
  ".idea",
  "Backup",
  "Tests"
]);
async function scanDirectory(rootDir, options = {}) {
  const extensions = options.extensions || SUPPORTED_EXTENSIONS;
  const skipDirs = /* @__PURE__ */ new Set([...SKIP_DIRS, ...options.skipDirs || []]);
  const skipDirsLower = new Set([...skipDirs].map((d) => d.toLowerCase()));
  const files = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await (0, import_promises.readdir)(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = (0, import_path.join)(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirsLower.has(entry.name.toLowerCase())) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = (0, import_path.extname)(entry.name).toLowerCase();
        if (extensions.has(ext)) {
          try {
            const fileStat = await (0, import_promises.stat)(fullPath);
            const content = await (0, import_promises.readFile)(fullPath, "utf-8");
            const linesOfCode = content.split("\n").filter((l) => l.trim().length > 0).length;
            const relativePath = (0, import_path.relative)(rootDir, fullPath);
            const parts = relativePath.split("/");
            const group = parts.length > 1 ? parts[0] : "/";
            files.push({
              id: relativePath,
              name: entry.name,
              path: relativePath,
              fullPath,
              language: LANGUAGE_MAP[ext] || "unknown",
              extension: ext,
              size: fileStat.size,
              linesOfCode,
              lastModified: Math.floor(fileStat.mtimeMs),
              group,
              content
            });
          } catch {
          }
        }
      }
    }
  }
  await walk(rootDir);
  return files;
}

// src/analyzer/graph-builder.ts
var import_path3 = require("path");

// src/analyzer/parsers/base-parser.ts
var BaseParser = class {
  language;
  constructor(language) {
    this.language = language;
  }
  /** Whether this parser uses Tree-sitter AST (override in subclass). */
  get usesTreeSitter() {
    return false;
  }
  parse(_fileInfo, _options) {
    return [];
  }
  /** Parse using a Tree-sitter syntax tree (override in TS-based parsers). */
  parseAST(_tree, _fileInfo, _options) {
    return this.parse(_fileInfo, _options);
  }
  /** Extract symbols using a Tree-sitter syntax tree (override in TS-based parsers). */
  extractSymbolsAST(_tree, _fileInfo) {
    return { functions: [], externs: [], structs: [], enums: [], macros: [], classes: [], exports: [], interfaces: [], traits: [], typeAliases: [], methods: [] };
  }
  /** Extract cross-file function calls using AST (override in TS-based parsers). */
  extractCallsAST(_tree, _fileInfo, _globalFunctions) {
    return [];
  }
  /** Extract heritage relations (extends/implements) from AST. */
  extractHeritageRelations(_tree, _fileInfo) {
    return [];
  }
  extractMatches(content, regex, type, sourceId, labelFn) {
    const relations = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1];
      if (target) {
        relations.push({
          source: sourceId,
          target,
          type,
          label: labelFn ? labelFn(match) : `${type}: ${target}`
        });
      }
    }
    return relations;
  }
};

// src/analyzer/parsers/ts-c-parser.ts
var C_BUILTINS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "goto",
  "sizeof",
  "typeof",
  "typedef",
  "struct",
  "union",
  "enum",
  "static",
  "extern",
  "inline",
  "const",
  "volatile",
  "register",
  "auto",
  "void",
  "int",
  "char",
  "float",
  "double",
  "long",
  "short",
  "unsigned",
  "signed",
  "bool",
  "BOOL",
  "printf",
  "fprintf",
  "sprintf",
  "snprintf",
  "scanf",
  "sscanf",
  "malloc",
  "calloc",
  "realloc",
  "free",
  "memcpy",
  "memset",
  "memmove",
  "strlen",
  "strcpy",
  "strncpy",
  "strcmp",
  "strncmp",
  "strcat",
  "fopen",
  "fclose",
  "fread",
  "fwrite",
  "fseek",
  "ftell",
  "exit",
  "abort",
  "assert",
  "NULL",
  "true",
  "false",
  "defined",
  "offsetof",
  "va_start",
  "va_end",
  "va_arg",
  "__attribute__",
  "__declspec",
  "visibility",
  "__extension__"
]);
var TreeSitterCParser = class extends BaseParser {
  constructor() {
    super("c");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract #include relations ────────────
  parseAST(tree, fileInfo, options = {}) {
    const relations = [];
    this.walkForIncludes(tree.rootNode, fileInfo.id, relations, !!options.includeSystemHeaders);
    return relations;
  }
  walkForIncludes(node, sourceId, relations, includeSystem) {
    if (node.type === "preproc_include") {
      const pathNode = node.childForFieldName("path");
      if (pathNode) {
        const raw = pathNode.text;
        if (pathNode.type === "string_literal") {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "include",
            label: `#include "${target}"`
          });
        } else if (pathNode.type === "system_lib_string" && includeSystem) {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "system-include",
            label: `#include <${target}>`
          });
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForIncludes(node.child(i), sourceId, relations, includeSystem);
    }
    return relations;
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols);
        return;
      case "declaration":
        this.extractDeclaration(node, symbols);
        return;
      case "type_definition":
        this.extractTypedef(node, symbols);
        return;
      case "preproc_def":
        this.extractMacro(node, symbols, false);
        return;
      case "preproc_function_def":
        this.extractMacro(node, symbols, true);
        return;
      case "struct_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractStruct(node, symbols, "struct");
        }
        break;
      case "enum_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractEnum(node, symbols);
        }
        break;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const declarator = this.findDescendant(node, "function_declarator");
    if (!declarator) {
      return;
    }
    const nameNode = declarator.childForFieldName("declarator");
    const name = nameNode?.text;
    if (!name || C_BUILTINS.has(name)) {
      return;
    }
    const returnType = this.getReturnType(node, declarator);
    const params = this.getParams(declarator);
    const line = node.startPosition.row + 1;
    symbols.functions.push({ name, returnType, params, line, type: "function" });
  }
  extractDeclaration(node, symbols) {
    const text = node.text;
    if (text.startsWith("extern")) {
      const declarator = this.findDescendant(node, "function_declarator");
      if (declarator) {
        const nameNode = declarator.childForFieldName("declarator");
        const name = nameNode?.text;
        if (name) {
          symbols.externs.push({ name, type: "extern" });
          return;
        }
      }
    }
  }
  extractTypedef(node, symbols) {
    const structSpec = this.findDescendant(node, "struct_specifier");
    if (structSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.structs.push({ name: typeId.text, type: "typedef-struct" });
      } else {
        this.extractStruct(structSpec, symbols, "struct");
      }
      return;
    }
    const enumSpec = this.findDescendant(node, "enum_specifier");
    if (enumSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.enums.push({ name: typeId.text, type: "enum" });
      } else {
        this.extractEnum(enumSpec, symbols);
      }
    }
  }
  extractStruct(node, symbols, kind) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.structs.push({ name: nameNode.text, type: kind });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.enums.push({ name: nameNode.text, type: "enum" });
    }
  }
  extractMacro(node, symbols, isFunctionLike) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.macros.push({
        name: nameNode.text,
        type: isFunctionLike ? "function-macro" : "constant-macro"
      });
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, _fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: _fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  /** Get raw list of external calls (for backward compat with extractCalls). */
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const declarator = this.findDescendant(node, "function_declarator");
      const nameNode = declarator?.childForFieldName("declarator");
      if (nameNode) {
        defined.add(nameNode.text);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  getReturnType(funcDef, declarator) {
    const typeNode = funcDef.childForFieldName("type");
    if (typeNode) {
      const directDecl = funcDef.childForFieldName("declarator");
      if (directDecl?.type === "pointer_declarator") {
        return typeNode.text + "*";
      }
      return typeNode.text;
    }
    const before = funcDef.text.substring(0, declarator.startIndex - funcDef.startIndex).trim();
    return before || "int";
  }
  getParams(declarator) {
    const paramList = declarator.childForFieldName("parameters");
    if (!paramList) {
      return "";
    }
    const text = paramList.text;
    return text.startsWith("(") ? text.slice(1, -1).trim() : text.trim();
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-js-parser.ts
var JS_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "void",
  "in",
  "of",
  "this",
  "super",
  "with",
  "yield",
  "await",
  "debugger",
  "constructor",
  "get",
  "set",
  "static",
  "async",
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "console",
  "window",
  "document",
  "global",
  "process",
  "require",
  "module",
  "exports",
  "import",
  "export",
  "default",
  "from"
]);
var JS_BUILTINS = /* @__PURE__ */ new Set([
  ...JS_KEYWORDS,
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURI",
  "decodeURI",
  "encodeURIComponent",
  "decodeURIComponent",
  "eval",
  "JSON",
  "Math",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Proxy",
  "Reflect",
  "Symbol",
  "BigInt",
  "ArrayBuffer",
  "SharedArrayBuffer",
  "DataView",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint16Array",
  "Uint32Array",
  "URL",
  "URLSearchParams",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "fetch",
  "alert",
  "confirm",
  "prompt",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "createElement",
  "getElementById",
  "querySelector",
  "querySelectorAll",
  "log",
  "warn",
  "error",
  "info",
  "debug",
  "trace",
  "dir",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "slice",
  "concat",
  "map",
  "filter",
  "reduce",
  "forEach",
  "find",
  "findIndex",
  "some",
  "every",
  "includes",
  "indexOf",
  "join",
  "sort",
  "reverse",
  "flat",
  "flatMap",
  "keys",
  "values",
  "entries",
  "assign",
  "freeze",
  "seal",
  "defineProperty",
  "getOwnPropertyNames",
  "hasOwnProperty",
  "toString",
  "valueOf",
  "toJSON",
  "then",
  "catch",
  "resolve",
  "reject",
  "all",
  "allSettled",
  "race",
  "any",
  "stringify",
  "parse",
  "replace",
  "match",
  "search",
  "split",
  "trim",
  "startsWith",
  "endsWith",
  "charAt",
  "charCodeAt",
  "substring",
  "repeat",
  "padStart",
  "padEnd",
  "bind",
  "call",
  "apply",
  "next",
  "done",
  "emit",
  "on",
  "once",
  "off"
]);
var TreeSitterJSParser = class extends BaseParser {
  constructor() {
    super("javascript");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import/require relations ──────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkForImports(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForImports(node, sourceId, relations) {
    switch (node.type) {
      case "import_statement":
        this.extractImport(node, sourceId, relations);
        return;
      case "call_expression": {
        const funcNode = node.childForFieldName("function");
        if (funcNode) {
          if (funcNode.type === "identifier" && funcNode.text === "require") {
            this.extractCallImport(node, sourceId, relations, "require");
          } else if (funcNode.type === "import") {
            this.extractCallImport(node, sourceId, relations, "dynamic-import");
          }
        }
        break;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForImports(node.child(i), sourceId, relations);
    }
  }
  extractImport(node, sourceId, relations) {
    const source = node.childForFieldName("source");
    if (!source) {
      return;
    }
    const target = this.stripQuotes(source.text);
    if (!target) {
      return;
    }
    const isTypeImport = this.hasDirectChild(node, "type");
    relations.push({
      source: sourceId,
      target,
      type: isTypeImport ? "import-type" : "import",
      label: isTypeImport ? `import type from '${target}'` : `import from '${target}'`
    });
  }
  extractCallImport(node, sourceId, relations, type) {
    const args = node.childForFieldName("arguments");
    if (!args) {
      return;
    }
    const firstArg = args.child(1);
    if (!firstArg) {
      return;
    }
    let target;
    if (firstArg.type === "string" || firstArg.type === "string_fragment") {
      target = this.stripQuotes(firstArg.text);
    } else if (firstArg.type === "template_string") {
      const raw = firstArg.text.slice(1, -1);
      target = raw.split("$")[0].split("?")[0];
    } else {
      return;
    }
    if (!target) {
      return;
    }
    relations.push({
      source: sourceId,
      target,
      type,
      label: type === "require" ? `require('${target}')` : `import('${target}')`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_declaration":
      case "generator_function_declaration":
        this.extractFunctionDecl(node, symbols);
        return;
      case "lexical_declaration":
      case "variable_declaration":
        this.extractVariableDecl(node, symbols);
        return;
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "export_statement":
        this.extractExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunctionDecl(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || JS_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isGenerator = node.type === "generator_function_declaration";
    const sym = {
      name,
      type: isGenerator ? "generator" : "function",
      line
    };
    if (isAsync) {
      sym.isAsync = true;
    }
    symbols.functions.push(sym);
  }
  extractVariableDecl(node, symbols) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type !== "variable_declarator") {
        continue;
      }
      const nameNode = child.childForFieldName("name");
      const valueNode = child.childForFieldName("value");
      if (!nameNode || !valueNode) {
        continue;
      }
      const name = nameNode.text;
      if (JS_KEYWORDS.has(name)) {
        continue;
      }
      if (valueNode.type === "arrow_function") {
        const line = node.startPosition.row + 1;
        const isAsync = this.hasDirectChild(valueNode, "async");
        const sym = { name, type: "arrow", line };
        if (isAsync) {
          sym.isAsync = true;
        }
        if (!symbols.functions.some((f) => f.name === name)) {
          symbols.functions.push(sym);
        }
      }
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.classes.push({ name, type: "class", line });
    const body = node.childForFieldName("body");
    if (body) {
      this.extractMethods(body, symbols);
    }
  }
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const isGetter = this.findChildByText(member, "get") !== null && member.childForFieldName("parameters")?.text === "()";
      const isSetter = this.findChildByText(member, "set") !== null && !isGetter;
      const sym = {
        name,
        type: isGetter ? "getter" : isSetter ? "setter" : "method"
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      symbols.methods.push(sym);
    }
  }
  extractExport(node, symbols) {
    const isDefault = this.hasDirectChild(node, "default");
    const isTypeExport = this.hasDirectChild(node, "type");
    const exportClause = this.findChild(node, "export_clause");
    if (exportClause) {
      if (isTypeExport) {
        return;
      }
      for (let i = 0; i < exportClause.childCount; i++) {
        const spec = exportClause.child(i);
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          if (nameNode && !JS_KEYWORDS.has(nameNode.text)) {
            symbols.exports.push({ name: nameNode.text, type: "export-named" });
          }
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      switch (child.type) {
        case "function_declaration":
        case "generator_function_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              type: isDefault ? "export-default" : "export-function"
            });
            this.extractFunctionDecl(child, symbols);
          }
          break;
        }
        case "class_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              type: isDefault ? "export-default" : "export-class"
            });
            this.extractClass(child, symbols);
          }
          break;
        }
        case "lexical_declaration":
        case "variable_declaration": {
          for (let j = 0; j < child.childCount; j++) {
            const decl = child.child(j);
            if (decl.type === "variable_declarator") {
              const name = decl.childForFieldName("name")?.text;
              if (name && !JS_KEYWORDS.has(name)) {
                symbols.exports.push({
                  name,
                  type: isDefault ? "export-default" : "export-variable"
                });
              }
            }
          }
          this.extractVariableDecl(child, symbols);
          break;
        }
      }
    }
    if (isDefault && symbols.exports.length === 0) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "identifier" && !JS_KEYWORDS.has(child.text)) {
          symbols.exports.push({ name: child.text, type: "export-default" });
          break;
        }
      }
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration" || node.type === "generator_function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "variable_declarator") {
      const value = node.childForFieldName("value");
      if (value?.type === "arrow_function") {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          defined.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  stripQuotes(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
  findChildByText(node, text) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.text === text && child.type !== "statement_block" && child.type !== "formal_parameters") {
        return child;
      }
    }
    return null;
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-ts-parser.ts
var TreeSitterTSParser = class extends TreeSitterJSParser {
  constructor() {
    super();
    this.language = "typescript";
  }
  // ── Override symbol extraction to add TS-specific nodes ────
  extractSymbolsAST(tree, fileInfo) {
    const symbols = super.extractSymbolsAST(tree, fileInfo);
    this.walkForTSSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForTSSymbols(node, symbols) {
    switch (node.type) {
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "type_alias_declaration":
        this.extractTypeAlias(node, symbols);
        return;
      case "export_statement":
        this.extractTSExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForTSSymbols(node.child(i), symbols);
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  extractTSExport(node, symbols) {
    const isTypeExport = this.hasDirectChild(node, "type");
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "interface_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-interface" });
          this.extractInterface(child, symbols);
        }
        return;
      }
      if (child.type === "type_alias_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-type-alias" });
          this.extractTypeAlias(child, symbols);
        }
        return;
      }
    }
    if (isTypeExport) {
      const exportClause = this.findChild(node, "export_clause");
      if (exportClause) {
        for (let i = 0; i < exportClause.childCount; i++) {
          const spec = exportClause.child(i);
          if (spec.type === "export_specifier") {
            const nameNode = spec.childForFieldName("name");
            if (nameNode) {
              symbols.exports.push({ name: nameNode.text, type: "export-type" });
            }
          }
        }
      }
    }
  }
  // ── Class heritage: extends/implements ─────────────────────
  extractClass(node, symbols) {
    super.extractClass(node, symbols);
    const heritage = this.findChild(node, "class_heritage");
    if (!heritage) {
      return;
    }
    const nameNode = node.childForFieldName("name");
    const className = nameNode?.text;
    if (!className) {
      return;
    }
    const text = heritage.text;
    const extendsMatch = text.match(/extends\s+(\w+)/);
    if (extendsMatch) {
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.extends = extendsMatch[1];
      }
    }
    const implementsMatch = text.match(/implements\s+(.+)/);
    if (implementsMatch) {
      const interfaces = implementsMatch[1].split(",").map((s) => s.trim().split(/\s/)[0]);
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.implements = interfaces;
      }
    }
  }
  // ── Override methods to capture visibility/static/async ────
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const visibility = this.getVisibility(member);
      const isOverride = this.hasDirectChild(member, "override");
      const sym = { name, type: "method" };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      if (visibility) {
        sym.visibility = visibility;
      }
      if (isOverride) {
        sym.isOverride = true;
      }
      symbols.methods.push(sym);
    }
  }
  /** Extract heritage relations (extends/implements) as Relation edges. */
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      const heritage = this.findChild(node, "class_heritage");
      if (className && heritage) {
        const text = heritage.text;
        const extendsMatch = text.match(/extends\s+(\w+)/);
        if (extendsMatch) {
          relations.push({
            source: sourceId,
            target: extendsMatch[1],
            type: "extends",
            label: `${className} extends ${extendsMatch[1]}`
          });
        }
        const implementsMatch = text.match(/implements\s+(.+)/);
        if (implementsMatch) {
          const raw = implementsMatch[1].replace(/\{[\s\S]*$/, "");
          const interfaces = raw.split(",").map((s) => s.trim().split(/\s/)[0]).filter(Boolean);
          for (const iface of interfaces) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  getVisibility(node) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "accessibility_modifier") {
        const text = child.text;
        return text;
      }
    }
    return void 0;
  }
};

// src/analyzer/parsers/ts-py-parser.ts
var PY_BUILTINS = /* @__PURE__ */ new Set([
  "print",
  "len",
  "range",
  "int",
  "str",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "isinstance",
  "issubclass",
  "hasattr",
  "getattr",
  "setattr",
  "delattr",
  "callable",
  "super",
  "property",
  "staticmethod",
  "classmethod",
  "abs",
  "all",
  "any",
  "bin",
  "chr",
  "dir",
  "divmod",
  "enumerate",
  "eval",
  "exec",
  "filter",
  "format",
  "frozenset",
  "globals",
  "hash",
  "hex",
  "id",
  "input",
  "iter",
  "locals",
  "map",
  "max",
  "min",
  "next",
  "object",
  "oct",
  "open",
  "ord",
  "pow",
  "repr",
  "reversed",
  "round",
  "slice",
  "sorted",
  "sum",
  "vars",
  "zip",
  "breakpoint",
  "compile",
  "complex",
  "memoryview",
  "bytearray",
  "bytes",
  "__import__",
  "__name__",
  "__file__",
  "__doc__"
]);
var PY_KEYWORDS = /* @__PURE__ */ new Set([
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "return",
  "yield",
  "lambda",
  "not",
  "and",
  "or",
  "assert",
  "raise",
  "pass",
  "break",
  "continue",
  "try",
  "except",
  "finally",
  "with",
  "as",
  "import",
  "from",
  "global",
  "nonlocal",
  "del",
  "in",
  "is",
  "async",
  "await"
]);
var TreeSitterPyParser = class extends BaseParser {
  constructor() {
    super("python");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import relations ──────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_statement") {
        this.extractImport(node, fileInfo.id, relations);
      } else if (node.type === "import_from_statement") {
        this.extractFromImport(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractImport(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "aliased_import") {
        const name = child.type === "aliased_import" ? child.childForFieldName("name")?.text ?? child.text : child.text;
        if (name) {
          relations.push({
            source: sourceId,
            target: name,
            type: "import",
            label: `import ${name}`
          });
        }
      }
    }
  }
  extractFromImport(node, sourceId, relations) {
    const moduleNode = node.childForFieldName("module_name");
    let moduleName;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "relative_import") {
        moduleName = child.text;
        break;
      }
    }
    if (!moduleName) {
      return;
    }
    relations.push({
      source: sourceId,
      target: moduleName,
      type: "from-import",
      label: `from ${moduleName} import`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols, insideClass, []);
        return;
      case "decorated_definition":
        this.extractDecorated(node, symbols, insideClass);
        return;
      case "class_definition":
        this.extractClass(node, symbols);
        return;
      case "expression_statement":
        this.extractAllExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractFunction(node, symbols, insideClass, decorators) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isDunder = name.startsWith("__") && name.endsWith("__");
    const isStaticMethod = decorators.includes("staticmethod");
    const isClassMethod = decorators.includes("classmethod");
    if (insideClass) {
      const sym = {
        name,
        type: isDunder ? "dunder" : "method",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStaticMethod) {
        sym.isStatic = true;
      }
      if (isClassMethod) {
        sym.isClassMethod = true;
      }
      symbols.methods.push(sym);
    } else {
      const sym = {
        name,
        type: isDunder ? "dunder" : "function",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      symbols.functions.push(sym);
    }
  }
  extractDecorated(node, symbols, insideClass) {
    const decorators = [];
    let funcDef = null;
    let classDef = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "decorator") {
        const decoName = this.getDecoratorName(child);
        if (decoName) {
          decorators.push(decoName);
          if (!PY_BUILTINS.has(decoName) && !PY_KEYWORDS.has(decoName)) {
            if (!symbols.macros.some((m) => m.name === decoName)) {
              symbols.macros.push({
                name: decoName,
                type: "decorator",
                line: child.startPosition.row + 1
              });
            }
          }
        }
      } else if (child.type === "function_definition") {
        funcDef = child;
      } else if (child.type === "class_definition") {
        classDef = child;
      }
    }
    if (funcDef) {
      this.extractFunction(funcDef, symbols, insideClass, decorators);
    }
    if (classDef) {
      this.extractClass(classDef, symbols);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const classSym = {
      name,
      type: "class",
      line
    };
    const superclasses = this.extractSuperclasses(node);
    if (superclasses.length > 0) {
      classSym.extends = superclasses[0];
      if (superclasses.length > 1) {
        classSym.implements = superclasses.slice(1);
      }
    }
    symbols.classes.push(classSym);
    const body = node.childForFieldName("body");
    if (body) {
      this.walkForSymbols(body, symbols, true);
    }
  }
  extractSuperclasses(classNode) {
    const superclasses = [];
    const argList = this.findChild(classNode, "argument_list");
    if (!argList) {
      return superclasses;
    }
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i);
      if (child.type === "identifier" || child.type === "dotted_name") {
        superclasses.push(child.text);
      }
    }
    return superclasses;
  }
  extractAllExport(node, symbols) {
    const assign = this.findChild(node, "assignment");
    if (!assign) {
      return;
    }
    const left = assign.childForFieldName("left");
    if (!left || left.text !== "__all__") {
      return;
    }
    const right = assign.childForFieldName("right");
    if (!right || right.type !== "list") {
      return;
    }
    for (let i = 0; i < right.childCount; i++) {
      const child = right.child(i);
      if (child.type === "string") {
        const name = this.stripPyString(child.text);
        if (name) {
          symbols.exports.push({ name, type: "export-all" });
        }
      }
    }
  }
  // ── Heritage relations as edges ────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      if (className) {
        const superclasses = this.extractSuperclasses(node);
        for (const base of superclasses) {
          relations.push({
            source: sourceId,
            target: base,
            type: "extends",
            label: `${className} extends ${base}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "class_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "function_definition" || child.type === "class_definition") {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            defined.add(name);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getDecoratorName(decorator) {
    for (let i = 0; i < decorator.childCount; i++) {
      const child = decorator.child(i);
      if (child.type === "identifier") {
        return child.text;
      }
      if (child.type === "dotted_name") {
        return child.text;
      }
      if (child.type === "call") {
        const func = child.childForFieldName("function");
        return func?.text ?? null;
      }
    }
    return null;
  }
  stripPyString(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-java-parser.ts
var JAVA_BUILTINS = /* @__PURE__ */ new Set([
  "System",
  "String",
  "Integer",
  "Long",
  "Double",
  "Float",
  "Boolean",
  "Object",
  "Class",
  "Math",
  "Arrays",
  "Collections",
  "List",
  "Map",
  "Set",
  "HashMap",
  "ArrayList",
  "HashSet",
  "LinkedList",
  "TreeMap",
  "TreeSet",
  "Optional",
  "Stream",
  "Collectors",
  "Iterator",
  "Iterable",
  "Exception",
  "RuntimeException",
  "IOException",
  "NullPointerException",
  "Thread",
  "Runnable",
  "Comparable",
  "Serializable",
  "Cloneable",
  "StringBuilder",
  "StringBuffer",
  "Throwable",
  "Error",
  "println",
  "printf",
  "print",
  "format",
  "toString",
  "equals",
  "hashCode",
  "clone",
  "getClass",
  "notify",
  "wait",
  "valueOf",
  "parseInt",
  "parseDouble",
  "parseLong",
  "parseFloat",
  "length",
  "size",
  "get",
  "put",
  "add",
  "remove",
  "contains",
  "isEmpty",
  "toArray",
  "iterator",
  "stream",
  "forEach",
  "map",
  "filter",
  "reduce",
  "collect",
  "of",
  "asList",
  "sort",
  "reverse",
  "min",
  "max",
  "close",
  "read",
  "write",
  "flush",
  "append"
]);
var JAVA_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "instanceof",
  "this",
  "super",
  "void",
  "null",
  "true",
  "false",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "synchronized",
  "volatile",
  "transient",
  "native",
  "strictfp",
  "class",
  "interface",
  "enum",
  "extends",
  "implements",
  "import",
  "package",
  "default",
  "assert",
  "var"
]);
var TreeSitterJavaParser = class extends BaseParser {
  constructor() {
    super("java");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const pathNode = this.findChild(node, "scoped_identifier");
      if (!pathNode) {
        continue;
      }
      const target = pathNode.text;
      const isStatic = this.hasDirectChild(node, "static");
      relations.push({
        source: fileInfo.id,
        target,
        type: isStatic ? "static-import" : "import",
        label: isStatic ? `import static ${target}` : `import ${target}`
      });
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "enum_declaration":
        this.extractEnum(node, symbols);
        return;
      case "method_declaration":
        if (insideClass) {
          this.extractMethod(node, symbols);
        }
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const mods = this.getModifiers(node);
    const classSym = {
      name,
      type: "class",
      line
    };
    if (mods.visibility) {
      classSym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      classSym.isStatic = true;
    }
    const superclass = this.findChild(node, "superclass");
    if (superclass) {
      const superName = this.findChild(superclass, "type_identifier");
      if (superName) {
        classSym.extends = superName.text;
      }
    }
    const superInterfaces = this.findChild(node, "super_interfaces");
    if (superInterfaces) {
      classSym.implements = this.extractTypeList(superInterfaces);
    }
    symbols.classes.push(classSym);
    const body = node.childForFieldName("body");
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        this.walkForSymbols(body.child(i), symbols, true);
      }
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
    const body = this.findChild(node, "interface_body");
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child.type === "method_declaration") {
          this.extractMethod(child, symbols);
        }
      }
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.enums.push({ name, type: "enum", line });
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const mods = this.getModifiers(node);
    const sym = { name, type: "method" };
    if (mods.visibility) {
      sym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      sym.isStatic = true;
    }
    if (mods.isAsync) {
      sym.isAsync = true;
    }
    symbols.methods.push(sym);
  }
  // ── Heritage relations ─────────────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const className = node.childForFieldName("name")?.text;
      if (className) {
        const superclass = this.findChild(node, "superclass");
        if (superclass) {
          const name = this.findChild(superclass, "type_identifier")?.text;
          if (name) {
            relations.push({
              source: sourceId,
              target: name,
              type: "extends",
              label: `${className} extends ${name}`
            });
          }
        }
        const superIfaces = this.findChild(node, "super_interfaces");
        if (superIfaces) {
          for (const iface of this.extractTypeList(superIfaces)) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "method_invocation") {
      const obj = node.childForFieldName("object");
      if (!obj) {
        const name = node.childForFieldName("name")?.text;
        if (name && !JAVA_BUILTINS.has(name) && !JAVA_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getModifiers(node) {
    const mods = this.findChild(node, "modifiers");
    if (!mods) {
      return {};
    }
    const text = mods.text;
    const result = {};
    if (text.includes("public")) {
      result.visibility = "public";
    } else if (text.includes("private")) {
      result.visibility = "private";
    } else if (text.includes("protected")) {
      result.visibility = "protected";
    }
    if (text.includes("static")) {
      result.isStatic = true;
    }
    if (text.includes("synchronized")) {
      result.isAsync = false;
    }
    return result;
  }
  extractTypeList(node) {
    const types = [];
    const typeList = this.findChild(node, "type_list");
    const target = typeList || node;
    for (let i = 0; i < target.childCount; i++) {
      const child = target.child(i);
      if (child.type === "type_identifier") {
        types.push(child.text);
      }
    }
    return types;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-go-parser.ts
var GO_BUILTINS = /* @__PURE__ */ new Set([
  "append",
  "cap",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
  "error",
  "string",
  "bool",
  "byte",
  "rune",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
  "float32",
  "float64",
  "complex64",
  "complex128",
  "nil",
  "true",
  "false",
  "iota"
]);
var GO_KEYWORDS = /* @__PURE__ */ new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var"
]);
var TreeSitterGoParser = class extends BaseParser {
  constructor() {
    super("go");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const singleSpec = this.findChild(node, "import_spec");
      if (singleSpec) {
        const target = this.extractImportPath(singleSpec);
        if (target) {
          relations.push({
            source: fileInfo.id,
            target,
            type: "import",
            label: `import "${target}"`
          });
        }
      }
      const specList = this.findChild(node, "import_spec_list");
      if (specList) {
        for (let j = 0; j < specList.childCount; j++) {
          const spec = specList.child(j);
          if (spec.type === "import_spec") {
            const target = this.extractImportPath(spec);
            if (target) {
              relations.push({
                source: fileInfo.id,
                target,
                type: "import",
                label: `import "${target}"`
              });
            }
          }
        }
      }
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      switch (node.type) {
        case "function_declaration":
          this.extractFunction(node, symbols);
          break;
        case "method_declaration":
          this.extractMethod(node, symbols);
          break;
        case "type_declaration":
          this.extractTypeDecl(node, symbols);
          break;
      }
    }
    return symbols;
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || GO_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "function", line };
    symbols.functions.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-function" });
    }
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const receiverList = node.child(1);
    let receiverType;
    if (receiverList?.type === "parameter_list") {
      const text = receiverList.text;
      const match = text.match(/\*?(\w+)\s*\)/);
      if (match) {
        receiverType = match[1];
      }
    }
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "method" };
    if (receiverType) {
      sym.receiver = receiverType;
    }
    symbols.methods.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-method" });
    }
  }
  extractTypeDecl(node, symbols) {
    const typeSpec = this.findChild(node, "type_spec");
    if (!typeSpec) {
      return;
    }
    const nameNode = typeSpec.child(0);
    const defNode = typeSpec.child(1);
    if (!nameNode || !defNode) {
      return;
    }
    const name = nameNode.text;
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    if (defNode.type === "struct_type") {
      symbols.structs.push({ name, type: "struct", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-struct" });
      }
    } else if (defNode.type === "interface_type") {
      symbols.interfaces.push({ name, type: "interface", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-interface" });
      }
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  extractImportPath(spec) {
    for (let i = 0; i < spec.childCount; i++) {
      const child = spec.child(i);
      if (child.type === "interpreted_string_literal") {
        return child.text.slice(1, -1);
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-rust-parser.ts
var RUST_BUILTINS = /* @__PURE__ */ new Set([
  "println",
  "print",
  "eprintln",
  "eprint",
  "format",
  "write",
  "writeln",
  "panic",
  "todo",
  "unimplemented",
  "unreachable",
  "assert",
  "assert_eq",
  "assert_ne",
  "debug_assert",
  "debug_assert_eq",
  "debug_assert_ne",
  "vec",
  "cfg",
  "include",
  "include_str",
  "include_bytes",
  "env",
  "option_env",
  "concat",
  "stringify",
  "line",
  "column",
  "file",
  "Box",
  "Vec",
  "String",
  "Option",
  "Result",
  "Some",
  "None",
  "Ok",
  "Err",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "VecDeque",
  "LinkedList",
  "Rc",
  "Arc",
  "Mutex",
  "RwLock",
  "Cell",
  "RefCell",
  "Into",
  "From",
  "TryInto",
  "TryFrom",
  "AsRef",
  "AsMut",
  "Default",
  "Clone",
  "Copy",
  "Debug",
  "Display",
  "PartialEq",
  "Eq",
  "PartialOrd",
  "Ord",
  "Hash",
  "Iterator",
  "IntoIterator",
  "Send",
  "Sync",
  "Sized",
  "Unpin",
  "Drop",
  "drop",
  "swap",
  "replace",
  "take",
  "unwrap",
  "expect",
  "map",
  "and_then",
  "or_else",
  "unwrap_or",
  "is_some",
  "is_none",
  "is_ok",
  "is_err",
  "iter",
  "into_iter",
  "collect",
  "filter",
  "fold",
  "for_each",
  "push",
  "pop",
  "len",
  "is_empty",
  "contains",
  "get",
  "insert",
  "remove",
  "clone",
  "to_string",
  "to_owned",
  "as_str",
  "as_ref",
  "as_mut"
]);
var RUST_KEYWORDS = /* @__PURE__ */ new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "yield",
  "true",
  "false"
]);
var TreeSitterRustParser = class extends BaseParser {
  constructor() {
    super("rust");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (use/mod) ──────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "use_declaration") {
        this.extractUse(node, fileInfo.id, relations);
      } else if (node.type === "mod_item") {
        this.extractMod(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractUse(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "scoped_identifier" || child.type === "identifier" || child.type === "scoped_use_list" || child.type === "use_wildcard") {
        const target = child.text;
        relations.push({
          source: sourceId,
          target,
          type: "use",
          label: `use ${target}`
        });
        return;
      }
    }
  }
  extractMod(node, sourceId, relations) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
      return;
    }
    if (this.findChild(node, "declaration_list")) {
      return;
    }
    const target = nameNode.text;
    relations.push({
      source: sourceId,
      target,
      type: "mod",
      label: `mod ${target}`
    });
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_item":
        this.extractFunction(node, symbols);
        return;
      case "struct_item":
        this.extractStruct(node, symbols);
        return;
      case "enum_item":
        this.extractEnum(node, symbols);
        return;
      case "trait_item":
        this.extractTrait(node, symbols);
        return;
      case "impl_item":
        this.extractImpl(node, symbols);
        return;
      case "type_item":
        this.extractTypeAlias(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || RUST_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    const isAsync = this.hasChildType(node, "function_modifiers");
    const sym = { name, type: "function", line };
    if (isAsync) {
      sym.isAsync = true;
    }
    if (isPub) {
      sym.visibility = "public";
    }
    symbols.functions.push(sym);
    if (isPub) {
      symbols.exports.push({ name, type: "export-function" });
    }
  }
  extractStruct(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.structs.push({ name, type: "struct", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-struct" });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.enums.push({ name, type: "enum", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-enum" });
    }
  }
  extractTrait(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.traits.push({ name, type: "trait", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-trait" });
    }
  }
  extractImpl(node, symbols) {
    const body = this.findChild(node, "declaration_list");
    if (!body) {
      return;
    }
    const typeIds = this.findAllChildren(node, "type_identifier");
    const hasTrait = this.hasDirectChild(node, "for");
    let structName;
    let traitName;
    if (hasTrait && typeIds.length >= 2) {
      traitName = typeIds[0].text;
      structName = typeIds[1].text;
    } else if (typeIds.length >= 1) {
      structName = typeIds[0].text;
    }
    for (let i = 0; i < body.childCount; i++) {
      const child = body.child(i);
      if (child.type === "function_item") {
        const nameNode = child.childForFieldName("name");
        const name = nameNode?.text;
        if (!name) {
          continue;
        }
        const isPub = this.hasDirectChild(child, "visibility_modifier");
        const isAsync = this.hasChildType(child, "function_modifiers");
        const sym = { name, type: "method" };
        if (isPub) {
          sym.visibility = "public";
        }
        if (isAsync) {
          sym.isAsync = true;
        }
        if (structName) {
          sym.receiver = structName;
        }
        symbols.methods.push(sym);
      }
    }
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  // ── Heritage (impl Trait for Struct) ───────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "impl_item") {
      const hasTrait = this.hasDirectChild(node, "for");
      if (hasTrait) {
        const typeIds = this.findAllChildren(node, "type_identifier");
        if (typeIds.length >= 2) {
          const traitName = typeIds[0].text;
          const structName = typeIds[1].text;
          relations.push({
            source: sourceId,
            target: traitName,
            type: "implements",
            label: `${structName} implements ${traitName}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_item") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    if (node.type === "macro_invocation") {
      const macroNode = node.child(0);
      if (macroNode?.type === "identifier") {
        const name = macroNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name)) {
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  hasDirectChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  hasChildType(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
  findAllChildren(node, type) {
    const results = [];
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        results.push(node.child(i));
      }
    }
    return results;
  }
};

// src/analyzer/parsers/html-parser.ts
var SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var LINK_HREF_RE = /<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi;
var IMG_SRC_RE = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var HTMLParser = class extends BaseParser {
  constructor() {
    super("html");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(SCRIPT_SRC_RE.source, "gi"),
      "script",
      id,
      (m) => `<script src="${m[1]}">`
    ));
    relations.push(...this.extractMatches(
      content,
      new RegExp(LINK_HREF_RE.source, "gi"),
      "stylesheet",
      id,
      (m) => `<link href="${m[1]}">`
    ));
    if (options.includeAssets) {
      relations.push(...this.extractMatches(
        content,
        new RegExp(IMG_SRC_RE.source, "gi"),
        "asset",
        id,
        (m) => `<img src="${m[1]}">`
      ));
    }
    return relations;
  }
};

// src/analyzer/parsers/css-parser.ts
var CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;
var CSS_URL_RE = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;
var CSSParser = class extends BaseParser {
  constructor() {
    super("css");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(CSS_IMPORT_RE.source, "g"),
      "css-import",
      id,
      (m) => `@import "${m[1]}"`
    ));
    if (options.includeUrls) {
      const urlMatches = this.extractMatches(
        content,
        new RegExp(CSS_URL_RE.source, "g"),
        "css-url",
        id,
        (m) => `url("${m[1]}")`
      );
      relations.push(...urlMatches.filter(
        (r) => !r.target.startsWith("data:") && !r.target.startsWith("http:") && !r.target.startsWith("https:") && !r.target.startsWith("#")
      ));
    }
    return relations;
  }
};

// src/analyzer/complexity.ts
var C_JS_DECISION_RE = /\b(if|else\s+if|for|while|do|switch|case|catch)\b/g;
var LOGICAL_OPERATORS_RE = /(\|\||&&)/g;
var TERNARY_RE = /[^?]\?[^?:]/g;
var CSS_SELECTOR_RE = /[^{}]+(?=\s*\{)/g;
var CSS_MEDIA_RE = /@media\b/g;
function computeComplexity(fileInfo) {
  const { content, language } = fileInfo;
  switch (language) {
    case "c":
    case "javascript":
    case "typescript":
      return computeCJSComplexity(content);
    case "css":
      return computeCSSComplexity(content);
    case "html":
      return computeHTMLComplexity(content);
    default:
      return { complexity: 1, details: {} };
  }
}
function computeCJSComplexity(content) {
  const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  let complexity = 1;
  const details = {};
  const keywords = {};
  const decisionRe = new RegExp(C_JS_DECISION_RE.source, "g");
  let match;
  while ((match = decisionRe.exec(stripped)) !== null) {
    const kw = match[1].replace(/\s+/g, " ");
    keywords[kw] = (keywords[kw] || 0) + 1;
    complexity++;
  }
  details.keywords = keywords;
  const logicalRe = new RegExp(LOGICAL_OPERATORS_RE.source, "g");
  let logicalCount = 0;
  while ((match = logicalRe.exec(stripped)) !== null) {
    logicalCount++;
    complexity++;
  }
  details.logicalOperators = logicalCount;
  const ternaryRe = new RegExp(TERNARY_RE.source, "g");
  let ternaryCount = 0;
  while ((match = ternaryRe.exec(stripped)) !== null) {
    ternaryCount++;
    complexity++;
  }
  details.ternaryOperators = ternaryCount;
  return { complexity, details };
}
function computeCSSComplexity(content) {
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  let selectorCount = 0;
  const selectorRe = new RegExp(CSS_SELECTOR_RE.source, "g");
  let match;
  while ((match = selectorRe.exec(stripped)) !== null) {
    const selectors = match[0].split(",").filter((s) => s.trim().length > 0);
    selectorCount += selectors.length;
  }
  let mediaCount = 0;
  const mediaRe = new RegExp(CSS_MEDIA_RE.source, "g");
  while ((match = mediaRe.exec(stripped)) !== null) {
    mediaCount++;
  }
  const complexity = Math.max(1, Math.round(1 + selectorCount / 10 + mediaCount));
  return {
    complexity,
    details: { selectors: selectorCount, mediaQueries: mediaCount }
  };
}
function computeHTMLComplexity(content) {
  const eventHandlerRe = /\bon\w+\s*=/gi;
  let eventCount = 0;
  let match;
  while ((match = eventHandlerRe.exec(content)) !== null) {
    eventCount++;
  }
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let scriptCount = 0;
  let inlineJSComplexity = 0;
  while ((match = scriptRe.exec(content)) !== null) {
    scriptCount++;
    const jsResult = computeCJSComplexity(match[0]);
    inlineJSComplexity += jsResult.complexity - 1;
  }
  const complexity = Math.max(1, 1 + eventCount + inlineJSComplexity);
  return {
    complexity,
    details: { eventHandlers: eventCount, scriptBlocks: scriptCount, inlineJSComplexity }
  };
}

// src/analyzer/tree-sitter-loader.ts
var import_path2 = require("path");
var TSParser = require("web-tree-sitter");
var GRAMMAR_FILES = {
  "c": "tree-sitter-c.wasm",
  "cpp": "tree-sitter-cpp.wasm",
  "javascript": "tree-sitter-javascript.wasm",
  "typescript": "tree-sitter-typescript.wasm",
  "tsx": "tree-sitter-tsx.wasm",
  "python": "tree-sitter-python.wasm",
  "java": "tree-sitter-java.wasm",
  "go": "tree-sitter-go.wasm",
  "rust": "tree-sitter-rust.wasm",
  "csharp": "tree-sitter-c_sharp.wasm",
  "css": "tree-sitter-css.wasm",
  "html": "tree-sitter-html.wasm"
};
var initialized = false;
var loadedLanguages = /* @__PURE__ */ new Map();
function getWasmDir() {
  const fs = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "tree-sitter-wasms", "out"),
    // dev from out/
    resolve("node_modules", "tree-sitter-wasms", "out")
    // dev from project root (vitest)
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}
async function initTreeSitter() {
  if (initialized) {
    return;
  }
  const fs = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms", "tree-sitter.wasm"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
    // dev from out/
    resolve("node_modules", "web-tree-sitter", "tree-sitter.wasm")
    // dev from project root (vitest)
  ];
  const wasmFile = candidates.find((p) => fs.existsSync(p));
  if (!wasmFile) {
    throw new Error("web-tree-sitter.wasm not found. Searched:\n" + candidates.join("\n"));
  }
  await TSParser.init({
    locateFile: () => wasmFile
  });
  initialized = true;
}
async function loadLanguage(languageId) {
  const cached = loadedLanguages.get(languageId);
  if (cached) {
    return cached;
  }
  const file = GRAMMAR_FILES[languageId];
  if (!file) {
    throw new Error(`No Tree-sitter grammar available for language: ${languageId}`);
  }
  const wasmDir = getWasmDir();
  const wasmPath = (0, import_path2.join)(wasmDir, file);
  const language = await TSParser.Language.load(wasmPath);
  loadedLanguages.set(languageId, language);
  return language;
}
async function createParser(languageId) {
  await initTreeSitter();
  const language = await loadLanguage(languageId);
  const parser = new TSParser();
  parser.setLanguage(language);
  return parser;
}
async function parseSource(languageId, source) {
  const parser = await createParser(languageId);
  const tree = parser.parse(source);
  if (!tree) {
    throw new Error(`Tree-sitter failed to parse source for language: ${languageId}`);
  }
  return tree;
}
function hasGrammar(languageId) {
  return languageId in GRAMMAR_FILES;
}

// src/analyzer/graph-builder.ts
var PARSERS = {
  "c": new TreeSitterCParser(),
  "javascript": new TreeSitterJSParser(),
  "typescript": new TreeSitterTSParser(),
  "python": new TreeSitterPyParser(),
  "java": new TreeSitterJavaParser(),
  "go": new TreeSitterGoParser(),
  "rust": new TreeSitterRustParser(),
  "html": new HTMLParser(),
  "css": new CSSParser()
};
function getParser(language) {
  return PARSERS[language];
}
async function preParseFiles(files) {
  const trees = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (hasGrammar(file.language)) {
      try {
        const tree = await parseSource(file.language, file.content);
        trees.set(file.id, tree);
      } catch {
      }
    }
  }
  return trees;
}
function resolveTarget(target, sourceId, fileMap) {
  if (fileMap.has(target))
    return target;
  const sourceDir = (0, import_path3.dirname)(sourceId);
  const relativePath = (0, import_path3.normalize)((0, import_path3.join)(sourceDir, target));
  if (fileMap.has(relativePath))
    return relativePath;
  const extensions = [".js", ".ts", ".py", ".c", ".h", ".css", ".html"];
  for (const ext of extensions) {
    if (fileMap.has(relativePath + ext))
      return relativePath + ext;
    if (fileMap.has(target + ext))
      return target + ext;
  }
  const indexPath = (0, import_path3.join)(relativePath, "index.js");
  if (fileMap.has(indexPath))
    return indexPath;
  const targetBasename = (0, import_path3.basename)(target);
  for (const [id, file] of fileMap) {
    if (file.name === targetBasename)
      return id;
  }
  for (const ext of extensions) {
    const nameWithExt = targetBasename + ext;
    for (const [id, file] of fileMap) {
      if (file.name === nameWithExt)
        return id;
    }
  }
  return null;
}
function findCycles(links) {
  const adj = /* @__PURE__ */ new Map();
  for (const link of links) {
    if (!adj.has(link.source))
      adj.set(link.source, []);
    adj.get(link.source).push(link.target);
  }
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const stack = [];
  function dfs(node) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (inStack.has(next)) {
        const cycleStart = stack.indexOf(next);
        if (cycleStart >= 0) {
          const cycle = stack.slice(cycleStart);
          if (cycle.length >= 2) {
            cycles.push(cycle);
          }
        }
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    inStack.delete(node);
  }
  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cycle of cycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }
  return unique;
}
function buildGraph(files, projectName = "Project", options = {}, astTrees) {
  const fileMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    fileMap.set(file.id, file);
  }
  const allRelations = [];
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (parser) {
      const relations = tree && parser.usesTreeSitter ? parser.parseAST(tree, file, options) : parser.parse(file, options);
      allRelations.push(...relations);
    }
  }
  const fileSymbols = /* @__PURE__ */ new Map();
  const LANG_FAMILY = {
    "c": "c",
    "javascript": "js",
    "typescript": "js",
    "python": "py",
    "java": "java",
    "go": "go",
    "rust": "rust"
  };
  const globalFunctionIndex = /* @__PURE__ */ new Map();
  const SYMBOL_LANGUAGES = /* @__PURE__ */ new Set(["c", "javascript", "typescript", "python", "java", "go", "rust"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const symbols = tree && parser.usesTreeSitter ? parser.extractSymbolsAST(tree, file) : parser.extractSymbols?.(file);
    if (!symbols)
      continue;
    fileSymbols.set(file.id, symbols);
    const family = LANG_FAMILY[file.language] || file.language;
    for (const func of symbols.functions) {
      const key = `${family}:${func.name}`;
      if (!globalFunctionIndex.has(key)) {
        globalFunctionIndex.set(key, []);
      }
      globalFunctionIndex.get(key).push(file.id);
    }
  }
  const functionCallLinks = [];
  const HEADER_EXTS = /* @__PURE__ */ new Set([".h", ".hpp", ".d.ts"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    if (HEADER_EXTS.has(file.extension))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    let calls;
    if (tree && parser.usesTreeSitter) {
      const tsParser = parser;
      calls = tsParser.extractCallsFromAST?.(tree) || [];
    } else {
      const regexParser = parser;
      calls = regexParser.extractCalls?.(file) || [];
    }
    const ownSymbols = fileSymbols.get(file.id);
    const ownFunctions = new Set(
      ownSymbols ? ownSymbols.functions.map((f) => f.name) : []
    );
    const family = LANG_FAMILY[file.language] || file.language;
    for (const callName of calls) {
      if (ownFunctions.has(callName))
        continue;
      const key = `${family}:${callName}`;
      const definedIn = globalFunctionIndex.get(key);
      if (definedIn) {
        for (const defFileId of definedIn) {
          if (defFileId !== file.id) {
            functionCallLinks.push({
              source: file.id,
              target: defFileId,
              type: "function-call",
              label: `${callName}()`
            });
          }
        }
      }
    }
  }
  const heritageLinks = [];
  const symbolFileIndex = /* @__PURE__ */ new Map();
  for (const [fileId, symbols] of fileSymbols) {
    for (const cls of symbols.classes) {
      symbolFileIndex.set(cls.name, fileId);
    }
    for (const iface of symbols.interfaces || []) {
      symbolFileIndex.set(iface.name, fileId);
    }
    for (const trait of symbols.traits || []) {
      symbolFileIndex.set(trait.name, fileId);
    }
    for (const struct of symbols.structs) {
      symbolFileIndex.set(struct.name, fileId);
    }
  }
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    if (!tree)
      continue;
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const heritageRels = parser.extractHeritageRelations(tree, file);
    for (const rel of heritageRels) {
      const targetFileId = symbolFileIndex.get(rel.target);
      if (targetFileId && targetFileId !== file.id) {
        heritageLinks.push({
          source: file.id,
          target: targetFileId,
          type: rel.type,
          label: rel.label
        });
      }
    }
  }
  const complexityMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const result = computeComplexity(file);
    complexityMap.set(file.id, result);
  }
  const links = [];
  const unresolvedCount = { count: 0, targets: [] };
  for (const relation of allRelations) {
    const resolvedTarget = resolveTarget(relation.target, relation.source, fileMap);
    if (resolvedTarget) {
      if (resolvedTarget !== relation.source) {
        links.push({
          source: relation.source,
          target: resolvedTarget,
          type: relation.type,
          label: relation.label
        });
      }
    } else {
      unresolvedCount.count++;
      if (unresolvedCount.targets.length < 20) {
        unresolvedCount.targets.push({ from: relation.source, ref: relation.target });
      }
    }
  }
  links.push(...functionCallLinks);
  links.push(...heritageLinks);
  const linkSet = /* @__PURE__ */ new Set();
  const uniqueLinks = links.filter((link) => {
    const key = `${link.source}|${link.target}|${link.type}`;
    if (linkSet.has(key))
      return false;
    linkSet.add(key);
    return true;
  });
  const fanOut = /* @__PURE__ */ new Map();
  const fanIn = /* @__PURE__ */ new Map();
  for (const link of uniqueLinks) {
    fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
    fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
  }
  const allCalledNames = /* @__PURE__ */ new Set();
  const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
  for (const file of files) {
    let m;
    const re = new RegExp(CALL_SCAN_RE.source, "gm");
    while ((m = re.exec(file.content)) !== null) {
      allCalledNames.add(m[1]);
    }
  }
  const deadExportsMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const symbols = fileSymbols.get(file.id);
    if (!symbols)
      continue;
    const dead = [];
    for (const func of symbols.functions) {
      if (func.name === "main")
        continue;
      if (func.type === "dunder")
        continue;
      if (!allCalledNames.has(func.name)) {
        dead.push(func.name);
      }
    }
    for (const cls of symbols.classes) {
      if (!allCalledNames.has(cls.name)) {
        dead.push(cls.name);
      }
    }
    for (const exp of symbols.exports) {
      if (!allCalledNames.has(exp.name) && !dead.includes(exp.name)) {
        dead.push(exp.name);
      }
    }
    if (dead.length > 0) {
      deadExportsMap.set(file.id, dead);
    }
  }
  const nodes = files.map((f) => {
    const symbols = fileSymbols.get(f.id);
    const cmplx = complexityMap.get(f.id) || { complexity: 1, details: {} };
    const node = {
      id: f.id,
      name: f.name,
      path: f.path,
      language: f.language,
      extension: f.extension,
      size: f.size,
      linesOfCode: f.linesOfCode,
      lastModified: f.lastModified || 0,
      group: f.group,
      fanOut: fanOut.get(f.id) || 0,
      fanIn: fanIn.get(f.id) || 0,
      complexity: cmplx.complexity,
      complexityDetails: cmplx.details
    };
    if (symbols) {
      node.symbols = {
        functions: symbols.functions.map((fn) => ({
          name: fn.name,
          returnType: fn.returnType || "",
          params: fn.params || "",
          line: fn.line || 0,
          type: fn.type,
          visibility: fn.visibility,
          isStatic: fn.isStatic,
          isAsync: fn.isAsync
        })),
        structs: symbols.structs.map((s) => ({ name: s.name, type: s.type })),
        enums: symbols.enums.map((e) => ({ name: e.name, type: e.type })),
        macros: symbols.macros.slice(0, 30),
        classes: symbols.classes.map((c) => ({ name: c.name, type: c.type })),
        exports: symbols.exports.map((e) => ({ name: e.name, type: e.type })),
        interfaces: (symbols.interfaces || []).map((i) => ({ name: i.name, type: i.type })),
        traits: (symbols.traits || []).map((t) => ({ name: t.name, type: t.type })),
        typeAliases: (symbols.typeAliases || []).map((ta) => ({ name: ta.name, type: ta.type })),
        methods: (symbols.methods || []).map((m) => ({
          name: m.name,
          returnType: m.returnType || "",
          params: m.params || "",
          line: m.line || 0,
          type: m.type,
          visibility: m.visibility,
          isStatic: m.isStatic,
          isAsync: m.isAsync
        })),
        totalSymbols: symbols.functions.length + symbols.structs.length + symbols.enums.length + symbols.macros.length + symbols.classes.length + symbols.exports.length + (symbols.interfaces || []).length + (symbols.traits || []).length + (symbols.typeAliases || []).length + (symbols.methods || []).length
      };
    }
    const dead = deadExportsMap.get(f.id);
    if (dead && dead.length > 0) {
      node.deadExports = dead;
    }
    return node;
  });
  const langStats = {};
  for (const node of nodes) {
    if (!langStats[node.language]) {
      langStats[node.language] = { count: 0, totalLOC: 0, avgComplexity: 0 };
    }
    langStats[node.language].count++;
    langStats[node.language].totalLOC += node.linesOfCode;
    langStats[node.language].avgComplexity += node.complexity;
  }
  for (const lang in langStats) {
    langStats[lang].avgComplexity = Math.round(
      langStats[lang].avgComplexity / langStats[lang].count * 10
    ) / 10;
  }
  const groupSet = new Set(nodes.map((n) => n.group));
  const funcCallCount = uniqueLinks.filter((l) => l.type === "function-call").length;
  const heritageCount = uniqueLinks.filter((l) => l.type === "extends" || l.type === "implements").length;
  const deadCodeFiles = nodes.filter((n) => n.deadExports && n.deadExports.length > 0).length;
  const deadExportsTotal = nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);
  const cycles = findCycles(uniqueLinks);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < cycles.length; i++) {
    for (const nodeId of cycles[i]) {
      const node = nodeMap.get(nodeId);
      if (node) {
        if (!node.cycleIds)
          node.cycleIds = [];
        node.cycleIds.push(i);
      }
    }
  }
  return {
    meta: {
      projectName,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalFiles: nodes.length,
      totalLinks: uniqueLinks.length,
      totalRelationsFound: allRelations.length,
      functionCallLinks: funcCallCount,
      heritageLinks: heritageCount,
      unresolvedReferences: unresolvedCount.count,
      unresolvedSamples: unresolvedCount.targets,
      deadCodeFiles,
      deadExportsTotal,
      cycles,
      languageStats: langStats,
      groups: [...groupSet].sort()
    },
    nodes,
    links: uniqueLinks
  };
}

// src/analyzer-worker.ts
async function run() {
  const { rootPath, skipDirs, projectName } = import_worker_threads.workerData;
  const files = await scanDirectory(rootPath, {
    skipDirs: new Set(skipDirs)
  });
  const astTrees = await preParseFiles(files);
  const graphData = buildGraph(files, projectName, {
    skipDirs: new Set(skipDirs),
    projectName
  }, astTrees);
  import_worker_threads.parentPort?.postMessage({ graphData, files });
}
run().catch((err) => {
  import_worker_threads.parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
});
//# sourceMappingURL=analyzer-worker.js.map
