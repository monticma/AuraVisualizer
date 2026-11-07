"use strict";
var AuraCity = (() => {
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

  // src/graph/city-core.ts
  var city_core_exports = {};
  __export(city_core_exports, {
    DEFAULT_GAP: () => DEFAULT_GAP,
    DEFAULT_HEIGHT_COUNT: () => DEFAULT_HEIGHT_COUNT,
    MIN_HEIGHT_RATIO: () => MIN_HEIGHT_RATIO,
    districtDepth: () => districtDepth,
    districtKeyOf: () => districtKeyOf,
    heightFor: () => heightFor,
    layoutCity: () => layoutCity,
    metricValue: () => metricValue,
    squarify: () => squarify,
    tierEdges: () => tierEdges,
    tierOf: () => tierOf
  });
  var MIN_HEIGHT_RATIO = 0.12;
  var DEFAULT_HEIGHT_COUNT = 5;
  var DEFAULT_GAP = 0.06;
  function metricValue(node, metric) {
    let raw;
    switch (metric) {
      case "linesOfCode":
        raw = node.linesOfCode;
        break;
      case "complexity":
        raw = node.complexity;
        break;
      case "cognitive":
        raw = node.cognitive !== void 0 ? node.cognitive : node.complexity;
        break;
      case "fanIn":
        raw = node.fanIn;
        break;
      case "fanOut":
        raw = node.fanOut;
        break;
      case "pagerank":
        raw = node.pagerank;
        break;
      case "size":
        raw = node.size;
        break;
    }
    if (raw === void 0 || raw === null || !isFinite(raw))
      return 0;
    return raw > 0 ? raw : 0;
  }
  function districtKeyOf(node, by) {
    if (by === "layer") {
      const layer = node.layer && node.layer.length > 0 ? node.layer : "(unlayered)";
      return layer;
    }
    if (by === "community") {
      if (node.community && node.community.length > 0)
        return node.community;
    }
    const group = node.group && node.group.length > 0 ? node.group : node.path;
    if (!group)
      return ".";
    const normalized = group.replace(/\\/g, "/").replace(/\/+$/, "");
    return normalized.length > 0 ? normalized : ".";
  }
  function districtDepth(key) {
    if (!key || key === ".")
      return 0;
    return key.split("/").length - 1;
  }
  function squarify(items, rect) {
    const positive = items.filter((item) => item.value > 0);
    if (positive.length === 0 || rect.w <= 0 || rect.h <= 0)
      return [];
    const total = positive.reduce((sum, item) => sum + item.value, 0);
    const scale = rect.w * rect.h / total;
    const sorted = positive.map((item) => ({ id: item.id, area: Math.max(item.value * scale, 1e-12) })).sort((a, b) => b.area - a.area || a.id.localeCompare(b.id));
    const out = [];
    let free = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    let index = 0;
    while (index < sorted.length) {
      const side = Math.min(free.w, free.h);
      const row = [sorted[index]];
      let next = index + 1;
      while (next < sorted.length && worst([...row, sorted[next]], side) <= worst(row, side)) {
        row.push(sorted[next]);
        next++;
      }
      const rowArea = row.reduce((sum, item) => sum + item.area, 0);
      if (rowArea <= 0)
        break;
      if (free.w >= free.h) {
        const width = Math.min(rowArea / free.h, free.w);
        let cursor = free.y;
        for (const item of row) {
          const height = item.area / rowArea * free.h;
          out.push({ id: item.id, x: free.x, y: cursor, w: width, h: height });
          cursor += height;
        }
        free = { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
      } else {
        const height = Math.min(rowArea / free.w, free.h);
        let cursor = free.x;
        for (const item of row) {
          const width = item.area / rowArea * free.w;
          out.push({ id: item.id, x: cursor, y: free.y, w: width, h: height });
          cursor += width;
        }
        free = { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
      }
      index = next;
    }
    return out;
  }
  function worst(row, side) {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    for (const item of row) {
      sum += item.area;
      if (item.area > max)
        max = item.area;
      if (item.area < min)
        min = item.area;
    }
    if (sum <= 0 || side <= 0)
      return Infinity;
    return Math.max(side * side * max / (sum * sum), sum * sum / (side * side * min));
  }
  function tierEdges(values, count = DEFAULT_HEIGHT_COUNT) {
    const sorted = values.filter((value) => isFinite(value)).slice().sort((a, b) => a - b);
    if (sorted.length === 0)
      return [];
    const tiers = Math.max(1, Math.floor(count));
    const edges = [];
    for (let i = 0; i <= tiers; i++) {
      const position = (sorted.length - 1) * (i / tiers);
      const low = Math.floor(position);
      const high = Math.ceil(position);
      const weight = position - low;
      const value = low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * weight;
      edges.push(value);
    }
    return edges;
  }
  function tierOf(value, edges) {
    if (edges.length < 2)
      return 1;
    for (let i = 1; i < edges.length; i++) {
      if (value <= edges[i])
        return i;
    }
    return edges.length - 1;
  }
  function heightFor(value, reference, mapping, edges = []) {
    const span = reference.max - reference.min;
    if (span <= 0)
      return 1;
    if (mapping === "threshold") {
      return value > reference.median ? 1 : MIN_HEIGHT_RATIO + (1 - MIN_HEIGHT_RATIO) * 0.35;
    }
    if (mapping === "linear") {
      const ratio = (value - reference.min) / span;
      return MIN_HEIGHT_RATIO + (1 - MIN_HEIGHT_RATIO) * Math.max(0, Math.min(1, ratio));
    }
    const tiers = Math.max(1, edges.length - 1);
    if (tiers <= 1)
      return 1;
    if (edges.every((edge) => edge === edges[0]))
      return 1;
    const tier = tierOf(value, edges);
    return MIN_HEIGHT_RATIO + (1 - MIN_HEIGHT_RATIO) * (tier - 1) / (tiers - 1);
  }
  function medianOf(sorted) {
    if (sorted.length === 0)
      return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }
  function layoutCity(nodes, options = {}) {
    const footprintMetric = options.footprint || "linesOfCode";
    let heightMetric = options.height || "cognitive";
    const mapping = options.mapping || "quantiles";
    const districtBy = options.districtBy || "group";
    const heightCount = Math.max(1, options.heightCount || DEFAULT_HEIGHT_COUNT);
    const gap = options.gap === void 0 ? DEFAULT_GAP : Math.max(0, Math.min(0.4, options.gap));
    if (heightMetric === "cognitive" && !nodes.some((node) => typeof node.cognitive === "number" && isFinite(node.cognitive))) {
      heightMetric = "complexity";
    }
    const usable = nodes.filter((node) => node && typeof node.id === "string" && node.id.length > 0);
    const empty = {
      rects: [],
      districts: [],
      tiers: [],
      heightMetric,
      footprintMetric,
      mapping,
      medianEdge: 0
    };
    if (usable.length === 0)
      return empty;
    const heights = usable.map((node) => metricValue(node, heightMetric));
    const sortedHeights = heights.slice().sort((a, b) => a - b);
    const reference = {
      min: sortedHeights[0],
      max: sortedHeights[sortedHeights.length - 1],
      median: medianOf(sortedHeights)
    };
    const edges = mapping === "quantiles" ? tierEdges(heights, heightCount) : [];
    const byDistrict = /* @__PURE__ */ new Map();
    for (const node of usable) {
      const key = districtKeyOf(node, districtBy);
      const bucket = byDistrict.get(key);
      if (bucket)
        bucket.push(node);
      else
        byDistrict.set(key, [node]);
    }
    const footprints = /* @__PURE__ */ new Map();
    for (const node of usable)
      footprints.set(node.id, metricValue(node, footprintMetric));
    const districtItems = [...byDistrict.entries()].map(([key, members]) => ({
      id: key,
      value: Math.max(1, members.reduce((sum, node) => sum + Math.max(footprints.get(node.id) || 0, 1), 0))
    }));
    const districtRects = squarify(districtItems, { x: 0, y: 0, w: 1, h: 1 });
    const rects = [];
    const districts = [];
    for (const placed of districtRects) {
      const members = byDistrict.get(placed.id) || [];
      const depth = districtDepth(placed.id);
      districts.push({
        key: placed.id,
        x: placed.x,
        z: placed.y,
        w: placed.w,
        d: placed.h,
        depth,
        count: members.length
      });
      const insetX = placed.w * gap;
      const insetZ = placed.h * gap;
      const inner = {
        x: placed.x + insetX,
        y: placed.y + insetZ,
        w: Math.max(placed.w - insetX * 2, 1e-6),
        h: Math.max(placed.h - insetZ * 2, 1e-6)
      };
      const items = members.map((node) => ({ id: node.id, value: Math.max(footprints.get(node.id) || 0, 1) }));
      const placedMembers = squarify(items, inner);
      const byId = new Map(members.map((node) => [node.id, node]));
      for (const slot of placedMembers) {
        const node = byId.get(slot.id);
        if (!node)
          continue;
        const heightValue = metricValue(node, heightMetric);
        rects.push({
          id: node.id,
          x: slot.x,
          z: slot.y,
          w: slot.w,
          d: slot.h,
          h: heightFor(heightValue, reference, mapping, edges),
          district: placed.id,
          depth,
          footprintValue: footprints.get(node.id) || 0,
          heightValue
        });
      }
    }
    const edgesSides = [];
    for (const rect of rects)
      edgesSides.push(Math.min(rect.w, rect.d));
    edgesSides.sort((a, b) => a - b);
    return {
      rects,
      districts,
      tiers: edges,
      heightMetric,
      footprintMetric,
      mapping,
      medianEdge: medianOf(edgesSides)
    };
  }
  return __toCommonJS(city_core_exports);
})();
