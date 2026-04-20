export interface EdgeTerminalDebugInfo {
  edgeId: string;
  sourcePortId: string | null;
  targetPortId: string | null;
  sourceNodeId: string | null;
  targetNodeId: string | null;
}

interface EdgeTerminalDebugShape {
  id: string;
  getSourcePortId: () => string | null | undefined;
  getTargetPortId: () => string | null | undefined;
  getSourceCellId: () => string | null | undefined;
  getTargetCellId: () => string | null | undefined;
}

interface EdgeTerminalDebugGraph {
  getEdges: () => EdgeTerminalDebugShape[];
}

export function appendDatapathPortDebugMarker(container: Element) {
  if (!('querySelector' in container) || container.querySelector('[data-port-debug-marker="true"]')) {
    return;
  }

  const marker = container.ownerDocument?.createElementNS('http://www.w3.org/2000/svg', 'circle');
  if (!marker) {
    return;
  }

  marker.setAttribute('data-port-debug-marker', 'true');
  marker.setAttribute('cx', '0');
  marker.setAttribute('cy', '0');
  marker.setAttribute('r', '2');
  marker.setAttribute('fill', '#ff3b30');
  marker.setAttribute('stroke', 'none');
  marker.setAttribute('pointer-events', 'none');
  container.appendChild(marker);
}

export function collectEdgeTerminalDebugInfo(graph: EdgeTerminalDebugGraph): EdgeTerminalDebugInfo[] {
  return graph.getEdges().map((edge) => ({
    edgeId: edge.id,
    sourcePortId: edge.getSourcePortId() ?? null,
    targetPortId: edge.getTargetPortId() ?? null,
    sourceNodeId: edge.getSourceCellId() ?? null,
    targetNodeId: edge.getTargetCellId() ?? null,
  }));
}

export function logEdgeTerminalDebugInfo(graph: EdgeTerminalDebugGraph) {
  const entries = collectEdgeTerminalDebugInfo(graph);
  const missingPortEntries = entries.filter(({ sourcePortId, targetPortId }) => !sourcePortId || !targetPortId);

  console.groupCollapsed(`[datapath] edge terminals (${entries.length})`);
  console.table(entries);
  if (missingPortEntries.length > 0) {
    console.warn('[datapath] edges with missing port ids');
    console.table(missingPortEntries);
  }
  console.groupEnd();
}
