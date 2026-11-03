"use strict";
var AuraShallow = (() => {
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

  // src/git/shallow-core.ts
  var shallow_core_exports = {};
  __export(shallow_core_exports, {
    SHALLOW_FIX_COMMAND: () => SHALLOW_FIX_COMMAND,
    buildGitHistoryInfo: () => buildGitHistoryInfo,
    formatCommitCount: () => formatCommitCount,
    parseCommitCount: () => parseCommitCount,
    parseShallowFlag: () => parseShallowFlag,
    shallowBannerText: () => shallowBannerText,
    shallowRiskCaption: () => shallowRiskCaption
  });
  var SHALLOW_FIX_COMMAND = "git fetch --unshallow";
  function parseShallowFlag(stdout) {
    const value = String(stdout == null ? "" : stdout).trim().toLowerCase();
    if (value === "true")
      return true;
    if (value === "false")
      return false;
    return void 0;
  }
  function parseCommitCount(stdout) {
    const match = String(stdout == null ? "" : stdout).trim().match(/^(\d+)$/);
    if (!match)
      return void 0;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : void 0;
  }
  function buildGitHistoryInfo(shallow, commits) {
    if (shallow !== true)
      return void 0;
    const count = Number.isFinite(commits) && commits > 0 ? Math.floor(commits) : 0;
    return { shallow: true, commits: count };
  }
  function formatCommitCount(commits) {
    const count = Math.max(0, Math.round(Number.isFinite(commits) ? commits : 0));
    return count === 1 ? "1 commit visible" : `${count} commits visible`;
  }
  function shallowBannerText(info) {
    if (!info || info.shallow !== true)
      return "";
    const seen = info.commits > 0 ? ` (${formatCommitCount(info.commits)})` : "";
    return `History incomplete \u2014 shallow clone${seen}. Churn, co-change and complexity trends are underestimated.`;
  }
  function shallowRiskCaption(info) {
    if (!info || info.shallow !== true)
      return "";
    const seen = info.commits > 0 ? `, ${formatCommitCount(info.commits)}` : "";
    return `Churn is incomplete (shallow clone${seen}) \u2014 risk scores are underestimated.`;
  }
  return __toCommonJS(shallow_core_exports);
})();
