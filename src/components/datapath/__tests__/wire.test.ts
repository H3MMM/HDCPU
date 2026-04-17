import { describe, expect, it } from 'vitest';
import type { ComponentConfig, WireConfig } from '../../../types';
import { buildOrthogonalPath, buildWirePath, buildWirePoints, getAbsolutePortPoint } from '../Wire';

const components = new Map<string, ComponentConfig>([
  [
    'left',
    {
      id: 'left',
      type: 'register',
      label: 'Left',
      position: { x: 10, y: 20 },
      size: { width: 60, height: 80 },
      ports: [{ name: 'out', direction: 'out', position: 'right', busWidth: 32, signalType: 'data' }],
    },
  ],
  [
    'right',
    {
      id: 'right',
      type: 'alu',
      label: 'Right',
      position: { x: 200, y: 60 },
      size: { width: 90, height: 140 },
      ports: [{ name: 'in', direction: 'in', position: 'left', busWidth: 32, signalType: 'data' }],
    },
  ],
]);

describe('Wire helpers', () => {
  it('resolves absolute port points from component geometry', () => {
    expect(getAbsolutePortPoint(components.get('left')!, 'out')).toEqual({ x: 70, y: 60 });
    expect(getAbsolutePortPoint(components.get('right')!, 'in')).toEqual({ x: 200, y: 130 });
  });

  it('builds orthogonal wire routes when no waypoints are provided', () => {
    const wire: WireConfig = {
      id: 'left-to-right',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
    };

    const points = buildWirePoints(wire, components);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 70, y: 60 });
    expect(points.at(-1)).toEqual({ x: 200, y: 130 });
    expect(buildWirePath(points)).toContain('M 70 60');
  });

  it('keeps straight paths when points are nearly aligned', () => {
    const points = buildOrthogonalPath({ x: 10, y: 10 }, { x: 18, y: 40 });
    expect(points).toEqual([
      { x: 10, y: 10 },
      { x: 18, y: 40 },
    ]);
  });
});
