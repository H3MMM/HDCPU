import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPortPlacement, getSignalTone } from './shared';
import type { ComponentConfig, PortConfig, WireConfig } from '../../types';

export interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

export interface WireProps {
  wire: WireConfig;
  components: ReadonlyMap<string, ComponentConfig>;
  active?: boolean;
  showLabel?: boolean;
  animateFlow?: boolean;
  layer?: 'underlay' | 'overlay';
}

function findPort(component: ComponentConfig, portName: string): PortConfig {
  const port = component.ports.find((candidate) => candidate.name === portName);
  if (!port) {
    throw new Error(`Port ${portName} not found on component ${component.id}`);
  }
  return port;
}

export function getAbsolutePortPoint(component: ComponentConfig, portName: string): Point {
  const port = findPort(component, portName);
  const placement = getPortPlacement(port, component.ports, component.size);

  return {
    x: component.position.x + placement.x,
    y: component.position.y + placement.y,
  };
}

function addPoint(points: Point[], next: Point) {
  const previous = points.at(-1);
  if (!previous || previous.x !== next.x || previous.y !== next.y) {
    points.push(next);
  }
}

function simplifyOrthogonalPoints(points: readonly Point[]): Point[] {
  if (points.length <= 2) {
    return [...points];
  }

  const simplified: Point[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified.at(-1);
    const current = points[index];
    const next = points[index + 1];

    if (!previous) {
      simplified.push(current);
      continue;
    }

    const collinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);

    if (!collinear) {
      simplified.push(current);
    }
  }

  simplified.push(points[points.length - 1]);
  return simplified;
}

function appendOrthogonalSegment(
  points: Point[],
  next: Point,
  mode: 'horizontal-first' | 'vertical-first'
) {
  const previous = points.at(-1);
  if (!previous) {
    points.push(next);
    return;
  }

  if (previous.x === next.x || previous.y === next.y) {
    addPoint(points, next);
    return;
  }

  const corner = mode === 'vertical-first'
    ? { x: previous.x, y: next.y }
    : { x: next.x, y: previous.y };

  addPoint(points, corner);
  addPoint(points, next);
}

function getSegmentMode(
  index: number,
  totalSegments: number,
  fromPort: PortConfig,
  toPort: PortConfig
): 'horizontal-first' | 'vertical-first' {
  if (index === 0) {
    return fromPort.position === 'top' || fromPort.position === 'bottom'
      ? 'vertical-first'
      : 'horizontal-first';
  }

  if (index === totalSegments - 1) {
    return toPort.position === 'left' || toPort.position === 'right'
      ? 'vertical-first'
      : 'horizontal-first';
  }

  return 'horizontal-first';
}

function orthogonalizeRoute(points: readonly Point[], fromPort: PortConfig, toPort: PortConfig): Point[] {
  if (points.length <= 1) {
    return [...points];
  }

  const orthogonalPoints: Point[] = [points[0]];

  for (let index = 1; index < points.length; index += 1) {
    appendOrthogonalSegment(
      orthogonalPoints,
      points[index],
      getSegmentMode(index - 1, points.length - 1, fromPort, toPort)
    );
  }

  return orthogonalPoints;
}

export function buildOrthogonalPath(start: Point, end: Point): Point[] {
  const horizontalDistance = Math.abs(end.x - start.x);
  const verticalDistance = Math.abs(end.y - start.y);

  if (horizontalDistance < 12 || verticalDistance < 12) {
    return [start, end];
  }

  const midX = start.x + (end.x - start.x) / 2;

  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end,
  ];
}

const PORT_ESCAPE_DISTANCE = 18;
const OBSTACLE_MARGIN = 14;
const BOUNDS_PADDING = 48;
const TURN_PENALTY = 24;
const EPSILON = 0.01;

function getDirection(from: Point, to: Point): Direction | null {
  if (from.x === to.x) {
    if (to.y > from.y) {
      return 'down';
    }

    if (to.y < from.y) {
      return 'up';
    }
  }

  if (from.y === to.y) {
    if (to.x > from.x) {
      return 'right';
    }

    if (to.x < from.x) {
      return 'left';
    }
  }

  return null;
}

function getComponentRect(component: ComponentConfig): Rect {
  return {
    left: component.position.x,
    right: component.position.x + component.size.width,
    top: component.position.y,
    bottom: component.position.y + component.size.height,
  };
}

function expandRect(rect: Rect, margin: number): Rect {
  return {
    left: rect.left - margin,
    right: rect.right + margin,
    top: rect.top - margin,
    bottom: rect.bottom + margin,
  };
}

function pointInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x > rect.left + EPSILON &&
    point.x < rect.right - EPSILON &&
    point.y > rect.top + EPSILON &&
    point.y < rect.bottom - EPSILON
  );
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

  return false;
}

function getEscapePoint(point: Point, port: PortConfig): Point {
  switch (port.position) {
    case 'left':
      return { x: point.x - PORT_ESCAPE_DISTANCE, y: point.y };
    case 'right':
      return { x: point.x + PORT_ESCAPE_DISTANCE, y: point.y };
    case 'top':
      return { x: point.x, y: point.y - PORT_ESCAPE_DISTANCE };
    case 'bottom':
      return { x: point.x, y: point.y + PORT_ESCAPE_DISTANCE };
    default:
      return point;
  }
}

function buildObstacleAwarePath(
  start: Point,
  end: Point,
  fromPort: PortConfig,
  toPort: PortConfig,
  wire: WireConfig,
  components: ReadonlyMap<string, ComponentConfig>
): Point[] {
  const startEscape = getEscapePoint(start, fromPort);
  const endEscape = getEscapePoint(end, toPort);

  const obstacleRects = [...components.values()]
    .filter((component) => component.id !== wire.from.component && component.id !== wire.to.component)
    .map((component) => expandRect(getComponentRect(component), OBSTACLE_MARGIN));

  const bounds = obstacleRects.reduce<Rect>(
    (accumulator, rect) => ({
      left: Math.min(accumulator.left, rect.left),
      right: Math.max(accumulator.right, rect.right),
      top: Math.min(accumulator.top, rect.top),
      bottom: Math.max(accumulator.bottom, rect.bottom),
    }),
    {
      left: Math.min(startEscape.x, endEscape.x),
      right: Math.max(startEscape.x, endEscape.x),
      top: Math.min(startEscape.y, endEscape.y),
      bottom: Math.max(startEscape.y, endEscape.y),
    }
  );

  const xs = new Set<number>([
    start.x,
    startEscape.x,
    endEscape.x,
    end.x,
    bounds.left - BOUNDS_PADDING,
    bounds.right + BOUNDS_PADDING,
  ]);
  const ys = new Set<number>([
    start.y,
    startEscape.y,
    endEscape.y,
    end.y,
    bounds.top - BOUNDS_PADDING,
    bounds.bottom + BOUNDS_PADDING,
  ]);

  for (const rect of obstacleRects) {
    xs.add(rect.left);
    xs.add(rect.right);
    ys.add(rect.top);
    ys.add(rect.bottom);
  }

  const sortedX = [...xs].sort((left, right) => left - right);
  const sortedY = [...ys].sort((left, right) => left - right);

  const nodes: Point[] = [];
  const nodeKeys = new Map<string, number>();

  function pushNode(point: Point) {
    const key = `${point.x},${point.y}`;
    if (!nodeKeys.has(key)) {
      nodeKeys.set(key, nodes.length);
      nodes.push(point);
    }
  }

  pushNode(startEscape);
  pushNode(endEscape);

  for (const x of sortedX) {
    for (const y of sortedY) {
      const point = { x, y };
      if (!obstacleRects.some((rect) => pointInsideRect(point, rect))) {
        pushNode(point);
      }
    }
  }

  const neighbors = new Map<number, Array<{ index: number; distance: number; direction: Direction }>>();
  const nodesByX = new Map<number, number[]>();
  const nodesByY = new Map<number, number[]>();

  nodes.forEach((point, index) => {
    const sameX = nodesByX.get(point.x) ?? [];
    sameX.push(index);
    nodesByX.set(point.x, sameX);

    const sameY = nodesByY.get(point.y) ?? [];
    sameY.push(index);
    nodesByY.set(point.y, sameY);
  });

  function connectLine(group: number[], axis: 'x' | 'y') {
    const ordered = [...group].sort((left, right) => {
      const leftPoint = nodes[left];
      const rightPoint = nodes[right];
      return axis === 'x' ? leftPoint.y - rightPoint.y : leftPoint.x - rightPoint.x;
    });

    for (let index = 0; index < ordered.length - 1; index += 1) {
      const fromIndex = ordered[index];
      const toIndex = ordered[index + 1];
      const fromPoint = nodes[fromIndex];
      const toPoint = nodes[toIndex];

      if (obstacleRects.some((rect) => segmentIntersectsRect(fromPoint, toPoint, rect))) {
        continue;
      }

      const direction = getDirection(fromPoint, toPoint);
      const reverseDirection = getDirection(toPoint, fromPoint);
      if (!direction || !reverseDirection) {
        continue;
      }

      const distance = Math.abs(fromPoint.x - toPoint.x) + Math.abs(fromPoint.y - toPoint.y);
      const fromNeighbors = neighbors.get(fromIndex) ?? [];
      fromNeighbors.push({ index: toIndex, distance, direction });
      neighbors.set(fromIndex, fromNeighbors);

      const toNeighbors = neighbors.get(toIndex) ?? [];
      toNeighbors.push({ index: fromIndex, distance, direction: reverseDirection });
      neighbors.set(toIndex, toNeighbors);
    }
  }

  for (const group of nodesByX.values()) {
    connectLine(group, 'x');
  }

  for (const group of nodesByY.values()) {
    connectLine(group, 'y');
  }

  const startIndex = nodeKeys.get(`${startEscape.x},${startEscape.y}`);
  const endIndex = nodeKeys.get(`${endEscape.x},${endEscape.y}`);

  if (startIndex === undefined || endIndex === undefined) {
    return [start, ...buildOrthogonalPath(startEscape, endEscape), end];
  }

  interface SearchState {
    nodeIndex: number;
    direction: Direction | 'start';
    cost: number;
    estimate: number;
  }

  const frontier: SearchState[] = [{
    nodeIndex: startIndex,
    direction: 'start',
    cost: 0,
    estimate: 0,
  }];
  const bestCost = new Map<string, number>([[`${startIndex}:start`, 0]]);
  const previous = new Map<string, { key: string; nodeIndex: number; direction: Direction | 'start' }>();
  let finalKey: string | null = null;

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.estimate - right.estimate);
    const current = frontier.shift();
    if (!current) {
      break;
    }

    const currentKey = `${current.nodeIndex}:${current.direction}`;
    if (current.cost !== bestCost.get(currentKey)) {
      continue;
    }

    if (current.nodeIndex === endIndex) {
      finalKey = currentKey;
      break;
    }

    for (const next of neighbors.get(current.nodeIndex) ?? []) {
      const turnCost =
        current.direction === 'start' || current.direction === next.direction ? 0 : TURN_PENALTY;
      const nextCost = current.cost + next.distance + turnCost;
      const nextKey = `${next.index}:${next.direction}`;

      if (nextCost >= (bestCost.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      bestCost.set(nextKey, nextCost);
      previous.set(nextKey, {
        key: currentKey,
        nodeIndex: current.nodeIndex,
        direction: current.direction,
      });

      const target = nodes[endIndex];
      const heuristic = Math.abs(nodes[next.index].x - target.x) + Math.abs(nodes[next.index].y - target.y);
      frontier.push({
        nodeIndex: next.index,
        direction: next.direction,
        cost: nextCost,
        estimate: nextCost + heuristic,
      });
    }
  }

  if (!finalKey) {
    return simplifyOrthogonalPoints([start, startEscape, ...buildOrthogonalPath(startEscape, endEscape), endEscape, end]);
  }

  const route: Point[] = [];
  let currentKey: string | null = finalKey;

  while (currentKey) {
    const [nodeIndex] = currentKey.split(':');
    route.push(nodes[Number.parseInt(nodeIndex, 10)]);
    currentKey = previous.get(currentKey)?.key ?? null;
  }

  route.reverse();
  return simplifyOrthogonalPoints([start, startEscape, ...route.slice(1, -1), endEscape, end]);
}

export function buildWirePoints(wire: WireConfig, components: ReadonlyMap<string, ComponentConfig>): Point[] {
  const fromComponent = components.get(wire.from.component);
  const toComponent = components.get(wire.to.component);

  if (!fromComponent || !toComponent) {
    throw new Error(`Wire ${wire.id} references unknown components`);
  }

  const fromPort = findPort(fromComponent, wire.from.port);
  const toPort = findPort(toComponent, wire.to.port);
  const start = getAbsolutePortPoint(fromComponent, wire.from.port);
  const end = getAbsolutePortPoint(toComponent, wire.to.port);

  if (wire.waypoints && wire.waypoints.length > 0) {
    return simplifyOrthogonalPoints(orthogonalizeRoute([start, ...wire.waypoints, end], fromPort, toPort));
  }

  return buildObstacleAwarePath(start, end, fromPort, toPort, wire, components);
}

export function buildWirePath(points: readonly Point[]): string {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export const Wire = memo(function Wire({
  wire,
  components,
  active = false,
  showLabel = false,
  animateFlow = true,
  layer = 'overlay',
}: WireProps) {
  const { path, labelPoint } = useMemo(() => {
    const points = buildWirePoints(wire, components);
    return {
      path: buildWirePath(points),
      labelPoint: wire.labelPosition ?? points[Math.floor(points.length / 2)],
    };
  }, [wire, components]);

  const signalTone = getSignalTone(wire.signalType);
  const labelTone = getSignalTone(wire.labelSignalType ?? wire.signalType);
  const strokeWidth = active ? Math.max(3, 1.8 + wire.busWidth / 24) : Math.max(1.2, 1 + wire.busWidth / 48);
  const idleStroke = 'rgba(77, 91, 102, 0.34)';
  const dashArray = active ? '14 10' : wire.signalType === 'control' ? '6 6' : undefined;
  const labelText = wire.label ?? (showLabel ? wire.id : null);

  if (layer === 'underlay') {
    if (!active) {
      return null;
    }

    return (
      <g aria-hidden="true">
        <path
          d={path}
          fill="none"
          stroke={signalTone}
          strokeOpacity="0.28"
          strokeWidth={strokeWidth + 7}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return (
    <g aria-label={`wire ${wire.id}`}>
      {active && animateFlow ? (
        <motion.path
          d={path}
          fill="none"
          stroke={signalTone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray}
          initial={false}
          animate={{
            strokeDashoffset: [-24, 0],
            opacity: 1,
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ) : (
        <path
          d={path}
          fill="none"
          stroke={active ? signalTone : idleStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray}
          opacity={active ? 1 : 0.78}
        />
      )}

      {labelText && labelPoint ? (
        <g transform={wire.labelRotate ? `rotate(${wire.labelRotate} ${labelPoint.x} ${labelPoint.y})` : undefined}>
          <text
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            fontFamily={wire.signalType === 'control' ? 'Iowan Old Style, Palatino Linotype, serif' : 'Consolas, SFMono-Regular, monospace'}
            fontSize={wire.signalType === 'control' ? '13' : '9'}
            fontStyle={wire.signalType === 'control' ? 'italic' : 'normal'}
            stroke="rgba(248, 246, 242, 0.96)"
            strokeWidth="4"
            paintOrder="stroke"
            fill={active ? labelTone : 'rgba(77, 91, 102, 0.72)'}
          >
            {labelText}
          </text>
        </g>
      ) : null}
    </g>
  );
});
