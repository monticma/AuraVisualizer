"use strict";
var AuraBreadcrumbCore = (() => {
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

  // src/navigation/breadcrumb-core.ts
  var breadcrumb_core_exports = {};
  __export(breadcrumb_core_exports, {
    BREADCRUMB_LIMIT: () => BREADCRUMB_LIMIT,
    back: () => back,
    entryTooltip: () => entryTooltip,
    fileName: () => fileName,
    pushEntry: () => pushEntry,
    sameEntry: () => sameEntry,
    truncateText: () => truncateText,
    truncateTo: () => truncateTo
  });
  var BREADCRUMB_LIMIT = 20;
  function fileName(filePath) {
    if (!filePath)
      return "";
    const clean = String(filePath).replace(/\\/g, "/").replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || clean;
  }
  function truncateText(text, max = 28) {
    const value = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    const limit = Math.max(1, Math.floor(max) || 28);
    if (value.length <= limit)
      return value;
    return `${value.slice(0, limit - 1).trimEnd()}\u2026`;
  }
  function queryKey(entry) {
    if (!entry || !entry.query || !entry.query.expr)
      return "";
    return `${entry.query.expr}:${entry.query.mode || ""}`;
  }
  function sameEntry(a, b) {
    if (!a || !b)
      return false;
    if ((a.label || "") !== (b.label || ""))
      return false;
    if ((a.focusKind || "none") !== (b.focusKind || "none"))
      return false;
    if ((a.tab || "") !== (b.tab || ""))
      return false;
    if ((a.depth || 0) !== (b.depth || 0))
      return false;
    if ((a.nodeIds || []).join("|") !== (b.nodeIds || []).join("|"))
      return false;
    return queryKey(a) === queryKey(b);
  }
  function normalizeEntry(entry) {
    const copy = {
      label: entry.label,
      focusKind: entry.focusKind || "none",
      nodeIds: Array.isArray(entry.nodeIds) ? entry.nodeIds.filter((id) => typeof id === "string") : []
    };
    if (entry.icon)
      copy.icon = entry.icon;
    if (entry.detail)
      copy.detail = entry.detail;
    if (entry.tab)
      copy.tab = entry.tab;
    if (typeof entry.depth === "number" && isFinite(entry.depth))
      copy.depth = entry.depth;
    if (entry.query && entry.query.expr) {
      copy.query = { expr: entry.query.expr, mode: entry.query.mode || "filter" };
    }
    if (entry.pose)
      copy.pose = entry.pose;
    return copy;
  }
  function pushEntry(stack, entry, limit = BREADCRUMB_LIMIT) {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (!entry || typeof entry.label !== "string" || !entry.label.trim())
      return current;
    if (sameEntry(current[current.length - 1], entry))
      return current;
    const cap = Math.max(1, Math.floor(limit) || BREADCRUMB_LIMIT);
    const next = [...current, normalizeEntry(entry)];
    return next.length > cap ? next.slice(next.length - cap) : next;
  }
  function back(stack) {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (current.length < 2)
      return { stack: current };
    const next = current.slice(0, -1);
    return { stack: next, entry: next[next.length - 1] };
  }
  function truncateTo(stack, index) {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (!Number.isInteger(index) || index < 0 || index >= current.length)
      return current;
    return current.slice(0, index + 1);
  }
  function entryTooltip(entry) {
    if (!entry)
      return "";
    const parts = [entry.label];
    if (entry.detail && entry.detail !== entry.label)
      parts.push(entry.detail);
    const count = entry.nodeIds ? entry.nodeIds.length : 0;
    if (count > 1)
      parts.push(`${count} files`);
    return parts.join(" \u2014 ");
  }
  return __toCommonJS(breadcrumb_core_exports);
})();
