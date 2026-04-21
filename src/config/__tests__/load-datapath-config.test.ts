import {
  getDatapathConfig,
  normalizeDatapathConfig,
  summarizeDatapathConfig,
  validateDatapathConfig,
} from '../load-datapath-config';

describe('loadDatapathConfig', () => {
  it('loads the multicycle datapath configuration', () => {
    const config = getDatapathConfig();

    expect(config.metadata.name).toBe('RISC-V Multicycle CPU');
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
        },
      ],
    });

    expect(normalized.components[0].position).toEqual({ x: 12, y: 34 });
    expect(normalized.components[0].size).toEqual({ width: 56, height: 78 });
    expect(normalized.components[0].ports[0].name).toBe('p0');
    expect(normalized.components[0].ports[0].x).toBe(68);
    expect(normalized.wires[0].from.component).toBe('c1');
    expect(normalized.wires[0].from.port).toBe('p0');
    expect(normalized.wires[0].waypoints).toEqual([{ x: 100, y: 120 }]);
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

  it('ensures bundled datapath ports all have absolute coordinates', () => {
    const config = getDatapathConfig();
    const missing = config.components
      .flatMap((component) => component.ports)
      .filter((port) => !Number.isFinite(port.x) || !Number.isFinite(port.y));

    expect(missing).toHaveLength(0);
  });

  it('keeps bundled datapath routes valid under strict geometry constraints', () => {
    const report = validateDatapathConfig(getDatapathConfig());
    const routeIssues = report.issues.filter((issue) => (
      issue.code === 'missing-waypoints'
      || issue.code === 'non-orthogonal-segment'
      || issue.code === 'invalid-source-exit-direction'
      || issue.code === 'invalid-target-entry-direction'
    ));

    expect(routeIssues).toHaveLength(0);
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

  it('reports orthogonal and side-direction issues for invalid constrained routes', () => {
    const normalized = normalizeDatapathConfig({
      metadata: {
        name: 'route-constraints',
        type: 'multicycle',
        version: '1.0.0',
        canvasSize: { width: 300, height: 140 },
      },
      components: [
        {
          id: 'src',
          type: 'register',
          label: 'SRC',
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
          id: 'dst',
          type: 'register',
          label: 'DST',
          x: 160,
          y: 0,
          width: 40,
          height: 40,
          ports: [
            {
              id: 'in',
              direction: 'in',
              side: 'left',
              x: 160,
              y: 20,
              busWidth: 32,
              signalType: 'data',
            },
          ],
        },
      ],
      wires: [
        {
          id: 'diag',
          from: { componentId: 'src', portId: 'out' },
          to: { componentId: 'dst', portId: 'in' },
          waypoints: [{ x: 100, y: 60 }],
          signalType: 'data',
          busWidth: 32,
        },
        {
          id: 'bad-source',
          from: { componentId: 'src', portId: 'out' },
          to: { componentId: 'dst', portId: 'in' },
          waypoints: [
            { x: 40, y: 60 },
            { x: 120, y: 60 },
            { x: 120, y: 20 },
          ],
          signalType: 'data',
          busWidth: 32,
        },
        {
          id: 'bad-target',
          from: { componentId: 'src', portId: 'out' },
          to: { componentId: 'dst', portId: 'in' },
          waypoints: [
            { x: 100, y: 20 },
            { x: 100, y: 80 },
            { x: 160, y: 80 },
          ],
          signalType: 'data',
          busWidth: 32,
        },
      ],
    });

    const report = validateDatapathConfig(normalized);
    const codes = report.issues.map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'non-orthogonal-segment',
        'invalid-source-exit-direction',
        'invalid-target-entry-direction',
      ])
    );
  });
});
