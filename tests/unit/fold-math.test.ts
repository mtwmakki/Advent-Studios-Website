import { describe, it, expect } from 'vitest';
import { projectToPlane, hingeAngles } from '../../src/lib/motion/fold-math';

describe('screen parallax projection', () => {
  const eye = { x: 0, y: 0, z: 2.6 };

  it('leaves points already on the open screen plane where they are', () => {
    expect(projectToPlane({ x: -0.4, y: 0.2, z: 0 }, eye, 0)).toEqual({ x: -0.4, y: 0.2 });
    expect(projectToPlane({ x: 0.5, y: -0.3, z: 0 }, eye, 0)).toEqual({ x: 0.5, y: -0.3 });
  });

  it('maps a point lifted towards the viewer outwards from the centre, as seen from the eye', () => {
    // A point 0.65 in front of the plane appears further out once projected back onto it.
    const q = projectToPlane({ x: -0.3, y: 0.1, z: 0.65 }, eye, 0);
    expect(q.x).toBeLessThan(-0.3);
    expect(q.y).toBeGreaterThan(0.1);
  });

  it('squeezes a half standing upright at the hinge into a strip next to the hinge', () => {
    // The opening half at 90 degrees sticks straight out from the hinge (x = 0) towards the viewer.
    const q = projectToPlane({ x: -0.001, y: 0, z: 0.6 }, eye, 0);
    expect(Math.abs(q.x)).toBeLessThan(0.01);
  });
});

describe('hinge on the left', () => {
  it('closed: the front half lies over the back half; open: it sits to the left of the hinge', () => {
    expect(hingeAngles(0).pivot).toBeCloseTo(Math.PI);
    expect(hingeAngles(1).pivot).toBeCloseTo(0);
    // The outer edge of the opening half (local x = -W) travels from the right (stacked) to the left.
    expect(hingeAngles(0).outerEdgeX(0.68)).toBeCloseTo(0.68);
    expect(hingeAngles(1).outerEdgeX(0.68)).toBeCloseTo(-0.68);
    expect(hingeAngles(0.5).outerEdgeX(0.68)).toBeCloseTo(0, 5);
  });
});
