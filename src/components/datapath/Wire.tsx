import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPortPlacement, getSignalTone } from './shared';
import type { ComponentConfig, PortConfig, WireConfig } from '../../types';

export interface Point {
  x: number;
  y: number;
}

export interface WireProps {
  wire: WireConfig;
  components: ReadonlyMap<string, ComponentConfig>;
  active?: boolean;
  showLabel?: boolean;
  animateFlow?: boolean;
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
    return orthogonalizeRoute([start, ...wire.waypoints, end], fromPort, toPort);
  }

  return buildOrthogonalPath(start, end);
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

  return (
    <g aria-label={`wire ${wire.id}`}>
      <path
        d={path}
        fill="none"
        stroke={signalTone}
        strokeOpacity={active ? 0.28 : 0}
        strokeWidth={strokeWidth + 7}
        strokeLinecap="round"
      />

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
