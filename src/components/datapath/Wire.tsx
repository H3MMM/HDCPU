import type { Edge, EdgeMetadata } from '@antv/x6';
import type { WireConfig } from '../../types';
import { getSignalTone } from './shared';

const IDLE_STROKE = 'rgba(77, 91, 102, 0.34)';
export const DATAPATH_EDGE_CONNECTION_POINT = 'anchor' as const;
export const DATAPATH_EDGE_LONG_SPAN_THRESHOLD = 200;

export const DATAPATH_EDGE_ROUTER = {
  name: 'orth',
} as const;

export const DATAPATH_EDGE_FALLBACK_ROUTER = {
  name: 'normal',
} as const;

export const DATAPATH_EDGE_CONNECTOR = {
  name: 'rounded',
} as const;

function getDatapathEdgeTerminal(component: string, port: string) {
  return {
    cell: component,
    port,
    connectionPoint: DATAPATH_EDGE_CONNECTION_POINT,
  };
}

function getWaypointSpan(wire: WireConfig) {
  if (!wire.waypoints || wire.waypoints.length < 2) {
    return 0;
  }

  const xs = wire.waypoints.map(({ x }) => x);
  const ys = wire.waypoints.map(({ y }) => y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);

  return Math.max(spanX, spanY);
}

function shouldUseGuidedRoute(wire: WireConfig) {
  if (wire.routeMode === 'guided') {
    return !!wire.waypoints?.length;
  }

  return (
    !!wire.waypoints?.length &&
    (wire.signalType === 'control' || getWaypointSpan(wire) >= DATAPATH_EDGE_LONG_SPAN_THRESHOLD)
  );
}

function getDatapathEdgeVertices(wire: WireConfig) {
  if (!shouldUseGuidedRoute(wire) || !wire.waypoints || wire.waypoints.length < 3) {
    return undefined;
  }

  const middleWaypoints = wire.waypoints.slice(1, -1).map(({ x, y }) => ({ x, y }));
  return middleWaypoints.length ? middleWaypoints : undefined;
}

function getDatapathEdgeRouter(wire: WireConfig) {
  return shouldUseGuidedRoute(wire) ? DATAPATH_EDGE_ROUTER : DATAPATH_EDGE_FALLBACK_ROUTER;
}

export function getDatapathEdgeAttrs(wire: WireConfig, active = false) {
  const signalTone = getSignalTone(wire.signalType);
  const strokeWidth = active ? Math.max(3, 1.8 + wire.busWidth / 24) : Math.max(1.2, 1 + wire.busWidth / 48);
  const strokeDasharray = active ? '14 10' : wire.signalType === 'control' ? '6 6' : null;

  return {
    line: {
      stroke: active ? signalTone : IDLE_STROKE,
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeOpacity: active ? 1 : 0.78,
      strokeDasharray,
      sourceMarker: null,
      targetMarker: null,
    },
  };
}

export function createDatapathEdge(wire: WireConfig, active = false): EdgeMetadata {
  const vertices = getDatapathEdgeVertices(wire);

  return {
    id: wire.id,
    shape: 'edge',
    source: getDatapathEdgeTerminal(wire.from.component, wire.from.port),
    target: getDatapathEdgeTerminal(wire.to.component, wire.to.port),
    zIndex: 1,
    router: getDatapathEdgeRouter(wire),
    connector: DATAPATH_EDGE_CONNECTOR,
    ...(vertices ? { vertices } : {}),
    attrs: getDatapathEdgeAttrs(wire, active),
  };
}

export function applyDatapathEdgeState(edge: Edge, wire: WireConfig, active = false) {
  const vertices = getDatapathEdgeVertices(wire);

  edge.setSource(getDatapathEdgeTerminal(wire.from.component, wire.from.port));
  edge.setTarget(getDatapathEdgeTerminal(wire.to.component, wire.to.port));
  edge.setRouter(getDatapathEdgeRouter(wire));
  edge.setConnector(DATAPATH_EDGE_CONNECTOR);
  edge.setVertices(vertices ?? []);
  edge.attr(getDatapathEdgeAttrs(wire, active));
}
