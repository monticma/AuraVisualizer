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
    FOLLOW_DISTANCE: () => FOLLOW_DISTANCE,
    GAMEPAD_DEADZONE: () => GAMEPAD_DEADZONE,
    GAMEPAD_LOOK_RATE: () => GAMEPAD_LOOK_RATE,
    GAMEPAD_RESPONSE_EXPONENT: () => GAMEPAD_RESPONSE_EXPONENT,
    GAMEPAD_TRIGGER_THRESHOLD: () => GAMEPAD_TRIGGER_THRESHOLD,
    MAX_PITCH: () => MAX_PITCH,
    MAX_SPEED_MULT: () => MAX_SPEED_MULT,
    MIN_SCENE_SCALE: () => MIN_SCENE_SCALE,
    MIN_SPEED_MULT: () => MIN_SPEED_MULT,
    PAD_BUTTON: () => PAD_BUTTON,
    SCENE_SPEED_FACTOR: () => SCENE_SPEED_FACTOR,
    WHEEL_STEP: () => WHEEL_STEP,
    adjustSpeedMult: () => adjustSpeedMult,
    applyMouseDelta: () => applyMouseDelta,
    applyStickLook: () => applyStickLook,
    approach: () => approach,
    approachVec3: () => approachVec3,
    baseSpeed: () => baseSpeed,
    boostFactor: () => boostFactor,
    clamp: () => clamp,
    combineInput: () => combineInput,
    deadzone: () => deadzone,
    followPose: () => followPose,
    inputVector: () => inputVector,
    moveDirection: () => moveDirection,
    readPadState: () => readPadState,
    rotateVec3: () => rotateVec3,
    sceneScale: () => sceneScale,
    triggerValue: () => triggerValue,
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
  var FOLLOW_DISTANCE = 120;
  function followPose(camera, orbitTarget, node, distance = FOLLOW_DISTANCE) {
    const dx = camera.x - orbitTarget.x;
    const dy = camera.y - orbitTarget.y;
    const dz = camera.z - orbitTarget.z;
    const current = Math.hypot(dx, dy, dz);
    const dir = current > 1e-9 ? { x: dx / current, y: dy / current, z: dz / current } : { x: 0, y: 0, z: 1 };
    const dist = Math.max(1, distance);
    return {
      pos: {
        x: node.x + dir.x * dist,
        y: node.y + dir.y * dist,
        z: node.z + dir.z * dist
      },
      target: { x: node.x, y: node.y, z: node.z }
    };
  }
  function baseSpeed(scale, speedSetting) {
    const setting = clamp(speedSetting, MIN_SPEED_MULT, MAX_SPEED_MULT);
    return setting * SCENE_SPEED_FACTOR * Math.max(MIN_SCENE_SCALE, scale);
  }
  function adjustSpeedMult(mult, wheelSteps) {
    return clamp(mult * Math.pow(WHEEL_STEP, wheelSteps), MIN_SPEED_MULT, MAX_SPEED_MULT);
  }
  var GAMEPAD_DEADZONE = 0.15;
  var GAMEPAD_RESPONSE_EXPONENT = 1.5;
  var GAMEPAD_LOOK_RATE = 1.8;
  var GAMEPAD_TRIGGER_THRESHOLD = 0.08;
  var PAD_BUTTON = {
    cross: 0,
    circle: 1,
    square: 2,
    triangle: 3,
    l1: 4,
    r1: 5,
    l2: 6,
    r2: 7,
    share: 8,
    options: 9,
    l3: 10,
    r3: 11,
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    ps: 16,
    touchpad: 17
  };
  function deadzone(value, dz = GAMEPAD_DEADZONE) {
    const v = clamp(typeof value === "number" && isFinite(value) ? value : 0, -1, 1);
    const magnitude = Math.abs(v);
    if (magnitude <= dz)
      return 0;
    const scaled = (magnitude - dz) / (1 - dz);
    return Math.sign(v) * Math.pow(scaled, GAMEPAD_RESPONSE_EXPONENT);
  }
  function triggerValue(pad, index) {
    const button = pad.buttons ? pad.buttons[index] : void 0;
    const value = button && typeof button.value === "number" ? button.value : void 0;
    const raw = typeof value === "number" ? value : (() => {
      const axisIndex = index === PAD_BUTTON.l2 ? 4 : index === PAD_BUTTON.r2 ? 5 : -1;
      const axis = axisIndex >= 0 && pad.axes ? pad.axes[axisIndex] : void 0;
      return typeof axis === "number" ? (axis + 1) / 2 : 0;
    })();
    return clamp(raw, 0, 1);
  }
  function triggerAmount(value) {
    if (value <= GAMEPAD_TRIGGER_THRESHOLD)
      return 0;
    return clamp((value - GAMEPAD_TRIGGER_THRESHOLD) / (1 - GAMEPAD_TRIGGER_THRESHOLD), 0, 1);
  }
  function readPadState(pad, invertY) {
    const axes = pad.axes || [];
    const axis = (i) => typeof axes[i] === "number" ? axes[i] : 0;
    const lx = deadzone(axis(0));
    const ly = deadzone(axis(1));
    const rx = deadzone(axis(2));
    const ry = deadzone(axis(3));
    const buttons = [];
    const count = pad.buttons ? pad.buttons.length : 0;
    for (let i = 0; i < count; i++) {
      const b = pad.buttons ? pad.buttons[i] : void 0;
      buttons[i] = !!(b && (b.pressed === true || typeof b.value === "number" && b.value > 0.5));
    }
    return {
      id: pad.id || "gamepad",
      forward: -ly,
      // stick pushed up (negative axis) = fly forward
      strafe: lx,
      lookYaw: -rx * GAMEPAD_LOOK_RATE,
      // stick right = look right
      lookPitch: (invertY ? ry : -ry) * GAMEPAD_LOOK_RATE,
      // stick up = look up
      descend: triggerAmount(triggerValue(pad, PAD_BUTTON.l2)),
      boost: triggerAmount(triggerValue(pad, PAD_BUTTON.r2)),
      buttons
    };
  }
  function applyStickLook(yaw, pitch, state, dt, rateScale = 1) {
    return {
      yaw: yaw + state.lookYaw * rateScale * dt,
      pitch: clamp(pitch + state.lookPitch * rateScale * dt, -MAX_PITCH, MAX_PITCH)
    };
  }
  function combineInput(a, b) {
    const forward = a.forward + b.forward;
    const strafe = a.strafe + b.strafe;
    const vertical = a.vertical + b.vertical;
    const len = Math.hypot(forward, strafe, vertical);
    if (len > 1)
      return { forward: forward / len, strafe: strafe / len, vertical: vertical / len };
    return { forward, strafe, vertical };
  }
  function boostFactor(digitalBoost, padBoost) {
    const analog = 1 + (BOOST_MULT - 1) * clamp(padBoost, 0, 1);
    return Math.max(digitalBoost ? BOOST_MULT : 1, analog);
  }
  return __toCommonJS(flight_core_exports);
})();
