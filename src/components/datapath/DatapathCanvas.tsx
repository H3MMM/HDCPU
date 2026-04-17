import { useMemo, useState, type PointerEvent, type WheelEvent } from 'react';
import { motion } from 'framer-motion';
import { useCPUStore } from '../../store/cpu-store';
import { STAGE_ACTIVE_COMPONENTS, STAGE_ACTIVE_WIRES } from '../../view/activity-map';
import type { ComponentConfig, DatapathConfig } from '../../types';
import { ALUComponent } from './ALUComponent';
import { ControlUnitComponent } from './ControlUnitComponent';
import { MemoryComponent } from './MemoryComponent';
import { MuxComponent } from './MuxComponent';
import { RegisterComponent } from './RegisterComponent';
import { Wire } from './Wire';

interface CanvasViewport {
  scale: number;
  x: number;
  y: number;
}

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 0.55), 1.75);
}

function resolvePath(source: unknown, path: string): unknown {
  const tokens = path.match(/([^[.\]]+)|\[(\d+)\]/g) ?? [];
  let current: unknown = source;

  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (token.startsWith('[')) {
      const index = Number.parseInt(token.slice(1, -1), 10);
      current = (current as ArrayLike<unknown>)[index];
      continue;
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

function formatStateValue(value: unknown): string {
  if (typeof value === 'number') {
    return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (Array.isArray(value)) {
    return `${value.length} entries`;
  }

  if (typeof value === 'string') {
    return value;
  }

  return 'idle';
}

function buildDisplayState(store: ReturnType<typeof useCPUStore.getState>) {
  return {
    pc: store.instructionCount * 4,
    nextPC: (store.instructionCount + 1) * 4,
    decodedInstruction: store.currentInstruction,
    controlSignals: store.controlSignals,
    registers: store.registers,
    pipelineRegs: {
      IR: store.currentMachineWord ?? 0,
      MDR:
        store.memoryBytes[store.memoryViewStartAddress] |
        ((store.memoryBytes[store.memoryViewStartAddress + 1] ?? 0) << 8) |
        ((store.memoryBytes[store.memoryViewStartAddress + 2] ?? 0) << 16) |
        ((store.memoryBytes[store.memoryViewStartAddress + 3] ?? 0) << 24),
      A: store.registers[1] ?? 0,
      B: store.registers[2] ?? 0,
      ALUOut: store.registers[3] ?? 0,
    },
    aluDetail: {
      inputA: store.registers[1] ?? 0,
      inputB: store.currentInstruction?.immediate ?? 0,
      operation: store.controlSignals.ALUOp,
      result: store.registers[3] ?? 0,
    },
    memoryAccess: {
      address: store.memoryViewStartAddress,
      data: store.memoryBytes[store.memoryViewStartAddress] ?? 0,
    },
  };
}

function getComponentSubtitle(component: ComponentConfig): string {
  if (component.type === 'register' || component.type === 'register-file') {
    return 'State Register';
  }

  if (component.type === 'memory') {
    return 'Memory Bank';
  }

  if (component.type === 'alu') {
    return 'Arithmetic Logic';
  }

  if (component.type === 'mux') {
    return 'Selector';
  }

  if (component.type === 'control') {
    return 'Finite Control';
  }

  return component.type;
}

function renderComponentNode(
  component: ComponentConfig,
  active: boolean,
  onSelect: (componentId: string) => void,
  detail: string
) {
  const commonProps = {
    component,
    active,
    subtitle: getComponentSubtitle(component),
    detail,
    onClick: () => onSelect(component.id),
  };

  const transform = `translate(${component.position.x} ${component.position.y})`;

  if (component.type === 'register' || component.type === 'register-file') {
    return (
      <g key={component.id} transform={transform}>
        <RegisterComponent {...commonProps} />
      </g>
    );
  }

  if (component.type === 'memory') {
    return (
      <g key={component.id} transform={transform}>
        <MemoryComponent {...commonProps} />
      </g>
    );
  }

  if (component.type === 'mux') {
    return (
      <g key={component.id} transform={transform}>
        <MuxComponent {...commonProps} />
      </g>
    );
  }

  if (component.type === 'control') {
    return (
      <g key={component.id} transform={transform}>
        <ControlUnitComponent {...commonProps} />
      </g>
    );
  }

  return (
    <g key={component.id} transform={transform}>
      <ALUComponent {...commonProps} />
    </g>
  );
}

export function DatapathCanvas() {
  const config = useCPUStore((state) => state.datapathConfig);
  const stage = useCPUStore((state) => state.stage);
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
  const controlSignals = useCPUStore((state) => state.controlSignals);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const selectComponent = useCPUStore((state) => state.selectComponent);
  const storeState = useCPUStore();

  const [viewport, setViewport] = useState<CanvasViewport>({ scale: 0.74, x: 48, y: 56 });
  const [dragOrigin, setDragOrigin] = useState<{ clientX: number; clientY: number } | null>(null);

  const componentsById = useMemo(
    () => new Map(config.components.map((component) => [component.id, component])),
    [config.components]
  );

  const displayState = useMemo(() => buildDisplayState(storeState), [storeState]);

  const activeComponentIds = useMemo(() => {
    const ids = new Set(STAGE_ACTIVE_COMPONENTS[stage] ?? []);
    if (selectedComponentId) {
      ids.add(selectedComponentId);
    }
    return ids;
  }, [selectedComponentId, stage]);

  const activeWireIds = useMemo(() => {
    const ids = new Set(STAGE_ACTIVE_WIRES[stage] ?? []);

    for (const wire of config.wires) {
      if (wire.stateKey?.startsWith('controlSignals.')) {
        const value = resolvePath(displayState, wire.stateKey);
        if (value === true || value === 1) {
          ids.add(wire.id);
        }
      }
    }

    return ids;
  }, [config.wires, displayState, stage]);

  const focusedComponent =
    config.components.find((component) => component.id === selectedComponentId) ?? config.components[0] ?? null;

  function adjustScale(nextScale: number) {
    setViewport((current) => ({
      ...current,
      scale: clampScale(nextScale),
    }));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    adjustScale(viewport.scale + delta);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    setDragOrigin({ clientX: event.clientX, clientY: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragOrigin) {
      return;
    }

    const dx = (event.clientX - dragOrigin.clientX) / viewport.scale;
    const dy = (event.clientY - dragOrigin.clientY) / viewport.scale;

    setViewport((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    }));
    setDragOrigin({ clientX: event.clientX, clientY: event.clientY });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    setDragOrigin(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 6 + Day 7 / Animated Canvas</p>
          <h2>动态数据通路画布</h2>
        </div>
        <span className="editor-pill">Stage {stage}</span>
      </div>

      <p className="panel-copy">
        这里已经把整张数据通路画布接起来了。当前阶段会驱动部件和连线的动画高亮，画布也支持拖拽和平滑缩放，正好作为 Day7 的动画底座。
      </p>

      <div className="datapath-toolbar">
        <div className="datapath-toolbar-actions">
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale + 0.12)}>
            Zoom In
          </button>
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale - 0.12)}>
            Zoom Out
          </button>
          <button
            type="button"
            className="preset-pill"
            onClick={() => setViewport({ scale: 0.74, x: 48, y: 56 })}
          >
            Reset View
          </button>
        </div>

        <div className="register-summary-strip">
          <span className="type-pill">{currentInstruction?.asmString ?? 'No instruction loaded'}</span>
          <span className="type-pill">Scale {viewport.scale.toFixed(2)}x</span>
        </div>
      </div>

      <div
        className="datapath-canvas-shell"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          className="datapath-canvas-svg"
          viewBox={`0 0 ${config.metadata.canvasSize.width} ${config.metadata.canvasSize.height}`}
          aria-label="动画数据通路画布"
        >
          <defs>
            <pattern id="animated-datapath-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(35, 51, 63, 0.08)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect
            x="0"
            y="0"
            width={config.metadata.canvasSize.width}
            height={config.metadata.canvasSize.height}
            rx="36"
            fill="url(#animated-datapath-grid)"
          />

          <motion.g
            initial={false}
            animate={{
              x: viewport.x,
              y: viewport.y,
              scale: viewport.scale,
            }}
            transition={{
              duration: dragOrigin ? 0 : 0.34,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {config.wires.map((wire) => (
              <Wire
                key={wire.id}
                wire={wire}
                components={componentsById}
                active={activeWireIds.has(wire.id)}
                showLabel={false}
              />
            ))}

            {config.components.map((component) => {
              const detail = component.stateKey
                ? formatStateValue(resolvePath(displayState, component.stateKey))
                : component.id;

              return renderComponentNode(component, activeComponentIds.has(component.id), selectComponent, detail);
            })}
          </motion.g>
        </svg>
      </div>

      <div className="datapath-showcase-grid">
        <div className="datapath-legend">
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--data" />
            Data flow dash animation
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--control" />
            Control wire pulse
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--address" />
            Address path emphasis
          </span>
        </div>

        <div className="detail-grid">
          <article className="detail-item">
            <span className="detail-label">Focused Module</span>
            <strong className="detail-value">{focusedComponent?.label ?? 'none'}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">Active Components</span>
            <strong className="detail-value">{activeComponentIds.size}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">Active Wires</span>
            <strong className="detail-value">{activeWireIds.size}</strong>
          </article>
        </div>
      </div>
    </section>
  );
}
