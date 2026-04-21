import { describe, expect, it } from 'vitest';
import { getComponentTone, getPortPlacementFromAbsoluteCoordinates, getSignalTone } from '../shared';
import type { ComponentConfig, PortConfig } from '../../../types';

describe('datapath shared helpers', () => {
  it('converts absolute port coordinates to component-local render placement', () => {
    const component: ComponentConfig = {
      id: 'alu',
      type: 'alu',
      label: 'ALU',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 120 },
      ports: [],
    };
    const port: PortConfig = {
      id: 'result',
      name: 'result',
      direction: 'out',
      position: 'right',
      side: 'right',
      x: 180,
      y: 248,
      busWidth: 32,
      signalType: 'data',
    };

    const placement = getPortPlacementFromAbsoluteCoordinates(port, component);

    expect(placement).toEqual({
      x: 80,
      y: 48,
      labelX: 92,
      labelY: 52,
      textAnchor: 'start',
    });
  });

  it('returns null when absolute coordinates are missing', () => {
    const component: ComponentConfig = {
      id: 'alu',
      type: 'alu',
      label: 'ALU',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 120 },
      ports: [],
    };
    const port: PortConfig = {
      id: 'a',
      name: 'a',
      direction: 'in',
      position: 'left',
      busWidth: 32,
      signalType: 'data',
    };

    expect(getPortPlacementFromAbsoluteCoordinates(port, component)).toBeNull();
  });

  it('returns stable tones for component and signal categories', () => {
    expect(getComponentTone('alu').frame).toBe('#61734f');
    expect(getSignalTone('control')).toBe('#1b6b72');
  });
});
