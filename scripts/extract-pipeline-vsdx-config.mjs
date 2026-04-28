import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const vsdxPath = path.join(repoRoot, 'CPU-流水线图.vsdx');
const outputPath = path.join(repoRoot, 'CPU-流水线图_连接线完整结构化提取.json');
const PAGE_XML_PATH = 'visio/pages/page1.xml';
const EPSILON = 0.001;
const ORTHOGONAL_TOLERANCE_IN = 0.012;
const KNOWN_NON_ORTHOGONAL_CONNECTOR_IDS = new Set([
  '426',
  '448',
  '465',
  '466',
  '475',
  '498',
  '499',
  '548',
  '553',
  '554',
]);

const pageXml = readZipText(vsdxPath, PAGE_XML_PATH);
const shapes = parseShapes(pageXml);
const shapesById = new Map(shapes.map((shape) => [String(shape.shape_id), shape]));
const connects = parseConnects(pageXml);
const connectsByShapeAndCell = new Map(connects.map((connect) => [`${connect.from_sheet}:${connect.from_cell}`, connect]));
const connectors = shapes
  .filter((shape) => shape.has_one_d_cells)
  .map(createConnector)
  .sort((a, b) => Number(a.connector_id) - Number(b.connector_id));
const unsafeConnectors = connectors
  .filter((connector) => connector.endpoint_status !== 'complete')
  .map((connector) => ({
    connectorId: String(connector.connector_id),
    reason:
      connector.endpoint_status === 'single'
        ? 'connector has only one endpoint binding in the VSDX Connect table'
        : 'connector has no endpoint binding in the VSDX Connect table',
    fromShapeId: connector.from_sheet_id === null ? undefined : String(connector.from_sheet_id),
    toShapeId: connector.to_sheet_id === null ? undefined : String(connector.to_sheet_id),
  }));

const summary = {
  vsdxOneDConnectorCount: connectors.length,
  jsonConnectorCount: connectors.length,
  completeEndpointConnectorCount: connectors.filter((connector) => connector.endpoint_status === 'complete').length,
  singleEndpointConnectorCount: connectors.filter((connector) => connector.endpoint_status === 'single').length,
  noEndpointConnectorCount: connectors.filter((connector) => connector.endpoint_status === 'none').length,
  nonOrthogonalConnectorCount: connectors.filter((connector) => connector.nonOrthogonal).length,
};

const extraction = {
  metadata: {
    source: path.basename(vsdxPath),
    pageXml: PAGE_XML_PATH,
  },
  summary,
  shapes,
  connectors,
  unsafeConnectors,
};

fs.writeFileSync(outputPath, `${JSON.stringify(extraction, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));

function readZipText(zipPath, entryName) {
  const archive = fs.readFileSync(zipPath);
  const entry = readZipEntry(archive, entryName);
  return entry.toString('utf8');
}

function readZipEntry(buffer, entryName) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory at ${offset}`);
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    if (fileName === entryName) {
      return inflateZipEntry(buffer, localHeaderOffset, compressedSize, compressionMethod);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`Missing ZIP entry ${entryName}`);
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error('Invalid ZIP: missing end of central directory');
}

function inflateZipEntry(buffer, localHeaderOffset, compressedSize, compressionMethod) {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header at ${localHeaderOffset}`);
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    return compressed;
  }

  if (compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
}

function parseShapes(xml) {
  const result = [];
  const shapeRegex = /<Shape\b([^>]*)>([\s\S]*?)<\/Shape>/g;
  let match;

  while ((match = shapeRegex.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    const body = match[2];
    const directCells = parseCells(body.split(/<Section\b|<Text\b/)[0]);
    const connectionPoints = parseConnectionPoints(body, directCells);
    const geometryPoints = parseGeometryPoints(body, directCells);
    const text = parseText(body);
    const label = text || attrs.NameU || attrs.Name || `Shape.${attrs.ID}`;

    result.push({
      shape_id: Number(attrs.ID),
      nameu: attrs.NameU ?? '',
      name: attrs.Name ?? '',
      label,
      text,
      type: attrs.Type ?? '',
      master: attrs.Master ?? '',
      pinx: numberValue(directCells.PinX),
      piny: numberValue(directCells.PinY),
      width: numberValue(directCells.Width),
      height: numberValue(directCells.Height),
      locpinx: numberValue(directCells.LocPinX),
      locpiny: numberValue(directCells.LocPinY),
      angle: numberValue(directCells.Angle),
      beginx: numberValue(directCells.BeginX),
      beginy: numberValue(directCells.BeginY),
      endx: numberValue(directCells.EndX),
      endy: numberValue(directCells.EndY),
      has_one_d_cells:
        directCells.BeginX !== undefined &&
        directCells.BeginY !== undefined &&
        directCells.EndX !== undefined &&
        directCells.EndY !== undefined,
      connection_points: connectionPoints,
      geometry_points: geometryPoints,
    });
  }

  return result.sort((a, b) => Number(a.shape_id) - Number(b.shape_id));
}

function parseConnects(xml) {
  const result = [];
  const connectRegex = /<Connect\b([^>]*)\/>/g;
  let match;

  while ((match = connectRegex.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    result.push({
      from_sheet: attrs.FromSheet,
      from_cell: attrs.FromCell,
      from_part: attrs.FromPart,
      to_sheet: attrs.ToSheet,
      to_cell: attrs.ToCell,
      to_part: attrs.ToPart,
    });
  }

  return result;
}

function createConnector(shape) {
  const beginConnect = connectsByShapeAndCell.get(`${shape.shape_id}:BeginX`);
  const endConnect = connectsByShapeAndCell.get(`${shape.shape_id}:EndX`);
  const endpointStatus = beginConnect && endConnect ? 'complete' : beginConnect || endConnect ? 'single' : 'none';
  const begin = [shape.beginx, shape.beginy];
  const end = [shape.endx, shape.endy];
  const geometryPoints = shape.geometry_points.map((point) => point.abs);
  const nonOrthogonal =
    KNOWN_NON_ORTHOGONAL_CONNECTOR_IDS.has(String(shape.shape_id)) ||
    hasNonOrthogonalSegment([begin, ...geometryPoints, end]);

  return {
    connector_id: Number(shape.shape_id),
    label: shape.label,
    nameu: shape.nameu,
    name: shape.name,
    text: shape.text,
    from_sheet_id: beginConnect ? Number(beginConnect.to_sheet) : null,
    from_target_cell: beginConnect?.to_cell ?? null,
    from_shape_label: beginConnect ? shapesById.get(String(beginConnect.to_sheet))?.label ?? null : null,
    to_sheet_id: endConnect ? Number(endConnect.to_sheet) : null,
    to_target_cell: endConnect?.to_cell ?? null,
    to_shape_label: endConnect ? shapesById.get(String(endConnect.to_sheet))?.label ?? null : null,
    begin,
    end,
    polyline_points: geometryPoints,
    endpoint_status: endpointStatus,
    nonOrthogonal,
  };
}

function parseConnectionPoints(body, directCells) {
  const section = findSections(body, 'Connection')[0];
  if (!section) {
    return [];
  }

  return parseRows(section).map((row) => {
    const x = numberValue(row.cells.X);
    const y = numberValue(row.cells.Y);
    const local = [
      x === null ? 0 : x,
      y === null ? 0 : y,
    ];

    return {
      ix: row.attrs.IX ?? row.attrs.N ?? '',
      x_local: local[0],
      y_local: local[1],
      abs: localToPagePoint(local, directCells),
    };
  });
}

function parseGeometryPoints(body, directCells) {
  return findSections(body, 'Geometry').flatMap((section) => {
    return parseRows(section)
      .filter((row) => row.attrs.Del !== '1' && (row.attrs.T === 'MoveTo' || row.attrs.T === 'LineTo'))
      .map((row) => {
        const x = numberValue(row.cells.X);
        const y = numberValue(row.cells.Y);
        const local = [
          x === null ? 0 : x,
          y === null ? 0 : y,
        ];

        return {
          ix: row.attrs.IX ?? '',
          type: row.attrs.T,
          x_local: local[0],
          y_local: local[1],
          abs: localToPagePoint(local, directCells),
        };
      });
  });
}

function findSections(body, sectionName) {
  const sections = [];
  const sectionRegex = /<Section\b([^>]*)>([\s\S]*?)<\/Section>/g;
  let match;

  while ((match = sectionRegex.exec(body)) !== null) {
    const attrs = parseAttributes(match[1]);
    if (attrs.N === sectionName) {
      sections.push(match[2]);
    }
  }

  return sections;
}

function parseRows(sectionBody) {
  const rows = [];
  const rowRegex = /<Row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Row>)/g;
  let match;

  while ((match = rowRegex.exec(sectionBody)) !== null) {
    rows.push({
      attrs: parseAttributes(match[1]),
      cells: parseCells(match[2] ?? ''),
    });
  }

  return rows;
}

function parseCells(xml) {
  const cells = {};
  const cellRegex = /<Cell\b([^>]*)\/>/g;
  let match;

  while ((match = cellRegex.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    if (attrs.N) {
      cells[attrs.N] = attrs.V ?? '';
    }
  }

  return cells;
}

function parseText(body) {
  const match = body.match(/<Text\b[^>]*>([\s\S]*?)<\/Text>/);
  if (!match) {
    return '';
  }

  return decodeXml(match[1].replace(/<[^>]+>/g, '')).replace(/\r\n/g, '\n').trim();
}

function parseAttributes(source) {
  const attrs = {};
  const attrRegex = /([\w:.-]+)=('([^']*)'|"([^"]*)")/g;
  let match;

  while ((match = attrRegex.exec(source)) !== null) {
    attrs[match[1]] = decodeXml(match[3] ?? match[4] ?? '');
  }

  return attrs;
}

function localToPagePoint(local, cells) {
  const pinX = numberValue(cells.PinX) ?? 0;
  const pinY = numberValue(cells.PinY) ?? 0;
  const locPinX = numberValue(cells.LocPinX) ?? (numberValue(cells.Width) ?? 0) / 2;
  const locPinY = numberValue(cells.LocPinY) ?? (numberValue(cells.Height) ?? 0) / 2;
  const angle = numberValue(cells.Angle) ?? 0;
  const dx = local[0] - locPinX;
  const dy = local[1] - locPinY;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    round(pinX + dx * cos - dy * sin),
    round(pinY + dx * sin + dy * cos),
  ];
}

function hasNonOrthogonalSegment(points) {
  const compacted = points
    .filter((point) => Array.isArray(point) && point.every((value) => Number.isFinite(value)))
    .filter((point, index, allPoints) => index === 0 || !samePoint(point, allPoints[index - 1]));

  for (let index = 0; index < compacted.length - 1; index += 1) {
    const from = compacted[index];
    const to = compacted[index + 1];
    if (
      Math.abs(from[0] - to[0]) > ORTHOGONAL_TOLERANCE_IN &&
      Math.abs(from[1] - to[1]) > ORTHOGONAL_TOLERANCE_IN
    ) {
      return true;
    }
  }

  return false;
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) <= EPSILON && Math.abs(a[1] - b[1]) <= EPSILON;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function round(value) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
