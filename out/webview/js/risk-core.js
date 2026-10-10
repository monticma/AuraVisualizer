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
    DEFAULT_RISK_WINDOW: () => DEFAULT_RISK_WINDOW,
    RISK_WINDOWS: () => RISK_WINDOWS,
    buildRiskPercentiles: () => buildRiskPercentiles,
    computeRiskScore: () => computeRiskScore,
    normalizeRiskWindow: () => normalizeRiskWindow,
    percentileLookup: () => percentileLookup,
    riskReasons: () => riskReasons,
    riskReasonsText: () => riskReasonsText,
    topPercentLabel: () => topPercentLabel
  });
  var RISK_WINDOWS = [30, 90, 365];
  var DEFAULT_RISK_WINDOW = 90;
  var CHURN_CAP = 20;
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
  function buildRiskPercentiles(nodes, churnOf) {
    const complexity = [], fanIn = [], fanOut = [], churn = [];
    for (const n of nodes) {
      complexity.push(n.complexity || 0);
      fanIn.push(n.fanIn || 0);
      fanOut.push(n.fanOut || 0);
      churn.push(churnOf(n) || 0);
    }
    return {
      complexity: percentileLookup(complexity),
      fanIn: percentileLookup(fanIn),
      fanOut: percentileLookup(fanOut),
      churn: percentileLookup(churn)
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
  function computeRiskScore(node, pct, churn) {
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const complexityP = pct ? pct.complexity(complexity) : Math.min(complexity / 50, 1);
    const fanInP = pct ? pct.fanIn(fanIn) : Math.min(fanIn / 20, 1);
    const fanOutP = pct ? pct.fanOut(fanOut) : Math.min(fanOut / 30, 1);
    const churnP = pct ? pct.churn(churn) : Math.min(churn / CHURN_CAP, 1);
    const inCycle = node.cycleIds && node.cycleIds.length > 0 ? 1 : 0;
    const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
    const deadCount = node.deadExports && node.deadExports.length || 0;
    const deadRatio = totalSymbols > 0 ? Math.min(deadCount / totalSymbols, 1) : 0;
    return 100 * (0.3 * complexityP + 0.2 * fanInP + 0.1 * fanOutP + 0.15 * inCycle + 0.15 * deadRatio + 0.1 * churnP);
  }
  function riskReasons(node, pct, ctx) {
    const reasons = [];
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const churn = ctx.churn || 0;
    const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
    const deadCount = node.deadExports && node.deadExports.length || 0;
    const authorCount = ctx.authorCount || 0;
    let lbl;
    if (complexity > 0) {
      const pC = pct ? pct.complexity(complexity) : 0;
      lbl = topPercentLabel(pC);
      reasons.push({ weight: 0.3 * pC, text: "complexity " + complexity + (lbl ? " (" + lbl + " of the repo)" : "") });
    }
    if (fanIn > 0) {
      const pI = pct ? pct.fanIn(fanIn) : 0;
      lbl = topPercentLabel(pI);
      reasons.push({ weight: 0.2 * pI, text: fanIn + (fanIn === 1 ? " file depends on it" : " files depend on it") + (lbl ? " (" + lbl + ")" : "") });
    }
    if (churn > 0) {
      const pCh = pct ? pct.churn(churn) : 0;
      lbl = topPercentLabel(pCh);
      reasons.push({ weight: 0.1 * pCh, text: "changed " + churn + " time" + (churn === 1 ? "" : "s") + " in " + ctx.windowDays + " days" + (lbl ? " (" + lbl + ")" : "") });
    }
    if (fanOut > 0) {
      const pO = pct ? pct.fanOut(fanOut) : 0;
      reasons.push({ weight: 0.1 * pO, text: "depends on " + fanOut + " file" + (fanOut === 1 ? "" : "s") });
    }
    if (node.cycleIds && node.cycleIds.length > 0) {
      reasons.push({ weight: 0.15, text: "in a dependency cycle" });
    }
    if (deadCount > 0) {
      const ratio = totalSymbols > 0 ? deadCount / totalSymbols : 0;
      reasons.push({ weight: 0.15 * ratio, text: deadCount + " unused symbol" + (deadCount === 1 ? "" : "s") + " of " + totalSymbols });
    }
    if (authorCount === 1) {
      reasons.push({ weight: 0, text: "single author" });
    } else if (authorCount > 1) {
      reasons.push({ weight: 0, text: authorCount + " authors" });
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
  return __toCommonJS(risk_core_exports);
})();
