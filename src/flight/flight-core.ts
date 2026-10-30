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
 * (`readPadState` & friends, W3C standard mapping) shares the same helpers.
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

/** Follow-editor framing: the same close-up distance as a normal node click. */
export const FOLLOW_DISTANCE = 120;

export interface FollowPose {
    pos: Vec3;
    target: Vec3;
}

/**
 * Camera pose for the "follow editor" flight.
 *
 * The orbit direction is preserved (the camera stays on the same side of the
 * current target), the orbit target moves to the active file, and the camera
 * lands at a fixed {@link FOLLOW_DISTANCE} from it. A fixed distance is
 * essential: deriving it from the current distance made repeated editor
 * switches creep closer and closer to the node. It also guarantees a close,
 * readable view even when the user was zoomed far out on the overview.
 */
export function followPose(
    camera: Vec3,
    orbitTarget: Vec3,
    node: Vec3,
    distance = FOLLOW_DISTANCE,
): FollowPose {
    const dx = camera.x - orbitTarget.x;
    const dy = camera.y - orbitTarget.y;
    const dz = camera.z - orbitTarget.z;
    const current = Math.hypot(dx, dy, dz);
    const dir = current > 1e-9
        ? { x: dx / current, y: dy / current, z: dz / current }
        : { x: 0, y: 0, z: 1 };
    const dist = Math.max(1, distance);
    return {
        pos: {
            x: node.x + dir.x * dist,
            y: node.y + dir.y * dist,
            z: node.z + dir.z * dist,
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

// ============================================================
// Gamepad tier (W3C standard mapping — DualSense, Xbox, …)
// ============================================================

/** Stick deflection ignored at rest (thumbstick drift, trigger noise). */
export const GAMEPAD_DEADZONE = 0.15;
/** Response-curve exponent applied after the deadzone (>1 = finer near centre). */
export const GAMEPAD_RESPONSE_EXPONENT = 1.5;
/** Right-stick look rate at full deflection, radians per second. */
export const GAMEPAD_LOOK_RATE = 1.8;
/** Analog trigger rest threshold — real pads never report exactly 0. */
export const GAMEPAD_TRIGGER_THRESHOLD = 0.08;

/**
 * W3C "standard" gamepad button indices. DualSense, DualShock, Xbox and most
 * modern pads report this layout; `gamepad.mapping === 'standard'` guarantees it.
 */
export const PAD_BUTTON = {
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
    touchpad: 17,
};

/** Minimal shape of a `Gamepad` — plain data, so tests can fake one. */
export interface PadLike {
    id?: string;
    axes?: ArrayLike<number>;
    buttons?: ArrayLike<{ pressed?: boolean; value?: number }>;
}

/** One frame of gamepad input, already mapped to the flight model. */
export interface PadState {
    id: string;
    /** Left stick → camera-relative translation, -1..1. */
    forward: number;
    strafe: number;
    /** Right stick → look rates, radians/s. */
    lookYaw: number;
    lookPitch: number;
    /** Analog triggers, 0..1 (L2 descends, R2 boosts). */
    descend: number;
    boost: number;
    /** Latched button flags — callers edge-trigger them. */
    buttons: boolean[];
}

/** Signed stick value → 0 inside the deadzone, curved response outside. */
export function deadzone(value: number, dz = GAMEPAD_DEADZONE): number {
    const v = clamp(typeof value === 'number' && isFinite(value) ? value : 0, -1, 1);
    const magnitude = Math.abs(v);
    if (magnitude <= dz) return 0;
    const scaled = (magnitude - dz) / (1 - dz);
    return Math.sign(v) * Math.pow(scaled, GAMEPAD_RESPONSE_EXPONENT);
}

/**
 * Analog trigger amount, 0..1, threshold applied.
 *
 * Standard-mapping pads expose L2/R2 as analog **buttons** 6/7 with a `value`;
 * a few pad/browser combinations report them as **axes** 4/5 instead (-1 at
 * rest) — both shapes are accepted.
 */
export function triggerValue(pad: PadLike, index: number): number {
    const button = pad.buttons ? pad.buttons[index] : undefined;
    const value = button && typeof button.value === 'number' ? button.value : undefined;
    const raw = typeof value === 'number'
        ? value
        : (() => {
            const axisIndex = index === PAD_BUTTON.l2 ? 4 : index === PAD_BUTTON.r2 ? 5 : -1;
            const axis = axisIndex >= 0 && pad.axes ? pad.axes[axisIndex] : undefined;
            return typeof axis === 'number' ? (axis + 1) / 2 : 0;
        })();
    return clamp(raw, 0, 1);
}

/** Trigger amount with the rest threshold removed and the remainder re-scaled. */
function triggerAmount(value: number): number {
    if (value <= GAMEPAD_TRIGGER_THRESHOLD) return 0;
    return clamp((value - GAMEPAD_TRIGGER_THRESHOLD) / (1 - GAMEPAD_TRIGGER_THRESHOLD), 0, 1);
}

/** Read one frame of pad data: sticks → translation + look rates, triggers, buttons. */
export function readPadState(pad: PadLike, invertY: boolean): PadState {
    const axes = pad.axes || [];
    const axis = (i: number) => (typeof axes[i] === 'number' ? (axes[i] as number) : 0);
    const lx = deadzone(axis(0));
    const ly = deadzone(axis(1));
    const rx = deadzone(axis(2));
    const ry = deadzone(axis(3));

    const buttons: boolean[] = [];
    const count = pad.buttons ? pad.buttons.length : 0;
    for (let i = 0; i < count; i++) {
        const b = pad.buttons ? pad.buttons[i] : undefined;
        buttons[i] = !!(b && (b.pressed === true || (typeof b.value === 'number' && b.value > 0.5)));
    }

    return {
        id: pad.id || 'gamepad',
        forward: -ly, // stick pushed up (negative axis) = fly forward
        strafe: lx,
        lookYaw: -rx * GAMEPAD_LOOK_RATE, // stick right = look right
        lookPitch: (invertY ? ry : -ry) * GAMEPAD_LOOK_RATE, // stick up = look up
        descend: triggerAmount(triggerValue(pad, PAD_BUTTON.l2)),
        boost: triggerAmount(triggerValue(pad, PAD_BUTTON.r2)),
        buttons,
    };
}

/** Integrate the stick look rates into yaw/pitch (pitch clamped, no roll). */
export function applyStickLook(
    yaw: number,
    pitch: number,
    state: PadState,
    dt: number,
    rateScale = 1,
): { yaw: number; pitch: number } {
    return {
        yaw: yaw + state.lookYaw * rateScale * dt,
        pitch: clamp(pitch + state.lookPitch * rateScale * dt, -MAX_PITCH, MAX_PITCH),
    };
}

/** Sum two input vectors (keyboard + gamepad) and re-normalize to unit length. */
export function combineInput(a: FlightInput, b: FlightInput): FlightInput {
    const forward = a.forward + b.forward;
    const strafe = a.strafe + b.strafe;
    const vertical = a.vertical + b.vertical;
    const len = Math.hypot(forward, strafe, vertical);
    if (len > 1) return { forward: forward / len, strafe: strafe / len, vertical: vertical / len };
    return { forward, strafe, vertical };
}

/** Speed multiplier: keyboard Shift is on/off, R2 is analog (both cap at BOOST_MULT). */
export function boostFactor(digitalBoost: boolean, padBoost: number): number {
    const analog = 1 + (BOOST_MULT - 1) * clamp(padBoost, 0, 1);
    return Math.max(digitalBoost ? BOOST_MULT : 1, analog);
}
