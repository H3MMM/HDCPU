import { describe, expect, it } from 'vitest';
import { getComponentTone, getPortPlacement, getSignalTone } from '../shared';
import type { PortConfig } from '../../../types';

describe('datapath shared helpers', () => {
  it('distributes sibling ports along the same edge when offset is not provided', () => {
    const ports: PortConfig[] = [
      { name: 'in0', direction: 'in', position: 'left', busWidth: 32, signalType: 'data' },
      { name: 'in1', direction: 'in', position: 'left', busWidth: 32, signalType: 'data' },
      { name: 'out', direction: 'out', position: 'right', busWidth: 32, signalType: 'data' },
    ];

    const first = getPortPlacement(ports[0], ports, { width: 120, height: 90 });
    const second = getPortPlacement(ports[1], ports, { width: 120, height: 90 });

    expect(first.x).toBe(0);
    expect(second.x).toBe(0);
    expect(first.y).toBeCloseTo(30);
    expect(second.y).toBeCloseTo(60);
  });

  it('returns stable tones for component and signal categories', () => {
    expect(getComponentTone('alu').frame).toBe('#61734f');
    expect(getSignalTone('control')).toBe('#1b6b72');
  });
});
