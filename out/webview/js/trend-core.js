"use strict";
var AuraTrend = (() => {
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

  // src/analysis/trend.ts
  var trend_exports = {};
  __export(trend_exports, {
    buildFileTrends: () => buildFileTrends,
    linearRegression: () => linearRegression,
    sparklinePoints: () => sparklinePoints,
    summarizeTrends: () => summarizeTrends
  });
  var DAY = 24 * 60 * 60 * 1e3;
  function toTime(value) {
    if (typeof value === "number")
      return isFinite(value) ? value : 0;
    const parsed = Date.parse(value);
    return isFinite(parsed) ? parsed : 0;
  }
  function linearRegression(points) {
    if (points.length < 2)
      return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
    let sumX = 0, sumY = 0;
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }
    const meanX = sumX / points.length;
    const meanY = sumY / points.length;
    let cov = 0, varX = 0, varY = 0;
    for (const point of points) {
      const dx = point.x - meanX;
      const dy = point.y - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }
    if (varX === 0)
      return { slope: 0, intercept: meanY, r2: 0 };
    const slope = cov / varX;
    const r2 = varY === 0 ? 0 : cov * cov / (varX * varY);
    return { slope, intercept: meanY - slope * meanX, r2: Math.max(0, Math.min(1, r2)) };
  }
  function buildFileTrends(commits, deltas, options = {}) {
    const threshold = Math.max(0, options.threshold ?? 0.5);
    const minR2 = Math.max(0, Math.min(1, options.minR2 ?? 0.3));
    const maxPoints = Math.max(2, options.maxPoints ?? 60);
    const resolvePath = options.resolvePath || ((path) => path);
    const ordered = commits.map((commit, index) => ({ ...commit, index, time: toTime(commit.date) })).sort((a, b) => a.time - b.time || a.index - b.index);
    const pointsByFile = /* @__PURE__ */ new Map();
    for (const commit of ordered) {
      const delta = deltas[commit.hash];
      if (!delta)
        continue;
      for (const file of delta.removed || []) {
        const resolved = resolvePath(file);
        if (resolved === file)
          pointsByFile.delete(resolved);
      }
      const modified = delta.modified || {};
      for (const rawFile of Object.keys(modified)) {
        const state = modified[rawFile];
        const rawComplexity = Number(state.complexity);
        const rawLines = Number(state.linesOfCode);
        if (!isFinite(rawComplexity) || !isFinite(rawLines))
          continue;
        const symbols = state.symbols && isFinite(Number(state.symbols.totalSymbols)) ? Number(state.symbols.totalSymbols) : 0;
        const file = resolvePath(rawFile);
        const point = {
          hash: commit.hash,
          date: commit.time,
          complexity: rawComplexity,
          lines: rawLines,
          symbols
        };
        const list = pointsByFile.get(file);
        if (list)
          list.push(point);
        else
          pointsByFile.set(file, [point]);
      }
    }
    const trends = {};
    for (const [file, allPoints] of pointsByFile) {
      if (allPoints.length === 0)
        continue;
      allPoints.sort((a, b) => a.date - b.date);
      const first = allPoints[0];
      const last = allPoints[allPoints.length - 1];
      const regression = linearRegression(allPoints.map((point) => ({
        x: (point.date - first.date) / DAY,
        y: point.complexity
      })));
      const slopePer30Days = regression.slope * 30;
      const samples = allPoints.length;
      const direction = samples < 2 ? "unknown" : Math.abs(slopePer30Days) < threshold ? "flat" : slopePer30Days > 0 ? "up" : "down";
      const significant = samples >= 2 && regression.r2 >= minR2;
      trends[file] = {
        file,
        points: allPoints.slice(-maxPoints),
        samples,
        start: first.date,
        end: last.date,
        delta: last.complexity - first.complexity,
        slopePer30Days,
        r2: regression.r2,
        direction,
        degrading: significant && slopePer30Days >= threshold,
        improving: significant && slopePer30Days <= -threshold
      };
    }
    return trends;
  }
  function summarizeTrends(trends) {
    const list = Object.values(trends);
    const degraded = list.filter((trend) => trend.degrading).length;
    const improved = list.filter((trend) => trend.improving).length;
    const average = list.length === 0 ? 0 : list.reduce((sum, trend) => sum + trend.slopePer30Days, 0) / list.length;
    return {
      files: list.length,
      degrading: degraded,
      improving: improved,
      stable: list.length - degraded - improved,
      averageSlopePer30Days: average
    };
  }
  function sparklinePoints(points, width, height) {
    if (points.length === 0)
      return "";
    if (points.length === 1)
      return "0," + (height / 2).toFixed(1);
    const min = Math.min(...points.map((point) => point.complexity));
    const max = Math.max(...points.map((point) => point.complexity));
    const span = max - min || 1;
    return points.map((point, index) => {
      const x = index / (points.length - 1) * width;
      const y = height - (point.complexity - min) / span * height;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
  }
  return __toCommonJS(trend_exports);
})();
