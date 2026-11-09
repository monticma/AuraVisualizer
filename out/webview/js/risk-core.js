"use strict";
var AuraRisk = (() => {
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

  // src/risk/risk-core.ts
  var risk_core_exports = {};
  __export(risk_core_exports, {
    CHURN_CAP: () => CHURN_CAP,
    DEFAULT_FIX_KEYWORDS: () => DEFAULT_FIX_KEYWORDS,
    DEFAULT_RISK_WINDOW: () => DEFAULT_RISK_WINDOW,
    RISK_HIGH_THRESHOLD: () => RISK_HIGH_THRESHOLD,
    RISK_MEDIUM_THRESHOLD: () => RISK_MEDIUM_THRESHOLD,
    RISK_WEIGHTS: () => RISK_WEIGHTS,
    RISK_WINDOWS: () => RISK_WINDOWS,
    asGitStats: () => asGitStats,
    buildRenameResolver: () => buildRenameResolver,
    buildRiskPercentiles: () => buildRiskPercentiles,
    computeRiskScore: () => computeRiskScore,
    isFixCommit: () => isFixCommit,
    normalizeRiskWindow: () => normalizeRiskWindow,
    percentileLookup: () => percentileLookup,
    riskBucket: () => riskBucket,
    riskReasons: () => riskReasons,
    riskReasonsText: () => riskReasonsText,
    topPercentLabel: () => topPercentLabel
  });
  var RISK_WINDOWS = [30, 90, 365];
  var DEFAULT_RISK_WINDOW = 90;
  var CHURN_CAP = 20;
  function asGitStats(input) {
    if (typeof input === "number")
      return { commits: input };
    if (!input)
      return { commits: 0 };
    return input;
  }
  var DEFAULT_FIX_KEYWORDS = "\\b(fix|fixes|fixed|bug|bugs|hotfix|regress|regression|revert)\\b";
  var fixRegexCache = /* @__PURE__ */ new Map();
  function compileFixPattern(pattern) {
    const key = pattern || DEFAULT_FIX_KEYWORDS;
    if (fixRegexCache.has(key))
      return fixRegexCache.get(key);
    let compiled = null;
    try {
      compiled = new RegExp(key, "i");
    } catch {
      compiled = null;
    }
    fixRegexCache.set(key, compiled);
    return compiled;
  }
  function isFixCommit(message, pattern) {
    if (!message)
      return false;
    let re = compileFixPattern(pattern);
    if (!re)
      re = compileFixPattern(void 0);
    return !!re && re.test(message);
  }
  var RISK_WEIGHTS = {
    complexity: 0.21,
    /** Fan-in, or PageRank when `riskCentrality` is on. */
    centrality: 0.18,
    fanOut: 0.08,
    cycle: 0.12,
    deadCode: 0.12,
    relChurn: 0.09,
    recency: 0.06,
    frequency: 0.06,
    authors: 0.05,
    fixRatio: 0.03
  };
  function normalizeRiskWindow(value) {
    return typeof value === "number" && RISK_WINDOWS.indexOf(value) !== -1 ? value : DEFAULT_RISK_WINDOW;
  }
  function percentileLookup(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return (v) => {
      const n = sorted.length;
      if (n === 0)
        return 0;
      let lo = 0, hi = n;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if (sorted[mid] < v)
          lo = mid + 1;
        else
          hi = mid;
      }
      const less = lo;
      let lo2 = less, hi2 = n;
      while (lo2 < hi2) {
        const mid2 = lo2 + hi2 >> 1;
        if (sorted[mid2] <= v)
          lo2 = mid2 + 1;
        else
          hi2 = mid2;
      }
      const equal = lo2 - less;
      const denom = n - equal;
      if (denom <= 0)
        return 0;
      return Math.min(1, less / denom);
    };
  }
  function buildRiskPercentiles(nodes, gitOf) {
    const complexity = [], fanIn = [], fanOut = [], churn = [];
    const pagerank = [];
    const relChurn = [], recency = [], authors = [], fixRatio = [];
    for (const n of nodes) {
      const git = asGitStats(gitOf(n));
      complexity.push(n.complexity || 0);
      fanIn.push(n.fanIn || 0);
      fanOut.push(n.fanOut || 0);
      churn.push(git.commits || 0);
      pagerank.push(typeof n.pagerank === "number" ? n.pagerank : 0);
      relChurn.push(git.relChurn || 0);
      recency.push(git.recency || 0);
      authors.push(git.authors || 0);
      fixRatio.push(git.fixRatio || 0);
    }
    return {
      complexity: percentileLookup(complexity),
      fanIn: percentileLookup(fanIn),
      fanOut: percentileLookup(fanOut),
      churn: percentileLookup(churn),
      centrality: percentileLookup(pagerank),
      relChurn: percentileLookup(relChurn),
      recency: percentileLookup(recency),
      authors: percentileLookup(authors),
      fixRatio: percentileLookup(fixRatio)
    };
  }
  function topPercentLabel(p) {
    const pc = Math.round((1 - p) * 100);
    if (pc <= 0)
      return "the highest";
    if (pc >= 100)
      return null;
    return "top " + pc + "%";
  }
  var RISK_HIGH_THRESHOLD = 66;
  var RISK_MEDIUM_THRESHOLD = 33;
  function riskBucket(score) {
    return score >= RISK_HIGH_THRESHOLD ? "high" : score >= RISK_MEDIUM_THRESHOLD ? "medium" : "low";
  }
  function computeRiskScore(node, pct, git, options = {}) {
    const stats = asGitStats(git);
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const commits = stats.commits || 0;
    const relChurn = stats.relChurn || 0;
    const recency = stats.recency || 0;
    const authors = stats.authors || 0;
    const fixRatio = stats.fixRatio || 0;
    const complexityP = pct ? pct.complexity(complexity) : Math.min(complexity / 50, 1);
    const fanInP = pct ? pct.fanIn(fanIn) : Math.min(fanIn / 20, 1);
    const fanOutP = pct ? pct.fanOut(fanOut) : Math.min(fanOut / 30, 1);
    const churnP = pct ? pct.churn(commits) : Math.min(commits / CHURN_CAP, 1);
    const relChurnP = pct?.relChurn ? pct.relChurn(relChurn) : Math.min(relChurn, 1);
    const recencyP = pct?.recency ? pct.recency(recency) : 0;
    const authorsP = pct?.authors ? pct.authors(authors) : 0;
    const fixRatioP = pct?.fixRatio ? pct.fixRatio(fixRatio) : fixRatio;
    const centralityEnabled = options.centrality === true && !!pct?.centrality;
    const centralityP = centralityEnabled && pct?.centrality ? pct.centrality(node.pagerank || 0) : 0;
    const inCycle = node.cycleIds && node.cycleIds.length > 0 ? 1 : 0;
    const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
    const deadCount = node.deadExports && node.deadExports.length || 0;
    const deadRatio = totalSymbols > 0 ? Math.min(deadCount / totalSymbols, 1) : 0;
    const w = RISK_WEIGHTS;
    return 100 * (w.complexity * complexityP + w.centrality * (centralityEnabled ? centralityP : fanInP) + w.fanOut * fanOutP + w.cycle * inCycle + w.deadCode * deadRatio + w.relChurn * relChurnP + w.recency * recencyP + w.frequency * churnP + w.authors * authorsP + w.fixRatio * fixRatioP);
  }
  function riskReasons(node, pct, ctx) {
    const reasons = [];
    const w = RISK_WEIGHTS;
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const churn = ctx.churn || 0;
    const relChurn = ctx.relChurn || 0;
    const fixRatio = ctx.fixRatio || 0;
    const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
    const deadCount = node.deadExports && node.deadExports.length || 0;
    const authorCount = ctx.authorCount || 0;
    let lbl;
    if (complexity > 0) {
      const pC = pct ? pct.complexity(complexity) : 0;
      lbl = topPercentLabel(pC);
      reasons.push({ weight: w.complexity * pC, text: "complexity " + complexity + (lbl ? " (" + lbl + " of the repo)" : "") });
    }
    if (fanIn > 0 || ctx.centrality && node.pagerank && pct?.centrality) {
      if (ctx.centrality && pct?.centrality && node.pagerank) {
        const pCentrality = pct.centrality(node.pagerank);
        const centralityLabel = topPercentLabel(pCentrality);
        reasons.push({
          weight: w.centrality * pCentrality,
          text: "centrality" + (centralityLabel ? " " + centralityLabel : "") + " (PageRank " + node.pagerank.toFixed(4) + ")"
        });
      } else {
        const pI = pct ? pct.fanIn(fanIn) : 0;
        lbl = topPercentLabel(pI);
        reasons.push({ weight: w.centrality * pI, text: fanIn + (fanIn === 1 ? " file depends on it" : " files depend on it") + (lbl ? " (" + lbl + ")" : "") });
      }
    }
    if (relChurn >= 0.1) {
      const pRc = pct?.relChurn ? pct.relChurn(relChurn) : Math.min(relChurn, 1);
      lbl = topPercentLabel(pRc);
      const times = relChurn >= 10 ? String(Math.round(relChurn)) : relChurn.toFixed(1);
      reasons.push({
        weight: w.relChurn * pRc,
        text: "rewritten " + times + "\xD7 in " + ctx.windowDays + " days" + (lbl ? " (" + lbl + ")" : "")
      });
    }
    if (churn > 0) {
      const pCh = pct ? pct.churn(churn) : 0;
      lbl = topPercentLabel(pCh);
      reasons.push({ weight: w.frequency * pCh, text: "changed " + churn + " time" + (churn === 1 ? "" : "s") + " in " + ctx.windowDays + " days" + (lbl ? " (" + lbl + ")" : "") });
    }
    if (authorCount > 1) {
      const pA = pct?.authors ? pct.authors(authorCount) : 0;
      lbl = topPercentLabel(pA);
      reasons.push({
        weight: w.authors * pA,
        text: authorCount + " authors" + (lbl ? " (" + lbl + ")" : "")
      });
    } else if (authorCount === 1) {
      reasons.push({ weight: 0, text: "single author" });
    }
    if (fixRatio > 0) {
      const pF = pct?.fixRatio ? pct.fixRatio(fixRatio) : fixRatio;
      lbl = topPercentLabel(pF);
      reasons.push({
        weight: w.fixRatio * pF,
        text: Math.round(fixRatio * 100) + "% of its commits are fixes" + (lbl ? " (" + lbl + ")" : "")
      });
    }
    if (fanOut > 0) {
      const pO = pct ? pct.fanOut(fanOut) : 0;
      reasons.push({ weight: w.fanOut * pO, text: "depends on " + fanOut + " file" + (fanOut === 1 ? "" : "s") });
    }
    if (node.cycleIds && node.cycleIds.length > 0) {
      reasons.push({ weight: w.cycle, text: "in a dependency cycle" });
    }
    if (deadCount > 0) {
      const ratio = totalSymbols > 0 ? deadCount / totalSymbols : 0;
      reasons.push({ weight: w.deadCode * ratio, text: deadCount + " unused symbol" + (deadCount === 1 ? "" : "s") + " of " + totalSymbols });
    }
    reasons.sort((a, b) => b.weight - a.weight);
    return reasons;
  }
  function riskReasonsText(reasons, separator) {
    const parts = [];
    for (const r of reasons)
      parts.push(r.text);
    return parts.join(separator);
  }
  function buildRenameResolver(commits) {
    const map = /* @__PURE__ */ new Map();
    for (const commit of commits) {
      for (const f of commit.files || []) {
        if (f.status === "R" && f.oldPath && f.path && f.oldPath !== f.path && !map.has(f.oldPath)) {
          map.set(f.oldPath, f.path);
        }
      }
    }
    const cache = /* @__PURE__ */ new Map();
    return (path) => {
      const hit = cache.get(path);
      if (hit !== void 0)
        return hit;
      let cur = path;
      const seen = /* @__PURE__ */ new Set([cur]);
      while (map.has(cur)) {
        const next = map.get(cur);
        if (seen.has(next))
          break;
        seen.add(next);
        cur = next;
      }
      cache.set(path, cur);
      return cur;
    };
  }
  return __toCommonJS(risk_core_exports);
})();
