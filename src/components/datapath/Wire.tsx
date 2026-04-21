import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getSignalTone } from './shared';
import type { ComponentConfig, Point, PortConfig, PortPosition, WireConfig } from '../../types';

export interface WireGeometryIssue {
  wireId: string;
  code:
    | 'duplicate-wire-id'
    | 'missing-from-component'
    | 'missing-to-component'
    | 'missing-from-port'
    | 'missing-to-port'
    | 'missing-from-port-coordinate'
    | 'missing-to-port-coordinate'
    | 'missing-waypoints'
    | 'invalid-waypoint'
    | 'non-orthogonal-segment'
    | 'invalid-source-exit-direction'
    | 'invalid-target-entry-direction'
    | 'start-point-mismatch'
    | 'end-point-mismatch';
  message: string;
}

interface WireSegment {
  index: number;
  from: Point;
  to: Point;
}

export interface WireGeometryResult {
  wireId: string;
  points: Point[];
  startPoint?: Point;
  endPoint?: Point;
  issues: WireGeometryIssue[];
}

export interface WireProps {
  wire: WireConfig;
  components: ReadonlyMap<string, ComponentConfig>;
  active?: boolean;
  showLabel?: boolean;
  animateFlow?: boolean;
  geometry?: WireGeometryResult;
}

function findPort(component: ComponentConfig, portRef: string): PortConfig | undefined {
  return component.ports.find(
    (candidate) => candidate.name === portRef || candidate.id === portRef
  );
}

export function getAbsolutePortPoint(component: ComponentConfig, portName: string): Point {
  const port = findPort(component, portName);
  if (!port) {
    throw new Error(`Port ${portName} not found on component ${component.id}`);
  }

  if (typeof port.x !== 'number' || !Number.isFinite(port.x)) {
    throw new Error(`Port ${portName} on component ${component.id} has invalid absolute coordinates`);
  }

  if (typeof port.y !== 'number' || !Number.isFinite(port.y)) {
    throw new Error(`Port ${portName} on component ${component.id} has invalid absolute coordinates`);
  }

  return {
    x: port.x,
    y: port.y,
  };
}

function isFinitePoint(point: Point | undefined): point is Point {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isValidPoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function buildWirePathPoints(startPoint: Point | undefined, waypoints: readonly Point[], endPoint: Point | undefined): Point[] {
  const points: Point[] = [];

  if (startPoint) {
    points.push(startPoint);
  }

  points.push(...waypoints);

  if (endPoint) {
    points.push(endPoint);
  }

  return points;
}

function buildWireSegments(points: readonly Point[]): WireSegment[] {
  const segments: WireSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      index,
      from: points[index],
      to: points[index + 1],
    });
  }

  return segments;
}

function isOrthogonalSegment(from: Point, to: Point): boolean {
  return from.x === to.x || from.y === to.y;
}

function resolvePortSide(port: PortConfig): PortPosition {
  return port.side ?? port.position;
}

function findFirstDirectionalSegment(segments: readonly WireSegment[]): WireSegment | undefined {
  return segments.find((segment) => segment.from.x !== segment.to.x || segment.from.y !== segment.to.y)
    ?? segments[0];
}

function findLastDirectionalSegment(segments: readonly WireSegment[]): WireSegment | undefined {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.from.x !== segment.to.x || segment.from.y !== segment.to.y) {
      return segment;
    }
  }

  return segments.at(-1);
}

function isSourceExitDirectionValid(side: PortPosition, segment: WireSegment): boolean {
  if (side === 'left') {
    return segment.from.y === segment.to.y && segment.to.x <= segment.from.x;
  }

  if (side === 'right') {
    return segment.from.y === segment.to.y && segment.to.x >= segment.from.x;
  }

  if (side === 'top') {
    return segment.from.x === segment.to.x && segment.to.y <= segment.from.y;
  }

  return segment.from.x === segment.to.x && segment.to.y >= segment.from.y;
}

function isTargetEntryDirectionValid(side: PortPosition, segment: WireSegment): boolean {
  if (side === 'left' || side === 'right') {
    return segment.from.y === segment.to.y;
  }

  return segment.from.x === segment.to.x;
}

function formatPoint(point: Point): string {
  return `(${point.x}, ${point.y})`;
}

function portPoint(port: PortConfig): Point | undefined {
  if (typeof port.x !== 'number' || !Number.isFinite(port.x)) {
    return undefined;
  }

  if (typeof port.y !== 'number' || !Number.isFinite(port.y)) {
    return undefined;
  }

  return { x: port.x, y: port.y };
}

function createIssue(wireId: string, code: WireGeometryIssue['code'], message: string): WireGeometryIssue {
  return {
    wireId,
    code,
    message,
  };
}

function resolvePortRef(endpoint: WireConfig['from']): string {
  return endpoint.portId ?? endpoint.port;
}

export function resolveWireGeometry(
  wire: WireConfig,
  components: ReadonlyMap<string, ComponentConfig>
): WireGeometryResult {
  const issues: WireGeometryIssue[] = [];
  const fromComponent = components.get(wire.from.componentId ?? wire.from.component);
  const toComponent = components.get(wire.to.componentId ?? wire.to.component);

  if (!fromComponent) {
    issues.push(
      createIssue(
        wire.id,
        'missing-from-component',
        `Wire ${wire.id} references missing from.component ${wire.from.component}`
      )
    );
  }

  if (!toComponent) {
    issues.push(
      createIssue(
        wire.id,
        'missing-to-component',
        `Wire ${wire.id} references missing to.component ${wire.to.component}`
      )
    );
  }

  const fromPortRef = resolvePortRef(wire.from);
  const toPortRef = resolvePortRef(wire.to);
  const fromPort = fromComponent ? findPort(fromComponent, fromPortRef) : undefined;
  const toPort = toComponent ? findPort(toComponent, toPortRef) : undefined;

  if (fromComponent && !fromPort) {
    issues.push(
      createIssue(
        wire.id,
        'missing-from-port',
        `Wire ${wire.id} references missing from.port ${fromPortRef}`
      )
    );
  }

  if (toComponent && !toPort) {
    issues.push(
      createIssue(
        wire.id,
        'missing-to-port',
        `Wire ${wire.id} references missing to.port ${toPortRef}`
      )
    );
  }

  const startPoint = fromPort ? portPoint(fromPort) : undefined;
  const endPoint = toPort ? portPoint(toPort) : undefined;

  if (fromPort && !startPoint) {
    issues.push(
      createIssue(
        wire.id,
        'missing-from-port-coordinate',
        `Wire ${wire.id} from.port ${fromPortRef} has invalid absolute coordinates`
      )
    );
  }

  if (toPort && !endPoint) {
    issues.push(
      createIssue(
        wire.id,
        'missing-to-port-coordinate',
        `Wire ${wire.id} to.port ${toPortRef} has invalid absolute coordinates`
      )
    );
  }

  if (!wire.waypoints || wire.waypoints.length === 0) {
    issues.push(
      createIssue(
        wire.id,
        'missing-waypoints',
        `Wire ${wire.id} has no waypoints in strict geometry mode`
      )
    );

    return {
      wireId: wire.id,
      points: [],
      startPoint,
      endPoint,
      issues,
    };
  }

  const validWaypoints: Point[] = [];
  wire.waypoints.forEach((waypoint, index) => {
    if (isValidPoint(waypoint)) {
      validWaypoints.push(waypoint);
      return;
    }

    issues.push(
      createIssue(
        wire.id,
        'invalid-waypoint',
        `Wire ${wire.id} waypoint[${index}] is invalid (${waypoint.x}, ${waypoint.y})`
      )
    );
  });

  const points = buildWirePathPoints(startPoint, validWaypoints, endPoint);
  const segments = buildWireSegments(points);

  if (startPoint && points.length > 0 && !pointsEqual(points[0], startPoint)) {
    issues.push(
      createIssue(
        wire.id,
        'start-point-mismatch',
        `Wire ${wire.id} polyline start does not match from.port ${fromPortRef}`
      )
    );
  }

  if (endPoint && points.length > 0 && !pointsEqual(points[points.length - 1], endPoint)) {
    issues.push(
      createIssue(
        wire.id,
        'end-point-mismatch',
        `Wire ${wire.id} polyline end does not match to.port ${toPortRef}`
      )
    );
  }

  segments.forEach((segment) => {
    if (isOrthogonalSegment(segment.from, segment.to)) {
      return;
    }

    issues.push(
      createIssue(
        wire.id,
        'non-orthogonal-segment',
        `Wire ${wire.id} segment[${segment.index}] is non-orthogonal from ${formatPoint(segment.from)} to ${formatPoint(segment.to)}`
      )
    );
  });

  if (startPoint && fromPort) {
    const firstSegment = findFirstDirectionalSegment(segments);
    if (firstSegment) {
      const sourceSide = resolvePortSide(fromPort);
      if (!isSourceExitDirectionValid(sourceSide, firstSegment)) {
        issues.push(
          createIssue(
            wire.id,
            'invalid-source-exit-direction',
            `Wire ${wire.id} source exit direction is invalid on segment[${firstSegment.index}] for side ${sourceSide}: ${formatPoint(firstSegment.from)} -> ${formatPoint(firstSegment.to)}`
          )
        );
      }
    }
  }

  if (endPoint && toPort) {
    const lastSegment = findLastDirectionalSegment(segments);
    if (lastSegment) {
      const targetSide = resolvePortSide(toPort);
      if (!isTargetEntryDirectionValid(targetSide, lastSegment)) {
        issues.push(
          createIssue(
            wire.id,
            'invalid-target-entry-direction',
            `Wire ${wire.id} target entry direction is invalid on segment[${lastSegment.index}] for side ${targetSide}: ${formatPoint(lastSegment.from)} -> ${formatPoint(lastSegment.to)}`
          )
        );
      }
    }
  }

  return {
    wireId: wire.id,
    points,
    startPoint,
    endPoint,
    issues,
  };
}

export function buildWirePoints(wire: WireConfig, components: ReadonlyMap<string, ComponentConfig>): Point[] {
  const geometry = resolveWireGeometry(wire, components);
  if (geometry.issues.length > 0) {
    const message = geometry.issues.map((issue) => issue.message).join('; ');
    throw new Error(message);
  }

  return geometry.points;
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
  geometry,
}: WireProps) {
  const resolvedGeometry = useMemo(
    () => geometry ?? resolveWireGeometry(wire, components),
    [geometry, wire, components]
  );

  const { path, labelPoint, markerPoint } = useMemo(() => {
    const points = resolvedGeometry.points;
    return {
      path: buildWirePath(points),
      labelPoint: wire.labelPosition ?? points[Math.floor(points.length / 2)],
      markerPoint: points[0] ?? resolvedGeometry.startPoint ?? resolvedGeometry.endPoint,
    };
  }, [resolvedGeometry, wire.labelPosition]);

  const hasIssues = resolvedGeometry.issues.length > 0;
  const signalTone = wire.style?.color ?? getSignalTone(wire.signalType);
  const labelTone = getSignalTone(wire.labelSignalType ?? wire.signalType);
  const strokeWidth = wire.style?.strokeWidth
    ?? (active ? Math.max(3, 1.8 + wire.busWidth / 24) : Math.max(1.2, 1 + wire.busWidth / 48));
  const idleStroke = 'rgba(77, 91, 102, 0.34)';
  const dashed = wire.style?.dashed === true || wire.kind === 'control' || wire.signalType === 'control';
  const dashArray = hasIssues ? '9 6' : active ? '14 10' : dashed ? '6 6' : undefined;
  const labelText = wire.label ?? (showLabel ? wire.id : null);
  const strokeColor = hasIssues ? '#d22f27' : signalTone;

  return (
    <g aria-label={`wire ${wire.id}`}>
      {path ? (
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeOpacity={hasIssues ? 0.24 : active ? 0.28 : 0}
          strokeWidth={strokeWidth + 7}
          strokeLinecap="round"
        />
      ) : null}

      {path && !hasIssues && active && animateFlow ? (
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
      ) : path ? (
        <path
          d={path}
          fill="none"
          stroke={hasIssues ? strokeColor : active ? signalTone : idleStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray}
          opacity={hasIssues ? 0.95 : active ? 1 : 0.78}
        />
      ) : null}

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
            fill={hasIssues ? strokeColor : active ? labelTone : 'rgba(77, 91, 102, 0.72)'}
          >
            {labelText}
          </text>
        </g>
      ) : null}

      {hasIssues && markerPoint ? (
        <g aria-label={`wire-error-${wire.id}`}>
          <circle cx={markerPoint.x} cy={markerPoint.y} r={6} fill="#fff4f3" stroke={strokeColor} strokeWidth={2} />
          <text
            x={markerPoint.x}
            y={markerPoint.y + 3}
            textAnchor="middle"
            fontFamily="Consolas, SFMono-Regular, monospace"
            fontSize="9"
            fontWeight="700"
            fill={strokeColor}
          >
            !
          </text>
        </g>
      ) : null}
    </g>
  );
});
