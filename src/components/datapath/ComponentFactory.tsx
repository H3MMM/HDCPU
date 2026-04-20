import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactElement,
} from 'react';
import {
  Graph,
  type Edge as X6Edge,
  type Graph as X6Graph,
  type Node as X6Node,
  type Rectangle,
} from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import type { ComponentConfig, DatapathConfig, PortPosition } from '../../types';
import { ALUComponent } from './ALUComponent';
import { ControlUnitComponent } from './ControlUnitComponent';
import { MemoryComponent } from './MemoryComponent';
import { MuxComponent } from './MuxComponent';
import { RegisterComponent } from './RegisterComponent';
import {
  DATAPATH_NODE_SHAPE,
  createDatapathNodeMetadata,
  createPortVisualAttrs,
  PORT_MARKUP,
} from './datapath-metadata';
import { appendDatapathPortDebugMarker, logEdgeTerminalDebugInfo } from './datapath-debug';
import { applyDatapathEdgeState, createDatapathEdge } from './Wire';

interface FactoryComponentProps {
  component: ComponentConfig;
  active: boolean;
  detail: string;
}

interface DatapathNodeData extends FactoryComponentProps {
  subtitle: string;
}

interface ComponentFactoryProps {
  config: DatapathConfig;
  activeComponentIds: ReadonlySet<string>;
  activeWireIds: ReadonlySet<string>;
  componentDetails: ReadonlyMap<string, string>;
  editable?: boolean;
  onZoomLevelChange?: (scale: number) => void;
  onWireLayoutChange?: (wireId: string, nextLayout: DatapathWireLayout) => void;
}

export interface ComponentFactoryHandle {
  setZoom: (scale: number) => void;
  resetViewport: () => void;
}

export interface DatapathWireLayout {
  from: { component: string; port: string };
  to: { component: string; port: string };
  waypoints: Array<{ x: number; y: number }>;
}

type ComponentRenderer = (props: FactoryComponentProps) => ReactElement;

const PORT_LAYOUT_NAMES = {
  left: 'hdcpu-port-left',
  right: 'hdcpu-port-right',
  top: 'hdcpu-port-top',
  bottom: 'hdcpu-port-bottom',
} as const satisfies Record<PortPosition, string>;

const COMPONENT_RENDERERS: Partial<Record<ComponentConfig['type'], ComponentRenderer>> = {
  register: renderRegisterNode,
  'register-file': renderRegisterNode,
  memory: renderMemoryNode,
  mux: renderMuxNode,
  control: renderControlNode,
  alu: renderALUNode,
  adder: renderALUNode,
  'imm-gen': renderRegisterNode,
  'sign-extend': renderRegisterNode,
  'branch-logic': renderControlNode,
  constant: renderRegisterNode,
};

const PORT_GROUPS = {
  left: createPortGroup('left'),
  right: createPortGroup('right'),
  top: createPortGroup('top'),
  bottom: createPortGroup('bottom'),
};

const DATAPATH_EDGE_EDIT_TOOLS: Array<{ name: string; args?: Record<string, unknown> }> = [
  {
    name: 'vertices',
    args: {
      snapRadius: 20,
      addable: true,
      removable: true,
      removeRedundancies: true,
    },
  },
  {
    name: 'segments',
  },
  {
    name: 'source-anchor',
  },
  {
    name: 'target-anchor',
  },
];

let registryReady = false;

export const INITIAL_DATAPATH_VIEWPORT = {
  scale: 0.74,
  x: 48,
  y: 56,
} as const;

export function getComponentSubtitle(component: ComponentConfig): string {
  switch (component.type) {
    case 'register':
    case 'register-file':
      return '寄存器';
    case 'memory':
      return '存储器';
    case 'mux':
      return '选择器';
    case 'control':
    case 'branch-logic':
      return '控制';
    case 'alu':
    case 'adder':
      return '算逻';
    case 'imm-gen':
    case 'sign-extend':
      return '立即数';
    case 'constant':
      return '常量';
    default:
      return component.type;
  }
}

function DatapathReactNode({ node }: { node: X6Node }) {
  const data = node.getData<DatapathNodeData>();
  if (!data) {
    return null;
  }

  const { component } = data;
  const width = component.size.width;
  const height = component.size.height;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${width}px`,
        height: `${height}px`,
        margin: 0,
        padding: 0,
        overflow: 'visible',
        transform: 'none',
        transformOrigin: '0 0',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        x={0}
        y={0}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{
          display: 'block',
          overflow: 'visible',
          transform: 'none',
          transformOrigin: '0 0',
        }}
      >
        {renderDatapathComponent(data)}
      </svg>
    </div>
  );
}

const ComponentFactoryBase = forwardRef<ComponentFactoryHandle, ComponentFactoryProps>(function ComponentFactory(
  {
    config,
    activeComponentIds,
    activeWireIds,
    componentDetails,
    editable = false,
    onZoomLevelChange,
    onWireLayoutChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<X6Graph | null>(null);
  const zoomChangeRef = useRef(onZoomLevelChange);
  const wireLayoutChangeRef = useRef(onWireLayoutChange);

  useEffect(() => {
    zoomChangeRef.current = onZoomLevelChange;
  }, [onZoomLevelChange]);

  useEffect(() => {
    wireLayoutChangeRef.current = onWireLayoutChange;
  }, [onWireLayoutChange]);

  useImperativeHandle(
    ref,
    () => ({
      setZoom(scale: number) {
        const graph = graphRef.current;
        if (!graph) {
          return;
        }

        graph.zoomTo(scale);
      },
      resetViewport() {
        const graph = graphRef.current;
        if (!graph) {
          return;
        }

        applyViewport(graph);
      },
    }),
    []
  );

  useEffect(() => {
    ensureDatapathRegistry();

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const allowWireEditing = editable;

    const graph = new Graph({
      container,
      width: container.clientWidth || config.metadata.canvasSize.width,
      height: container.clientHeight || config.metadata.canvasSize.height,
      autoResize: true,
      grid: false,
      background: false,
      panning: {
        enabled: true,
        eventTypes: allowWireEditing ? ['rightMouseDown'] : ['leftMouseDown'],
      },
      mousewheel: {
        enabled: true,
        factor: 1.1,
        minScale: 0.55,
        maxScale: 1.75,
        zoomAtMousePosition: true,
      },
      interacting: {
        nodeMovable: false,
        edgeMovable: allowWireEditing,
        vertexMovable: allowWireEditing,
        arrowheadMovable: allowWireEditing,
        edgeLabelMovable: false,
        magnetConnectable: allowWireEditing,
        useEdgeTools: allowWireEditing,
        toolsAddable: allowWireEditing,
      },
      onPortRendered({ container }) {
        appendDatapathPortDebugMarker(container);
      },
    });

    graph.on('scale', ({ sx }) => {
      zoomChangeRef.current?.(sx);
    });
    graph.on('render:done', () => {
      logEdgeTerminalDebugInfo(graph);
    });

    if (allowWireEditing) {
      const syncEditedWireLayout = ({ edge }: { edge: X6Edge }) => {
        const nextLayout = createDatapathWireLayout(edge);
        if (!nextLayout) {
          return;
        }

        wireLayoutChangeRef.current?.(edge.id, nextLayout);
      };

      graph.on('edge:mouseenter', ({ edge }) => {
        edge.removeTools();
        edge.addTools(DATAPATH_EDGE_EDIT_TOOLS);
      });
      graph.on('edge:mouseleave', ({ edge }) => {
        edge.removeTools();
      });

      graph.on('edge:change:source', syncEditedWireLayout);
      graph.on('edge:change:target', syncEditedWireLayout);
      graph.on('edge:change:vertices', syncEditedWireLayout);
    }

    graphRef.current = graph;
    applyViewport(graph);

    return () => {
      graphRef.current = null;
      graph.dispose();
    };
  }, [config.metadata.canvasSize.height, config.metadata.canvasSize.width, editable]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.batchUpdate('update', () => {
      graph.clearCells();

      for (const component of config.components) {
        graph.addNode(createDatapathNodeMetadata(component, createNodeData(component), PORT_GROUPS));
      }

      for (const wire of config.wires) {
        graph.addEdge(createDatapathEdge(wire));
      }
    });
  }, [config.components, config.wires, editable]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    syncDatapathViewState(graph, config, activeComponentIds, activeWireIds, componentDetails);
  }, [activeComponentIds, activeWireIds, componentDetails, config, editable]);

  return (
    <div
      ref={containerRef}
      className={editable ? 'datapath-x6-root datapath-x6-root--editing' : 'datapath-x6-root'}
      aria-label="动态数据通路画布"
    />
  );
});

export const ComponentFactory = memo(ComponentFactoryBase);

function ensureDatapathRegistry() {
  if (registryReady) {
    return;
  }

  Graph.registerPortLayout(
    {
      [PORT_LAYOUT_NAMES.left]: createOffsetPortLayout('left'),
      [PORT_LAYOUT_NAMES.right]: createOffsetPortLayout('right'),
      [PORT_LAYOUT_NAMES.top]: createOffsetPortLayout('top'),
      [PORT_LAYOUT_NAMES.bottom]: createOffsetPortLayout('bottom'),
    },
    true
  );

  register({
    shape: DATAPATH_NODE_SHAPE,
    component: DatapathReactNode,
    effect: ['data'],
  });

  registryReady = true;
}

function createOffsetPortLayout(position: PortPosition) {
  return (portsPositionArgs: Array<{ offset?: number }>, elemBBox: Rectangle) => {
    const nodeWidth = elemBBox.width;
    const nodeHeight = elemBBox.height;
    const total = Math.max(portsPositionArgs.length, 1);

    return portsPositionArgs.map(({ offset }, index) => {
      const normalizedOffset = clampOffset(offset, (index + 1) / (total + 1));

      switch (position) {
        case 'left':
          return { position: { x: 0, y: nodeHeight * normalizedOffset }, angle: 0 };
        case 'right':
          return { position: { x: nodeWidth, y: nodeHeight * normalizedOffset }, angle: 0 };
        case 'top':
          return { position: { x: nodeWidth * normalizedOffset, y: 0 }, angle: 0 };
        case 'bottom':
          return { position: { x: nodeWidth * normalizedOffset, y: nodeHeight }, angle: 0 };
        default:
          return { position: { x: 0, y: 0 }, angle: 0 };
      }
    });
  };
}

function clampOffset(offset?: number, fallback = 0.5): number {
  if (typeof offset !== 'number' || Number.isNaN(offset)) {
    return fallback;
  }

  return Math.min(Math.max(offset, 0), 1);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

function mapPointToWaypoint(point: unknown): { x: number; y: number } | null {
  if (!point || typeof point !== 'object') {
    return null;
  }

  const { x, y } = point as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  return {
    x: roundCoordinate(x),
    y: roundCoordinate(y),
  };
}

function createDatapathWireLayout(edge: X6Edge): DatapathWireLayout | null {
  const sourceComponent = edge.getSourceCellId();
  const sourcePort = edge.getSourcePortId();
  const targetComponent = edge.getTargetCellId();
  const targetPort = edge.getTargetPortId();

  if (!sourceComponent || !sourcePort || !targetComponent || !targetPort) {
    return null;
  }

  const sourcePoint = mapPointToWaypoint(edge.getSourcePoint());
  const targetPoint = mapPointToWaypoint(edge.getTargetPoint());
  if (!sourcePoint || !targetPoint) {
    return null;
  }

  const vertices = edge
    .getVertices()
    .map((vertex) => mapPointToWaypoint(vertex))
    .filter((vertex): vertex is { x: number; y: number } => vertex !== null);

  return {
    from: {
      component: sourceComponent,
      port: sourcePort,
    },
    to: {
      component: targetComponent,
      port: targetPort,
    },
    waypoints: [sourcePoint, ...vertices, targetPoint],
  };
}

function createPortGroup(position: PortPosition) {
  return {
    position: { name: PORT_LAYOUT_NAMES[position] },
    markup: PORT_MARKUP,
    attrs: createPortVisualAttrs(),
    zIndex: 10,
  };
}

function createNodeData(component: ComponentConfig, active = false, detail = component.id): DatapathNodeData {
  return {
    component,
    active,
    detail,
    subtitle: getComponentSubtitle(component),
  };
}

function applyViewport(graph: X6Graph) {
  graph.zoomTo(INITIAL_DATAPATH_VIEWPORT.scale);
  graph.translate(INITIAL_DATAPATH_VIEWPORT.x, INITIAL_DATAPATH_VIEWPORT.y);
}

function syncDatapathViewState(
  graph: X6Graph,
  config: DatapathConfig,
  activeComponentIds: ReadonlySet<string>,
  activeWireIds: ReadonlySet<string>,
  componentDetails: ReadonlyMap<string, string>
) {
  graph.batchUpdate('update', () => {
    for (const component of config.components) {
      const cell = graph.getCellById(component.id);
      if (!cell?.isNode()) {
        continue;
      }

      const nextData = createNodeData(
        component,
        activeComponentIds.has(component.id),
        componentDetails.get(component.id) ?? component.id
      );
      const previousData = cell.getData<DatapathNodeData>();

      if (
        !previousData ||
        previousData.component !== nextData.component ||
        previousData.active !== nextData.active ||
        previousData.detail !== nextData.detail ||
        previousData.subtitle !== nextData.subtitle
      ) {
        cell.setData(nextData);
      }
    }

    for (const wire of config.wires) {
      const cell = graph.getCellById(wire.id);
      if (!cell?.isEdge()) {
        continue;
      }

      applyDatapathEdgeState(cell, wire, activeWireIds.has(wire.id));
    }
  });
}

function renderDatapathComponent(props: FactoryComponentProps) {
  const renderer = COMPONENT_RENDERERS[props.component.type] ?? renderALUNode;
  return renderer(props);
}

function buildCommonProps({ component, active, detail }: FactoryComponentProps) {
  return {
    component,
    active,
    subtitle: getComponentSubtitle(component),
    detail,
  };
}

function renderRegisterNode(props: FactoryComponentProps) {
  return <RegisterComponent {...buildCommonProps(props)} />;
}

function renderMemoryNode(props: FactoryComponentProps) {
  return <MemoryComponent {...buildCommonProps(props)} />;
}

function renderMuxNode(props: FactoryComponentProps) {
  return <MuxComponent {...buildCommonProps(props)} />;
}

function renderControlNode(props: FactoryComponentProps) {
  return <ControlUnitComponent {...buildCommonProps(props)} />;
}

function renderALUNode(props: FactoryComponentProps) {
  return <ALUComponent {...buildCommonProps(props)} />;
}
