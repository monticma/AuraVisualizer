"use strict";
var AuraPilot = (() => {
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

  // src/flight/flight-core.ts
  var flight_core_exports = {};
  __export(flight_core_exports, {
    BOOST_MULT: () => BOOST_MULT,
    DEFAULT_FLIGHT_SPEED: () => DEFAULT_FLIGHT_SPEED,
    DEFAULT_MOUSE_SENSITIVITY: () => DEFAULT_MOUSE_SENSITIVITY,
    DEFAULT_SMOOTHING: () => DEFAULT_SMOOTHING,
    MAX_PITCH: () => MAX_PITCH,
    MAX_SPEED_MULT: () => MAX_SPEED_MULT,
    MIN_SCENE_SCALE: () => MIN_SCENE_SCALE,
    MIN_SPEED_MULT: () => MIN_SPEED_MULT,
    SCENE_SPEED_FACTOR: () => SCENE_SPEED_FACTOR,
    WHEEL_STEP: () => WHEEL_STEP,
    adjustSpeedMult: () => adjustSpeedMult,
    applyMouseDelta: () => applyMouseDelta,
    approach: () => approach,
    approachVec3: () => approachVec3,
    baseSpeed: () => baseSpeed,
    clamp: () => clamp,
    inputVector: () => inputVector,
    moveDirection: () => moveDirection,
    rotateVec3: () => rotateVec3,
    sceneScale: () => sceneScale,
    yawPitchFromDirection: () => yawPitchFromDirection,
    yawPitchQuaternion: () => yawPitchQuaternion
  });
  var MAX_PITCH = Math.PI / 2 - 0.017;
  var BOOST_MULT = 3.5;
  var WHEEL_STEP = 1.15;
  var MIN_SPEED_MULT = 0.25;
  var MAX_SPEED_MULT = 4;
  var DEFAULT_FLIGHT_SPEED = 1;
  var DEFAULT_SMOOTHING = 0.12;
  var DEFAULT_MOUSE_SENSITIVITY = 22e-4;
  var SCENE_SPEED_FACTOR = 0.35;
  var MIN_SCENE_SCALE = 40;
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function inputVector(keys) {
    const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const vertical = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    const len = Math.hypot(forward, strafe, vertical);
    if (len > 1)
      return { forward: forward / len, strafe: strafe / len, vertical: vertical / len };
    return { forward, strafe, vertical };
  }
  function applyMouseDelta(yaw, pitch, dx, dy, sensitivity, invertY) {
    const pitchDelta = (invertY ? dy : -dy) * sensitivity;
    return {
      yaw: yaw - dx * sensitivity,
      pitch: clamp(pitch + pitchDelta, -MAX_PITCH, MAX_PITCH)
    };
  }
  function yawPitchQuaternion(yaw, pitch) {
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    return { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp };
  }
  function yawPitchFromDirection(x, y, z) {
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    return {
      yaw: Math.atan2(-nx, -nz),
      pitch: clamp(Math.asin(clamp(ny, -1, 1)), -MAX_PITCH, MAX_PITCH)
    };
  }
  function rotateVec3(v, q) {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
      x: v.x + q.w * tx + (q.y * tz - q.z * ty),
      y: v.y + q.w * ty + (q.z * tx - q.x * tz),
      z: v.z + q.w * tz + (q.x * ty - q.y * tx)
    };
  }
  function moveDirection(input, quat) {
    const forward = rotateVec3({ x: 0, y: 0, z: -1 }, quat);
    const right = rotateVec3({ x: 1, y: 0, z: 0 }, quat);
    return {
      x: forward.x * input.forward + right.x * input.strafe,
      y: forward.y * input.forward + right.y * input.strafe + input.vertical,
      z: forward.z * input.forward + right.z * input.strafe
    };
  }
  function approach(current, target, smoothTime, dt) {
    if (!(smoothTime > 0))
      return target;
    return current + (target - current) * (1 - Math.exp(-dt / smoothTime));
  }
  function approachVec3(current, target, smoothTime, dt) {
    return {
      x: approach(current.x, target.x, smoothTime, dt),
      y: approach(current.y, target.y, smoothTime, dt),
      z: approach(current.z, target.z, smoothTime, dt)
    };
  }
  function sceneScale(nodes) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let count = 0;
    for (const node of nodes) {
      if (typeof node.x !== "number" || typeof node.y !== "number" || typeof node.z !== "number")
        continue;
      if (node.x < minX)
        minX = node.x;
      if (node.y < minY)
        minY = node.y;
      if (node.z < minZ)
        minZ = node.z;
      if (node.x > maxX)
        maxX = node.x;
      if (node.y > maxY)
        maxY = node.y;
      if (node.z > maxZ)
        maxZ = node.z;
      count++;
    }
    if (!count)
      return MIN_SCENE_SCALE;
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    return Math.max(MIN_SCENE_SCALE, extent);
  }
  function baseSpeed(scale, speedSetting) {
    const setting = clamp(speedSetting, MIN_SPEED_MULT, MAX_SPEED_MULT);
    return setting * SCENE_SPEED_FACTOR * Math.max(MIN_SCENE_SCALE, scale);
  }
  function adjustSpeedMult(mult, wheelSteps) {
    return clamp(mult * Math.pow(WHEEL_STEP, wheelSteps), MIN_SPEED_MULT, MAX_SPEED_MULT);
  }
  return __toCommonJS(flight_core_exports);
})();
