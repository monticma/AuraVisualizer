import { describe, it, expect } from 'vitest';
import {
    BOOST_MULT,
    MAX_PITCH,
    MAX_SPEED_MULT,
    MIN_SCENE_SCALE,
    SCENE_SPEED_FACTOR,
    WHEEL_STEP,
    adjustSpeedMult,
    applyMouseDelta,
    approach,
    approachVec3,
    baseSpeed,
    inputVector,
    moveDirection,
    rotateVec3,
    sceneScale,
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
