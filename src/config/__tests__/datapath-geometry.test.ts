import { describe, expect, it } from 'vitest';
import { createDatapathEdge, DATAPATH_EDGE_ROUTER } from '../../components/datapath/Wire';
import { getDatapathConfig } from '../load-datapath-config';
import type { ComponentConfig } from '../../types';

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function getOuterRect(component: ComponentConfig): Rect {
  return {
    left: component.position.x,
    right: component.position.x + component.size.width,
    top: component.position.y,
    bottom: component.position.y + component.size.height,
  };
}

describe('datapath geometry', () => {
  const config = getDatapathConfig();
  const components = new Map(config.components.map((component) => [component.id, component]));

  it('keeps every component inside the configured canvas bounds', () => {
    const outOfBounds = config.components
      .filter((component) => {
        const rect = getOuterRect(component);
        return (
          rect.left < 0 ||
          rect.top < 0 ||
          rect.right > config.metadata.canvasSize.width ||
          rect.bottom > config.metadata.canvasSize.height
        );
      })
      .map((component) => component.id);

    expect(outOfBounds).toEqual([]);
  });

  it('maps every wire to existing source and target ports', () => {
    const invalidWires = config.wires.flatMap((wire) => {
      const fromComponent = components.get(wire.from.component);
      const toComponent = components.get(wire.to.component);

      const problems: string[] = [];

      if (!fromComponent) {
        problems.push(`${wire.id} missing source component ${wire.from.component}`);
      } else if (!fromComponent.ports.some((port) => port.name === wire.from.port)) {
        problems.push(`${wire.id} missing source port ${wire.from.component}.${wire.from.port}`);
      }

      if (!toComponent) {
        problems.push(`${wire.id} missing target component ${wire.to.component}`);
      } else if (!toComponent.ports.some((port) => port.name === wire.to.port)) {
        problems.push(`${wire.id} missing target port ${wire.to.component}.${wire.to.port}`);
      }

      return problems;
    });

    expect(invalidWires).toEqual([]);
  });

  it('builds every wire as an X6 Manhattan edge and ignores legacy waypoints', () => {
    const invalidEdges = config.wires.flatMap((wire) => {
      const edge = createDatapathEdge(wire);
      const source = edge.source as { cell?: string; port?: string } | undefined;
      const target = edge.target as { cell?: string; port?: string } | undefined;
      const problems: string[] = [];

      if (JSON.stringify(edge.router) !== JSON.stringify(DATAPATH_EDGE_ROUTER)) {
        problems.push(`${wire.id} router mismatch`);
      }

      if (source?.cell !== wire.from.component || source?.port !== wire.from.port) {
        problems.push(`${wire.id} source terminal mismatch`);
      }

      if (target?.cell !== wire.to.component || target?.port !== wire.to.port) {
        problems.push(`${wire.id} target terminal mismatch`);
      }

      if ('vertices' in edge) {
        problems.push(`${wire.id} still carries explicit vertices`);
      }

      return problems;
    });

    expect(invalidEdges).toEqual([]);
  });

  it('keeps the execution, flag, and memory cluster visually separated', () => {
    const aluOut = components.get('alu-out');
    const flagLogic = components.get('branch-logic');
    const flagReg = components.get('flag-reg');
    const dataMem = components.get('data-mem');
    const mdr = components.get('mdr');
    const muxWb = components.get('mux-wb');

    expect(aluOut).toBeDefined();
    expect(flagLogic).toBeDefined();
    expect(flagReg).toBeDefined();
    expect(dataMem).toBeDefined();
    expect(mdr).toBeDefined();
    expect(muxWb).toBeDefined();

    const aluOutRect = getOuterRect(aluOut!);
    const flagLogicRect = getOuterRect(flagLogic!);
    const flagRegRect = getOuterRect(flagReg!);
    const dataMemRect = getOuterRect(dataMem!);
    const mdrRect = getOuterRect(mdr!);
    const muxWbRect = getOuterRect(muxWb!);

    expect(flagRegRect.bottom + 12).toBeLessThanOrEqual(flagLogicRect.top);
    expect(flagLogicRect.bottom + 16).toBeLessThanOrEqual(aluOutRect.top);
    expect(aluOutRect.right + 24).toBeLessThanOrEqual(dataMemRect.left);
    expect(flagLogicRect.right + 24).toBeLessThanOrEqual(dataMemRect.left);
    expect(dataMemRect.right + 12).toBeLessThanOrEqual(mdrRect.left);
    expect(mdrRect.right + 24).toBeLessThanOrEqual(muxWbRect.left);
  });
});
