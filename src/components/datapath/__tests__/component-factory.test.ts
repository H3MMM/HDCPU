import { describe, expect, it, vi } from 'vitest';
import type { ComponentConfig } from '../../../types';
import {
  appendDatapathPortDebugMarker,
  collectEdgeTerminalDebugInfo,
} from '../datapath-debug';
import { createDatapathNodeMetadata } from '../datapath-metadata';

describe('ComponentFactory node metadata', () => {
  it('maps JSON positions and port names directly into X6 node metadata', () => {
    const component: ComponentConfig = {
      id: 'pc',
      type: 'register',
      label: 'PC',
      position: { x: 242, y: 374 },
      size: { width: 58, height: 112 },
      ports: [
        {
          name: 'in',
          direction: 'in',
          position: 'left',
          offset: 0.42,
          busWidth: 32,
          signalType: 'address',
        },
        {
          name: 'out',
          direction: 'out',
          position: 'right',
          offset: 0.46,
          busWidth: 32,
          signalType: 'address',
        },
        {
          name: 'clk',
          direction: 'in',
          position: 'bottom',
          offset: 0.5,
          busWidth: 1,
          signalType: 'control',
        },
      ],
    };

    const node = createDatapathNodeMetadata(component, { component }, {});
    const ports = (node.ports as { items: Array<{ id?: string; group?: string; args?: { offset?: number } }> }).items;

    expect(node.x).toBe(242);
    expect(node.y).toBe(374);
    expect(node.width).toBe(58);
    expect(node.height).toBe(112);
    expect(ports.map(({ id, group, args }) => ({ id, group, args }))).toEqual([
      { id: 'in', group: 'left', args: { offset: 0.42 } },
      { id: 'out', group: 'right', args: { offset: 0.46 } },
      { id: 'clk', group: 'bottom', args: { offset: 0.5 } },
    ]);
  });

  it('adds a 4px red debug marker to each rendered X6 port container', () => {
    const marker = {
      setAttribute: vi.fn(),
    };
    const container = {
      querySelector: vi.fn().mockReturnValue(null),
      ownerDocument: {
        createElementNS: vi.fn().mockReturnValue(marker),
      },
      appendChild: vi.fn(),
    } as unknown as Element;

    appendDatapathPortDebugMarker(container);

    expect(container.ownerDocument.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'circle');
    expect(marker.setAttribute).toHaveBeenCalledWith('r', '2');
    expect(marker.setAttribute).toHaveBeenCalledWith('fill', '#ff3b30');
    expect(container.appendChild).toHaveBeenCalledWith(marker);
  });

  it('collects edge terminal ids and leaves missing port ids visible in the debug report', () => {
    const graph = {
      getEdges: () =>
        [
          {
            id: 'wired',
            getSourcePortId: () => 'out',
            getTargetPortId: () => 'in',
            getSourceCellId: () => 'left-node',
            getTargetCellId: () => 'right-node',
          },
          {
            id: 'broken',
            getSourcePortId: () => null,
            getTargetPortId: () => 'in',
            getSourceCellId: () => 'dangling-source',
            getTargetCellId: () => 'right-node',
          },
        ] as Array<{
          id: string;
          getSourcePortId: () => string | null;
          getTargetPortId: () => string | null;
          getSourceCellId: () => string | null;
          getTargetCellId: () => string | null;
        }>,
    };

    expect(collectEdgeTerminalDebugInfo(graph)).toEqual([
      {
        edgeId: 'wired',
        sourcePortId: 'out',
        targetPortId: 'in',
        sourceNodeId: 'left-node',
        targetNodeId: 'right-node',
      },
      {
        edgeId: 'broken',
        sourcePortId: null,
        targetPortId: 'in',
        sourceNodeId: 'dangling-source',
        targetNodeId: 'right-node',
      },
    ]);
  });
});
