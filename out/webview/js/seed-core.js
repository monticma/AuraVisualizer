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
    groupKeyOf: () => groupKeyOf,
    hashString: () => hashString,
    isPositioned: () => isPositioned,
    layoutStats: () => layoutStats,
    medianEdgeLength: () => medianEdgeLength,
    seedDirection: () => seedDirection,
    seedMissingNodes: () => seedMissingNodes
  });
  var FALLBACK_EXTENT = 40;
  var LOCAL_EDGE_FACTOR = 0.6;
  var MIN_SEED_UNIT = 3;
  var MAX_SEED_UNIT_SHARE = 0.05;
  var HUB_GROWTH = 0.3;
  var HUB_GROWTH_CAP = 6;
  var GROUP_DEPTH_MIN = 0.35;
  var GROUP_DEPTH_SPAN = 0.35;
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
  function groupKeyOf(id) {
    const text = String(id == null ? "" : id).replace(/\\/g, "/");
    const slash = text.indexOf("/");
    return slash > 0 ? text.slice(0, slash) : "";
  }
  function medianEdgeLength(nodes, links) {
    if (!links || links.length === 0)
      return null;
    const byId = /* @__PURE__ */ new Map();
    for (const node of nodes)
      byId.set(node.id, node);
    const lengths = [];
    for (const link of links) {
      const source = byId.get(endpointId(link.source));
      const target = byId.get(endpointId(link.target));
      if (!isPositioned(source) || !isPositioned(target))
        continue;
      const distance = Math.hypot(source.x - target.x, source.y - target.y, source.z - target.z);
      if (isFinite(distance) && distance > 0)
        lengths.push(distance);
    }
    if (lengths.length === 0)
      return null;
    lengths.sort((a, b) => a - b);
    return lengths[Math.floor(lengths.length / 2)];
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
    const result = {
      seeded: 0,
      fromNeighbours: 0,
      fromSphere: 0,
      radius: 0,
      extent: 0,
      unit: 0,
      medianEdge: null
    };
    if (!Array.isArray(nodes) || nodes.length === 0)
      return result;
    const stats = layoutStats(nodes);
    const extent = typeof options.extent === "number" && options.extent > 0 ? options.extent : stats.extent;
    const radius = extent * 0.5;
    const medianEdge = medianEdgeLength(nodes, links);
    const unit = Math.min(
      extent * MAX_SEED_UNIT_SHARE,
      Math.max(MIN_SEED_UNIT, (medianEdge === null ? extent * 0.12 : medianEdge) * LOCAL_EDGE_FACTOR)
    );
    result.extent = extent;
    result.radius = radius;
    result.unit = unit;
    result.medianEdge = medianEdge;
    const missing = nodes.filter((node) => node && !isPositioned(node)).sort((a, b) => a.id.localeCompare(b.id));
    if (missing.length === 0)
      return result;
    const adjacency = buildAdjacency(links);
    const byId = /* @__PURE__ */ new Map();
    for (const node of nodes)
      byId.set(node.id, node);
    const perHub = /* @__PURE__ */ new Map();
    const groupCentres = /* @__PURE__ */ new Map();
    function groupCentre(key) {
      const cached = groupCentres.get(key);
      if (cached)
        return cached;
      const direction = seedDirection("@group:" + key);
      const depthHash = hashString("@depth:" + key) / 4294967295;
      const depth = extent * (GROUP_DEPTH_MIN + GROUP_DEPTH_SPAN * depthHash);
      const centre = {
        x: stats.centroid.x + direction.x * depth,
        y: stats.centroid.y + direction.y * depth,
        z: stats.centroid.z + direction.z * depth
      };
      groupCentres.set(key, centre);
      return centre;
    }
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
        distance = unit * (1 + HUB_GROWTH * Math.min(seen, HUB_GROWTH_CAP));
        result.fromNeighbours++;
      } else {
        const key = groupKeyOf(node.id);
        const centre = groupCentre(key);
        baseX = centre.x;
        baseY = centre.y;
        baseZ = centre.z;
        const seen = perHub.get("@group:" + key) || 0;
        perHub.set("@group:" + key, seen + 1);
        distance = unit * (1 + HUB_GROWTH * Math.min(seen, HUB_GROWTH_CAP));
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
