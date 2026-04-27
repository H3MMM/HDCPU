import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repoRoot, 'CPU-流水线图_连接线完整结构化提取.json');
const outputPath = path.join(repoRoot, 'src', 'config', 'pipeline-datapath.json');

const SCALE = 160;
const MARGIN = 36;
const EPSILON = 0.001;
const CONNECTOR_NAME_PATTERN = /Dynamic connector|动态连接线/;
const JUNCTION_NAME_PATTERN = /Junction|接合点/;
const HIDDEN_AUTOSHAPE_PATTERN = /^(Process|流程|Shape)\./;
const COMPONENT_TYPE_BY_SHAPE_ID = new Map([
  ['429', 'register-file'],
  ['451', 'memory'],
]);

const extraction = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const endpointShapeIds = new Set(
  extraction.connectors
    .flatMap((connector) => [connector.from_sheet_id, connector.to_sheet_id])
    .filter((shapeId) => shapeId !== null && shapeId !== undefined)
    .map(String)
);
const visibleShapes = extraction.shapes.filter(shouldCreateComponent);
const bounds = getBounds([
  ...visibleShapes.flatMap((shape) => componentBoundsPoints(shape)),
  ...extraction.connectors.flatMap((connector) => connectorRoutePoints(connector)),
]);
const components = [];
const componentsByShapeId = new Map();

for (const shape of visibleShapes) {
  const component = createShapeComponent(shape);
  components.push(component);
  componentsByShapeId.set(String(shape.shape_id), component);
}

const wires = extraction.connectors.map(createWire);

const config = {
  metadata: {
    name: 'RISC-V Pipeline CPU',
    type: 'pipeline',
    version: '1.0.0',
    canvasSize: {
      width: Math.ceil((bounds.maxX - bounds.minX) * SCALE + MARGIN * 2),
      height: Math.ceil((bounds.maxY - bounds.minY) * SCALE + MARGIN * 2),
    },
  },
  components,
  wires,
};

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

function shouldCreateComponent(shape) {
  if (isBlankConnectorShape(shape)) {
    return false;
  }

  if (endpointShapeIds.has(String(shape.shape_id))) {
    return true;
  }

  return hasVisibleText(shape) || !isConnectorLike(shape);
}

function createShapeComponent(shape) {
  if (isJunction(shape)) {
    const point = toCanvas([shape.pinx, shape.piny]);
    return {
      id: componentIdForShape(shape.shape_id),
      type: 'constant',
      label: shape.label || `Junction ${shape.shape_id}`,
      position: point,
      size: { width: 0, height: 0 },
      ports: [],
      portStyle: 'hidden',
      bodyHidden: true,
      hideLabel: true,
      hideSubtitle: true,
      hideDetail: true,
    };
  }

  const textOnly = shouldRenderAsTextOnly(shape);
  const text = normalizeText(shape.text || shape.label || `Shape ${shape.shape_id}`);
  const type = textOnly ? 'constant' : classifyComponentType(text, shape);
  const size = textOnly ? estimateTextSize(text) : shapeSize(shape);
  const position = textOnly
    ? centeredPosition([shape.pinx, shape.piny], size)
    : shapeTopLeft(shape);
  const component = {
    id: componentIdForShape(shape.shape_id),
    type,
    label: text,
    position,
    size,
    ports: [],
    skin: skinForType(type),
    portStyle: 'hidden',
    hideSubtitle: true,
    hideDetail: true,
  };

  if (text.includes('\n')) {
    component.labelLines = text.split('\n');
    component.labelLineGap = 17;
  }

  if (textOnly) {
    component.bodyHidden = true;
    component.labelFontSize = signalTypeForText(text) === 'control' ? 15 : 14;
    component.labelFontStyle = signalTypeForText(text) === 'control' ? 'italic' : 'normal';
    component.labelSignalType = signalTypeForText(text);
  }

  if (shouldHideShapeLabel(shape)) {
    component.hideLabel = true;
  }

  if (type === 'mux') {
    component.choiceLabels = splitChoiceLabels(text);
    component.hideLabel = true;
  }

  if (type === 'register' && isClockedRegisterShape(shape, text)) {
    component.clocked = true;
  }

  return component;
}

function createWire(connector) {
  const signalType = signalTypeForWire(connector);
  const beginPoint = toCanvas(connector.begin);
  const endPoint = toCanvas(connector.end);
  const from = endpointFor(connector, 'from', beginPoint, signalType);
  const to = endpointFor(connector, 'to', endPoint, signalType);
  const routePoints = (connector.polyline_points ?? []).map(toCanvas);
  const waypoints = stripEndpointDuplicates(routePoints, beginPoint, endPoint);

  return {
    id: `pipeline-wire-${connector.connector_id}`,
    from,
    to,
    busWidth: signalType === 'control' ? 1 : 32,
    signalType,
    kind: signalType === 'control' ? 'control' : 'data',
    waypoints,
  };
}

function endpointFor(connector, endpointName, canvasPoint, signalType) {
  const sheetId = endpointName === 'from' ? connector.from_sheet_id : connector.to_sheet_id;
  const targetCell = endpointName === 'from' ? connector.from_target_cell : connector.to_target_cell;
  const direction = endpointName === 'from' ? 'out' : 'in';

  if (!sheetId) {
    const anchorComponent = createAnchorComponent(connector.connector_id, endpointName, canvasPoint);
    components.push(anchorComponent);
    return {
      component: anchorComponent.id,
      port: direction,
    };
  }

  const component = componentsByShapeId.get(String(sheetId));
  if (!component) {
    throw new Error(`Missing shape component ${sheetId} for connector ${connector.connector_id}`);
  }

  const portName = portNameForCell(targetCell, direction);
  ensurePort(component, {
    name: portName,
    direction,
    position: inferPortSide(component, canvasPoint),
    side: inferPortSide(component, canvasPoint),
    anchor: {
      x: round(canvasPoint.x - component.position.x),
      y: round(canvasPoint.y - component.position.y),
    },
    busWidth: signalType === 'control' ? 1 : 32,
    signalType,
    hidden: true,
  });

  return {
    component: component.id,
    port: portName,
  };
}

function createAnchorComponent(connectorId, endpointName, canvasPoint) {
  return {
    id: `pipeline-wire-${connectorId}-${endpointName}`,
    type: 'constant',
    label: '',
    position: canvasPoint,
    size: { width: 0, height: 0 },
    ports: [
      {
        name: endpointName === 'from' ? 'out' : 'in',
        direction: endpointName === 'from' ? 'out' : 'in',
        position: endpointName === 'from' ? 'right' : 'left',
        anchor: { x: 0, y: 0 },
        busWidth: 32,
        signalType: 'data',
        hidden: true,
      },
    ],
    portStyle: 'hidden',
    bodyHidden: true,
    hideLabel: true,
    hideSubtitle: true,
    hideDetail: true,
  };
}

function ensurePort(component, portConfig) {
  const existing = component.ports.find((port) => port.name === portConfig.name);

  if (existing) {
    Object.assign(existing, portConfig);
    return;
  }

  component.ports.push(portConfig);
}

function classifyComponentType(text, shape) {
  const explicitType = COMPONENT_TYPE_BY_SHAPE_ID.get(String(shape.shape_id));
  if (explicitType) {
    return explicitType;
  }

  if (isMuxText(text)) {
    return 'mux';
  }

  if (text === 'ALU') {
    return 'alu';
  }

  if (text === 'ADD') {
    return 'adder';
  }

  if (/指令存储器|数据存储器/.test(text)) {
    return 'memory';
  }

  if (/寄存器堆|Regs/.test(text)) {
    return 'register-file';
  }

  if (/控制|CU|bcc|标志|转移分支/.test(text)) {
    return 'control';
  }

  if (text === '4') {
    return 'constant';
  }

  if (!hasVisibleText(shape) && Number(shape.width) > 0.7 && Number(shape.height) > 0.7) {
    return 'register-file';
  }

  return 'register';
}

function skinForType(type) {
  if (type === 'memory') {
    return 'textbook-memory';
  }

  if (type === 'register-file') {
    return 'textbook-register-file';
  }

  if (type === 'alu') {
    return 'textbook-alu';
  }

  if (type === 'adder') {
    return 'textbook-adder';
  }

  if (type === 'mux') {
    return 'textbook-mux';
  }

  if (type === 'control') {
    return 'textbook-control';
  }

  if (type === 'constant') {
    return 'textbook-constant';
  }

  return 'textbook-register';
}

function shouldRenderAsTextOnly(shape) {
  const text = normalizeText(shape.text || shape.label || '');

  if (!text) {
    return false;
  }

  if (isConnectorLike(shape)) {
    return true;
  }

  if (/^(IF-ID|ID-EX|EX-MEM|MEM-WB)$/.test(text)) {
    return true;
  }

  if (Math.abs(Number(shape.width) || 0) <= EPSILON || Math.abs(Number(shape.height) || 0) <= EPSILON) {
    return true;
  }

  return false;
}

function shouldHideShapeLabel(shape) {
  const text = normalizeText(shape.text || '');

  if (text) {
    return false;
  }

  return HIDDEN_AUTOSHAPE_PATTERN.test(String(shape.label));
}

function isClockedRegisterShape(shape, text) {
  if (text === 'PC') {
    return true;
  }

  return !hasVisibleText(shape) && Number(shape.height) > 1;
}

function isMuxText(text) {
  return /^\d+(?: \/ \d+)+$/.test(text) || text === 'M / D / R';
}

function splitChoiceLabels(text) {
  return text.split(' / ').filter(Boolean);
}

function signalTypeForWire(connector) {
  const haystack = [
    connector.label,
    connector.from_shape_label,
    connector.to_shape_label,
  ].filter(Boolean).join(' ');

  return signalTypeForText(haystack);
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

function inferPortSide(component, point) {
  const localX = point.x - component.position.x;
  const localY = point.y - component.position.y;
  const distances = [
    ['left', Math.abs(localX)],
    ['right', Math.abs(localX - component.size.width)],
    ['top', Math.abs(localY)],
    ['bottom', Math.abs(localY - component.size.height)],
  ];

  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

function portNameForCell(cell, fallback) {
  const match = String(cell ?? '').match(/Connections\.X(\d+)/);
  return match ? `x${match[1]}` : fallback;
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

function shapeSize(shape) {
  const shapeBounds = getBounds(shapeCornerPoints(shape));
  return {
    width: round((shapeBounds.maxX - shapeBounds.minX) * SCALE),
    height: round((shapeBounds.maxY - shapeBounds.minY) * SCALE),
  };
}

function shapeTopLeft(shape) {
  const shapeBounds = getBounds(shapeCornerPoints(shape));
  return toCanvas([shapeBounds.minX, shapeBounds.maxY]);
}

function centeredPosition(visioPoint, size) {
  const center = toCanvas(visioPoint);
  return {
    x: round(center.x - size.width / 2),
    y: round(center.y - size.height / 2),
  };
}

function estimateTextSize(text) {
  const lines = text.split('\n');
  const longestLine = lines.reduce((longest, line) => Math.max(longest, line.length), 1);

  return {
    width: Math.max(22, round(longestLine * 9.5)),
    height: Math.max(18, round(lines.length * 18)),
  };
}

function normalizeText(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').trim();
}

function isBlankConnectorShape(shape) {
  return isConnectorLike(shape) && !hasVisibleText(shape);
}

function isConnectorLike(shape) {
  return CONNECTOR_NAME_PATTERN.test(`${shape.label ?? ''} ${shape.nameu ?? ''}`);
}

function isJunction(shape) {
  return JUNCTION_NAME_PATTERN.test(`${shape.label ?? ''} ${shape.nameu ?? ''}`);
}

function hasVisibleText(shape) {
  return normalizeText(shape.text).length > 0;
}

function componentIdForShape(shapeId) {
  return `pipeline-shape-${shapeId}`;
}

function componentBoundsPoints(shape) {
  if (shouldRenderAsTextOnly(shape) || isJunction(shape)) {
    return [[shape.pinx, shape.piny]];
  }

  return shapeGeometryPoints(shape);
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
    (currentBounds, point) => ({
      minX: Math.min(currentBounds.minX, Number(point[0])),
      maxX: Math.max(currentBounds.maxX, Number(point[0])),
      minY: Math.min(currentBounds.minY, Number(point[1])),
      maxY: Math.max(currentBounds.maxY, Number(point[1])),
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
    x: round((Number(point[0]) - bounds.minX) * SCALE + MARGIN),
    y: round((bounds.maxY - Number(point[1])) * SCALE + MARGIN),
  };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
