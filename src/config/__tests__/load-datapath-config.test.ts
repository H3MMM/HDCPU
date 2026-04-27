import {
  getBundledDatapathConfigs,
  getDatapathConfig,
  normalizeDatapathConfig,
  summarizeDatapathConfig,
  validateDatapathConfig,
} from '../load-datapath-config';
import type { ComponentConfig, Point, WireConfig } from '../../types';

const GEOMETRY_EPSILON = 0.001;

function getPortPoint(component: ComponentConfig, portName: string): Point {
  const port = component.ports.find((candidate) => candidate.name === portName);
  if (!port || !Number.isFinite(port.x) || !Number.isFinite(port.y)) {
    throw new Error(`Missing absolute port coordinate ${component.id}.${portName}`);
  }

  return { x: port.x!, y: port.y! };
}

function getWirePoints(wire: WireConfig, components: ReadonlyMap<string, ComponentConfig>): Point[] {
  return [
    getPortPoint(components.get(wire.from.component)!, wire.from.port),
    ...(wire.waypoints ?? []),
    getPortPoint(components.get(wire.to.component)!, wire.to.port),
  ];
}

function isOrthogonalSegment(from: Point, to: Point): boolean {
  return Math.abs(from.x - to.x) <= GEOMETRY_EPSILON || Math.abs(from.y - to.y) <= GEOMETRY_EPSILON;
}

function segmentIntersectsComponent(from: Point, to: Point, component: ComponentConfig): boolean {
  const padding = 3;
  const left = component.position.x + padding;
  const right = component.position.x + component.size.width - padding;
  const top = component.position.y + padding;
  const bottom = component.position.y + component.size.height - padding;

  if (left >= right || top >= bottom) {
    return false;
  }

  if (Math.abs(from.x - to.x) <= GEOMETRY_EPSILON) {
    return from.x > left && from.x < right && Math.max(from.y, to.y) > top && Math.min(from.y, to.y) < bottom;
  }

  if (Math.abs(from.y - to.y) <= GEOMETRY_EPSILON) {
    return from.y > top && from.y < bottom && Math.max(from.x, to.x) > left && Math.min(from.x, to.x) < right;
  }

  return false;
}

describe('loadDatapathConfig', () => {
  it('loads the multicycle datapath configuration', () => {
    const config = getDatapathConfig();

    expect(config.metadata.name).toBe('RISC-V Multicycle CPU');
    expect(config.components.length).toBeGreaterThan(0);
    expect(config.wires.length).toBeGreaterThan(0);
  });

  it('loads the pipeline datapath configuration', () => {
    const config = getDatapathConfig('pipeline');

    expect(config.metadata.name).toBe('RISC-V Pipeline CPU');
    expect(config.metadata.type).toBe('pipeline');
    expect(config.components.length).toBeGreaterThan(0);
    expect(config.wires.length).toBeGreaterThan(0);
  });

  it('summarizes the configuration for UI consumption', () => {
    const summary = summarizeDatapathConfig();

    expect(summary.componentCount).toBe(getDatapathConfig().components.length);
    expect(summary.wireCount).toBe(getDatapathConfig().wires.length);
    expect(summary.componentTypeCounts.register).toBeGreaterThan(0);
    expect(summary.componentTypeCounts.memory).toBeGreaterThan(0);
  });

  it('normalizes compatible field names without changing geometry semantics', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'compatibility',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 800, height: 400 },
      },
      components: [
        {
          id: 'c1',
          type: 'register',
          label: 'C1',
          x: 12,
          y: 34,
          width: 56,
          height: 78,
          bodyHidden: true,
          portLabelPlacement: 'inside',
          labelSignalType: 'control',
          labelFontStyle: 'italic',
          ports: [
            {
              id: 'p0',
              direction: 'out',
              side: 'right',
              x: 68,
              y: 56,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
      ],
      wires: [
        {
          id: 'w0',
          from: { componentId: 'c1', portId: 'p0' },
          to: { componentId: 'c1', portId: 'p0' },
          waypoints: [{ x: 100, y: 120 }],
          signalType: 'data',
          busWidth: 32,
          activeWhenAll: [{ stateKey: 'controlSignals.RegWrite', mode: 'truthy', oneOf: [true] }],
        },
      ],
    });

    expect(normalized.components[0].position).toEqual({ x: 12, y: 34 });
    expect(normalized.components[0].size).toEqual({ width: 56, height: 78 });
    expect(normalized.components[0].ports[0].name).toBe('p0');
    expect(normalized.components[0].ports[0].x).toBe(68);
    expect(normalized.components[0].bodyHidden).toBe(true);
    expect(normalized.components[0].portLabelPlacement).toBe('inside');
    expect(normalized.components[0].labelSignalType).toBe('control');
    expect(normalized.components[0].labelFontStyle).toBe('italic');
    expect(normalized.wires[0].from.component).toBe('c1');
    expect(normalized.wires[0].from.port).toBe('p0');
    expect(normalized.wires[0].waypoints).toEqual([{ x: 100, y: 120 }]);
    expect(normalized.wires[0].activeWhenAll).toEqual([
      { stateKey: 'controlSignals.RegWrite', mode: 'truthy', oneOf: [true] },
    ]);
  });

  it('hydrates legacy offset ports to absolute coordinates', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'legacy-offset',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 200, height: 120 },
      },
      components: [
        {
          id: 'legacy',
          type: 'register',
          label: 'legacy',
          position: { x: 10, y: 20 },
          size: { width: 100, height: 60 },
          ports: [
            { name: 'left-mid', direction: 'in', position: 'left', offset: 0.5, busWidth: 32, signalType: 'data' },
            { name: 'top-mid', direction: 'in', position: 'top', offset: 0.5, busWidth: 1, signalType: 'control' },
            { name: 'right-mid', direction: 'out', position: 'right', offset: 0.5, busWidth: 32, signalType: 'data' },
            { name: 'bottom-mid', direction: 'out', position: 'bottom', offset: 0.5, busWidth: 32, signalType: 'data' },
          ],
        },
      ],
      wires: [],
    });

    const ports = normalized.components[0].ports;
    const byName = new Map(ports.map((port) => [port.name, port]));

    expect(byName.get('left-mid')).toMatchObject({ x: 10, y: 50 });
    expect(byName.get('top-mid')).toMatchObject({ x: 60, y: 20 });
    expect(byName.get('right-mid')).toMatchObject({ x: 110, y: 50 });
    expect(byName.get('bottom-mid')).toMatchObject({ x: 60, y: 80 });
  });

  it('hydrates anchored ports before falling back to legacy offsets', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'anchored',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 200, height: 120 },
      },
      components: [
        {
          id: 'anchored',
          type: 'register',
          label: 'anchored',
          position: { x: 10, y: 20 },
          size: { width: 100, height: 60 },
          ports: [
            {
              name: 'precise',
              direction: 'out',
              position: 'right',
              anchor: { x: 17, y: 23 },
              offset: 1,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
      ],
      wires: [],
    });

    expect(normalized.components[0].ports[0]).toMatchObject({
      anchor: { x: 17, y: 23 },
      x: 27,
      y: 43,
    });
  });

  it('allows endpoint-only wires without waypoint validation errors', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'endpoint-only',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 220, height: 100 },
      },
      components: [
        {
          id: 'from',
          type: 'register',
          label: 'From',
          x: 10,
          y: 20,
          width: 40,
          height: 30,
          ports: [
            {
              id: 'out',
              direction: 'out',
              side: 'right',
              x: 50,
              y: 35,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
        {
          id: 'to',
          type: 'register',
          label: 'To',
          x: 120,
          y: 20,
          width: 40,
          height: 30,
          ports: [
            {
              id: 'in',
              direction: 'in',
              side: 'left',
              x: 120,
              y: 35,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
      ],
      wires: [
        {
          id: 'direct',
          from: { componentId: 'from', portId: 'out' },
          to: { componentId: 'to', portId: 'in' },
          signalType: 'data',
          busWidth: 32,
        },
      ],
    });

    expect(validateDatapathConfig(normalized).issues).toEqual([]);
  });

  it('ensures bundled datapath ports all have absolute coordinates', () => {
    for (const config of Object.values(getBundledDatapathConfigs())) {
      const missing = config.components
        .flatMap((component) => component.ports)
        .filter((port) => !Number.isFinite(port.x) || !Number.isFinite(port.y));

      expect(missing).toHaveLength(0);
    }
  });

  it('keeps bundled datapath validation clean', () => {
    for (const config of Object.values(getBundledDatapathConfigs())) {
      expect(validateDatapathConfig(config).issues).toEqual([]);
    }
  });

  it('keeps bundled wire routes orthogonal and outside unrelated components', () => {
    const config = getDatapathConfig();
    const components = new Map(config.components.map((component) => [component.id, component]));
    const issues: string[] = [];

    for (const wire of config.wires) {
      const points = getWirePoints(wire, components);

      for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];

        if (!isOrthogonalSegment(from, to)) {
          issues.push(`${wire.id}[${index}] is not orthogonal`);
          continue;
        }

        for (const component of config.components) {
          if (component.id === wire.from.component || component.id === wire.to.component) {
            continue;
          }

          if (segmentIntersectsComponent(from, to, component)) {
            issues.push(`${wire.id}[${index}] intersects ${component.id}`);
          }
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it('reports strict validation issues for duplicates and invalid wire references', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'invalid',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 400, height: 220 },
      },
      components: [
        {
          id: 'dup',
          type: 'register',
          label: 'A',
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          ports: [
            {
              id: 'out',
              direction: 'out',
              side: 'right',
              x: 40,
              y: 20,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
        {
          id: 'dup',
          type: 'register',
          label: 'B',
          x: 60,
          y: 0,
          width: 40,
          height: 40,
          ports: [],
        },
      ],
      wires: [
        {
          id: 'wire-dup',
          from: { componentId: 'dup', portId: 'missing-port' },
          to: { componentId: 'missing-component', portId: 'in' },
          waypoints: [{ x: 'bad', y: 30 }],
          signalType: 'data',
          busWidth: 32,
        },
        {
          id: 'wire-dup',
          from: { componentId: 'dup', portId: 'out' },
          to: { componentId: 'dup', portId: 'out' },
          signalType: 'data',
          busWidth: 32,
          waypoints: [{ x: 50, y: 20 }],
        },
      ],
    });

    const report = validateDatapathConfig(normalized);
    const codes = report.issues.map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'duplicate-component-id',
        'duplicate-wire-id',
        'missing-from-port',
        'missing-to-component',
        'invalid-waypoint',
      ])
    );
  });
});
