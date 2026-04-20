import type { NodeMetadata } from '@antv/x6';
import type { ComponentConfig, PortConfig } from '../../types';

export const DATAPATH_NODE_SHAPE = 'hdcpu-react-node';

export const PORT_MARKUP = [
  { tagName: 'circle', selector: 'portHalo' },
  { tagName: 'circle', selector: 'portBody' },
];

export function createPortVisualAttrs() {
  return {
    portHalo: {
      r: 12,
      fill: 'transparent',
      stroke: 'none',
      pointerEvents: 'none',
    },
    portBody: {
      r: 4,
      magnet: true,
      fill: 'transparent',
      stroke: 'none',
    },
  };
}

export function createPortItem(port: PortConfig) {
  return {
    id: port.name,
    group: port.position,
    markup: PORT_MARKUP,
    attrs: createPortVisualAttrs(),
    args: {
      offset: port.offset,
    },
  };
}

export function createDatapathNodeMetadata(
  component: ComponentConfig,
  data: unknown,
  portGroups: DatapathPortGroups
): NodeMetadata {
  return {
    id: component.id,
    shape: DATAPATH_NODE_SHAPE,
    x: component.position.x,
    y: component.position.y,
    width: component.size.width,
    height: component.size.height,
    zIndex: 2,
    data,
    attrs: {
      fo: {
        refX: 0,
        refY: 0,
        refWidth: '100%',
        refHeight: '100%',
        x: 0,
        y: 0,
        style: {
          overflow: 'visible',
        },
      },
      foBody: {
        style: {
          margin: 0,
          padding: 0,
          overflow: 'visible',
          transform: 'none',
          transformOrigin: '0 0',
          background: 'transparent',
        },
      },
      foContent: {
        style: {
          overflow: 'visible',
          transform: 'none',
          transformOrigin: '0 0',
        },
      },
    },
    ports: {
      groups: portGroups,
      items: component.ports.map((port) => createPortItem(port)),
    },
  };
}

type DatapathPortGroups = NonNullable<Exclude<NodeMetadata['ports'], unknown[]>>['groups'];
