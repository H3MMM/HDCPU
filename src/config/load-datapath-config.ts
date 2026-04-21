import rawDatapathConfig from './multicycle-datapath.json';
import type {
  ComponentConfig,
  ComponentType,
  DatapathConfig,
  Point,
  PortConfig,
  PortPosition,
  SignalType,
  WireConfig,
  WireEndpointConfig,
} from '../types';

const datapathConfig = normalizeDatapathConfig(rawDatapathConfig as unknown);

type UnknownRecord = Record<string, unknown>;

export interface DatapathValidationIssue {
  scope: 'diagram' | 'wire';
  code:
    | 'duplicate-component-id'
    | 'duplicate-wire-id'
    | 'missing-from-component'
    | 'missing-to-component'
    | 'missing-from-port'
    | 'missing-to-port'
    | 'missing-waypoints'
    | 'invalid-waypoint';
  message: string;
  componentId?: string;
  wireId?: string;
}

export interface DatapathValidationReport {
  issues: DatapathValidationIssue[];
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asPoint(value: unknown): Point | undefined {
  const record = asRecord(value);
  const x = asFiniteNumber(record.x);
  const y = asFiniteNumber(record.y);

  if (x === undefined || y === undefined) {
    return undefined;
  }

  return { x, y };
}

function asPortPosition(value: unknown): PortPosition | undefined {
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') {
    return value;
  }
  return undefined;
}

function asSignalType(value: unknown): SignalType | undefined {
  if (value === 'data' || value === 'control' || value === 'address') {
    return value;
  }
  return undefined;
}

function asComponentType(value: unknown): ComponentType {
  if (
    value === 'register' ||
    value === 'memory' ||
    value === 'register-file' ||
    value === 'alu' ||
    value === 'mux' ||
    value === 'control' ||
    value === 'imm-gen' ||
    value === 'adder' ||
    value === 'sign-extend' ||
    value === 'branch-logic' ||
    value === 'constant'
  ) {
    return value;
  }

  return 'register';
}

function resolvePortRatio(port: PortConfig, siblingIndex: number, siblingCount: number): number {
  if (typeof port.offset === 'number' && Number.isFinite(port.offset)) {
    return Math.min(Math.max(port.offset, 0), 1);
  }

  return (siblingIndex + 1) / (siblingCount + 1);
}

function toAbsolutePortPoint(
  port: PortConfig,
  ratio: number,
  componentPosition: { x: number; y: number },
  componentSize: { width: number; height: number }
): Point {
  const side = port.side ?? port.position;

  if (side === 'left') {
    return {
      x: componentPosition.x,
      y: componentPosition.y + componentSize.height * ratio,
    };
  }

  if (side === 'right') {
    return {
      x: componentPosition.x + componentSize.width,
      y: componentPosition.y + componentSize.height * ratio,
    };
  }

  if (side === 'top') {
    return {
      x: componentPosition.x + componentSize.width * ratio,
      y: componentPosition.y,
    };
  }

  return {
    x: componentPosition.x + componentSize.width * ratio,
    y: componentPosition.y + componentSize.height,
  };
}

function hydrateLegacyPortCoordinates(
  ports: readonly PortConfig[],
  componentPosition: { x: number; y: number },
  componentSize: { width: number; height: number }
): PortConfig[] {
  const bySide = new Map<PortPosition, PortConfig[]>();

  ports.forEach((port) => {
    const side = port.side ?? port.position;
    const sidePorts = bySide.get(side) ?? [];
    sidePorts.push(port);
    bySide.set(side, sidePorts);
  });

  return ports.map((port) => {
    if (typeof port.x === 'number' && Number.isFinite(port.x) && typeof port.y === 'number' && Number.isFinite(port.y)) {
      return port;
    }

    const side = port.side ?? port.position;
    const sidePorts = bySide.get(side) ?? [port];
    const siblingIndex = sidePorts.findIndex((candidate) => candidate.id === port.id && candidate.name === port.name);
    const ratio = resolvePortRatio(port, Math.max(siblingIndex, 0), sidePorts.length);
    const absolute = toAbsolutePortPoint(port, ratio, componentPosition, componentSize);

    return {
      ...port,
      x: absolute.x,
      y: absolute.y,
    };
  });
}

function normalizeWireEndpoint(value: unknown): WireEndpointConfig {
  const record = asRecord(value);
  const component = asString(record.component) ?? asString(record.componentId) ?? '';
  const port = asString(record.port) ?? asString(record.portId) ?? '';

  return {
    component,
    port,
    componentId: component,
    portId: port,
  };
}

function normalizePortConfig(value: unknown, index: number): PortConfig {
  const record = asRecord(value);
  const portId = asString(record.id) ?? asString(record.name) ?? `port-${index}`;
  const labelOffset = asPoint(record.labelOffset);
  const position = asPortPosition(record.position) ?? asPortPosition(record.side) ?? 'left';

  return {
    id: asString(record.id) ?? portId,
    name: asString(record.name) ?? portId,
    direction: record.direction === 'out' ? 'out' : 'in',
    position,
    side: asPortPosition(record.side) ?? position,
    x: asFiniteNumber(record.x),
    y: asFiniteNumber(record.y),
    offset: asFiniteNumber(record.offset),
    busWidth: asFiniteNumber(record.busWidth) ?? 1,
    signalType: asSignalType(record.signalType) ?? 'data',
    label: asString(record.label),
    hidden: typeof record.hidden === 'boolean' ? record.hidden : undefined,
    labelOffset,
    textAnchor:
      record.textAnchor === 'start' || record.textAnchor === 'middle' || record.textAnchor === 'end'
        ? record.textAnchor
        : undefined,
  };
}

function normalizeComponentConfig(value: unknown, index: number): ComponentConfig {
  const record = asRecord(value);
  const positionRecord = asRecord(record.position);
  const sizeRecord = asRecord(record.size);
  const x = asFiniteNumber(record.x) ?? asFiniteNumber(positionRecord.x) ?? 0;
  const y = asFiniteNumber(record.y) ?? asFiniteNumber(positionRecord.y) ?? 0;
  const width = asFiniteNumber(record.width) ?? asFiniteNumber(sizeRecord.width) ?? 0;
  const height = asFiniteNumber(record.height) ?? asFiniteNumber(sizeRecord.height) ?? 0;
  const normalizedPorts = Array.isArray(record.ports)
    ? record.ports.map((port, portIndex) => normalizePortConfig(port, portIndex))
    : [];
  const ports = hydrateLegacyPortCoordinates(
    normalizedPorts,
    { x, y },
    { width, height }
  );

  return {
    id: asString(record.id) ?? `component-${index}`,
    type: asComponentType(record.type),
    label: asString(record.label) ?? asString(record.id) ?? `Component-${index}`,
    x,
    y,
    width,
    height,
    position: { x, y },
    size: { width, height },
    ports,
    muxInputCount: asFiniteNumber(record.muxInputCount),
    stateKey: asString(record.stateKey),
    skin: asString(record.skin) as ComponentConfig['skin'],
    portStyle: asString(record.portStyle) as ComponentConfig['portStyle'],
    labelLines: Array.isArray(record.labelLines)
      ? record.labelLines.filter((line): line is string => typeof line === 'string')
      : undefined,
    labelRotate: asFiniteNumber(record.labelRotate),
    labelFontSize: asFiniteNumber(record.labelFontSize),
    labelLineGap: asFiniteNumber(record.labelLineGap),
    labelOffset: asPoint(record.labelOffset),
    choiceLabels: Array.isArray(record.choiceLabels)
      ? record.choiceLabels.filter((line): line is string => typeof line === 'string')
      : undefined,
    hideLabel: typeof record.hideLabel === 'boolean' ? record.hideLabel : undefined,
    hideSubtitle: typeof record.hideSubtitle === 'boolean' ? record.hideSubtitle : undefined,
    hideDetail: typeof record.hideDetail === 'boolean' ? record.hideDetail : undefined,
    clocked: typeof record.clocked === 'boolean' ? record.clocked : undefined,
  };
}

function normalizeWireConfig(value: unknown, index: number): WireConfig {
  const record = asRecord(value);
  const signalType =
    asSignalType(record.signalType) ??
    (record.kind === 'control' || record.kind === 'clock' ? 'control' : 'data');
  const waypoints = Array.isArray(record.waypoints)
    ? record.waypoints.map((waypoint) => {
        const waypointRecord = asRecord(waypoint);
        return {
          x: Number(waypointRecord.x),
          y: Number(waypointRecord.y),
        };
      })
    : undefined;

  return {
    id: asString(record.id) ?? `wire-${index}`,
    from: normalizeWireEndpoint(record.from),
    to: normalizeWireEndpoint(record.to),
    busWidth: asFiniteNumber(record.busWidth) ?? 1,
    signalType,
    waypoints,
    kind:
      record.kind === 'data' ||
      record.kind === 'control' ||
      record.kind === 'clock' ||
      record.kind === 'other'
        ? record.kind
        : undefined,
    label: asString(record.label),
    style: asRecord(record.style) as WireConfig['style'],
    labelPosition: asPoint(record.labelPosition),
    labelRotate: asFiniteNumber(record.labelRotate),
    labelSignalType: asSignalType(record.labelSignalType),
    stateKey: asString(record.stateKey),
    activeStages: Array.isArray(record.activeStages)
      ? record.activeStages.filter((stage): stage is string => typeof stage === 'string')
      : undefined,
    controlActiveMode: record.controlActiveMode === 'defined' ? 'defined' : 'truthy',
  };
}

export function normalizeDatapathConfig(rawConfig: unknown): DatapathConfig {
  const record = asRecord(rawConfig);
  const metadataRecord = asRecord(record.metadata);
  const canvasRecord = asRecord(metadataRecord.canvasSize);
  const width = asFiniteNumber(canvasRecord.width) ?? asFiniteNumber(record.width) ?? 0;
  const height = asFiniteNumber(canvasRecord.height) ?? asFiniteNumber(record.height) ?? 0;
  const components = Array.isArray(record.components)
    ? record.components.map((component, index) => normalizeComponentConfig(component, index))
    : [];
  const wires = Array.isArray(record.wires)
    ? record.wires.map((wire, index) => normalizeWireConfig(wire, index))
    : [];

  return {
    metadata: {
      name: asString(metadataRecord.name) ?? 'CPU Datapath',
      type: metadataRecord.type === 'pipeline' ? 'pipeline' : 'multicycle',
      version: asString(metadataRecord.version) ?? '1.0.0',
      canvasSize: { width, height },
    },
    components,
    wires,
  };
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function hasPort(component: ComponentConfig, portId: string): boolean {
  return component.ports.some((port) => port.id === portId || port.name === portId);
}

export function validateDatapathConfig(config: DatapathConfig): DatapathValidationReport {
  const issues: DatapathValidationIssue[] = [];
  const componentIds = new Set<string>();
  const wireIds = new Set<string>();
  const componentMap = new Map<string, ComponentConfig>();

  for (const component of config.components) {
    if (componentIds.has(component.id)) {
      issues.push({
        scope: 'diagram',
        code: 'duplicate-component-id',
        componentId: component.id,
        message: `Duplicate component id: ${component.id}`,
      });
    }

    componentIds.add(component.id);
    componentMap.set(component.id, component);
  }

  for (const wire of config.wires) {
    if (wireIds.has(wire.id)) {
      issues.push({
        scope: 'diagram',
        code: 'duplicate-wire-id',
        wireId: wire.id,
        message: `Duplicate wire id: ${wire.id}`,
      });
    }
    wireIds.add(wire.id);

    const fromComponent = componentMap.get(wire.from.component);
    const toComponent = componentMap.get(wire.to.component);

    if (!fromComponent) {
      issues.push({
        scope: 'wire',
        code: 'missing-from-component',
        wireId: wire.id,
        message: `Wire ${wire.id} references missing from.component ${wire.from.component}`,
      });
    }

    if (!toComponent) {
      issues.push({
        scope: 'wire',
        code: 'missing-to-component',
        wireId: wire.id,
        message: `Wire ${wire.id} references missing to.component ${wire.to.component}`,
      });
    }

    if (fromComponent && !hasPort(fromComponent, wire.from.port)) {
      issues.push({
        scope: 'wire',
        code: 'missing-from-port',
        wireId: wire.id,
        message: `Wire ${wire.id} references missing from.port ${wire.from.port}`,
      });
    }

    if (toComponent && !hasPort(toComponent, wire.to.port)) {
      issues.push({
        scope: 'wire',
        code: 'missing-to-port',
        wireId: wire.id,
        message: `Wire ${wire.id} references missing to.port ${wire.to.port}`,
      });
    }

    if (!wire.waypoints || wire.waypoints.length === 0) {
      issues.push({
        scope: 'wire',
        code: 'missing-waypoints',
        wireId: wire.id,
        message: `Wire ${wire.id} has no waypoints in strict geometry mode`,
      });
      continue;
    }

    wire.waypoints.forEach((waypoint, index) => {
      if (!isFinitePoint(waypoint)) {
        issues.push({
          scope: 'wire',
          code: 'invalid-waypoint',
          wireId: wire.id,
          message: `Wire ${wire.id} has invalid waypoint[${index}] (${waypoint.x}, ${waypoint.y})`,
        });
      }
    });
  }

  return { issues };
}

export interface DatapathSummary {
  componentCount: number;
  wireCount: number;
  canvasSize: DatapathConfig['metadata']['canvasSize'];
  componentTypeCounts: Partial<Record<ComponentType, number>>;
}

export function getDatapathConfig(): DatapathConfig {
  return datapathConfig;
}

export function getDatapathValidationReport(config: DatapathConfig = datapathConfig): DatapathValidationReport {
  return validateDatapathConfig(config);
}

export function summarizeDatapathConfig(config: DatapathConfig = datapathConfig): DatapathSummary {
  const componentTypeCounts = config.components.reduce<Partial<Record<ComponentType, number>>>((counts, component) => {
    counts[component.type] = (counts[component.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    componentCount: config.components.length,
    wireCount: config.wires.length,
    canvasSize: config.metadata.canvasSize,
    componentTypeCounts,
  };
}
