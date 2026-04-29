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
  component('imm-gen', '555', 'imm-gen', '立即数生成', { labelOffset: { x: 0, y: 5 } }),
  component('id-ex', '471', 'register', 'ID/EX', { clocked: true, hideLabel: true }),
  component('alu-src-b', '444', 'mux', '0\n1', { choiceLabels: ['0', '1'], hideLabel: true, muxInputCount: 2 }),
  component('alu', '417', 'alu', 'ALU', { labelRotate: 90 }),
  component('branch-logic', '427', 'branch-logic', '标志\n与转移\n分支', {
    labelFontSize: 14,
    labelLineGap: 15,
  }),
  component('pc-mux', '460', 'mux', '2\n1\n0', { choiceLabels: ['2', '1', '0'], hideLabel: true, muxInputCount: 3 }),
  component('pc-plus4', '422', 'adder', 'ADD', { labelRotate: 90 }),
  component('branch-adder', '461', 'adder', 'ADD', { labelRotate: 90 }),
  component('ex-mem', '494', 'register', 'EX/MEM', { clocked: true, hideLabel: true }),
  component('data-mem', '451', 'memory', '数据存储器\nDM', { labelOffset: { x: 0, y: 8 } }),
  component('wb-mux', '459', 'mux', '0\n1\n2\n3\n4', {
    choiceLabels: ['0', '1', '2', '3', '4'],
    hideLabel: true,
    muxInputCount: 5,
  }),
  component('mem-wb', '525', 'register', 'MEM/WB', { clocked: true, hideLabel: true }),
  component('const-4', '425', 'constant', '4', {
    bodyHidden: true,
    hideSubtitle: true,
    hideDetail: true,
    labelSignalType: 'control',
    labelFontStyle: 'italic',
    labelFontSize: 17,
  }),
];

const PORT_LABEL_ANNOTATION_SHAPES = new Set([
  '413', '414', '430', '431', '432', '433', '434', '439', '440',
  '445', '446', '447', '452', '454', '455', '456',
  '487', '488',
]);
const PORT_LABEL_TARGETS = new Map(Object.entries({
  '413': portLabel('instr-mem', 'addr', 'inside'),
  '414': componentEdgeLabel('instr-mem', 'right', 'inside'),
  '430': portLabel('reg-file', 'write_enable', 'inside'),
  '431': portLabel('reg-file', 'rs1_addr', 'inside'),
  '432': portLabel('reg-file', 'rd_addr', 'inside'),
  '433': portLabel('reg-file', 'rs2_addr', 'inside'),
  '434': portLabel('reg-file', 'write_data', 'inside'),
  '439': portLabel('if-id', 'rs1', 'outside'),
  '440': portLabel('if-id', 'rs2', 'outside'),
  '445': portLabel('alu', 'a', 'inside'),
  '446': portLabel('alu', 'b', 'inside'),
  '447': portLabel('alu', 'result', 'inside'),
  '452': portLabel('data-mem', 'read_data', 'inside'),
  '454': portLabel('data-mem', 'write_enable', 'inside'),
  '455': portLabel('data-mem', 'addr', 'inside'),
  '456': portLabel('data-mem', 'write_data', 'inside'),
  '487': portLabel('reg-file', 'rd_a', 'inside'),
  '488': portLabel('reg-file', 'rd_b', 'inside'),
}));
const FIELD_ANNOTATION_SHAPES = new Set([
  '478', '479', '480', '485', '486', '489', '490',
  '496', '503', '506', '509', '513', '516', '520', '521',
  '527', '529', '539', '542', '546', '547', '549', '550', '551', '552',
]);
const STAGE_TITLE_SHAPES = new Set(['470', '504', '505', '526']);
const WIRE_LABEL_CONNECTOR_IDS = new Set([
  '437', '448', '472', '473', '498', '499', '508', '510',
  '517', '530', '535', '554',
]);
const WIRE_LABEL_OVERRIDES = new Map(Object.entries({
  '448': { rotate: 0 },
  '498': { rotate: 0 },
  '530': { segment: 'vertical', rotate: 0 },
}));

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
  wire('469', 'instr-mem-ir-to-if-id', endpoint('instr-mem', 'data_out'), endpoint('if-id', 'instruction_in'), 'data', 32, {
    allowInferred: true,
  }),
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
  wire('508', 'id-ex-imm32-to-ex-mem', endpoint('id-ex', 'imm32_out'), endpoint('ex-mem', 'imm32_in'), 'data', 32, {
    allowInferred: true,
  }),
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
  wire('558', 'imm-gen-offset-to-id-ex', endpoint('imm-gen', 'offset_out'), endpoint('id-ex', 'imm32_in'), 'data', 32, {
    allowInferred: true,
  }),
];

const extraction = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const shapesById = new Map(extraction.shapes.map((shape) => [String(shape.shape_id), shape]));
const connectorsById = new Map(extraction.connectors.map((connector) => [String(connector.connector_id), connector]));
const diagramBounds = getBounds([
  ...STRUCTURAL_COMPONENTS.flatMap((spec) => shapeGeometryPoints(getShape(spec.shapeId))),
  ...[...FIELD_ANNOTATION_SHAPES, ...PORT_LABEL_ANNOTATION_SHAPES, ...STAGE_TITLE_SHAPES]
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

const wires = createWires();
const annotations = createAnnotations();

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

function portLabel(componentId, port, placement) {
  return { kind: 'port', componentId, port, placement };
}

function componentEdgeLabel(componentId, side, placement) {
  return { kind: 'component-edge', componentId, side, placement };
}

function junction(shapeId) {
  return { kind: 'junction', shapeId: String(shapeId) };
}

function floating() {
  return { kind: 'floating' };
}

function wire(connectorId, id, from, to, signalType, busWidth = signalType === 'control' ? 1 : 32, extra = {}) {
  return { connectorId: String(connectorId), id: `pipeline-wire-${connectorId}-${id}`, from, to, signalType, busWidth, ...extra };
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
    'labelRotate',
    'labelSignalType',
    'labelFontStyle',
    'labelFontSize',
    'labelLineGap',
    'bodyHidden',
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
    const size = {
      width: round((bounds.maxX - bounds.minX) * SCALE),
      height: round((bounds.maxY - bounds.minY) * SCALE),
    };
    applyFieldLayoutOverride(shapeId, position, size);
    const text = normalizeFieldAnnotationText(normalizeText(shape.text));
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text,
      position,
      size,
      role: 'field',
      signalType: signalTypeForText(text),
      box: 'field',
      fontStyle: 'normal',
      lineGap: text.includes('\n') ? 15 : undefined,
    });
  }

  for (const shapeId of PORT_LABEL_ANNOTATION_SHAPES) {
    const shape = getShape(shapeId);
    const text = normalizeText(shape.text);
    const placement = getPortLabelPlacement(shapeId, shape);
    const signalType = signalTypeForText(text);
    result.push({
      id: `pipeline-annotation-${shapeId}`,
      text,
      position: placement.position,
      role: 'signal',
      signalType,
      box: 'none',
      fontSize: 15,
      fontStyle: signalType === 'control' ? 'italic' : 'normal',
      textAnchor: placement.textAnchor,
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

  return result;
}

function getPortLabelPlacement(shapeId, shape) {
  const target = PORT_LABEL_TARGETS.get(String(shapeId));
  if (!target) {
    return {
      position: toCanvas([shape.pinx, shape.piny]),
      textAnchor: 'middle',
    };
  }

  const componentConfig = componentsById.get(target.componentId);
  if (!componentConfig) {
    throw new Error(`Missing component ${target.componentId} for port label shape ${shapeId}`);
  }

  if (target.kind === 'component-edge') {
    const sourcePoint = toCanvas([shape.pinx, shape.piny]);
    return placeLabelNearSide(
      {
        x: target.side === 'left'
          ? componentConfig.position.x
          : target.side === 'right'
            ? componentConfig.position.x + componentConfig.size.width
            : sourcePoint.x,
        y: target.side === 'top'
          ? componentConfig.position.y
          : target.side === 'bottom'
            ? componentConfig.position.y + componentConfig.size.height
            : sourcePoint.y,
      },
      target.side,
      target.placement
    );
  }

  const port = componentConfig.ports.find((candidate) => candidate.name === target.port || candidate.id === target.port);
  if (!port?.anchor) {
    throw new Error(`Missing anchored port ${target.componentId}.${target.port} for label shape ${shapeId}`);
  }

  return placeLabelNearSide(
    {
      x: round(componentConfig.position.x + port.anchor.x),
      y: round(componentConfig.position.y + port.anchor.y),
    },
    port.side ?? port.position,
    target.placement
  );
}

function placeLabelNearSide(point, side, placement) {
  const sideGap = 14;
  const topInsideGap = 16;
  const bottomInsideGap = 8;
  const outsideGap = 12;
  const placeInside = placement === 'inside';

  if (side === 'left') {
    return {
      position: {
        x: round(point.x + (placeInside ? sideGap : -outsideGap)),
        y: round(point.y + 4),
      },
      textAnchor: placeInside ? 'start' : 'end',
    };
  }

  if (side === 'right') {
    return {
      position: {
        x: round(point.x + (placeInside ? -sideGap : outsideGap)),
        y: round(point.y + 4),
      },
      textAnchor: placeInside ? 'end' : 'start',
    };
  }

  if (side === 'top') {
    return {
      position: {
        x: round(point.x),
        y: round(point.y + (placeInside ? topInsideGap : -outsideGap)),
      },
      textAnchor: 'middle',
    };
  }

  return {
    position: {
      x: round(point.x),
      y: round(point.y + (placeInside ? -bottomInsideGap : 18)),
    },
    textAnchor: 'middle',
  };
}

function applyFieldLayoutOverride(shapeId, position, size) {
  if (String(shapeId) === '527') {
    size.height = round(size.height - 3);
    return;
  }

  if (String(shapeId) === '529') {
    position.y = round(position.y + 1);
    size.height = round(size.height - 2);
  }
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

      if (!hasFloatingEndpoint(spec) && spec.allowInferred !== true) {
        continue;
      }
    }

    const points = compactConsecutivePoints(routePoints.map(toCanvas));
    const from = ensureEndpointPort(spec.from, connector, 'from', spec.signalType, spec.busWidth);
    const to = ensureEndpointPort(spec.to, connector, 'to', spec.signalType, spec.busWidth);
    const waypoints = stripEndpointDuplicates(points, points[0], points[points.length - 1]);
    const label = getWireLabel(connector);
    const labelPlacement = label ? getWireLabelPlacement(connector, points) : null;

    const wireConfig = {
      id: spec.id,
      from,
      to,
      busWidth: spec.busWidth,
      signalType: spec.signalType,
      kind: spec.signalType === 'control' ? 'control' : 'data',
      waypoints,
      nonOrthogonal: connector.nonOrthogonal === true || !isSafePolyline(routePoints),
    };

    if (label && labelPlacement) {
      wireConfig.label = label;
      wireConfig.labelSignalType = signalTypeForText(label);
      wireConfig.labelPosition = labelPlacement.position;
      if (labelPlacement.rotate !== 0) {
        wireConfig.labelRotate = labelPlacement.rotate;
      }
    }

    result.push(wireConfig);
  }

  return result;
}

function getWireLabel(connector) {
  if (!WIRE_LABEL_CONNECTOR_IDS.has(String(connector.connector_id))) {
    return undefined;
  }

  const text = normalizeText(connector.text ?? connector.label);
  return text.length > 0 ? text : undefined;
}

function getWireLabelPlacement(connector, points) {
  if (points.length === 0) {
    return null;
  }

  const override = WIRE_LABEL_OVERRIDES.get(String(connector.connector_id));
  const connectorShape = shapesById.get(String(connector.connector_id));
  const preferredPoint = connectorShape
    ? toCanvas([connectorShape.pinx, connectorShape.piny])
    : polylineMidpoint(points);
  const projection = override?.segment === 'vertical'
    ? projectPointToMatchingSegments(preferredPoint, points, 'vertical') ?? projectPointToPolyline(preferredPoint, points)
    : projectPointToPolyline(preferredPoint, points);

  if (!projection) {
    return {
      position: preferredPoint,
      rotate: override?.rotate ?? 0,
    };
  }

  return {
    position: projection.point,
    rotate: override?.rotate ?? projection.angle,
  };
}

function projectPointToMatchingSegments(point, points, orientation) {
  const filteredPoints = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const isVertical = Math.abs(from.x - to.x) <= EPSILON;
    const isHorizontal = Math.abs(from.y - to.y) <= EPSILON;
    if (
      (orientation === 'vertical' && isVertical) ||
      (orientation === 'horizontal' && isHorizontal)
    ) {
      filteredPoints.push([from, to]);
    }
  }

  let best = null;
  for (const [from, to] of filteredPoints) {
    const projection = projectPointToPolyline(point, [from, to]);
    if (!projection) {
      continue;
    }

    if (!best || projection.distanceSquared < best.distanceSquared) {
      best = projection;
    }
  }

  return best;
}

function projectPointToPolyline(point, points) {
  let best = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= EPSILON) {
      continue;
    }

    const ratio = Math.min(
      Math.max(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0),
      1
    );
    const projected = {
      x: round(from.x + dx * ratio),
      y: round(from.y + dy * ratio),
    };
    const distanceSquared = (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2;
    const rawAngle = Math.abs(dx) <= EPSILON && Math.abs(dy) > EPSILON
      ? -90
      : Math.abs(dy) <= EPSILON
        ? 0
        : round((Math.atan2(dy, dx) * 180) / Math.PI);
    const angle = Math.abs(rawAngle) <= 1 || Math.abs(Math.abs(rawAngle) - 180) <= 1 ? 0 : rawAngle;

    if (!best || distanceSquared < best.distanceSquared) {
      best = {
        point: projected,
        distanceSquared,
        angle,
      };
    }
  }

  return best;
}

function polylineMidpoint(points) {
  if (points.length === 1) {
    return points[0];
  }

  const lengths = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    lengths.push(length);
    totalLength += length;
  }

  const targetLength = totalLength / 2;
  let walked = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (walked + segmentLength < targetLength) {
      walked += segmentLength;
      continue;
    }

    const from = points[index];
    const to = points[index + 1];
    const ratio = segmentLength <= EPSILON ? 0 : (targetLength - walked) / segmentLength;
    return {
      x: round(from.x + (to.x - from.x) * ratio),
      y: round(from.y + (to.y - from.y) * ratio),
    };
  }

  return points.at(-1);
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

function normalizeFieldAnnotationText(text) {
  if (text === '控制信号') {
    return '控制\n信号';
  }

  if (text === '偏移地址') {
    return '偏移\n地址';
  }

  if (text === '分支目标地址') {
    return '分支\n目标\n地址';
  }

  return text;
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
