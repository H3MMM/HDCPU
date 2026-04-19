import { describe, expect, it } from 'vitest';
import { getDatapathConfig } from '../load-datapath-config';
import { buildWirePoints, type Point } from '../../components/datapath/Wire';
import type { ComponentConfig } from '../../types';

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const INTERIOR_INSET = 6;
const EPSILON = 0.01;

function getInteriorRect(component: ComponentConfig): Rect {
  return {
    left: component.position.x + INTERIOR_INSET,
    right: component.position.x + component.size.width - INTERIOR_INSET,
    top: component.position.y + INTERIOR_INSET,
    bottom: component.position.y + component.size.height - INTERIOR_INSET,
  };
}

function segmentIntersectsRect(start: Point, end: Point, rect: Rect): boolean {
  if (start.x === end.x) {
    if (start.x <= rect.left + EPSILON || start.x >= rect.right - EPSILON) {
      return false;
    }

    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return maxY > rect.top + EPSILON && minY < rect.bottom - EPSILON;
  }

  if (start.y === end.y) {
    if (start.y <= rect.top + EPSILON || start.y >= rect.bottom - EPSILON) {
      return false;
    }

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return maxX > rect.left + EPSILON && minX < rect.right - EPSILON;
  }

  return true;
}

describe('datapath geometry', () => {
  const config = getDatapathConfig();
  const components = new Map(config.components.map((component) => [component.id, component]));

  it('keeps every routed wire orthogonal', () => {
    const nonOrthogonal = config.wires
      .map((wire) => ({
        id: wire.id,
        points: buildWirePoints(wire, components),
      }))
      .filter(({ points }) =>
        points.some((point, index) => index > 0 && point.x !== points[index - 1].x && point.y !== points[index - 1].y)
      )
      .map(({ id }) => id);

    expect(nonOrthogonal).toEqual([]);
  });

  it('avoids routing wires through unrelated component interiors', () => {
    const offenders: string[] = [];

    for (const wire of config.wires) {
      const points = buildWirePoints(wire, components);

      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];

        for (const component of config.components) {
          if (component.id === wire.from.component || component.id === wire.to.component) {
            continue;
          }

          if (segmentIntersectsRect(start, end, getInteriorRect(component))) {
            offenders.push(`${wire.id} crosses ${component.id}`);
          }
        }
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});
