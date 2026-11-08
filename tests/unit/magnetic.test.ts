import { describe, it, expect } from 'vitest';
import { magneticOffset } from '../../src/lib/motion/magnetic';

describe('magneticOffset', () => {
  it('centre gives zero', () => {
    const o = magneticOffset(50, 50, { left: 0, top: 0, width: 100, height: 100 }, 0.35);
    expect({ x: o.x + 0, y: o.y + 0 }).toEqual({ x: 0, y: 0 });
  });

  it('corner scales by strength', () => {
    expect(magneticOffset(100, 0, { left: 0, top: 0, width: 100, height: 100 }, 0.5)).toEqual({ x: 25, y: -25 });
  });
});
