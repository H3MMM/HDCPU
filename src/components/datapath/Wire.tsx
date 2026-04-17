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

  const start = getAbsolutePortPoint(fromComponent, wire.from.port);
  const end = getAbsolutePortPoint(toComponent, wire.to.port);

  if (wire.waypoints && wire.waypoints.length > 0) {
    return [start, ...wire.waypoints, end];
  }

  return buildOrthogonalPath(start, end);
}

export function buildWirePath(points: readonly Point[]): string {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function Wire({ wire, components, active = false, showLabel = false }: WireProps) {
  const points = buildWirePoints(wire, components);
  const path = buildWirePath(points);
  const signalTone = getSignalTone(wire.signalType);
  const strokeWidth = active ? Math.max(3, 1.8 + wire.busWidth / 24) : Math.max(1.2, 1 + wire.busWidth / 48);
  const labelPoint = points[Math.floor(points.length / 2)];

  return (
    <g aria-label={`wire ${wire.id}`}>
      <motion.path
        d={path}
        fill="none"
        stroke={signalTone}
        strokeOpacity={active ? 0.28 : 0.12}
        strokeWidth={strokeWidth + 7}
        strokeLinecap="round"
        initial={false}
        animate={{
          opacity: active ? 1 : 0,
        }}
        transition={{ duration: 0.32 }}
      />

      <motion.path
        d={path}
        fill="none"
        stroke={active ? signalTone : 'rgba(77, 91, 102, 0.34)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={active ? '14 10' : wire.signalType === 'control' ? '6 6' : undefined}
        initial={false}
        animate={{
          strokeWidth,
          stroke: active ? signalTone : 'rgba(77, 91, 102, 0.34)',
          strokeDashoffset: active ? [-24, 0] : 0,
          opacity: active ? 1 : 0.78,
        }}
        transition={{
          duration: active ? 1.2 : 0.28,
          repeat: active ? Infinity : 0,
          ease: 'linear',
        }}
      />

      {showLabel && labelPoint ? (
        <text
          x={labelPoint.x}
          y={labelPoint.y - 10}
          textAnchor="middle"
          fontFamily="Consolas, SFMono-Regular, monospace"
          fontSize="9"
          fill={active ? signalTone : 'rgba(77, 91, 102, 0.56)'}
        >
          {wire.id}
        </text>
      ) : null}
    </g>
  );
}
