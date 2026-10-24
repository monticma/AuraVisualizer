"use strict";
var AuraCochange = (() => {
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

  // src/analysis/cochange.ts
  var cochange_exports = {};
  __export(cochange_exports, {
    computeCochange: () => computeCochange
  });

  // src/risk/risk-core.ts
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

  // src/analysis/cochange.ts
  function pairKey(a, b) {
    return a < b ? a + "\0" + b : b + "\0" + a;
  }
  function commitTime(commit) {
    if (typeof commit.date === "number" && isFinite(commit.date))
      return commit.date;
    if (typeof commit.date === "string") {
      const parsed = Date.parse(commit.date);
      return isFinite(parsed) ? parsed : void 0;
    }
    return void 0;
  }
  function computeCochange(commits, options = {}) {
    const windowDays = typeof options.windowDays === "number" && options.windowDays > 0 ? options.windowDays : 365;
    const now = typeof options.now === "number" && isFinite(options.now) ? options.now : Date.now();
    const minCochanges = Math.max(0, options.minCochanges ?? 2);
    const minJaccard = Math.min(1, Math.max(0, options.minJaccard ?? 0.2));
    const maxFilesPerCommit = Math.max(2, options.maxFilesPerCommit ?? 50);
    const maxPairs = Math.max(0, options.maxPairs ?? 200);
    const excludeLinked = options.excludeLinked !== false;
    const linked = /* @__PURE__ */ new Set();
    for (const pair of options.linkedPairs || [])
      linked.add(pairKey(pair[0], pair[1]));
    const allowed = options.allowedPaths ? new Set(options.allowedPaths) : void 0;
    const cutoff = now - windowDays * 24 * 60 * 60 * 1e3;
    const resolvePath = buildRenameResolver(commits);
    const pairCounts = /* @__PURE__ */ new Map();
    const fileCounts = /* @__PURE__ */ new Map();
    let commitsConsidered = 0;
    let totalCommitsInWindow = 0;
    for (const commit of commits) {
      const when = commitTime(commit);
      if (when === void 0 || when < cutoff || when > now)
        continue;
      const files = /* @__PURE__ */ new Set();
      for (const file of commit.files || []) {
        if (!file.path || file.status === "D")
          continue;
        const resolved = resolvePath(file.status === "R" && file.oldPath ? file.oldPath : file.path);
        if (!resolved)
          continue;
        if (allowed && !allowed.has(resolved))
          continue;
        files.add(resolved);
      }
      if (files.size === 0)
        continue;
      totalCommitsInWindow++;
      const list = Array.from(files).sort();
      for (const file of list)
        fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
      if (files.size < 2 || files.size > maxFilesPerCommit)
        continue;
      commitsConsidered++;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const key = pairKey(a, b);
          if (excludeLinked && linked.has(key))
            continue;
          const entry = pairCounts.get(key);
          if (entry)
            entry.cochanges++;
          else
            pairCounts.set(key, { a, b, cochanges: 1 });
        }
      }
    }
    const pairs = [];
    for (const entry of pairCounts.values()) {
      if (entry.cochanges < minCochanges)
        continue;
      const aCommits = fileCounts.get(entry.a) || 0;
      const bCommits = fileCounts.get(entry.b) || 0;
      const union = aCommits + bCommits - entry.cochanges;
      if (union <= 0)
        continue;
      const jaccard = entry.cochanges / union;
      if (jaccard < minJaccard)
        continue;
      pairs.push({
        a: entry.a,
        b: entry.b,
        cochanges: entry.cochanges,
        aCommits,
        bCommits,
        jaccard,
        support: commitsConsidered > 0 ? entry.cochanges / commitsConsidered : 0,
        linked: linked.has(pairKey(entry.a, entry.b))
      });
    }
    pairs.sort((left, right) => right.jaccard - left.jaccard || right.cochanges - left.cochanges || left.a.localeCompare(right.a) || left.b.localeCompare(right.b));
    return {
      pairs: pairs.slice(0, maxPairs),
      windowDays,
      commitsConsidered,
      totalCommitsInWindow,
      maxJaccard: pairs.length > 0 ? pairs[0].jaccard : 0
    };
  }
  return __toCommonJS(cochange_exports);
})();
