import { memo, useMemo, useState, type PointerEvent, type WheelEvent } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { ViewMapper } from '../../view/view-mapper';
import { createDatapathComponentNode } from './ComponentFactory';
import { Wire } from './Wire';

interface CanvasViewport {
  scale: number;
  x: number;
  y: number;
}

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 0.55), 1.75);
}

export const DatapathCanvas = memo(function DatapathCanvas() {
  const {
    config,
    currentSnapshot,
    stage,
    currentInstruction,
    selectedComponentId,
    selectComponent,
    runStatus,
  } = useCPUStore(
    useShallow((state) => ({
      config: state.datapathConfig,
      currentSnapshot: state.currentSnapshot,
      stage: state.stage,
      currentInstruction: state.currentInstruction,
      selectedComponentId: state.selectedComponentId,
      selectComponent: state.selectComponent,
      runStatus: state.runStatus,
    }))
  );

  const [viewport, setViewport] = useState<CanvasViewport>({ scale: 0.74, x: 48, y: 56 });
  const [dragOrigin, setDragOrigin] = useState<{ clientX: number; clientY: number } | null>(null);

  const mapper = useMemo(() => new ViewMapper(config), [config]);
  const viewState = useMemo(() => mapper.mapSnapshot(currentSnapshot), [currentSnapshot, mapper]);
  const componentsById = useMemo(
    () => new Map(config.components.map((component) => [component.id, component])),
    [config.components]
  );
  const animateFlow = runStatus !== 'running';

  const activeComponentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [componentId, componentState] of viewState.components) {
      if (componentState.highlighted) {
        ids.add(componentId);
      }
    }

    if (selectedComponentId) {
      ids.add(selectedComponentId);
    }

    return ids;
  }, [selectedComponentId, viewState.components]);

  const activeWireIds = useMemo(() => {
    const ids = new Set<string>();
    for (const wireState of viewState.wires.values()) {
      if (wireState.active) {
        ids.add(wireState.id);
      }
    }
    return ids;
  }, [viewState.wires]);

  const focusedComponent = useMemo(
    () => config.components.find((component) => component.id === selectedComponentId) ?? config.components[0] ?? null,
    [config.components, selectedComponentId]
  );
  const focusedComponentState = focusedComponent ? viewState.components.get(focusedComponent.id) : null;

  const renderedWires = useMemo(
    () => config.wires.map((wire) => (
      <Wire
        key={wire.id}
        wire={wire}
        components={componentsById}
        active={activeWireIds.has(wire.id)}
        showLabel={false}
        animateFlow={animateFlow}
      />
    )),
    [activeWireIds, animateFlow, componentsById, config.wires]
  );

  const renderedComponents = useMemo(
    () => config.components.map((component) => {
      const detail = viewState.components.get(component.id)?.displayValues[0]?.value ?? component.id;

      return createDatapathComponentNode({
        component,
        active: activeComponentIds.has(component.id),
        detail,
        onSelect: selectComponent,
      });
    }),
    [activeComponentIds, config.components, selectComponent, viewState.components]
  );

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
          <p className="eyebrow">第 9-13 天 / 动态画布</p>
          <h2>动态数据通路画布</h2>
        </div>
        <span className="editor-pill">阶段 {stage}</span>
      </div>

      <p className="panel-copy">
        画布仍然由 JSON 配置和真实 CPU 快照共同驱动，但 Day13 起会在连续运行时自动降低动画负载，把资源优先留给周期推进和状态更新；暂停后仍然保留完整观察信息。
      </p>

      <div className="datapath-toolbar">
        <div className="datapath-toolbar-actions">
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale + 0.12)}>
            放大
          </button>
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale - 0.12)}>
            缩小
          </button>
          <button
            type="button"
            className="preset-pill"
            onClick={() => setViewport({ scale: 0.74, x: 48, y: 56 })}
          >
            重置视图
          </button>
        </div>

        <div className="register-summary-strip">
          <span className="type-pill">{currentInstruction?.asmString ?? '暂无指令'}</span>
          <span className="type-pill">缩放 {viewport.scale.toFixed(2)}x</span>
          <span className="type-pill">{animateFlow ? '暂停态完整动画' : '运行态降载模式'}</span>
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
          aria-label="动态数据通路画布"
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
              duration: dragOrigin ? 0 : 0.26,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {renderedWires}
            {renderedComponents}
          </motion.g>
        </svg>
      </div>

      <div className="datapath-showcase-grid">
        <div className="datapath-legend">
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--data" />
            数据流动动画
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--control" />
            控制线脉冲
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--address" />
            地址路径强调
          </span>
        </div>

        <div className="detail-grid">
          <article className="detail-item">
            <span className="detail-label">当前焦点</span>
            <strong className="detail-value">{focusedComponent?.label ?? '无'}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">焦点细节</span>
            <strong className="detail-value">{focusedComponentState?.displayValues[0]?.value ?? '暂无'}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">活跃部件</span>
            <strong className="detail-value">{activeComponentIds.size}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">活跃连线</span>
            <strong className="detail-value">{activeWireIds.size}</strong>
          </article>
        </div>
      </div>
    </section>
  );
});
