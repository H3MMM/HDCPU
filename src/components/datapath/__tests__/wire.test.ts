import { describe, expect, it } from 'vitest';
import type { ComponentConfig, WireConfig } from '../../../types';
import { buildWirePath, buildWirePoints, getAbsolutePortPoint, resolveWireGeometry } from '../Wire';

const components = new Map<string, ComponentConfig>([
  [
    'left',
    {
      id: 'left',
      type: 'register',
      label: 'Left',
      position: { x: 10, y: 20 },
      size: { width: 60, height: 80 },
      ports: [{
        id: 'out',
        name: 'out',
        direction: 'out',
        position: 'right',
        side: 'right',
        x: 70,
        y: 60,
        busWidth: 32,
        signalType: 'data',
      }],
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
      ports: [{
        id: 'in',
        name: 'in',
        direction: 'in',
        position: 'left',
        side: 'left',
        x: 200,
        y: 130,
        busWidth: 32,
        signalType: 'data',
      }],
    },
  ],
]);

describe('Wire helpers', () => {
  it('resolves absolute port points from real port coordinates', () => {
    expect(getAbsolutePortPoint(components.get('left')!, 'out')).toEqual({ x: 70, y: 60 });
    expect(getAbsolutePortPoint(components.get('right')!, 'in')).toEqual({ x: 200, y: 130 });
  });

  it('builds strict wire points as [start, ...waypoints, end]', () => {
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

    const points = buildWirePoints(wire, components);

    expect(points).toEqual([
      { x: 70, y: 60 },
      { x: 120, y: 100 },
      { x: 160, y: 84 },
      { x: 200, y: 130 },
    ]);
    expect(buildWirePath(points)).toContain('M 70 60');
  });

  it('reports missing component without auto-fixing', () => {
    const wire: WireConfig = {
      id: 'broken-component',
      from: { component: 'left', port: 'out' },
      to: { component: 'missing-component', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 120, y: 100 },
      ],
    };

    const geometry = resolveWireGeometry(wire, components);

    expect(geometry.issues.map((issue) => issue.code)).toContain('missing-to-component');
  });

  it('reports missing port without auto-fixing', () => {
    const wire: WireConfig = {
      id: 'broken-port',
      from: { component: 'left', port: 'missing-port' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 120, y: 100 },
      ],
    };

    const geometry = resolveWireGeometry(wire, components);

    expect(geometry.issues.map((issue) => issue.code)).toContain('missing-from-port');
  });

  it('reports invalid waypoints and keeps only valid drawable points', () => {
    const wire: WireConfig = {
      id: 'invalid-waypoint',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: Number.NaN, y: 100 },
        { x: 160, y: 84 },
      ],
    };

    const geometry = resolveWireGeometry(wire, components);

    expect(geometry.issues.map((issue) => issue.code)).toContain('invalid-waypoint');
    expect(geometry.points).toEqual([
      { x: 70, y: 60 },
      { x: 160, y: 84 },
      { x: 200, y: 130 },
    ]);
  });

  it('draws endpoint-only wires when waypoints are missing', () => {
    const wire: WireConfig = {
      id: 'endpoint-only-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
    };

    expect(buildWirePoints(wire, components)).toEqual([
      { x: 70, y: 60 },
      { x: 200, y: 130 },
    ]);
  });

  it('keeps geometry regression stable for fixed sample data', () => {
    const wire: WireConfig = {
      id: 'regression-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 120, y: 80 },
        { x: 150, y: 95 },
        { x: 170, y: 110 },
      ],
    };

    const points = buildWirePoints(wire, components);

    expect(points).toEqual([
      { x: 70, y: 60 },
      { x: 120, y: 80 },
      { x: 150, y: 95 },
      { x: 170, y: 110 },
      { x: 200, y: 130 },
    ]);
  });
});
