import { useMemo, useState, type PointerEvent, type WheelEvent } from 'react';
import { motion } from 'framer-motion';
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

export function DatapathCanvas() {
  const config = useCPUStore((state) => state.datapathConfig);
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const stage = useCPUStore((state) => state.stage);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
  const selectComponent = useCPUStore((state) => state.selectComponent);

  const [viewport, setViewport] = useState<CanvasViewport>({ scale: 0.74, x: 48, y: 56 });
  const [dragOrigin, setDragOrigin] = useState<{ clientX: number; clientY: number } | null>(null);

  const mapper = useMemo(() => new ViewMapper(config), [config]);
  const viewState = useMemo(() => mapper.mapSnapshot(currentSnapshot), [currentSnapshot, mapper]);

  const componentsById = useMemo(
    () => new Map(config.components.map((component) => [component.id, component])),
    [config.components]
  );

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

  const focusedComponent =
    config.components.find((component) => component.id === selectedComponentId) ?? config.components[0] ?? null;
  const focusedComponentState = focusedComponent ? viewState.components.get(focusedComponent.id) : null;

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
          <p className="eyebrow">Day 6 + Day 7 + Day 9 / Animated Canvas</p>
          <h2>Dynamic Datapath Canvas</h2>
        </div>
        <span className="editor-pill">Stage {stage}</span>
      </div>

      <p className="panel-copy">
        The datapath is now rendered from the JSON config, highlighted from live CPU snapshots, and created through a
        shared component factory so future modules can plug in without growing this file.
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
          aria-label="Dynamic datapath canvas"
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
              const detail = viewState.components.get(component.id)?.displayValues[0]?.value ?? component.id;

              return createDatapathComponentNode({
                component,
                active: activeComponentIds.has(component.id),
                detail,
                onSelect: selectComponent,
              });
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
            <span className="detail-label">Focused Detail</span>
            <strong className="detail-value">{focusedComponentState?.displayValues[0]?.value ?? 'n/a'}</strong>
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
