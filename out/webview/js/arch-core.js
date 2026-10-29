"use strict";
var AuraArch = (() => {
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

  // src/arch/arch-core.ts
  var arch_core_exports = {};
  __export(arch_core_exports, {
    ARCH_BASELINE_FILE: () => ARCH_BASELINE_FILE,
    ARCH_RULES_FILE: () => ARCH_RULES_FILE,
    ARCH_RULES_VERSION: () => ARCH_RULES_VERSION,
    DEFAULT_ARCH_EDGE_TYPES: () => DEFAULT_ARCH_EDGE_TYPES,
    EMPTY_ARCH_BASELINE: () => EMPTY_ARCH_BASELINE,
    EMPTY_ARCH_RULES: () => EMPTY_ARCH_RULES,
    UNLAYERED: () => UNLAYERED,
    applyArchitecture: () => applyArchitecture,
    applyLayerAssignments: () => applyLayerAssignments,
    buildArchBaseline: () => buildArchBaseline,
    buildArchRulesTemplate: () => buildArchRulesTemplate,
    evaluateArchitecture: () => evaluateArchitecture,
    globMatch: () => globMatch,
    globToRegExp: () => globToRegExp,
    normalizeArchPath: () => normalizeArchPath,
    parseArchBaseline: () => parseArchBaseline,
    parseArchRules: () => parseArchRules,
    serializeArchBaseline: () => serializeArchBaseline,
    serializeArchRules: () => serializeArchRules,
    slicesPatternToRegExp: () => slicesPatternToRegExp
  });
  var ARCH_RULES_VERSION = 1;
  var ARCH_RULES_FILE = ".aura/arch-rules.json";
  var ARCH_BASELINE_FILE = ".aura/arch-baseline.json";
  var UNLAYERED = "unlayered";
  var DEFAULT_ARCH_EDGE_TYPES = [
    "import",
    "import-type",
    "require",
    "dynamic-import",
    "include",
    "system-include",
    "script",
    "stylesheet",
    "css-import",
    "css-url",
    "asset",
    "extends",
    "implements",
    "function-call",
    "source"
  ];
  var EMPTY_ARCH_RULES = {
    version: ARCH_RULES_VERSION,
    edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
    layers: [],
    rules: [],
    exceptions: [],
    strict: false
  };
  var EMPTY_ARCH_BASELINE = { version: ARCH_RULES_VERSION, entries: [] };
  function normalizeArchPath(input) {
    let value = String(input == null ? "" : input).replace(/\\/g, "/").trim();
    while (value.startsWith("./"))
      value = value.slice(2);
    value = value.replace(/\/{2,}/g, "/");
    if (value.length > 1 && value.endsWith("/"))
      value = value.slice(0, -1);
    return value;
  }
  function escapeRegExpChar(char) {
    return /[.*+?^${}()|[\]\\]/.test(char) ? "\\" + char : char;
  }
  function globSource(pattern) {
    let normalized = String(pattern == null ? "" : pattern).replace(/\\/g, "/").trim();
    while (normalized.startsWith("./"))
      normalized = normalized.slice(2);
    normalized = normalized.replace(/\/{2,}/g, "/");
    let out = "";
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (char === "*") {
        if (normalized[i + 1] === "*") {
          while (normalized[i + 1] === "*")
            i++;
          if (normalized[i + 1] === "/") {
            i++;
            out += "(?:.*/)?";
          } else {
            out += ".*";
          }
        } else {
          out += "[^/]*";
        }
      } else if (char === "?") {
        out += "[^/]";
      } else {
        out += escapeRegExpChar(char);
      }
    }
    return out;
  }
  function globToRegExp(pattern) {
    return new RegExp("^" + globSource(pattern) + "$");
  }
  function globMatch(path, pattern) {
    return globToRegExp(pattern).test(normalizeArchPath(path));
  }
  function compileGlobs(patterns) {
    return patterns.map(globToRegExp);
  }
  function matchesAny(path, regexps) {
    for (const re of regexps)
      if (re.test(path))
        return true;
    return false;
  }
  function slicesPatternToRegExp(pattern) {
    const normalized = normalizeArchPath(pattern);
    const runs = [];
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] !== "*")
        continue;
      let length = 1;
      while (normalized[i + length] === "*")
        length++;
      runs.push({ start: i, length });
      i += length - 1;
    }
    const singles = runs.filter((run) => run.length === 1);
    if (singles.length !== 1) {
      throw new Error(`Slices pattern "${pattern}" must contain exactly one "*" for the slice name`);
    }
    const star = singles[0].start;
    const prefix = normalized.slice(0, star);
    const suffix = normalized.slice(star + 1);
    const tail = suffix ? globSource(suffix) : "(?:/.*)?";
    return new RegExp("^" + globSource(prefix) + "([^/]+)" + tail + "$");
  }
  function asStringArray(value, field, where) {
    if (typeof value === "string" && value.trim())
      return [value.trim()];
    if (!Array.isArray(value))
      throw new Error(`${where}: "${field}" must be an array of strings`);
    const out = [];
    for (const item of value) {
      if (typeof item !== "string" || !item.trim()) {
        throw new Error(`${where}: "${field}" must contain non-empty strings`);
      }
      out.push(item.trim());
    }
    return out;
  }
  function normalizeSeverity(value, where) {
    if (value === void 0)
      return "warn";
    if (value === "error" || value === "warn")
      return value;
    throw new Error(`${where}: "severity" must be "error" or "warn"`);
  }
  function parseArchRules(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The rules file must contain a JSON object");
    }
    const obj = data;
    if (obj.version !== void 0 && obj.version !== ARCH_RULES_VERSION) {
      throw new Error(`Unsupported rules version ${String(obj.version)} (expected ${ARCH_RULES_VERSION})`);
    }
    const edgeTypes = obj.edgeTypes === void 0 ? DEFAULT_ARCH_EDGE_TYPES.slice() : asStringArray(obj.edgeTypes, "edgeTypes", "rules").map((t) => t.toLowerCase());
    if (edgeTypes.indexOf("doc-reference") !== -1) {
      const idx = edgeTypes.indexOf("doc-reference");
      edgeTypes.splice(idx, 1);
    }
    const rawLayers = obj.layers === void 0 ? [] : obj.layers;
    if (!Array.isArray(rawLayers))
      throw new Error('"layers" must be an array');
    const layers = [];
    const layerNames = /* @__PURE__ */ new Set();
    for (let i = 0; i < rawLayers.length; i++) {
      const entry = rawLayers[i];
      if (!entry || typeof entry !== "object")
        throw new Error(`Layer #${i} must be an object`);
      if (typeof entry.name !== "string" || !entry.name.trim()) {
        throw new Error(`Layer #${i} needs a non-empty "name"`);
      }
      const name = entry.name.trim();
      if (name === UNLAYERED)
        throw new Error(`Layer name "${UNLAYERED}" is reserved`);
      if (layerNames.has(name))
        throw new Error(`Duplicate layer name "${name}"`);
      layerNames.add(name);
      const paths = asStringArray(entry.paths, "paths", `Layer "${name}"`);
      if (paths.length === 0)
        throw new Error(`Layer "${name}" needs at least one glob in "paths"`);
      layers.push({ name, paths });
    }
    const rawRules = obj.rules === void 0 ? [] : obj.rules;
    if (!Array.isArray(rawRules))
      throw new Error('"rules" must be an array');
    const rules = [];
    const ruleIds = /* @__PURE__ */ new Set();
    for (let i = 0; i < rawRules.length; i++) {
      const entry = rawRules[i];
      if (!entry || typeof entry !== "object")
        throw new Error(`Rule #${i} must be an object`);
      if (typeof entry.id !== "string" || !entry.id.trim()) {
        throw new Error(`Rule #${i} needs a non-empty "id"`);
      }
      const id = entry.id.trim();
      if (ruleIds.has(id))
        throw new Error(`Duplicate rule id "${id}"`);
      ruleIds.add(id);
      const where = `Rule "${id}"`;
      const kind = entry.type === void 0 ? "deny" : entry.type;
      if (kind === "deny") {
        if (typeof entry.from !== "string" || !entry.from.trim()) {
          throw new Error(`${where}: "from" is required`);
        }
        const from = entry.from.trim();
        if (from !== UNLAYERED && !layerNames.has(from)) {
          throw new Error(`${where}: unknown source layer "${from}"`);
        }
        const deny = asStringArray(entry.deny, "deny", where);
        if (deny.length === 0)
          throw new Error(`${where}: "deny" must not be empty`);
        for (const target of deny) {
          if (target !== "*" && target !== UNLAYERED && !layerNames.has(target)) {
            throw new Error(`${where}: unknown denied layer "${target}"`);
          }
          if (target === from)
            throw new Error(`${where}: a layer cannot deny itself`);
        }
        rules.push({ id, kind: "deny", from, deny, severity: normalizeSeverity(entry.severity, where) });
      } else if (kind === "slices") {
        if (typeof entry.pattern !== "string" || !entry.pattern.trim()) {
          throw new Error(`${where}: "pattern" is required for a slices rule`);
        }
        const pattern = entry.pattern.trim();
        slicesPatternToRegExp(pattern);
        const shared = entry.shared === void 0 ? [] : asStringArray(entry.shared, "shared", where);
        rules.push({ id, kind: "slices", pattern, shared, severity: normalizeSeverity(entry.severity, where) });
      } else if (kind === "no-cycles") {
        if (entry.scope !== void 0 && entry.scope !== "layers") {
          throw new Error(`${where}: only "scope": "layers" is supported`);
        }
        rules.push({ id, kind: "no-cycles", severity: normalizeSeverity(entry.severity, where) });
      } else {
        throw new Error(`${where}: unknown rule type "${String(kind)}"`);
      }
    }
    const exceptions = obj.exceptions === void 0 ? [] : asStringArray(obj.exceptions, "exceptions", "rules");
    const strict = obj.strict === void 0 ? false : obj.strict;
    if (typeof strict !== "boolean")
      throw new Error('"strict" must be a boolean');
    return {
      version: ARCH_RULES_VERSION,
      edgeTypes,
      layers,
      rules,
      exceptions,
      strict
    };
  }
  function serializeArchRules(rules) {
    const out = {
      version: ARCH_RULES_VERSION,
      edgeTypes: rules.edgeTypes.slice(),
      layers: rules.layers.map((layer) => ({ name: layer.name, paths: layer.paths.slice() })),
      rules: rules.rules.map((rule) => {
        if (rule.kind === "deny") {
          return { id: rule.id, from: rule.from, deny: rule.deny.slice(), severity: rule.severity };
        }
        if (rule.kind === "slices") {
          return {
            id: rule.id,
            type: "slices",
            pattern: rule.pattern,
            shared: rule.shared.slice(),
            severity: rule.severity
          };
        }
        return { id: rule.id, type: "no-cycles", severity: rule.severity };
      }),
      exceptions: rules.exceptions.slice(),
      strict: rules.strict
    };
    return JSON.stringify(out, null, 2) + "\n";
  }
  function buildArchRulesTemplate(topFolders) {
    const seen = /* @__PURE__ */ new Set();
    const layers = [];
    for (const raw of topFolders) {
      const folder = normalizeArchPath(raw);
      if (!folder || folder.indexOf("/") !== -1 || seen.has(folder))
        continue;
      seen.add(folder);
      layers.push({ name: folder, paths: [`src/${folder}/**`] });
      if (layers.length >= 8)
        break;
    }
    return serializeArchRules({
      version: ARCH_RULES_VERSION,
      edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
      layers,
      rules: [],
      exceptions: [],
      strict: false
    });
  }
  function baselineKey(ruleId, source, target) {
    return ruleId + "\0" + source + "\0" + target;
  }
  function parseArchBaseline(raw) {
    if (!raw)
      return { version: ARCH_RULES_VERSION, entries: [] };
    try {
      const data = JSON.parse(raw);
      const entriesRaw = Array.isArray(data?.entries) ? data.entries : [];
      const entries = [];
      const seen = /* @__PURE__ */ new Set();
      for (const item of entriesRaw) {
        const rec = item;
        if (typeof rec.ruleId !== "string" || typeof rec.source !== "string" || typeof rec.target !== "string")
          continue;
        const key = baselineKey(rec.ruleId, rec.source, rec.target);
        if (seen.has(key))
          continue;
        seen.add(key);
        entries.push({ ruleId: rec.ruleId, source: rec.source, target: rec.target });
      }
      entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
      return { version: ARCH_RULES_VERSION, entries };
    } catch {
      return { version: ARCH_RULES_VERSION, entries: [] };
    }
  }
  function buildArchBaseline(evaluation) {
    const entries = [];
    const seen = /* @__PURE__ */ new Set();
    for (const violation of evaluation.violations) {
      const key = baselineKey(violation.ruleId, violation.source, violation.target);
      if (seen.has(key))
        continue;
      seen.add(key);
      entries.push({ ruleId: violation.ruleId, source: violation.source, target: violation.target });
    }
    entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
    return { version: ARCH_RULES_VERSION, entries };
  }
  function serializeArchBaseline(baseline) {
    return JSON.stringify({ version: ARCH_RULES_VERSION, entries: baseline.entries }, null, 2) + "\n";
  }
  function linkEnds(link) {
    return {
      source: typeof link.source === "string" ? link.source : link.source.id,
      target: typeof link.target === "string" ? link.target : link.target.id
    };
  }
  function layerCycleComponents(adjacency) {
    let index = 0;
    const indices = /* @__PURE__ */ new Map();
    const low = /* @__PURE__ */ new Map();
    const onStack = /* @__PURE__ */ new Set();
    const stack = [];
    const components = [];
    const strongConnect = (node) => {
      indices.set(node, index);
      low.set(node, index);
      index++;
      stack.push(node);
      onStack.add(node);
      for (const next of adjacency.get(node) || []) {
        if (!indices.has(next)) {
          strongConnect(next);
          low.set(node, Math.min(low.get(node), low.get(next)));
        } else if (onStack.has(next)) {
          low.set(node, Math.min(low.get(node), indices.get(next)));
        }
      }
      if (low.get(node) === indices.get(node)) {
        const component = [];
        let current;
        do {
          current = stack.pop();
          onStack.delete(current);
          component.push(current);
        } while (current !== node);
        if (component.length > 1)
          components.push(component.sort());
      }
    };
    for (const node of Array.from(adjacency.keys()).sort()) {
      if (!indices.has(node))
        strongConnect(node);
    }
    return components.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
  }
  function evaluateArchitecture(graph, rules, options = {}) {
    const baseline = options.baseline || EMPTY_ARCH_BASELINE;
    const baselineKeys = new Set(
      baseline.entries.map((e) => baselineKey(e.ruleId, e.source, e.target))
    );
    const layerMatchers = rules.layers.map((layer) => ({
      layer,
      regexps: compileGlobs(layer.paths)
    }));
    const exceptionMatchers = compileGlobs(rules.exceptions);
    const slicesMatchers = [];
    for (const rule of rules.rules) {
      if (rule.kind !== "slices")
        continue;
      slicesMatchers.push({
        rule,
        regexp: slicesPatternToRegExp(rule.pattern),
        shared: compileGlobs(rule.shared)
      });
    }
    const nodeById = /* @__PURE__ */ new Map();
    const codePaths = [];
    for (const node of graph.nodes) {
      nodeById.set(node.id, node);
      if (node.language !== "documentation")
        codePaths.push(normalizeArchPath(node.path || node.id));
    }
    const codePathSet = new Set(codePaths);
    const pathOfNode = (id) => {
      const node = nodeById.get(id);
      if (!node || node.language === "documentation")
        return void 0;
      return normalizeArchPath(node.path || node.id);
    };
    const fileLayer = /* @__PURE__ */ new Map();
    const exempt = /* @__PURE__ */ new Set();
    for (const path of codePaths) {
      if (matchesAny(path, exceptionMatchers)) {
        exempt.add(path);
        continue;
      }
      for (const matcher of layerMatchers) {
        if (matchesAny(path, matcher.regexps)) {
          fileLayer.set(path, matcher.layer.name);
          break;
        }
      }
    }
    const allUnlayeredFiles = codePaths.filter((path) => !exempt.has(path) && !fileLayer.has(path)).sort();
    const denyRules = rules.rules.filter((rule) => rule.kind === "deny");
    const edgeTypeSet = new Set(rules.edgeTypes.map((t) => t.toLowerCase()));
    edgeTypeSet.delete("doc-reference");
    const violationMap = /* @__PURE__ */ new Map();
    const addViolation = (ruleId, kind, severity, source, target, linkType, sourceGroup, targetGroup, sourceLayer, targetLayer) => {
      const key = ruleId + "\0" + source + "\0" + target;
      const existing = violationMap.get(key);
      if (existing) {
        if (existing.linkTypes.indexOf(linkType) === -1)
          existing.linkTypes.push(linkType);
        return;
      }
      violationMap.set(key, {
        ruleId,
        kind,
        severity,
        source,
        target,
        linkType,
        linkTypes: [linkType],
        sourceGroup,
        targetGroup,
        sourceLayer,
        targetLayer
      });
    };
    const caFiles = /* @__PURE__ */ new Map();
    const ceFiles = /* @__PURE__ */ new Map();
    for (const layer of rules.layers) {
      caFiles.set(layer.name, /* @__PURE__ */ new Set());
      ceFiles.set(layer.name, /* @__PURE__ */ new Set());
    }
    const adjacency = /* @__PURE__ */ new Map();
    for (const name of rules.layers.map((l) => l.name))
      adjacency.set(name, /* @__PURE__ */ new Set());
    for (const link of graph.links) {
      const type = (link.type || "").toLowerCase();
      if (!edgeTypeSet.has(type))
        continue;
      const { source, target } = linkEnds(link);
      if (source === target)
        continue;
      const sourcePath = pathOfNode(source);
      const targetPath = pathOfNode(target);
      if (!sourcePath || !targetPath || !codePathSet.has(sourcePath))
        continue;
      if (exempt.has(sourcePath))
        continue;
      const sourceLayer = fileLayer.get(sourcePath);
      const targetLayer = fileLayer.get(targetPath);
      const sourceGroupForRule = sourceLayer || UNLAYERED;
      if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
        const ca = caFiles.get(targetLayer);
        if (ca) {
          if (sourceLayer !== targetLayer)
            ca.add(sourcePath);
        }
        const ce = ceFiles.get(sourceLayer);
        if (ce)
          ce.add(targetPath);
        const out = adjacency.get(sourceLayer);
        if (out)
          out.add(targetLayer);
      }
      for (const rule of denyRules) {
        if (rule.from !== sourceGroupForRule)
          continue;
        const targetGroup = targetLayer || UNLAYERED;
        const denied = rule.deny.some((entry) => entry === targetGroup || entry === "*" && !!targetLayer);
        if (!denied)
          continue;
        if (targetLayer === sourceLayer)
          continue;
        addViolation(
          rule.id,
          "deny",
          rule.severity,
          sourcePath,
          targetPath,
          type,
          sourceLayer || UNLAYERED,
          targetGroup,
          sourceLayer,
          targetLayer
        );
      }
      for (const matcher of slicesMatchers) {
        const sourceMatch = matcher.regexp.exec(sourcePath);
        const targetMatch = matcher.regexp.exec(targetPath);
        if (!sourceMatch || !targetMatch)
          continue;
        const sourceSlice = sourceMatch[1];
        const targetSlice = targetMatch[1];
        if (sourceSlice === targetSlice)
          continue;
        if (matchesAny(targetPath, matcher.shared))
          continue;
        addViolation(
          matcher.rule.id,
          "slices",
          matcher.rule.severity,
          sourcePath,
          targetPath,
          type,
          sourceSlice,
          targetSlice
        );
      }
    }
    const violations = Array.from(violationMap.values()).map((v) => ({
      ...v,
      linkTypes: v.linkTypes.slice().sort(),
      baselined: baselineKeys.has(baselineKey(v.ruleId, v.source, v.target))
    })).sort((a, b) => {
      const keyA = a.ruleId + "\0" + a.source + "\0" + a.target;
      const keyB = b.ruleId + "\0" + b.source + "\0" + b.target;
      return keyA.localeCompare(keyB);
    });
    const newViolations = violations.filter((v) => !v.baselined);
    const filesByLayer = /* @__PURE__ */ new Map();
    for (const layer of fileLayer.values()) {
      filesByLayer.set(layer, (filesByLayer.get(layer) || 0) + 1);
    }
    const layerStats = rules.layers.map((layer) => {
      const violationsForLayer = violations.filter((v) => v.sourceLayer === layer.name);
      const newForLayer = violationsForLayer.filter((v) => !v.baselined);
      const ca = caFiles.get(layer.name)?.size || 0;
      const ce = ceFiles.get(layer.name)?.size || 0;
      const total = ca + ce;
      return {
        name: layer.name,
        files: filesByLayer.get(layer.name) || 0,
        ca,
        ce,
        instability: total > 0 ? ce / total : null,
        violations: violationsForLayer.length,
        newViolations: newForLayer.length,
        baselined: violationsForLayer.length - newForLayer.length,
        errors: newForLayer.filter((v) => v.severity === "error").length,
        warnings: newForLayer.filter((v) => v.severity === "warn").length
      };
    });
    const layerCycles = [];
    for (const rule of rules.rules) {
      if (rule.kind !== "no-cycles")
        continue;
      for (const component of layerCycleComponents(adjacency)) {
        layerCycles.push({ ruleId: rule.id, severity: rule.severity, layers: component });
      }
    }
    const baselinedCount = violations.length - newViolations.length;
    const evaluation = {
      rules: {
        layerNames: rules.layers.map((l) => l.name),
        ruleCount: rules.rules.length,
        denyCount: denyRules.length,
        slicesCount: rules.rules.filter((r) => r.kind === "slices").length,
        noCyclesCount: rules.rules.filter((r) => r.kind === "no-cycles").length,
        exceptionCount: rules.exceptions.length,
        strict: rules.strict,
        edgeTypes: rules.edgeTypes.slice()
      },
      layers: layerStats,
      violations,
      newViolations,
      counts: {
        errors: newViolations.filter((v) => v.severity === "error").length,
        warnings: newViolations.filter((v) => v.severity === "warn").length,
        total: violations.length,
        baselined: baselinedCount,
        newTotal: newViolations.length,
        newErrors: newViolations.filter((v) => v.severity === "error").length,
        newWarnings: newViolations.filter((v) => v.severity === "warn").length
      },
      layerCycles,
      unlayeredFiles: allUnlayeredFiles.slice(0, 500),
      unlayeredTotal: allUnlayeredFiles.length,
      configured: rules.layers.length > 0 && rules.rules.length > 0
    };
    return evaluation;
  }
  function applyArchitecture(nodes, links, evaluation, rules) {
    if (rules)
      applyLayerAssignments(nodes, rules);
    const newCountByPath = /* @__PURE__ */ new Map();
    for (const violation of evaluation.newViolations) {
      newCountByPath.set(violation.source, (newCountByPath.get(violation.source) || 0) + 1);
    }
    for (const node of nodes) {
      if (node.language === "documentation") {
        delete node.layer;
        delete node.archViolations;
        continue;
      }
      const path = normalizeArchPath(node.path || node.id);
      const count = newCountByPath.get(path);
      if (count)
        node.archViolations = count;
      else
        delete node.archViolations;
    }
    const bestByPair = /* @__PURE__ */ new Map();
    const severityRank = { warn: 1, error: 2 };
    for (const violation of evaluation.violations) {
      const key = violation.source + "\0" + violation.target;
      const candidate = {
        ruleId: violation.ruleId,
        severity: violation.severity,
        baselined: violation.baselined,
        linkTypes: violation.linkTypes
      };
      const previous = bestByPair.get(key);
      if (!previous) {
        bestByPair.set(key, candidate);
        continue;
      }
      if (previous.baselined && !candidate.baselined) {
        bestByPair.set(key, candidate);
      } else if (previous.baselined === candidate.baselined && severityRank[candidate.severity] > severityRank[previous.severity]) {
        bestByPair.set(key, candidate);
      }
    }
    for (const link of links) {
      const { source, target } = linkEnds(link);
      const best = bestByPair.get(source + "\0" + target);
      const type = (link.type || "").toLowerCase();
      const applies = !!best && (!type || !best.linkTypes || best.linkTypes.indexOf(type) !== -1);
      if (applies && best)
        link.archViolation = { ...best };
      else
        delete link.archViolation;
    }
  }
  function applyLayerAssignments(nodes, rules) {
    const exceptionMatchers = compileGlobs(rules.exceptions);
    const layerMatchers = rules.layers.map((layer) => ({
      layer,
      regexps: compileGlobs(layer.paths)
    }));
    for (const node of nodes) {
      if (node.language === "documentation") {
        delete node.layer;
        continue;
      }
      const path = normalizeArchPath(node.path || node.id);
      if (matchesAny(path, exceptionMatchers)) {
        delete node.layer;
        continue;
      }
      let assigned;
      for (const matcher of layerMatchers) {
        if (matchesAny(path, matcher.regexps)) {
          assigned = matcher.layer.name;
          break;
        }
      }
      if (assigned)
        node.layer = assigned;
      else
        delete node.layer;
    }
  }
  return __toCommonJS(arch_core_exports);
})();
