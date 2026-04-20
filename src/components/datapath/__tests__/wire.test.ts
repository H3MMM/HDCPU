import type { Edge } from '@antv/x6';
import { describe, expect, it, vi } from 'vitest';
import type { WireConfig } from '../../../types';
import {
  DATAPATH_EDGE_CONNECTION_POINT,
  DATAPATH_EDGE_CONNECTOR,
  DATAPATH_EDGE_FALLBACK_ROUTER,
  DATAPATH_EDGE_LONG_SPAN_THRESHOLD,
  DATAPATH_EDGE_ROUTER,
  applyDatapathEdgeState,
  createDatapathEdge,
  getDatapathEdgeAttrs,
} from '../Wire';

describe('Wire helpers', () => {
  it('pins edge terminals to anchor connection points', () => {
    const wire: WireConfig = {
      id: 'left-to-right',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
    };

    const edge = createDatapathEdge(wire);

    expect(edge.source).toEqual({
      cell: 'left',
      port: 'out',
      connectionPoint: DATAPATH_EDGE_CONNECTION_POINT,
    });
    expect(edge.target).toEqual({
      cell: 'right',
      port: 'in',
      connectionPoint: DATAPATH_EDGE_CONNECTION_POINT,
    });
  });

  it('drops legacy vertices for local short wires even if JSON still contains waypoints', () => {
    const wire: WireConfig = {
      id: 'short-guided-wire',
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

    expect(edge.router).toEqual(DATAPATH_EDGE_FALLBACK_ROUTER);
    expect(edge.connector).toEqual(DATAPATH_EDGE_CONNECTOR);
    expect(edge).not.toHaveProperty('vertices');
  });

  it('restores only middle channel vertices for long guided wires', () => {
    const wire: WireConfig = {
      id: 'long-guided-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 0, y: 10 },
        { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 10 },
        { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 90 },
        { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 80, y: 90 },
      ],
    };

    const edge = createDatapathEdge(wire);

    expect(edge.router).toEqual(DATAPATH_EDGE_ROUTER);
    expect(edge.connector).toEqual(DATAPATH_EDGE_CONNECTOR);
    expect(edge.vertices).toEqual([
      { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 10 },
      { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 90 },
    ]);
  });

  it('updates an existing edge with the router, connector, and vertices that match the wire', () => {
    const wire: WireConfig = {
      id: 'guided-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      waypoints: [
        { x: 0, y: 10 },
        { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 10 },
        { x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 90 },
      ],
    };
    const edge = {
      setSource: vi.fn(),
      setTarget: vi.fn(),
      setRouter: vi.fn(),
      setConnector: vi.fn(),
      setVertices: vi.fn(),
      attr: vi.fn(),
    } as unknown as Edge;

    applyDatapathEdgeState(edge, wire, true);

    expect(edge.setSource).toHaveBeenCalledWith({
      cell: 'left',
      port: 'out',
      connectionPoint: DATAPATH_EDGE_CONNECTION_POINT,
    });
    expect(edge.setTarget).toHaveBeenCalledWith({
      cell: 'right',
      port: 'in',
      connectionPoint: DATAPATH_EDGE_CONNECTION_POINT,
    });
    expect(edge.setRouter).toHaveBeenCalledWith(DATAPATH_EDGE_ROUTER);
    expect(edge.setConnector).toHaveBeenCalledWith(DATAPATH_EDGE_CONNECTOR);
    expect(edge.setVertices).toHaveBeenCalledWith([{ x: DATAPATH_EDGE_LONG_SPAN_THRESHOLD + 20, y: 10 }]);
    expect(edge.attr).toHaveBeenCalledWith(getDatapathEdgeAttrs(wire, true));
  });

  it('clears explicit vertices when a short fallback-routed edge should ignore legacy waypoints', () => {
    const wire: WireConfig = {
      id: 'unguided-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 1,
      signalType: 'data',
      waypoints: [
        { x: 120, y: 100 },
        { x: 160, y: 84 },
      ],
    };
    const edge = {
      setSource: vi.fn(),
      setTarget: vi.fn(),
      setRouter: vi.fn(),
      setConnector: vi.fn(),
      setVertices: vi.fn(),
      attr: vi.fn(),
    } as unknown as Edge;

    applyDatapathEdgeState(edge, wire);

    expect(edge.setRouter).toHaveBeenCalledWith(DATAPATH_EDGE_FALLBACK_ROUTER);
    expect(edge.setConnector).toHaveBeenCalledWith(DATAPATH_EDGE_CONNECTOR);
    expect(edge.setVertices).toHaveBeenCalledWith([]);
  });

  it('keeps control wires on the guided route even when only middle channel points remain', () => {
    const wire: WireConfig = {
      id: 'control-wire',
      from: { component: 'left', port: 'control' },
      to: { component: 'right', port: 'select' },
      busWidth: 1,
      signalType: 'control',
      waypoints: [
        { x: 50, y: 30 },
        { x: 220, y: 30 },
        { x: 220, y: 90 },
      ],
    };

    const edge = createDatapathEdge(wire);

    expect(edge.router).toEqual(DATAPATH_EDGE_ROUTER);
    expect(edge.vertices).toEqual([{ x: 220, y: 30 }]);
  });

  it('keeps short manually tuned wires on guided routing when routeMode is guided', () => {
    const wire: WireConfig = {
      id: 'manual-short-wire',
      from: { component: 'left', port: 'out' },
      to: { component: 'right', port: 'in' },
      busWidth: 32,
      signalType: 'data',
      routeMode: 'guided',
      waypoints: [
        { x: 100, y: 120 },
        { x: 140, y: 96 },
        { x: 180, y: 96 },
      ],
    };

    const edge = createDatapathEdge(wire);

    expect(edge.router).toEqual(DATAPATH_EDGE_ROUTER);
    expect(edge.vertices).toEqual([{ x: 140, y: 96 }]);
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
