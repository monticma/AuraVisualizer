/**
 * flight-core.ts — Pilot mode (free flight) — pure logic.
 *
 * Single source of truth for the math behind `webview/js/flight.js`: the
 * keyboard → input-vector mapping, the frame-rate independent smoothing, the
 * yaw/pitch camera model (world-up, no roll — the quaternion is rebuilt every
 * frame) and the scene-scaled speed.
 *
 * Bundled by esbuild into the webview as `window.AuraPilot` (same pattern as
 * risk-core → `window.AuraRisk`). Keep this module dependency-free (no DOM,
 * no `vscode`): it runs in the browser and in Node (vitest). The gamepad tier
 * will reuse the same helpers.
 */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Quat {
    x: number;
    y: number;
    z: number;
    w: number;
}

/** Pitch clamp — stay just short of the poles (±89°). */
export const MAX_PITCH = Math.PI / 2 - 0.017;

/** Shift boost multiplier. */
export const BOOST_MULT = 3.5;
/** Wheel speed-multiplier step (each notch). */
export const WHEEL_STEP = 1.15;
export const MIN_SPEED_MULT = 0.25;
export const MAX_SPEED_MULT = 4;

/** Defaults — fallbacks when settings are missing/invalid. */
export const DEFAULT_FLIGHT_SPEED = 1;
export const DEFAULT_SMOOTHING = 0.12;           // seconds (exponential time constant)
export const DEFAULT_MOUSE_SENSITIVITY = 0.0022; // radians per pixel
/** Scene extent → base units/s (the Aura scene spans hundreds of units). */
export const SCENE_SPEED_FACTOR = 0.35;
/** Floor for the scene scale so tiny graphs stay flyable. */
export const MIN_SCENE_SCALE = 40;

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Keyboard state → camera-relative input, scaled to unit length when diagonal. */
export interface FlightInput {
    forward: number;
    strafe: number;
    vertical: number;
}

export function inputVector(keys: {
    forward?: boolean;
    back?: boolean;
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
}): FlightInput {
    const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const vertical = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    const len = Math.hypot(forward, strafe, vertical);
    if (len > 1) return { forward: forward / len, strafe: strafe / len, vertical: vertical / len };
    return { forward, strafe, vertical };
}

/** Recompute yaw/pitch from mouse pixel deltas (pitch clamped, no roll). */
export function applyMouseDelta(
    yaw: number,
    pitch: number,
    dx: number,
    dy: number,
    sensitivity: number,
    invertY: boolean,
): { yaw: number; pitch: number } {
    const pitchDelta = (invertY ? dy : -dy) * sensitivity; // mouse-up (dy < 0) → look up by default
    return {
        yaw: yaw - dx * sensitivity,
        pitch: clamp(pitch + pitchDelta, -MAX_PITCH, MAX_PITCH),
    };
}

/** Camera rotation for a flight orientation — R = Ry(yaw) · Rx(pitch), no roll. */
export function yawPitchQuaternion(yaw: number, pitch: number): Quat {
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    return { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp };
}

/** Decompose a look direction into yaw/pitch (entry from the orbital camera). */
export function yawPitchFromDirection(x: number, y: number, z: number): { yaw: number; pitch: number } {
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    return {
        yaw: Math.atan2(-nx, -nz),
        pitch: clamp(Math.asin(clamp(ny, -1, 1)), -MAX_PITCH, MAX_PITCH),
    };
}

/** Rotate a vector by a unit quaternion (v' = q v q⁻¹). */
export function rotateVec3(v: Vec3, q: Quat): Vec3 {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
        x: v.x + q.w * tx + (q.y * tz - q.z * ty),
        y: v.y + q.w * ty + (q.z * tx - q.x * tz),
        z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
}

/** World-space move direction: camera-relative WASD + world-axis vertical (Q/E). */
export function moveDirection(input: FlightInput, quat: Quat): Vec3 {
    const forward = rotateVec3({ x: 0, y: 0, z: -1 }, quat);
    const right = rotateVec3({ x: 1, y: 0, z: 0 }, quat);
    return {
        x: forward.x * input.forward + right.x * input.strafe,
        y: forward.y * input.forward + right.y * input.strafe + input.vertical,
        z: forward.z * input.forward + right.z * input.strafe,
    };
}

/** Frame-rate independent exponential smoothing (time constant `smoothTime`). */
export function approach(current: number, target: number, smoothTime: number, dt: number): number {
    if (!(smoothTime > 0)) return target;
    return current + (target - current) * (1 - Math.exp(-dt / smoothTime));
}

export function approachVec3(current: Vec3, target: Vec3, smoothTime: number, dt: number): Vec3 {
    return {
        x: approach(current.x, target.x, smoothTime, dt),
        y: approach(current.y, target.y, smoothTime, dt),
        z: approach(current.z, target.z, smoothTime, dt),
    };
}

/** Scene scale from laid-out nodes — bounding-box max extent (floored). */
export function sceneScale(nodes: Array<{ x?: unknown; y?: unknown; z?: unknown }>): number {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let count = 0;
    for (const node of nodes) {
        if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') continue;
        if (node.x < minX) minX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.z < minZ) minZ = node.z;
        if (node.x > maxX) maxX = node.x;
        if (node.y > maxY) maxY = node.y;
        if (node.z > maxZ) maxZ = node.z;
        count++;
    }
    if (!count) return MIN_SCENE_SCALE;
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    return Math.max(MIN_SCENE_SCALE, extent);
}

/** Follow-editor framing: a slight zoom-in while keeping the current view angle. */
export const FOLLOW_ZOOM = 0.8;
export const FOLLOW_MIN_DISTANCE = 24;

export interface FollowPose {
    pos: Vec3;
    target: Vec3;
}

/**
 * Camera pose for the "follow editor" flight.
 *
 * The orbit direction is preserved (the camera stays on the same side of the
 * target), the orbit target moves to the active file, and the distance is
 * shortened to {@link FOLLOW_ZOOM} of the current framing — a light zoom, not
 * a dramatic close-up. `minDistance` keeps tiny/zero-distance views usable.
 */
export function followPose(
    camera: Vec3,
    orbitTarget: Vec3,
    node: Vec3,
    zoom = FOLLOW_ZOOM,
    minDistance = FOLLOW_MIN_DISTANCE,
): FollowPose {
    const dx = camera.x - orbitTarget.x;
    const dy = camera.y - orbitTarget.y;
    const dz = camera.z - orbitTarget.z;
    const current = Math.hypot(dx, dy, dz);
    const dir = current > 1e-9
        ? { x: dx / current, y: dy / current, z: dz / current }
        : { x: 0, y: 0, z: 1 };
    const distance = Math.max(minDistance, current * clamp(zoom, 0.2, 1));
    return {
        pos: {
            x: node.x + dir.x * distance,
            y: node.y + dir.y * distance,
            z: node.z + dir.z * distance,
        },
        target: { x: node.x, y: node.y, z: node.z },
    };
}

/** Base flight speed (units/s): scene-scaled, with the user's speed setting. */
export function baseSpeed(scale: number, speedSetting: number): number {
    const setting = clamp(speedSetting, MIN_SPEED_MULT, MAX_SPEED_MULT);
    return setting * SCENE_SPEED_FACTOR * Math.max(MIN_SCENE_SCALE, scale);
}

/** Wheel-adjusted speed multiplier, clamped to [MIN_SPEED_MULT, MAX_SPEED_MULT]. */
export function adjustSpeedMult(mult: number, wheelSteps: number): number {
    return clamp(mult * Math.pow(WHEEL_STEP, wheelSteps), MIN_SPEED_MULT, MAX_SPEED_MULT);
}
