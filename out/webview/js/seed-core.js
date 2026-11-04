"use strict";
var AuraSeed = (() => {
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

  // src/graph/seed-core.ts
  var seed_core_exports = {};
  __export(seed_core_exports, {
    hashString: () => hashString,
    isPositioned: () => isPositioned,
    layoutStats: () => layoutStats,
    seedDirection: () => seedDirection,
    seedMissingNodes: () => seedMissingNodes
  });
  var FALLBACK_EXTENT = 40;
  function hashString(value) {
    let hash = 2166136261;
    const text = String(value == null ? "" : value);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  function isPositioned(node) {
    return !!node && typeof node.x === "number" && isFinite(node.x) && typeof node.y === "number" && isFinite(node.y) && typeof node.z === "number" && isFinite(node.z);
  }
  function seedDirection(id) {
    const lon = hashString(id) / 4294967295 * Math.PI * 2;
    const lat = hashString(id + "seed") / 4294967295 * 2 - 1;
    const ring = Math.sqrt(Math.max(0, 1 - lat * lat));
    return { x: ring * Math.cos(lon), y: lat, z: ring * Math.sin(lon) };
  }
  function layoutStats(nodes) {
    let sx = 0, sy = 0, sz = 0, placed = 0;
    for (const node of nodes) {
      if (!isPositioned(node))
        continue;
      sx += node.x;
      sy += node.y;
      sz += node.z;
      placed++;
    }
    if (placed === 0)
      return { centroid: { x: 0, y: 0, z: 0 }, extent: FALLBACK_EXTENT, placed: 0 };
    const centroid = { x: sx / placed, y: sy / placed, z: sz / placed };
    let extent = 0;
    for (const node of nodes) {
      if (!isPositioned(node))
        continue;
      const dx = node.x - centroid.x;
      const dy = node.y - centroid.y;
      const dz = node.z - centroid.z;
      extent = Math.max(extent, Math.hypot(dx, dy, dz));
    }
    return { centroid, extent: extent > 0 ? extent : FALLBACK_EXTENT, placed };
  }
  function endpointId(end) {
    return typeof end === "object" && end ? String(end.id) : String(end);
  }
  function buildAdjacency(links) {
    const adjacency = /* @__PURE__ */ new Map();
    const push = (from, to) => {
      if (!from || !to || from === to)
        return;
      const list = adjacency.get(from);
      if (list)
        list.push(to);
      else
        adjacency.set(from, [to]);
    };
    for (const link of links || []) {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      push(source, target);
      push(target, source);
    }
    return adjacency;
  }
  function seedMissingNodes(nodes, links = [], options = {}) {
    const result = { seeded: 0, fromNeighbours: 0, fromSphere: 0, radius: 0, extent: 0 };
    if (!Array.isArray(nodes) || nodes.length === 0)
      return result;
    const stats = layoutStats(nodes);
    const extent = typeof options.extent === "number" && options.extent > 0 ? options.extent : stats.extent;
    const radius = extent * 0.5;
    result.extent = extent;
    result.radius = radius;
    const missing = nodes.filter((node) => node && !isPositioned(node)).sort((a, b) => a.id.localeCompare(b.id));
    if (missing.length === 0)
      return result;
    const adjacency = buildAdjacency(links);
    const byId = /* @__PURE__ */ new Map();
    for (const node of nodes)
      byId.set(node.id, node);
    const perHub = /* @__PURE__ */ new Map();
    for (const node of missing) {
      const neighbours = adjacency.get(node.id) || [];
      let baseX = stats.centroid.x;
      let baseY = stats.centroid.y;
      let baseZ = stats.centroid.z;
      let anchorId = "";
      let sumX = 0, sumY = 0, sumZ = 0, count = 0;
      for (const neighbourId of neighbours) {
        const neighbour = byId.get(neighbourId);
        if (!isPositioned(neighbour))
          continue;
        sumX += neighbour.x;
        sumY += neighbour.y;
        sumZ += neighbour.z;
        count++;
        if (!anchorId)
          anchorId = neighbourId;
      }
      const direction = seedDirection(node.id);
      let distance;
      if (count > 0) {
        baseX = sumX / count;
        baseY = sumY / count;
        baseZ = sumZ / count;
        const seen = perHub.get(anchorId) || 0;
        perHub.set(anchorId, seen + 1);
        distance = extent * (0.1 + 0.06 * Math.min(seen, 5));
        result.fromNeighbours++;
      } else {
        distance = radius;
        result.fromSphere++;
      }
      node.x = baseX + direction.x * distance;
      node.y = baseY + direction.y * distance;
      node.z = baseZ + direction.z * distance;
      result.seeded++;
    }
    return result;
  }
  return __toCommonJS(seed_core_exports);
})();
