import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourcePath = firstExistingPath([
  path.join(repoRoot, 'CPU-流水线图_连接线完整结构化提取.json'),
  path.join(repoRoot, 'CPU-娴佹按绾垮浘_杩炴帴绾垮畬鏁寸粨鏋勫寲鎻愬彇.json'),
]);
const outputPath = path.join(repoRoot, 'src', 'config', 'pipeline-datapath.json');

const SCALE = 160;
const MARGIN = 36;
const EPSILON = 0.001;
const ORTHOGONAL_TOLERANCE_IN = 0.012;

const STRUCTURAL_COMPONENTS = [
  component('pc', '415', 'register', 'PC', { clocked: true }),
  component('instr-mem', '412', 'memory', '指令存储器\nIM'),
  component('if-id', '416', 'register', 'IF/ID', { clocked: true, hideLabel: true }),
  component('control-unit', '443', 'control', '译码及控制单元\nCU'),
  component('reg-file', '429', 'register-file', '寄存器堆\nRegs', { labelOffset: { x: 0, y: 8 } }),
  component('imm-gen', '555', 'imm-gen', '立即数生成'),
  component('id-ex', '471', 'register', 'ID/EX', { clocked: true, hideLabel: true }),
  component('alu-src-b', '444', 'mux', '0\n1', { choiceLabels: ['0', '1'], hideLabel: true, muxInputCount: 2 }),
  component('alu', '417', 'alu', 'ALU'),
  component('branch-logic', '427', 'branch-logic', '标志\n与转移分支'),
  component('pc-mux', '460', 'mux', '2\n1\n0', { choiceLabels: ['2', '1', '0'], hideLabel: true, muxInputCount: 3 }),
  component('pc-plus4', '422', 'adder', 'ADD'),
  component('branch-adder', '461', 'adder', 'ADD'),
  component('ex-mem', '494', 'register', 'EX/MEM', { clocked: true, hideLabel: true }),
  component('data-mem', '451', 'memory', '数据存储器\nDM', { labelOffset: { x: 0, y: 8 } }),
  component('wb-mux', '459', 'mux', '0\n1\n2\n3\n4', {
    choiceLabels: ['0', '1', '2', '3', '4'],
    hideLabel: true,
    muxInputCount: 5,
  }),
  component('mem-wb', '525', 'register', 'MEM/WB', { clocked: true, hideLabel: true }),
  component('const-4', '425', 'constant', '4', {
    hideSubtitle: true,
    hideDetail: true,
    labelSignalType: 'control',
    labelFontStyle: 'italic',
    labelFontSize: 16,
  }),
];

const PORT_LABEL_ANNOTATION_SHAPES = new Set([
  '413', '414', '430', '431', '432', '433', '434', '439', '440',
  '445', '446', '447', '452', '454', '455', '456',
  '487', '488',
]);
const FIELD_ANNOTATION_SHAPES = new Set([
  '478', '479', '480', '485', '486', '489', '490',
  '496', '503', '506', '509', '513', '516', '520', '521',
  '527', '529', '539', '542', '546', '547', '549', '550', '551', '552',
]);
const STAGE_TITLE_SHAPES = new Set(['470', '504', '505', '526']);
const SIGNAL_ANNOTATION_SHAPES = new Set([
  '437', '448', '472', '473', '498', '499', '508', '510',
  '517', '530', '535', '554',
]);

const WIRE_SPECS = [
  wire('418', 'pc-to-instr-mem-addr', endpoint('pc', 'out'), endpoint('instr-mem', 'addr'), 'address'),
  wire('419', 'bypass-b-to-ex-mem', junction('428'), endpoint('ex-mem', 'store_data_in'), 'data'),
  wire('420', 'alu-src-b-to-alu-b', endpoint('alu-src-b', 'out'), endpoint('alu', 'b'), 'data'),
  wire('423', 'pc-line-to-pc-plus4', junction('421'), endpoint('pc-plus4', 'a'), 'address'),
  wire('424', 'const4-to-pc-plus4', endpoint('const-4', 'out'), endpoint('pc-plus4', 'b'), 'data', 32),
  wire('426', 'pc-plus4-to-pc-mux', endpoint('pc-plus4', 'out'), endpoint('pc-mux', 'in2'), 'address'),
  wire('435', 'if-id-rs1-to-regfile', endpoint('if-id', 'rs1'), endpoint('reg-file', 'rs1_addr'), 'data'),
  wire('436', 'if-id-rs2-to-regfile', endpoint('if-id', 'rs2'), endpoint('reg-file', 'rs2_addr'), 'data'),
  wire('437', 'if-id-rd-to-id-ex', endpoint('if-id', 'rd'), endpoint('id-ex', 'rd_in'), 'data'),
  wire('441', 'if-id-ir-to-control', endpoint('if-id', 'instruction'), endpoint('control-unit', 'instruction'), 'control', 1),
  wire('448', 'mem-wb-control-to-wb-mux', endpoint('mem-wb', 'wb_select'), endpoint('wb-mux', 'select'), 'control', 1),
  wire('449', 'ex-mem-b-to-data-mem-write-data', endpoint('ex-mem', 'store_data_out'), endpoint('data-mem', 'write_data'), 'data'),
  wire('453', 'data-mem-read-to-mem-wb', endpoint('data-mem', 'read_data'), endpoint('mem-wb', 'mem_data_in'), 'data'),
  wire('457', 'id-ex-imm32-to-alu-src-b', junction('468'), endpoint('alu-src-b', 'in1'), 'data'),
  wire('458', 'ex-mem-alu-result-to-data-mem', endpoint('ex-mem', 'alu_result_out'), endpoint('data-mem', 'addr'), 'address'),
  wire('465', 'branch-target-to-pc-mux', endpoint('ex-mem', 'pc_select'), endpoint('pc-mux', 'in1'), 'address'),
  wire('466', 'pc-mux-to-pc', endpoint('pc-mux', 'out'), endpoint('pc', 'in'), 'address'),
  wire('467', 'mem-wb-alu-result-to-wb-mux', endpoint('mem-wb', 'alu_result_out'), endpoint('wb-mux', 'in1'), 'data'),
  wire('472', 'if-id-pc4-to-id-ex', endpoint('if-id', 'pc4_out'), endpoint('id-ex', 'pc4_in'), 'address'),
  wire('473', 'if-id-pc0-to-id-ex', endpoint('if-id', 'pc0_out'), endpoint('id-ex', 'pc0_in'), 'address'),
  wire('474', 'pc4-entry-to-if-id', junction('476'), endpoint('if-id', 'pc4_in'), 'address'),
  wire('475', 'pc0-entry-to-if-id', junction('477'), endpoint('if-id', 'pc0_in'), 'address'),
  wire('491', 'regfile-rd-b-to-id-ex', endpoint('reg-file', 'rd_b'), endpoint('id-ex', 'b_in'), 'data'),
  wire('492', 'regfile-rd-a-to-id-ex', endpoint('reg-file', 'rd_a'), endpoint('id-ex', 'a_in'), 'data'),
  wire('493', 'id-ex-b-to-alu-src-b', endpoint('id-ex', 'b_out'), endpoint('alu-src-b', 'in0'), 'data'),
  wire('495', 'id-ex-pc0-to-branch-adder', endpoint('id-ex', 'pc0_for_branch'), endpoint('branch-adder', 'pc0'), 'address'),
  wire('497', 'id-ex-imm32-to-branch-adder', junction('468'), endpoint('branch-adder', 'imm32'), 'data'),
  wire('498', 'id-ex-rs2-imm-select-to-mux', endpoint('id-ex', 'rs2_imm_select'), endpoint('alu-src-b', 'select'), 'control', 1),
  wire('499', 'id-ex-alu-op-to-alu', endpoint('id-ex', 'alu_op'), endpoint('alu', 'op'), 'control', 1),
  wire('500', 'alu-result-to-ex-mem', endpoint('alu', 'result'), endpoint('ex-mem', 'alu_result_in'), 'data'),
  wire('501', 'id-ex-a-to-alu', endpoint('id-ex', 'a_out'), endpoint('alu', 'a'), 'data'),
  wire('507', 'wb-mux-to-regfile-write-data', endpoint('wb-mux', 'out'), endpoint('reg-file', 'write_data'), 'data'),
  wire('510', 'id-ex-bcc-to-branch-logic', junction('524'), endpoint('branch-logic', 'branch_control'), 'control', 1),
  wire('512', 'alu-flag-to-branch-logic', junction('450'), endpoint('branch-logic', 'alu_flag'), 'control', 1),
  wire('514', 'alu-branch-flag-to-branch-logic', junction('438'), endpoint('branch-logic', 'flag_in'), 'control', 1),
  wire('517', 'id-ex-pc4-to-ex-mem', endpoint('id-ex', 'pc4_out'), endpoint('ex-mem', 'pc4_in'), 'address'),
  wire('518', 'branch-adder-output-stub', endpoint('branch-adder', 'out'), floating(), 'address'),
  wire('530', 'ex-mem-mem-write-to-data-mem', junction('533'), endpoint('data-mem', 'write_enable'), 'control', 1),
  wire('531', 'id-ex-control-to-ex-mem', endpoint('id-ex', 'control_out'), endpoint('ex-mem', 'control_in'), 'control', 1),
  wire('535', 'pc-select-to-pc-mux', junction('534'), endpoint('pc-mux', 'select'), 'control', 1),
  wire('536', 'ex-mem-feedback-to-pc-mux', junction('464'), endpoint('pc-mux', 'in0'), 'address'),
  wire('538', 'branch-adder-to-branch-logic', junction('537'), endpoint('branch-logic', 'branch_target_in'), 'address'),
  wire('540', 'mem-wb-read-data-to-wb-mux', endpoint('mem-wb', 'mem_data_out'), endpoint('wb-mux', 'in0'), 'data'),
  wire('541', 'mem-wb-imm32-to-wb-mux', endpoint('mem-wb', 'imm32_out'), endpoint('wb-mux', 'in2'), 'data'),
  wire('543', 'ex-mem-pc4-to-mem-wb', endpoint('ex-mem', 'pc4_out'), endpoint('mem-wb', 'pc4_in'), 'address'),
  wire('544', 'mem-wb-pc4-to-wb-mux', endpoint('mem-wb', 'pc4_out'), endpoint('wb-mux', 'in3'), 'address'),
  wire('548', 'mem-wb-offset-to-wb-mux', endpoint('mem-wb', 'offset_out'), endpoint('wb-mux', 'in4'), 'data'),
  wire('553', 'mem-wb-rd-to-regfile-wa', endpoint('mem-wb', 'rd_out'), endpoint('reg-file', 'rd_addr'), 'data'),
  wire('554', 'mem-wb-reg-write-to-regfile', endpoint('mem-wb', 'reg_write_out'), endpoint('reg-file', 'write_enable'), 'control', 1),
  wire('557', 'if-id-imm-to-imm-gen', junction('556'), endpoint('imm-gen', 'instruction'), 'data'),
];

const extraction = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const shapesById = new Map(extraction.shapes.map((shape) => [String(shape.shape_id), shape]));
const connectorsById = new Map(extraction.connectors.map((connector) => [String(connector.connector_id), connector]));
const diagramBounds = getBounds([
  ...STRUCTURAL_COMPONENTS.flatMap((spec) => shapeGeometryPoints(getShape(spec.shapeId))),
  ...[...FIELD_ANNOTATION_SHAPES, ...PORT_LABEL_ANNOTATION_SHAPES, ...STAGE_TITLE_SHAPES, ...SIGNAL_ANNOTATION_SHAPES]
    .map((shapeId) => getShape(shapeId))
    .flatMap(shapeGeometryPoints),
  ...extraction.connectors.flatMap(connectorRoutePoints),
]);

const components = [];
const componentsById = new Map();
const unsafeConnectors = [];

for (const spec of STRUCTURAL_COMPONENTS) {
  const built = createComponentFromShape(spec);
  components.push(built);
  componentsById.set(built.id, built);
}

const annotations = createAnnotations();
const wires = createWires();

const config = {
  metadata: {
    name: 'RISC-V Pipeline CPU',
    type: 'pipeline',
    version: '2.0.0',
    canvasSize: {
      width: Math.ceil((diagramBounds.maxX - diagramBounds.minX) * SCALE + MARGIN * 2),
      height: Math.ceil((diagramBounds.maxY - diagramBounds.minY) * SCALE + MARGIN * 2),
    },
    unsafeConnectors,
  },
  components,
  wires,
  annotations,
};

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

function component(id, shapeId, type, label, extra = {}) {
  return { id, shapeId, type, label, ...extra };
}

function endpoint(componentId, port) {
  return { kind: 'component', componentId, port };
}

function junction(shapeId) {
  return { kind: 'junction', shapeId: String(shapeId) };
}

function floating() {
  return { kind: 'floating' };
}

function wire(connectorId, id, from, to, signalType, busWidth = signalType === 'control' ? 1 : 32) {
  return { connectorId: String(connectorId), id: `pipeline-wire-${connectorId}-${id}`, from, to, signalType, busWidth };
}

function firstExistingPath(candidates) {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Missing pipeline extraction JSON. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

function createComponentFromShape(spec) {
  const shape = getShape(spec.shapeId);
  const bounds = getBounds(shapeCornerPoints(shape));
  const position = toCanvas([bounds.minX, bounds.maxY]);
  const size = {
    width: round((bounds.maxX - bounds.minX) * SCALE),
    height: round((bounds.maxY - bounds.minY) * SCALE),
  };
  const skin = {
    register: 'textbook-register',
    memory: 'textbook-memory',
    'register-file': 'textbook-register-file',
    alu: 'textbook-alu',
    adder: 'textbook-adder',
    mux: 'textbook-mux',
    control: 'textbook-control',
    'imm-gen': 'textbook-decoder',
    'branch-logic': 'textbook-control',
    constant: 'textbook-constant',
  }[spec.type];
  const componentConfig = {
    id: spec.id,
    type: spec.type,
    label: spec.label,
    position,
    size,
    ports: [],
    skin,
    portStyle: 'hidden',
    portLabelPlacement: 'inside',
    hideSubtitle: true,
    hideDetail: true,
  };

  if (spec.label.includes('\n')) {
    componentConfig.labelLines = spec.label.split('\n');
    componentConfig.labelLineGap = 17;
  }

  for (const key of [
    'clocked',
    'hideLabel',
    'choiceLabels',
    'muxInputCount',
    'labelOffset',
    'labelSignalType',
    'labelFontStyle',
    'labelFontSize',
  ]) {
    if (spec[key] !== undefined) {
      componentConfig[key] = spec[key];
    }
  }

  return componentConfig;
}

function createAnnotations() {
  const result = [];

  for (const shapeId of FIELD_ANNOTATION_SHAPES) {
    const shape = getShape(shapeId);
    const bounds = getBounds(shapeCornerPoints(shape));
    const position = toCanvas([bounds.minX, bounds.maxY]);
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text: normalizeText(shape.text),
      position,
      size: {
        width: round((bounds.maxX - bounds.minX) * SCALE),
        height: round((bounds.maxY - bounds.minY) * SCALE),
      },
      role: 'field',
      signalType: signalTypeForText(shape.text),
      box: 'field',
    });
  }

  for (const shapeId of PORT_LABEL_ANNOTATION_SHAPES) {
    const shape = getShape(shapeId);
    const text = normalizeText(shape.text);
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text,
      position: toCanvas([shape.pinx, shape.piny]),
      role: 'signal',
      signalType: signalTypeForText(text),
      box: 'none',
      fontSize: signalTypeForText(text) === 'control' ? 13 : 12,
      fontStyle: signalTypeForText(text) === 'control' ? 'italic' : 'normal',
    });
  }

  for (const shapeId of STAGE_TITLE_SHAPES) {
    const shape = getShape(shapeId);
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text: normalizeText(shape.text),
      position: toCanvas([shape.pinx, shape.piny]),
      role: 'stage-title',
      box: 'none',
      fontSize: 15,
      fontWeight: 750,
    });
  }

  for (const shapeId of SIGNAL_ANNOTATION_SHAPES) {
    const shape = getShape(shapeId);
    const text = normalizeText(shape.text);
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text,
      position: toCanvas([shape.pinx, shape.piny]),
      role: 'signal',
      signalType: signalTypeForText(text),
      box: 'none',
      fontSize: signalTypeForText(text) === 'control' ? 13 : 12,
      fontStyle: signalTypeForText(text) === 'control' ? 'italic' : 'normal',
    });
  }

  return result;
}

function createWires() {
  const result = [];
  const mappedConnectorIds = new Set(WIRE_SPECS.map((spec) => spec.connectorId));

  for (const connector of extraction.unsafeConnectors ?? []) {
    addUnsafeConnector({
      connectorId: connector.connectorId,
      reason: connector.reason,
      fromShapeId: connector.fromShapeId,
      toShapeId: connector.toShapeId,
    });
  }

  for (const connector of extraction.connectors) {
    if (!mappedConnectorIds.has(String(connector.connector_id))) {
      addUnsafeConnector({
        connectorId: String(connector.connector_id),
        reason: connector.endpoint_status === 'complete'
          ? 'complete connector is not mapped to a structural CPU unit'
          : connector.endpoint_status === 'single'
            ? 'connector has only one endpoint binding in the VSDX Connect table'
            : 'connector has no endpoint binding in the VSDX Connect table',
        fromShapeId: stringOrUndefined(connector.from_sheet_id),
        toShapeId: stringOrUndefined(connector.to_sheet_id),
      });
    }
  }

  for (const spec of WIRE_SPECS) {
    const connector = getConnector(spec.connectorId);
    const routePoints = connectorRoutePoints(connector);

    if (connector.endpoint_status !== 'complete') {
      addUnsafeConnector({
        connectorId: spec.connectorId,
        reason: connector.endpoint_status === 'single'
          ? 'connector has only one endpoint binding in the VSDX Connect table'
          : 'connector has no endpoint binding in the VSDX Connect table',
        fromShapeId: stringOrUndefined(connector.from_sheet_id),
        toShapeId: stringOrUndefined(connector.to_sheet_id),
      });

      if (!hasFloatingEndpoint(spec)) {
        continue;
      }
    }

    const points = compactConsecutivePoints(routePoints.map(toCanvas));
    const from = ensureEndpointPort(spec.from, connector, 'from', spec.signalType, spec.busWidth);
    const to = ensureEndpointPort(spec.to, connector, 'to', spec.signalType, spec.busWidth);
    const waypoints = stripEndpointDuplicates(points, points[0], points[points.length - 1]);

    result.push({
      id: spec.id,
      from,
      to,
      busWidth: spec.busWidth,
      signalType: spec.signalType,
      kind: spec.signalType === 'control' ? 'control' : 'data',
      waypoints,
      nonOrthogonal: connector.nonOrthogonal === true || !isSafePolyline(routePoints),
    });
  }

  return result;
}

function hasFloatingEndpoint(spec) {
  return spec.from.kind === 'floating' || spec.to.kind === 'floating';
}

function addUnsafeConnector(connector) {
  if (unsafeConnectors.some((candidate) => candidate.connectorId === connector.connectorId)) {
    return;
  }

  unsafeConnectors.push(connector);
}

function ensureEndpointPort(ref, connector, endpointName, signalType, busWidth) {
  const point = toCanvas(endpointName === 'from' ? connector.begin : connector.end);
  const direction = endpointName === 'from' ? 'out' : 'in';

  if (ref.kind === 'junction') {
    const id = `pipeline-junction-${ref.shapeId}`;
    let componentConfig = componentsById.get(id);

    if (!componentConfig) {
      componentConfig = {
        id,
        type: 'constant',
        label: '',
        position: point,
        size: { width: 0, height: 0 },
        ports: [],
        portStyle: 'hidden',
        bodyHidden: true,
        hideLabel: true,
        hideSubtitle: true,
        hideDetail: true,
      };
      components.push(componentConfig);
      componentsById.set(id, componentConfig);
    }

    const portName = `${connector.connector_id}-${endpointName}`;
    ensurePort(componentConfig, {
      id: portName,
      name: portName,
      direction,
      position: direction === 'out' ? 'right' : 'left',
      side: direction === 'out' ? 'right' : 'left',
      anchor: { x: 0, y: 0 },
      busWidth,
      signalType,
      hidden: true,
    });
    return { component: id, port: portName };
  }

  if (ref.kind === 'floating') {
    const id = `pipeline-floating-${connector.connector_id}-${endpointName}`;
    const portName = `${connector.connector_id}-${endpointName}`;
    const componentConfig = {
      id,
      type: 'constant',
      label: '',
      position: point,
      size: { width: 0, height: 0 },
      ports: [
        {
          id: portName,
          name: portName,
          direction,
          position: direction === 'out' ? 'right' : 'left',
          side: direction === 'out' ? 'right' : 'left',
          anchor: { x: 0, y: 0 },
          busWidth,
          signalType,
          hidden: true,
        },
      ],
      portStyle: 'hidden',
      bodyHidden: true,
      hideLabel: true,
      hideSubtitle: true,
      hideDetail: true,
    };

    components.push(componentConfig);
    componentsById.set(id, componentConfig);
    return { component: id, port: portName };
  }

  const componentConfig = componentsById.get(ref.componentId);
  if (!componentConfig) {
    throw new Error(`Missing component ${ref.componentId} for connector ${connector.connector_id}`);
  }

  const side = inferPortSide(componentConfig, point);
  ensurePort(componentConfig, {
    id: ref.port,
    name: ref.port,
    direction,
    position: side,
    side,
    anchor: {
      x: round(point.x - componentConfig.position.x),
      y: round(point.y - componentConfig.position.y),
    },
    busWidth,
    signalType,
    hidden: true,
  });

  return { component: ref.componentId, port: ref.port };
}

function ensurePort(componentConfig, portConfig) {
  const existing = componentConfig.ports.find((port) => port.id === portConfig.id || port.name === portConfig.name);
  if (existing) {
    Object.assign(existing, portConfig);
    return;
  }

  componentConfig.ports.push(portConfig);
}

function inferPortSide(componentConfig, point) {
  const localX = point.x - componentConfig.position.x;
  const localY = point.y - componentConfig.position.y;
  const distances = [
    ['left', Math.abs(localX)],
    ['right', Math.abs(localX - componentConfig.size.width)],
    ['top', Math.abs(localY)],
    ['bottom', Math.abs(localY - componentConfig.size.height)],
  ];

  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

function isSafePolyline(points) {
  const compacted = compactConsecutivePoints(points.map((point) => ({ x: Number(point[0]), y: Number(point[1]) })));
  for (let index = 0; index < compacted.length - 1; index += 1) {
    const from = compacted[index];
    const to = compacted[index + 1];
    if (
      Math.abs(from.x - to.x) > ORTHOGONAL_TOLERANCE_IN &&
      Math.abs(from.y - to.y) > ORTHOGONAL_TOLERANCE_IN
    ) {
      return false;
    }
  }

  return true;
}

function stripEndpointDuplicates(points, start, end) {
  return points
    .filter((point, index) => {
      if (index === 0 && samePoint(point, start)) {
        return false;
      }

      if (index === points.length - 1 && samePoint(point, end)) {
        return false;
      }

      return true;
    })
    .filter((point, index, allPoints) => index === 0 || !samePoint(point, allPoints[index - 1]));
}

function compactConsecutivePoints(points) {
  return points.filter((point, index, allPoints) => index === 0 || !samePoint(point, allPoints[index - 1]));
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

function connectorRoutePoints(connector) {
  return [
    connector.begin,
    ...(connector.polyline_points ?? []),
    connector.end,
  ].filter(Boolean);
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

function signalTypeForText(text) {
  if (/控制|Write|ALU_OP|PC_s|rs2_imm_s|w_data_s|bcc|Mem_Write|Reg_Write|_s/.test(text)) {
    return 'control';
  }

  if (/PC|地址|IM_A|DM_A/.test(text)) {
    return 'address';
  }

  return 'data';
}

function normalizeText(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').trim();
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function stringOrUndefined(value) {
  return value === null || value === undefined ? undefined : String(value);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
