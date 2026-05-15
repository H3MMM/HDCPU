import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repoRoot, 'doc', 'CPU\u56fe_\u7b2c\u4e09\u9875_37\u6761_\u63d0\u53d6.json');
const configPath = path.join(repoRoot, 'src', 'config', 'multicycle-datapath.json');

const SCALE = 160;
const MARGIN = 36;
const EPSILON = 0.001;

const COMPONENT_SHAPES = {
  pc: '12',
  'clk-source': '109',
  'alu-src-a': '81',
  'const-4': '90',
  'pc-plus4': '88',
  pc0: '80',
  'instr-mem': '9',
  ir: '13',
  'id-decoder': '1',
  'control-unit': '26',
  'reg-file': '14',
  'reg-a': '21',
  'reg-b': '23',
  'alu-src-b': '67',
  alu: '24',
  'flag-reg': '28',
  'branch-logic': '52',
  'alu-out': '25',
  'jump-target': '82',
  'data-mem': '3',
  mdr: '6',
  'mux-wb': '74',
};

const PORT_ANCHORS = {
  'pc.in': connectorEnd(50),
  'pc.out': connectorBegin(29),
  'pc.write': connectorEnd(100),
  'pc.clk': connectorEnd(113),
  'clk-source.out': connectorEnd(111),
  'alu-src-a.out': connectorBegin(50),
  'alu-src-a.in0': connectorEnd(91),
  'alu-src-a.in1': connectorEnd(93),
  'alu-src-a.in2': connectorEnd(92),
  'alu-src-a.select': connectorEnd(98),
  'const-4.out': connectorBegin(89),
  'pc-plus4.a': connectorEnd(49),
  'pc-plus4.b': connectorEnd(89),
  'pc-plus4.out': connectorBegin(91),
  'pc0.in': connectorEnd(84),
  'pc0.out': connectorBegin(85),
  'pc0.write': connectorEnd(104),
  'pc0.clk': connectorEnd(146),
  'instr-mem.addr': connectorEnd(29),
  'instr-mem.data_out': connectorBegin(30),
  'instr-mem.rd_en': connectorEnd(133),
  'ir.in': connectorEnd(30),
  'ir.out': connectionPoint('13', 1),
  'ir.write': connectorEnd(101),
  'ir.clk': connectorEnd(134),
  'id-decoder.instruction': connectionPoint('1', 0),
  'id-decoder.opcode': connectorBegin(47),
  'id-decoder.funct7': connectorBegin(58),
  'id-decoder.funct3': connectorBegin(60),
  'id-decoder.rs1': connectorBegin(31),
  'id-decoder.rs2': connectorBegin(32),
  'id-decoder.rd': connectorBegin(40),
  'id-decoder.imm32': connectorBegin(51),
  'control-unit.opcode': connectorEnd(47),
  'control-unit.funct7': connectorEnd(58),
  'control-unit.funct3': connectorEnd(60),
  'control-unit.flag': connectorEnd(103),
  'control-unit.reg_write': connectorBegin(44),
  'control-unit.alu_op': connectorBegin(45),
  'control-unit.pc_select': connectorBegin(98),
  'control-unit.pc_write': connectorBegin(100),
  'control-unit.ir_write': connectorBegin(101),
  'control-unit.pc0_write': connectorBegin(104),
  'control-unit.rs2_imm_select': connectorBegin(68),
  'control-unit.mem_write': connectorBegin(71),
  'control-unit.wb_select': connectorBegin(79),
  'control-unit.size_select': connectorBegin(149),
  'control-unit.sign_extend': connectorBegin(150),
  'reg-file.rs1_addr': connectorEnd(31),
  'reg-file.rs2_addr': connectorEnd(32),
  'reg-file.rd_addr': connectorEnd(40),
  'reg-file.write_data': connectorEnd(64),
  'reg-file.wr_en': connectorEnd(44),
  'reg-file.clk': connectorEnd(135),
  'reg-file.rs1_data': connectorBegin(33),
  'reg-file.rs2_data': connectorBegin(34),
  'reg-a.in': connectorEnd(33),
  'reg-a.out': connectorBegin(35),
  'reg-a.clk': connectorEnd(131),
  'reg-b.in': connectorEnd(34),
  'reg-b.out': connectorBegin(39),
  'reg-b.clk': connectorBegin(131),
  'alu-src-b.in0': connectorEnd(39),
  'alu-src-b.in1': connectorEnd(51),
  'alu-src-b.out': connectorBegin(36),
  'alu-src-b.select': connectorEnd(68),
  'alu.a': connectorEnd(35),
  'alu.b': connectorEnd(36),
  'alu.result': connectorBegin(37),
  'alu.op': connectorEnd(45),
  'branch-logic.in': connectorEnd(38),
  'branch-logic.out': connectorBegin(69),
  'flag-reg.in': connectorEnd(69),
  'flag-reg.out': connectorBegin(103),
  'flag-reg.clk': connectorEnd(124),
  'alu-out.in': connectorEnd(37),
  'alu-out.out': connectorBegin(2),
  'alu-out.clk': connectorEnd(137),
  'jump-target.a': connectorEnd(85),
  'jump-target.b': connectorEnd(86),
  'jump-target.out': connectorBegin(92),
  'data-mem.addr': connectorEnd(2),
  'data-mem.write_data': connectorEnd(8),
  'data-mem.data_out': connectorBegin(7),
  'data-mem.wr_en': connectorEnd(71),
  'data-mem.clock': connectorEnd(139),
  'data-mem.size_select': connectorEnd(149),
  'data-mem.sign_extend': connectorEnd(150),
  'mdr.in': connectorEnd(7),
  'mdr.out': connectorBegin(5),
  'mdr.clk': connectorEnd(138),
  'mux-wb.in0': connectorEnd(75),
  'mux-wb.in1': connectorEnd(5),
  'mux-wb.in2': connectorEnd(83),
  'mux-wb.in3': connectorEnd(96),
  'mux-wb.in4': connectorEnd(151),
  'mux-wb.out': connectorBegin(64),
  'mux-wb.select': connectorEnd(79),
};

const WIRE_ROUTES = {
  'pc-to-imem': [29],
  'imem-to-ir': [30],
  'pc-to-pc0': [84],
  'pc-to-pcplus4': [49],
  'const4-to-pcplus4': [89],
  'pcplus4-to-pcsrc': [91],
  'pcsrc-to-pc': [50],
  'ir-to-decoder': [],
  'decoder-opcode-to-ctrl': [47],
  'decoder-funct7-to-ctrl': [58],
  'decoder-funct3-to-ctrl': [60],
  'decoder-rs1-to-regfile': [31],
  'decoder-rs2-to-regfile': [32],
  'decoder-rd-to-regfile': [40],
  'regfile-to-a': [33],
  'regfile-to-b': [34],
  'rega-to-alu': [35],
  'regb-to-rs2mux': [39],
  'immgen-to-rs2mux': [51],
  'rs2mux-to-alu': [36],
  'alu-to-aluout': [37],
  'alu-to-branchlogic': [38],
  'branchlogic-to-flagreg': [69],
  'flagreg-to-ctrl': [103],
  'pc0-to-jumptarget': [85],
  'immgen-to-jumptarget': [
    connectorBegin(51),
    connectorPolylinePoint(51, 0),
    connectorPolylinePoint(51, 1),
    connectorPolylinePoint(51, 2),
    86,
  ],
  'jumptarget-to-pcsrc': [92],
  'aluout-to-pcsrc': [93],
  'aluout-to-dmem': [2],
  'regb-to-dmem': [8],
  'dmem-to-mdr': [7],
  'aluout-to-muxwb': [75],
  'mdr-to-muxwb': [5],
  'pcplus4-to-muxwb': [83],
  'immgen-to-muxwb': [
    connectorBegin(51),
    connectorPolylinePoint(51, 0),
    connectorPolylinePoint(51, 1),
    connectorPolylinePoint(51, 2),
    96,
  ],
  'jumptarget-to-muxwb': [151],
  'muxwb-to-regfile': [64],
  'ctrl-to-pc-select': [98],
  'ctrl-to-pc-write': [100],
  'ctrl-to-pc0-write': [104],
  'ctrl-to-ir-write': [101],
  'ctrl-to-regfile-write': [44],
  'ctrl-to-rs2mux-select': [68],
  'ctrl-to-alu-op': [45],
  'ctrl-to-dmem-write': [71],
  'ctrl-to-muxwb-select': [79],
  'ctrl-to-size-select': [149],
  'ctrl-to-se-select': [150],
  'clk-to-pc': [reverseConnector(111), 113],
  'clk-to-imem': [reverseConnector(111), 133],
  'clk-to-pc0': [reverseConnector(111), 146],
  'clk-to-ir': [reverseConnector(111), 134],
  'clk-to-regfile': [reverseConnector(111), 135],
  'clk-to-rega': [reverseConnector(111), 136, 131],
  'clk-to-regb': [reverseConnector(111), 136],
  'clk-to-flagreg': [reverseConnector(111), 137, 124],
  'clk-to-aluout': [reverseConnector(111), 137],
  'clk-to-dmem': [reverseConnector(111), 139],
  'clk-to-mdr': [reverseConnector(111), 138],
};

const extraction = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const shapesById = new Map(extraction.shapes.map((shape) => [String(shape.shape_id), shape]));
const connectorsById = new Map(extraction.connectors.map((connector) => [String(connector.connector_id), connector]));

const diagramBounds = getBounds([
  ...extraction.shapes
    .filter((shape) => !String(shape.label).startsWith('Dynamic connector'))
    .flatMap((shape) => shapeGeometryPoints(shape)),
  ...extraction.connectors.flatMap((connector) => connectorRoutePoints(connector)),
]);

config.metadata.version = '1.2.0';
config.metadata.canvasSize = {
  width: Math.ceil((diagramBounds.maxX - diagramBounds.minX) * SCALE + MARGIN * 2),
  height: Math.ceil((diagramBounds.maxY - diagramBounds.minY) * SCALE + MARGIN * 2),
};

const componentsById = new Map(config.components.map((component) => [component.id, component]));

for (const [componentId, shapeId] of Object.entries(COMPONENT_SHAPES)) {
  const component = getComponent(componentId);
  const bounds = getBounds(shapeCornerPoints(getShape(shapeId)));
  const topLeft = toCanvas([bounds.minX, bounds.maxY]);

  component.position = topLeft;
  component.size = {
    width: round((bounds.maxX - bounds.minX) * SCALE),
    height: round((bounds.maxY - bounds.minY) * SCALE),
  };
}

getComponent('id-decoder').clocked = false;
getComponent('id-decoder').ports = getComponent('id-decoder').ports.filter((port) => port.name !== 'clk');

ensurePort('control-unit', {
  name: 'size_select',
  direction: 'out',
  position: 'top',
  busWidth: 2,
  signalType: 'control',
  hidden: true,
});
ensurePort('control-unit', {
  name: 'sign_extend',
  direction: 'out',
  position: 'top',
  busWidth: 1,
  signalType: 'control',
  hidden: true,
});
ensurePort('data-mem', {
  name: 'size_select',
  label: 'Size_s',
  direction: 'in',
  position: 'top',
  busWidth: 2,
  signalType: 'control',
});
ensurePort('data-mem', {
  name: 'sign_extend',
  label: 'SE_s',
  direction: 'in',
  position: 'right',
  busWidth: 1,
  signalType: 'control',
});
ensurePort('reg-file', {
  name: 'clk',
  label: 'clk_Regs',
  direction: 'in',
  position: 'bottom',
  busWidth: 1,
  signalType: 'control',
  labelOffset: { x: 0, y: -4 },
});
ensurePort('flag-reg', {
  name: 'clk',
  direction: 'in',
  position: 'bottom',
  busWidth: 1,
  signalType: 'control',
  hidden: true,
});
ensurePort('mux-wb', {
  name: 'in4',
  direction: 'in',
  position: 'left',
  busWidth: 32,
  signalType: 'data',
  hidden: true,
});

getComponent('mux-wb').muxInputCount = 5;
getComponent('mux-wb').choiceLabels = ['4', '0', '1', '2', '3'];
getComponent('instr-mem').portLabelPlacement = 'inside';
getComponent('reg-file').portLabelPlacement = 'inside';
getComponent('alu').portLabelPlacement = 'inside';
getComponent('data-mem').portLabelPlacement = 'inside';
getComponent('const-4').bodyHidden = true;
getComponent('const-4').labelSignalType = 'control';
getComponent('const-4').labelFontStyle = 'italic';
getComponent('const-4').labelFontSize = 17;
getPort(getComponent('reg-file'), 'wr_en').label = 'Reg_Write';
getPort(getComponent('reg-file'), 'wr_en').position = 'top';
getPort(getComponent('reg-file'), 'wr_en').side = 'top';
getPort(getComponent('id-decoder'), 'imm32').position = 'right';
getPort(getComponent('id-decoder'), 'imm32').side = 'right';

for (const [portKey, ref] of Object.entries(PORT_ANCHORS)) {
  const [componentId, portName] = portKey.split('.');
  const component = getComponent(componentId);
  const port = getPort(component, portName);
  const point = resolvePointRef(ref);
  const canvasPoint = toCanvas(point);

  port.anchor = {
    x: round(canvasPoint.x - component.position.x),
    y: round(canvasPoint.y - component.position.y),
  };
}

getPort(getComponent('id-decoder'), 'imm32').anchor.x = getPort(getComponent('id-decoder'), 'opcode').anchor.x;

getPort(getComponent('clk-source'), 'out').signalType = 'control';

config.wires = config.wires.filter((wire) => wire.id !== 'clk-to-decoder' && wire.id !== 'decoder-to-immgen');
const wiresById = new Map(config.wires.map((wire) => [wire.id, wire]));

ensureWire({
  id: 'jumptarget-to-muxwb',
  from: { component: 'jump-target', port: 'out' },
  to: { component: 'mux-wb', port: 'in4' },
  busWidth: 32,
  signalType: 'data',
});
ensureWire({
  id: 'ctrl-to-size-select',
  from: { component: 'control-unit', port: 'size_select' },
  to: { component: 'data-mem', port: 'size_select' },
  busWidth: 2,
  signalType: 'control',
  label: 'Size_s',
  stateKey: 'decodedInstruction.funct3',
  activeStages: ['MEM'],
  controlActiveMode: 'defined',
});
ensureWire({
  id: 'ctrl-to-se-select',
  from: { component: 'control-unit', port: 'sign_extend' },
  to: { component: 'data-mem', port: 'sign_extend' },
  busWidth: 1,
  signalType: 'control',
  label: 'SE_s',
  stateKey: 'decodedInstruction.funct3',
  activeStages: ['MEM'],
  controlActiveMode: 'defined',
});
ensureWire({
  id: 'clk-to-flagreg',
  from: { component: 'clk-source', port: 'out' },
  to: { component: 'flag-reg', port: 'clk' },
  busWidth: 1,
  signalType: 'control',
});

getWire('clk-to-regfile').to = { component: 'reg-file', port: 'clk' };
getWire('immgen-to-rs2mux').from = { component: 'id-decoder', port: 'imm32' };
getWire('immgen-to-jumptarget').from = { component: 'id-decoder', port: 'imm32' };
getWire('immgen-to-muxwb').from = { component: 'id-decoder', port: 'imm32' };
getWire('pcplus4-to-muxwb').from = { component: 'pc', port: 'out' };
getWire('ctrl-to-pc-select').activeWhenAll = [
  {
    stateKey: 'controlSignals.PCWrite',
    mode: 'truthy',
  },
];
getWire('alu-to-branchlogic').activeWhenAll = [
  {
    stateKey: 'controlSignals.Branch',
    mode: 'truthy',
  },
];
getWire('branchlogic-to-flagreg').activeWhenAll = [
  {
    stateKey: 'controlSignals.Branch',
    mode: 'truthy',
  },
];
getWire('ctrl-to-rs2mux-select').activeWhenAll = [
  {
    stateKey: 'controlSignals.ALUSrcB',
    mode: 'defined',
    oneOf: [2, 3],
  },
];
getWire('ctrl-to-muxwb-select').activeWhenAll = [
  {
    stateKey: 'controlSignals.RegWrite',
    mode: 'truthy',
  },
];
getWire('ctrl-to-se-select').activeWhenAll = [
  {
    stateKey: 'controlSignals.MemRead',
    mode: 'truthy',
  },
];

for (const [wireId, route] of Object.entries(WIRE_ROUTES)) {
  const wire = getWire(wireId);
  const points = buildRoutePoints(wire, route);
  wire.waypoints = points.slice(1, -1);

  if (wire.id.startsWith('clk-to-')) {
    wire.signalType = 'control';
  }
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

function connectorBegin(id) {
  return { kind: 'connector-begin', id: String(id) };
}

function connectorEnd(id) {
  return { kind: 'connector-end', id: String(id) };
}

function connectorPolylinePoint(id, index) {
  return { kind: 'connector-polyline-point', id: String(id), index };
}

function reverseConnector(id) {
  return { id, reverse: true };
}

function connectionPoint(shapeId, ix) {
  return { kind: 'connection-point', shapeId: String(shapeId), ix: String(ix) };
}

function shapeSide(shapeId, side) {
  return { kind: 'shape-side', shapeId: String(shapeId), side };
}

function getShape(shapeId) {
  const shape = shapesById.get(String(shapeId));
  if (!shape) {
    throw new Error(`Missing shape ${shapeId}`);
  }
  return shape;
}

function getConnector(connectorId) {
  const connector = connectorsById.get(String(connectorId));
  if (!connector) {
    throw new Error(`Missing connector ${connectorId}`);
  }
  return connector;
}

function getComponent(componentId) {
  const component = componentsById.get(componentId);
  if (!component) {
    throw new Error(`Missing component ${componentId}`);
  }
  return component;
}

function getPort(component, portName) {
  const port = component.ports.find((candidate) => candidate.name === portName);
  if (!port) {
    throw new Error(`Missing port ${component.id}.${portName}`);
  }
  return port;
}

function getWire(wireId) {
  const wire = wiresById.get(wireId);
  if (!wire) {
    throw new Error(`Missing wire ${wireId}`);
  }
  return wire;
}

function ensurePort(componentId, portConfig) {
  const component = getComponent(componentId);
  const existing = component.ports.find((port) => port.name === portConfig.name);

  if (existing) {
    Object.assign(existing, portConfig);
    return existing;
  }

  component.ports.push(portConfig);
  return portConfig;
}

function ensureWire(wireConfig) {
  const existing = wiresById.get(wireConfig.id);

  if (existing) {
    Object.assign(existing, wireConfig);
    return existing;
  }

  config.wires.push(wireConfig);
  wiresById.set(wireConfig.id, wireConfig);
  return wireConfig;
}

function resolvePointRef(ref) {
  if (Array.isArray(ref)) {
    return ref;
  }

  if (ref.kind === 'connector-begin') {
    return getConnector(ref.id).begin;
  }

  if (ref.kind === 'connector-end') {
    return getConnector(ref.id).end;
  }

  if (ref.kind === 'connector-polyline-point') {
    const point = getConnector(ref.id).polyline_points[ref.index];
    if (!point) {
      throw new Error(`Missing connector polyline point ${ref.id}[${ref.index}]`);
    }
    return point;
  }

  if (ref.kind === 'connection-point') {
    const point = getShape(ref.shapeId).connection_points.find((candidate) => String(candidate.ix) === ref.ix);
    if (!point) {
      throw new Error(`Missing connection point ${ref.shapeId}.${ref.ix}`);
    }
    return point.abs;
  }

  if (ref.kind === 'shape-side') {
    const bounds = getBounds(shapeCornerPoints(getShape(ref.shapeId)));
    const y = (bounds.minY + bounds.maxY) / 2;
    if (ref.side === 'left') {
      return [bounds.minX, y];
    }
    if (ref.side === 'right') {
      return [bounds.maxX, y];
    }
    throw new Error(`Unsupported shape side ${ref.side}`);
  }

  throw new Error(`Unsupported point ref ${JSON.stringify(ref)}`);
}

function connectorRoutePoints(connector) {
  return [
    connector.begin,
    ...(connector.polyline_points ?? []),
    connector.end,
  ].filter(Boolean);
}

function routeEntryPoints(routeEntry) {
  if (Array.isArray(routeEntry) || routeEntry.kind) {
    return [resolvePointRef(routeEntry)];
  }

  const entry = typeof routeEntry === 'number' ? { id: routeEntry } : routeEntry;
  const points = connectorRoutePoints(getConnector(entry.id));
  return entry.reverse ? [...points].reverse() : points;
}

function buildRoutePoints(wire, route) {
  const start = absolutePortPoint(wire.from);
  const end = absolutePortPoint(wire.to);
  const routePoints = route.flatMap(routeEntryPoints).map(toCanvas);
  return compactCollinear(orthogonalJoin([start, ...routePoints, end]));
}

function absolutePortPoint(endpoint) {
  const component = getComponent(endpoint.component);
  const port = getPort(component, endpoint.port);
  if (!port.anchor) {
    throw new Error(`Port ${endpoint.component}.${endpoint.port} has no anchor`);
  }

  return {
    x: round(component.position.x + port.anchor.x),
    y: round(component.position.y + port.anchor.y),
  };
}

function shapeGeometryPoints(shape) {
  return [
    ...shapeCornerPoints(shape),
    ...(shape.connection_points ?? []).map((point) => point.abs),
  ];
}

function shapeCornerPoints(shape) {
  const width = Number(shape.width) || 0;
  const height = Number(shape.height) || 0;
  const angle = Number(shape.angle) || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => {
    const dx = x - width / 2;
    const dy = y - height / 2;
    return [
      Number(shape.pinx) + dx * cos - dy * sin,
      Number(shape.piny) + dx * sin + dy * cos,
    ];
  });
}

function getBounds(points) {
  if (points.length === 0) {
    throw new Error('Cannot compute bounds for empty point list');
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, Number(point[0])),
      maxX: Math.max(bounds.maxX, Number(point[0])),
      minY: Math.min(bounds.minY, Number(point[1])),
      maxY: Math.max(bounds.maxY, Number(point[1])),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function toCanvas(point) {
  return {
    x: round((Number(point[0]) - diagramBounds.minX) * SCALE + MARGIN),
    y: round((diagramBounds.maxY - Number(point[1])) * SCALE + MARGIN),
  };
}

function orthogonalJoin(points) {
  const joined = [];

  for (const point of points) {
    appendOrthogonal(joined, point);
  }

  return joined;
}

function appendOrthogonal(points, next) {
  const previous = points.at(-1);
  if (!previous) {
    points.push(next);
    return;
  }

  if (samePoint(previous, next)) {
    return;
  }

  if (sameNumber(previous.x, next.x) || sameNumber(previous.y, next.y)) {
    points.push(next);
    return;
  }

  points.push({ x: next.x, y: previous.y });
  points.push(next);
}

function compactCollinear(points) {
  const compacted = [];

  for (const point of points) {
    if (compacted.at(-1) && samePoint(compacted.at(-1), point)) {
      continue;
    }

    compacted.push(point);

    while (compacted.length >= 3) {
      const c = compacted[compacted.length - 1];
      const b = compacted[compacted.length - 2];
      const a = compacted[compacted.length - 3];

      if (
        (sameNumber(a.x, b.x) && sameNumber(b.x, c.x)) ||
        (sameNumber(a.y, b.y) && sameNumber(b.y, c.y))
      ) {
        compacted.splice(compacted.length - 2, 1);
        continue;
      }

      break;
    }
  }

  return compacted;
}

function samePoint(a, b) {
  return sameNumber(a.x, b.x) && sameNumber(a.y, b.y);
}

function sameNumber(a, b) {
  return Math.abs(a - b) <= EPSILON;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
