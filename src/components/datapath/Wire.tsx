import type { Edge, EdgeMetadata } from '@antv/x6';
import type { WireConfig } from '../../types';
import { getSignalTone } from './shared';

const IDLE_STROKE = 'rgba(77, 91, 102, 0.34)';

export const DATAPATH_EDGE_ROUTER = {
  name: 'manhattan',
  args: {
    padding: 10,
  },
} as const;

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
  return {
    id: wire.id,
    shape: 'edge',
    source: {
      cell: wire.from.component,
      port: wire.from.port,
    },
    target: {
      cell: wire.to.component,
      port: wire.to.port,
    },
    zIndex: 1,
    router: DATAPATH_EDGE_ROUTER,
    attrs: getDatapathEdgeAttrs(wire, active),
  };
}

export function applyDatapathEdgeState(edge: Edge, wire: WireConfig, active = false) {
  edge.setRouter(DATAPATH_EDGE_ROUTER);
  edge.attr(getDatapathEdgeAttrs(wire, active));
}
