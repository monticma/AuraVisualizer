"use strict";
var AuraDeadCode = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/analysis/dead-code.ts
  var dead_code_exports = {};
  __export(dead_code_exports, {
    DEFAULT_DEAD_CODE_RULES: () => DEFAULT_DEAD_CODE_RULES,
    classifyDeadCode: () => classifyDeadCode,
    collectCalledNames: () => collectCalledNames,
    countExemptions: () => countExemptions,
    findExemption: () => findExemption,
    parseDeadCodeRules: () => parseDeadCodeRules,
    serializeDeadCodeRules: () => serializeDeadCodeRules
  });
  var DEFAULT_DEAD_CODE_RULES = [
    { name: "main", reason: "program entry point" },
    { namePattern: "^__.*__$", reason: "Python special method" },
    {
      name: ["activate", "deactivate"],
      path: ["**/extension.ts", "**/extension.js"],
      reason: "VS Code extension lifecycle"
    },
    {
      namePattern: "^[A-Z][A-Za-z0-9_]*$",
      path: ["**/*.tsx", "**/*.jsx"],
      kind: ["function", "class", "export"],
      reason: "React component exported for JSX"
    },
    {
      name: [
        "setup",
        "created",
        "beforeCreate",
        "mounted",
        "beforeMount",
        "updated",
        "beforeUpdate",
        "unmounted",
        "beforeDestroy",
        "activated",
        "deactivated",
        "onMounted",
        "onUpdated",
        "onUnmounted"
      ],
      language: "vue",
      reason: "Vue lifecycle hook"
    },
    {
      name: ["body"],
      language: "swift",
      reason: "SwiftUI view body"
    },
    {
      name: [
        "doGet",
        "doPost",
        "doPut",
        "doDelete",
        "doHead",
        "doOptions",
        "doTrace",
        "init",
        "destroy",
        "service"
      ],
      language: "java",
      reason: "Java servlet lifecycle"
    },
    {
      name: [
        "Awake",
        "Start",
        "Update",
        "FixedUpdate",
        "LateUpdate",
        "OnEnable",
        "OnDisable",
        "OnDestroy",
        "OnCollisionEnter",
        "OnCollisionExit",
        "OnCollisionStay",
        "OnTriggerEnter",
        "OnTriggerExit",
        "OnTriggerStay"
      ],
      language: "csharp",
      reason: "Unity lifecycle callback"
    },
    {
      name: ["setup", "loop"],
      path: ["**/*.ino"],
      reason: "Arduino entry point"
    },
    {
      path: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/*_test.*",
        "**/test_*.py",
        "**/__tests__/**",
        "**/tests/**",
        "**/test/**"
      ],
      reason: "test file"
    }
  ];
  function asArray(value) {
    if (value === void 0)
      return void 0;
    return Array.isArray(value) ? value : [value];
  }
  function normalizeSelector(value) {
    if (typeof value === "string" && value.trim())
      return [value.trim()];
    if (Array.isArray(value)) {
      const list = value.filter((v) => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
      return list.length > 0 ? list : void 0;
    }
    return void 0;
  }
  function globToRegExp(glob) {
    let out = "^";
    for (let i = 0; i < glob.length; i++) {
      const ch = glob[i];
      if (ch === "*") {
        if (glob[i + 1] === "*") {
          i++;
          if (glob[i + 1] === "/")
            i++;
          out += ".*";
        } else {
          out += "[^/]*";
        }
      } else if (ch === "?") {
        out += "[^/]";
      } else {
        out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      }
    }
    return new RegExp(out + "$");
  }
  function matchesAnyPath(filePath, patterns) {
    return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
  }
  function matchesString(value, expected) {
    const list = asArray(expected);
    return !list || list.length === 0 || list.indexOf(value) !== -1;
  }
  function matchesPath(filePath, expected) {
    const list = asArray(expected);
    return !list || list.length === 0 || matchesAnyPath(filePath, list);
  }
  function selectorList(value) {
    if (value === void 0)
      return void 0;
    const list = Array.isArray(value) ? value : [value];
    const cleaned = list.map((item) => item.trim()).filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned : void 0;
  }
  function serializeDeadCodeRules(rules) {
    const entries = rules.map((rule) => {
      const entry = {};
      const name = selectorList(rule.name);
      if (name)
        entry.name = name;
      if (rule.namePattern)
        entry.namePattern = rule.namePattern;
      const path = selectorList(rule.path);
      if (path)
        entry.path = path;
      const language = selectorList(rule.language);
      if (language)
        entry.language = language;
      const kind = selectorList(rule.kind);
      if (kind)
        entry.kind = kind;
      entry.reason = rule.reason;
      return entry;
    });
    return JSON.stringify({ version: 1, rules: entries }, null, 2) + "\n";
  }
  function parseDeadCodeRules(raw) {
    let value = raw;
    if (typeof value === "string") {
      if (!value.trim())
        return [];
      try {
        value = JSON.parse(value);
      } catch (err) {
        throw new Error("Dead-code rules are not valid JSON: " + (err instanceof Error ? err.message : String(err)));
      }
    }
    if (value === null || value === void 0)
      return [];
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error('Dead-code rules must be an object with a "rules" array.');
    }
    const candidate = value;
    if (candidate.rules === void 0)
      return [];
    if (!Array.isArray(candidate.rules)) {
      throw new Error('Dead-code "rules" must be an array.');
    }
    if (candidate.rules.length > 200) {
      throw new Error("Dead-code rules are limited to 200 entries.");
    }
    return candidate.rules.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Dead-code rule #${index + 1} must be an object.`);
      }
      const rule = entry;
      const reason = typeof rule.reason === "string" ? rule.reason.trim() : "";
      if (!reason)
        throw new Error(`Dead-code rule #${index + 1} needs a non-empty "reason".`);
      const name = normalizeSelector(rule.name);
      const namePattern = typeof rule.namePattern === "string" ? rule.namePattern : void 0;
      const path = normalizeSelector(rule.path);
      const language = normalizeSelector(rule.language);
      const kind = normalizeSelector(rule.kind);
      if (!name && !namePattern && !path) {
        throw new Error(`Dead-code rule #${index + 1} needs at least one selector: name, namePattern or path.`);
      }
      if (namePattern) {
        try {
          new RegExp(namePattern);
        } catch {
          throw new Error(`Dead-code rule #${index + 1} has an invalid namePattern.`);
        }
      }
      const normalized = { reason };
      if (name)
        normalized.name = name;
      if (namePattern)
        normalized.namePattern = namePattern;
      if (path)
        normalized.path = path;
      if (language)
        normalized.language = language;
      if (kind)
        normalized.kind = kind;
      return normalized;
    });
  }
  function findExemption(file, candidate, rules) {
    const filePath = file.id || file.path;
    for (const rule of rules) {
      if (rule.name !== void 0 && !matchesString(candidate.name, rule.name))
        continue;
      if (rule.namePattern !== void 0 && !new RegExp(rule.namePattern).test(candidate.name))
        continue;
      if (rule.path !== void 0 && !matchesPath(filePath, rule.path))
        continue;
      if (rule.language !== void 0 && !matchesString(file.language, rule.language))
        continue;
      if (rule.kind !== void 0 && !matchesString(candidate.kind, rule.kind))
        continue;
      return rule.reason;
    }
    return void 0;
  }
  function collectCalledNames(files) {
    const allCalledNames = /* @__PURE__ */ new Set();
    const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
    for (const file of files) {
      const re = new RegExp(CALL_SCAN_RE.source, "gm");
      let match;
      while ((match = re.exec(file.content)) !== null)
        allCalledNames.add(match[1]);
    }
    return allCalledNames;
  }
  function classifyDeadCode(file, symbols, calledNames, rules) {
    if (!symbols)
      return { dead: [], exempted: [] };
    const candidates = [];
    const add = (name, kind) => {
      if (name)
        candidates.push({ name, kind });
    };
    for (const fn of symbols.functions)
      add(fn.name, fn.type || "function");
    for (const cls of symbols.classes)
      add(cls.name, cls.type || "class");
    for (const exp of symbols.exports)
      add(exp.name, exp.type || "export");
    for (const method of symbols.methods || [])
      add(method.name, method.type || "method");
    const dead = [];
    const exempted = [];
    const seenDead = /* @__PURE__ */ new Set();
    const seenExempted = /* @__PURE__ */ new Set();
    for (const candidate of candidates) {
      if (calledNames.has(candidate.name))
        continue;
      const reason = findExemption(file, candidate, rules);
      if (reason) {
        const key = candidate.name + "|" + candidate.kind;
        if (!seenExempted.has(key)) {
          exempted.push({ name: candidate.name, kind: candidate.kind, reason });
          seenExempted.add(key);
        }
      } else if (candidate.kind !== "method" && !seenDead.has(candidate.name)) {
        dead.push(candidate.name);
        seenDead.add(candidate.name);
      }
    }
    return { dead, exempted };
  }
  function countExemptions(nodes) {
    return nodes.reduce((sum, node) => sum + (node.exemptedExports?.length || 0), 0);
  }
  return __toCommonJS(dead_code_exports);
})();
