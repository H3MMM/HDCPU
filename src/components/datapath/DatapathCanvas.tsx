import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { validateDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';
import { ViewMapper } from '../../view/view-mapper';
import { createDatapathComponentNode } from './ComponentFactory';
import { DatapathActiveGlowFilters } from './shared';
import { resolveWireGeometry, Wire } from './Wire';

interface CanvasViewport {
  scale: number;
  x: number;
  y: number;
}

interface DragSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  active: boolean;
}

const DRAG_THRESHOLD_PX = 8;

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 0.55), 1.75);
}

export const DatapathCanvas = memo(function DatapathCanvas() {
  const {
    config,
    currentSnapshot,
    stage,
    currentInstruction,
    runStatus,
  } = useCPUStore(
    useShallow((state) => ({
      config: state.datapathConfig,
      currentSnapshot: state.currentSnapshot,
      stage: state.stage,
      currentInstruction: state.currentInstruction,
      runStatus: state.runStatus,
    }))
  );

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ scale: 0.74, x: 48, y: 56 });
  const [isDragging, setIsDragging] = useState(false);
  const initialViewport = useMemo(() => ({ scale: 0.74, x: 48, y: 56 }), []);
  const geometryIssueSignatureRef = useRef('');

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

    return ids;
  }, [viewState.components]);

  const activeWireIds = useMemo(() => {
    const ids = new Set<string>();
    for (const wireState of viewState.wires.values()) {
      if (wireState.active) {
        ids.add(wireState.id);
      }
    }
    return ids;
  }, [viewState.wires]);

  const configValidationReport = useMemo(() => validateDatapathConfig(config), [config]);

  const duplicateWireIds = useMemo(() => {
    const ids = new Set<string>();
    configValidationReport.issues.forEach((issue) => {
      if (issue.code === 'duplicate-wire-id' && issue.wireId) {
        ids.add(issue.wireId);
      }
    });
    return ids;
  }, [configValidationReport.issues]);

  const duplicateComponentIssues = useMemo(
    () => configValidationReport.issues.filter((issue) => issue.code === 'duplicate-component-id'),
    [configValidationReport.issues]
  );

  const wireGeometryById = useMemo(() => {
    return new Map(config.wires.map((wire) => {
      const geometry = resolveWireGeometry(wire, componentsById);

      if (duplicateWireIds.has(wire.id)) {
        geometry.issues.push({
          wireId: wire.id,
          code: 'duplicate-wire-id',
          message: `Wire ${wire.id} has a duplicate id`,
        });
      }

      return [wire.id, geometry];
    }));
  }, [componentsById, config.wires, duplicateWireIds]);

  const invalidWireIds = useMemo(() => {
    const ids = new Set<string>();
    wireGeometryById.forEach((geometry, wireId) => {
      if (geometry.issues.length > 0) {
        ids.add(wireId);
      }
    });
    return ids;
  }, [wireGeometryById]);

  const renderedWires = useMemo(
    () => config.wires.map((wire) => (
      <Wire
        key={wire.id}
        wire={wire}
        components={componentsById}
        active={activeWireIds.has(wire.id)}
        showLabel={false}
        animateFlow={animateFlow}
        geometry={wireGeometryById.get(wire.id)}
      />
    )),
    [activeWireIds, animateFlow, componentsById, config.wires, wireGeometryById]
  );

  const renderedComponents = useMemo(
    () => config.components.map((component) => {
      const detail = viewState.components.get(component.id)?.displayValues[0]?.value ?? component.id;

      return createDatapathComponentNode({
        component,
        active: activeComponentIds.has(component.id),
        detail,
      });
    }),
    [activeComponentIds, config.components, viewState.components]
  );

  useEffect(() => {
    const issueLines: string[] = [];

    wireGeometryById.forEach((geometry, wireId) => {
      geometry.issues.forEach((issue) => {
        issueLines.push(`${wireId}:${issue.code}:${issue.message}`);
      });
    });

    duplicateComponentIssues.forEach((issue) => {
      issueLines.push(`diagram:${issue.code}:${issue.message}`);
    });

    issueLines.sort();
    const signature = issueLines.join('|');
    if (!signature || signature === geometryIssueSignatureRef.current) {
      return;
    }

    geometryIssueSignatureRef.current = signature;
    console.groupCollapsed(`[DatapathGeometry] ${issueLines.length} issue(s)`);
    if (duplicateComponentIssues.length > 0) {
      duplicateComponentIssues.forEach((issue) => {
        console.error(issue.message);
      });
    }
    wireGeometryById.forEach((geometry, wireId) => {
      if (geometry.issues.length === 0) {
        return;
      }

      console.error(`Wire ${wireId}`);
      geometry.issues.forEach((issue) => {
        console.error(`- ${issue.message}`);
      });
    });
    console.groupEnd();
  }, [duplicateComponentIssues, wireGeometryById]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setViewport((current) => ({
        ...current,
        scale: clampScale(current.scale + delta),
      }));
    };

    shell.addEventListener('wheel', handleWheel, { passive: false });
    return () => shell.removeEventListener('wheel', handleWheel);
  }, []);

  function adjustScale(nextScale: number) {
    setViewport((current) => ({
      ...current,
      scale: clampScale(nextScale),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      active: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    const totalDeltaX = event.clientX - dragSession.startClientX;
    const totalDeltaY = event.clientY - dragSession.startClientY;
    const movedEnough = Math.hypot(totalDeltaX, totalDeltaY) >= DRAG_THRESHOLD_PX;

    if (!dragSession.active) {
      if (!movedEnough) {
        return;
      }

      dragSession.active = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();

    const deltaClientX = event.clientX - dragSession.lastClientX;
    const deltaClientY = event.clientY - dragSession.lastClientY;

    setViewport((current) => ({
      ...current,
      x: current.x + deltaClientX / current.scale,
      y: current.y + deltaClientY / current.scale,
    }));

    dragSession.lastClientX = event.clientX;
    dragSession.lastClientY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragSession = dragSessionRef.current;
    dragSessionRef.current = null;

    if (dragSession?.active) {
      setIsDragging(false);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section className="panel-card panel-card--canvas">
      <div className="canvas-topbar">
        <div>
          <p className="eyebrow">中央主画布</p>
          <h2>CPU 数据通路</h2>
        </div>

        <div className="canvas-chip-row">
          <span className="status-chip status-chip--accent">阶段 {stage}</span>
          <span className="editor-pill">缩放 {viewport.scale.toFixed(2)}x</span>
          <span className="editor-pill">异常连线 {invalidWireIds.size}</span>
          <span className="editor-pill">{animateFlow ? '暂停态细节模式' : '运行态流畅模式'}</span>
        </div>
      </div>

      <div className="datapath-toolbar datapath-toolbar--compact">
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
            onClick={() => setViewport(initialViewport)}
          >
            归位
          </button>
        </div>

        <div className="canvas-summary canvas-summary--legend">
          <span className="type-pill">{currentInstruction?.asmString ?? '暂无指令'}</span>
          <div className="datapath-legend datapath-legend--compact">
            <span className="datapath-legend-item">
              <span className="datapath-legend-dot datapath-legend-dot--data" />
              数据路径
            </span>
            <span className="datapath-legend-item">
              <span className="datapath-legend-dot datapath-legend-dot--control" />
              控制路径
            </span>
            <span className="datapath-legend-item">
              <span className="datapath-legend-dot datapath-legend-dot--address" />
              地址路径
            </span>
          </div>
        </div>
      </div>

      <div
        ref={shellRef}
        className="datapath-canvas-shell"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          className="datapath-canvas-svg datapath-canvas-svg--workspace"
          viewBox={`0 0 ${config.metadata.canvasSize.width} ${config.metadata.canvasSize.height}`}
          aria-label="动态数据通路画布"
        >
          <defs>
            <DatapathActiveGlowFilters />
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
              duration: isDragging ? 0 : 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {renderedWires}
            {renderedComponents}
          </motion.g>
        </svg>
      </div>
    </section>
  );
});
