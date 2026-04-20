import { describe, expect, it } from 'vitest';
import type { WireConfig } from '../../../types';
import { DATAPATH_EDGE_ROUTER, createDatapathEdge, getDatapathEdgeAttrs } from '../Wire';

describe('Wire helpers', () => {
  it('maps component ports to X6 edge terminals and always enables manhattan routing', () => {
    const wire: WireConfig = {
      id: 'left-to-right',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 120, y: 100 },
        { x: 160, y: 84 },
      ],
    };

    const edge = createDatapathEdge(wire);

    expect(edge.source).toEqual({ cell: 'left', port: 'out' });
    expect(edge.target).toEqual({ cell: 'right', port: 'in' });
    expect(edge.router).toEqual(DATAPATH_EDGE_ROUTER);
    expect(edge).not.toHaveProperty('vertices');
  });

  it('styles active data wires with the signal tone and a thicker stroke', () => {
    const wire: WireConfig = {
      id: 'active-data',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
    };

    const attrs = getDatapathEdgeAttrs(wire, true);

    expect(attrs.line.stroke).toBe('#be5d34');
    expect(attrs.line.strokeWidth).toBeGreaterThan(3);
    expect(attrs.line.strokeDasharray).toBe('14 10');
    expect(attrs.line.targetMarker).toBeNull();
  });

  it('keeps inactive control wires dashed with the idle stroke color', () => {
    const wire: WireConfig = {
      id: 'idle-control',
      from: { component: 'left', port: 'control' },
      to: { component: 'right', port: 'select' },
      busWidth: 1,
      signalType: 'control',
    };

    const attrs = getDatapathEdgeAttrs(wire, false);

    expect(attrs.line.stroke).toBe('rgba(77, 91, 102, 0.34)');
    expect(attrs.line.strokeDasharray).toBe('6 6');
    expect(attrs.line.strokeOpacity).toBeCloseTo(0.78);
  });
});
