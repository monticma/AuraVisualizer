import { describe, it, expect } from 'vitest';
import {
    BOOST_MULT,
    GAMEPAD_DEADZONE,
    GAMEPAD_LOOK_RATE,
    MAX_PITCH,
    MAX_SPEED_MULT,
    MIN_SCENE_SCALE,
    PAD_BUTTON,
    SCENE_SPEED_FACTOR,
    WHEEL_STEP,
    adjustSpeedMult,
    applyMouseDelta,
    applyStickLook,
    approach,
    approachVec3,
    baseSpeed,
    boostFactor,
    combineInput,
    deadzone,
    followPose,
    inputVector,
    moveDirection,
    readPadState,
    rotateVec3,
    sceneScale,
    triggerValue,
    yawPitchFromDirection,
    yawPitchQuaternion,
} from '../flight/flight-core';

const near = (a: number, b: number, p = 10) => Math.abs(a - b) < Math.pow(10, -p);

describe('flight: input vector', () => {
    it('maps keys to camera-relative input and cancels opposites', () => {
        expect(inputVector({})).toEqual({ forward: 0, strafe: 0, vertical: 0 });
        expect(inputVector({ forward: true })).toEqual({ forward: 1, strafe: 0, vertical: 0 });
        expect(inputVector({ forward: true, back: true })).toEqual({ forward: 0, strafe: 0, vertical: 0 });
        expect(inputVector({ left: true })).toEqual({ forward: 0, strafe: -1, vertical: 0 });
    });

    it('normalizes diagonals to unit length', () => {
        const d = inputVector({ forward: true, right: true });
        expect(near(Math.hypot(d.forward, d.strafe, d.vertical), 1)).toBe(true);

        const duo = inputVector({ forward: true, up: true });
        expect(near(Math.hypot(duo.forward, duo.strafe, duo.vertical), 1)).toBe(true);
        expect(near(duo.forward, duo.vertical)).toBe(true);
    });
});

describe('flight: mouse look', () => {
    it('mouse right turns right (yaw decreases), mouse up looks up by default', () => {
        const right = applyMouseDelta(0, 0, 10, 0, 0.002, false);
        expect(right.yaw).toBeLessThan(0);
        expect(right.pitch).toBe(0);

        const up = applyMouseDelta(0, 0, 0, -10, 0.002, false);
        expect(up.pitch).toBeGreaterThan(0);
    });

    it('invertY flips the pitch direction', () => {
        const up = applyMouseDelta(0, 0, 0, -10, 0.002, true);
        expect(up.pitch).toBeLessThan(0);
    });

    it('clamps the pitch just short of the poles', () => {
        const p = applyMouseDelta(0, 0, 0, -100000, 0.002, false).pitch;
        expect(p).toBeLessThanOrEqual(MAX_PITCH);
        expect(p).toBeGreaterThan(MAX_PITCH - 1e-6);
    });
});

describe('flight: yaw/pitch camera model', () => {
    it('identity orientation looks down -Z', () => {
        const f = rotateVec3({ x: 0, y: 0, z: -1 }, yawPitchQuaternion(0, 0));
        expect(near(f.x, 0)).toBe(true);
        expect(near(f.y, 0)).toBe(true);
        expect(near(f.z, -1)).toBe(true);
    });

    it('yaw -90° looks toward +X, pitch +45° looks up', () => {
        const right = rotateVec3({ x: 0, y: 0, z: -1 }, yawPitchQuaternion(-Math.PI / 2, 0));
        expect(near(right.x, 1)).toBe(true);
        expect(near(right.z, 0)).toBe(true);

        const up = rotateVec3({ x: 0, y: 0, z: -1 }, yawPitchQuaternion(0, Math.PI / 4));
        expect(near(up.y, Math.sin(Math.PI / 4))).toBe(true);
        expect(near(up.z, -Math.cos(Math.PI / 4))).toBe(true);
    });

    it('yawPitchFromDirection round-trips through the quaternion', () => {
        for (const [yaw, pitch] of [[0, 0], [1.2, 0.4], [-2.8, -0.7]] as const) {
            const f = rotateVec3({ x: 0, y: 0, z: -1 }, yawPitchQuaternion(yaw, pitch));
            const yp = yawPitchFromDirection(f.x, f.y, f.z);
            expect(near(yp.yaw, yaw, 9)).toBe(true);
            expect(near(yp.pitch, pitch, 9)).toBe(true);
        }
    });

    it('moveDirection is camera-relative for WASD and world-axis for Q/E', () => {
        const q = yawPitchQuaternion(-Math.PI / 2, 0); // looking toward +X
        const fwd = moveDirection({ forward: 1, strafe: 0, vertical: 0 }, q);
        expect(near(fwd.x, 1)).toBe(true);
        expect(near(fwd.z, 0)).toBe(true);

        const strafe = moveDirection({ forward: 0, strafe: 1, vertical: 0 }, q);
        expect(near(strafe.z, 1)).toBe(true); // facing +X, right hand points toward +Z

        const up = moveDirection({ forward: 0, strafe: 0, vertical: 1 }, yawPitchQuaternion(0, Math.PI / 2));
        expect(near(up.y, 1)).toBe(true); // world-up independent of pitch
    });
});

describe('flight: smoothing', () => {
    it('two half steps land where one full step lands (frame-rate independent)', () => {
        const full = approach(0, 10, 0.2, 0.1);
        const half = approach(approach(0, 10, 0.2, 0.05), 10, 0.2, 0.05);
        expect(near(full, half, 12)).toBe(true);
    });

    it('smoothTime 0 reaches the target immediately, and vectors interpolate', () => {
        expect(approach(3, 7, 0, 0.016)).toBe(7);
        const v = approachVec3({ x: 0, y: 0, z: 0 }, { x: 5, y: -5, z: 5 }, 0, 0.016);
        expect(v).toEqual({ x: 5, y: -5, z: 5 });
    });
});

describe('flight: scene scale & speed', () => {
    it('sceneScale measures the bounding-box extent and ignores invalid nodes', () => {
        expect(sceneScale([])).toBe(MIN_SCENE_SCALE);
        expect(sceneScale([{ x: 'a' }, { y: 2 }])).toBe(MIN_SCENE_SCALE);
        const nodes = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 100, z: 50 }];
        expect(sceneScale(nodes)).toBe(300);
        expect(sceneScale([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }])).toBe(MIN_SCENE_SCALE);
    });

    it('baseSpeed scales with the scene and clamps the setting', () => {
        expect(near(baseSpeed(200, 1), SCENE_SPEED_FACTOR * 200)).toBe(true);
        expect(near(baseSpeed(200, 0), SCENE_SPEED_FACTOR * 200 * 0.25)).toBe(true); // clamped to min mult
        expect(near(baseSpeed(1, 1), SCENE_SPEED_FACTOR * MIN_SCENE_SCALE)).toBe(true);
    });

    it('adjustSpeedMult steps and clamps the wheel multiplier', () => {
        expect(near(adjustSpeedMult(1, 1), WHEEL_STEP)).toBe(true);
        expect(near(adjustSpeedMult(1, -1), 1 / WHEEL_STEP)).toBe(true);
        expect(adjustSpeedMult(1, 100)).toBe(MAX_SPEED_MULT);
        expect(near(adjustSpeedMult(1, 100000), MAX_SPEED_MULT)).toBe(true);
        expect(adjustSpeedMult(1, -100)).toBe(0.25);
    });

    it('boost stays a pure multiplier constant', () => {
        expect(BOOST_MULT).toBeGreaterThan(3);
    });
});

describe('flight: follow-editor pose', () => {
    it('targets the node, keeps the view direction and lands at the click distance', () => {
        const pose = followPose(
            { x: 0, y: 0, z: 100 },
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 20, z: 30 },
        );
        expect(pose.target).toEqual({ x: 10, y: 20, z: 30 });
        expect(near(pose.pos.x, 10)).toBe(true);
        expect(near(pose.pos.y, 20)).toBe(true);
        expect(near(pose.pos.z, 150)).toBe(true); // fixed 120 above the node
        expect(near(Math.hypot(pose.pos.x - 10, pose.pos.y - 20, pose.pos.z - 30), 120)).toBe(true);
    });

    it('keeps the same distance when alternating between files', () => {
        const a = { x: -200, y: 10, z: 0 };
        const b = { x: 300, y: -40, z: 80 };
        const first = followPose({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, b);
        const second = followPose(first.pos, first.target, a);
        const d1 = Math.hypot(first.pos.x - b.x, first.pos.y - b.y, first.pos.z - b.z);
        const d2 = Math.hypot(second.pos.x - a.x, second.pos.y - a.y, second.pos.z - a.z);
        expect(near(d1, 120)).toBe(true);
        expect(near(d2, 120)).toBe(true);
    });

    it('does not zoom past the node when the camera is very close', () => {
        const pose = followPose(
            { x: 0, y: 0, z: 10 },
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
        );
        expect(near(Math.hypot(pose.pos.x, pose.pos.y, pose.pos.z), 120)).toBe(true);
    });

    it('falls back to a stable direction when camera and target coincide', () => {
        const pose = followPose(
            { x: 5, y: 5, z: 5 },
            { x: 5, y: 5, z: 5 },
            { x: 1, y: 2, z: 3 },
        );
        expect(pose.target).toEqual({ x: 1, y: 2, z: 3 });
        expect(near(pose.pos.z, 123)).toBe(true); // 120 fallback above the node
    });
});

// ============================================================
// Gamepad tier (W3C standard mapping)
// ============================================================

/** Fake a `Gamepad` the way Chromium reports a DualSense in standard mapping. */
function fakePad(opts: {
    axes?: number[];
    pressed?: number[];
    triggers?: { l2?: number; r2?: number };
    id?: string;
} = {}) {
    const axes = opts.axes || [0, 0, 0, 0];
    const buttons = new Array(18).fill(null).map(() => ({ pressed: false, value: 0 }));
    (opts.pressed || []).forEach((i) => {
        buttons[i] = { pressed: true, value: 1 };
    });
    const triggers = opts.triggers || {};
    if (typeof triggers.l2 === 'number') buttons[PAD_BUTTON.l2] = { pressed: triggers.l2 > 0.5, value: triggers.l2 };
    if (typeof triggers.r2 === 'number') buttons[PAD_BUTTON.r2] = { pressed: triggers.r2 > 0.5, value: triggers.r2 };
    return { id: opts.id || 'DualSense Wireless Controller (STANDARD GAMEPAD)', axes, buttons };
}

describe('flight: gamepad deadzone', () => {
    it('zeroes everything inside the deadzone, both signs', () => {
        expect(deadzone(0)).toBe(0);
        expect(deadzone(GAMEPAD_DEADZONE)).toBe(0);
        expect(deadzone(-GAMEPAD_DEADZONE)).toBe(0);
        expect(deadzone(0.1)).toBe(0);
    });

    it('reaches full deflection outside the deadzone and keeps the sign', () => {
        expect(deadzone(1)).toBe(1);
        expect(deadzone(-1)).toBe(-1);
        expect(deadzone(0.6)).toBeGreaterThan(0);
        expect(deadzone(-0.6)).toBeLessThan(0);
    });

    it('applies a response curve: mid-stick moves less than proportionally', () => {
        const mid = deadzone(0.575); // (0.575 - 0.15) / 0.85 = 0.5 exactly
        expect(near(mid, Math.pow(0.5, 1.5))).toBe(true);
        expect(mid).toBeLessThan(0.5);
    });

    it('is monotonic and clamped on out-of-range input', () => {
        expect(deadzone(0.4)).toBeLessThan(deadzone(0.7));
        expect(deadzone(9)).toBe(1);
        expect(deadzone(Number.NaN)).toBe(0);
    });
});

describe('flight: gamepad mapping', () => {
    it('left stick translates: up = forward, right = strafe right', () => {
        const state = readPadState(fakePad({ axes: [0.8, -0.8, 0, 0] }), false);
        expect(state.forward).toBeGreaterThan(0);
        expect(state.strafe).toBeGreaterThan(0);
    });

    it('right stick looks: right turns right, up looks up', () => {
        const state = readPadState(fakePad({ axes: [0, 0, 0.8, -0.8] }), false);
        expect(state.lookYaw).toBeLessThan(0); // yaw decreases when turning right
        expect(state.lookPitch).toBeGreaterThan(0);
    });

    it('invertY flips the stick pitch', () => {
        const normal = readPadState(fakePad({ axes: [0, 0, 0, -1] }), false);
        const inverted = readPadState(fakePad({ axes: [0, 0, 0, -1] }), true);
        expect(normal.lookPitch).toBeGreaterThan(0);
        expect(inverted.lookPitch).toBeLessThan(0);
        expect(near(Math.abs(inverted.lookPitch), Math.abs(normal.lookPitch))).toBe(true);
    });

    it('look rate is bounded by GAMEPAD_LOOK_RATE at full deflection', () => {
        const state = readPadState(fakePad({ axes: [0, 0, -1, 1] }), false);
        expect(near(Math.abs(state.lookYaw), GAMEPAD_LOOK_RATE)).toBe(true);
        expect(near(Math.abs(state.lookPitch), GAMEPAD_LOOK_RATE)).toBe(true);
    });

    it('maps analog triggers: L2 descends, R2 boosts (threshold applied)', () => {
        const idle = readPadState(fakePad({ triggers: { l2: 0, r2: 0 } }), false);
        expect(idle.descend).toBe(0);
        expect(idle.boost).toBe(0);

        const half = readPadState(fakePad({ triggers: { l2: 0.5, r2: 0.5 } }), false);
        expect(half.descend).toBeGreaterThan(0);
        expect(half.descend).toBeLessThan(1);

        const full = readPadState(fakePad({ triggers: { l2: 1, r2: 1 } }), false);
        expect(full.descend).toBe(1);
        expect(full.boost).toBe(1);
    });

    it('reads triggers reported as axes 4/5 on non-standard pads', () => {
        const legacy = { id: 'Generic pad', axes: [0, 0, 0, 0, 0.6, -1], buttons: [] };
        expect(triggerValue(legacy, PAD_BUTTON.l2)).toBeGreaterThan(0.7);
        expect(triggerValue(legacy, PAD_BUTTON.r2)).toBe(0);
    });

    it('latches pressed buttons and keeps the pad id', () => {
        const state = readPadState(fakePad({ pressed: [PAD_BUTTON.circle, PAD_BUTTON.touchpad] }), false);
        expect(state.buttons[PAD_BUTTON.circle]).toBe(true);
        expect(state.buttons[PAD_BUTTON.touchpad]).toBe(true);
        expect(state.buttons[PAD_BUTTON.cross]).toBe(false);
        expect(state.id).toContain('DualSense');
    });

    it('an idle pad produces no motion at all', () => {
        const state = readPadState(fakePad(), false);
        expect(state.forward).toBeCloseTo(0, 10);
        expect(state.strafe).toBeCloseTo(0, 10);
        expect(state.lookYaw).toBeCloseTo(0, 10);
        expect(state.lookPitch).toBeCloseTo(0, 10);
    });
});

describe('flight: gamepad look integration', () => {
    it('integrates look rates with dt and clamps the pitch', () => {
        const state = readPadState(fakePad({ axes: [0, 0, -1, -1] }), false);
        const step = applyStickLook(0, 0, state, 0.1);
        expect(step.yaw).toBeGreaterThan(0);
        expect(step.pitch).toBeGreaterThan(0);
        expect(near(step.yaw, GAMEPAD_LOOK_RATE * 0.1)).toBe(true);

        let pitch = 0;
        for (let i = 0; i < 1000; i++) pitch = applyStickLook(0, pitch, state, 0.05).pitch;
        expect(pitch).toBeLessThanOrEqual(MAX_PITCH);
        expect(pitch).toBeGreaterThan(MAX_PITCH - 1e-6);
    });

    it('a bigger dt moves further, and rateScale scales the sensitivity', () => {
        const state = readPadState(fakePad({ axes: [0, 0, 1, 0] }), false);
        const slow = Math.abs(applyStickLook(0, 0, state, 0.01).yaw);
        const fast = Math.abs(applyStickLook(0, 0, state, 0.02).yaw);
        expect(fast).toBeGreaterThan(slow);
        const scaled = Math.abs(applyStickLook(0, 0, state, 0.01, 2).yaw);
        expect(near(scaled, slow * 2)).toBe(true);
    });
});

describe('flight: keyboard + gamepad combined', () => {
    it('sums both sources and re-normalizes above unit length', () => {
        const kb = inputVector({ forward: true });
        const pad = { forward: 1, strafe: 0, vertical: 0 };
        const both = combineInput(kb, pad);
        expect(near(Math.hypot(both.forward, both.strafe, both.vertical), 1)).toBe(true);

        const empty = combineInput(inputVector({}), { forward: 0, strafe: 0, vertical: 0 });
        expect(empty).toEqual({ forward: 0, strafe: 0, vertical: 0 });
    });

    it('adds orthogonal sources without overshooting', () => {
        const merged = combineInput(inputVector({ up: true }), { forward: 0.5, strafe: 0, vertical: 0 });
        expect(merged.vertical).toBeGreaterThan(0);
        expect(merged.forward).toBeGreaterThan(0);
        expect(Math.hypot(merged.forward, merged.strafe, merged.vertical)).toBeLessThanOrEqual(1 + 1e-9);
    });

    it('analog R2 boosts proportionally and caps at the keyboard boost', () => {
        expect(boostFactor(false, 0)).toBe(1);
        expect(boostFactor(false, 0.5)).toBeCloseTo(1 + (BOOST_MULT - 1) * 0.5, 10);
        expect(boostFactor(false, 1)).toBeCloseTo(BOOST_MULT, 10);
        expect(boostFactor(true, 0)).toBe(BOOST_MULT);
        expect(boostFactor(true, 0.2)).toBe(BOOST_MULT);
        expect(boostFactor(false, 4)).toBe(BOOST_MULT);
    });
});
