import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { validateDatapathConfig, type DatapathMode } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';
import {
  buildMulticycleTextbookSignalRows,
  buildPipelineTextbookSignalRows,
  formatTextbookSignalValue,
} from '../../teaching/textbook-signals';
import type { ComponentConfig, CycleSnapshot, PipelineStageKey } from '../../types';
import { ViewMapper } from '../../view/view-mapper';
import { createDatapathComponentNode } from './ComponentFactory';
import { DatapathAnnotations } from './DatapathAnnotations';
import { DatapathActiveGlowFilters, getComponentTone } from './shared';
import { orderWiresForRendering, resolveWireGeometry, Wire } from './Wire';

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
const INITIAL_VIEWPORT: CanvasViewport = { scale: 0.74, x: 48, y: 56 };
const DATAPATH_MODES: readonly DatapathMode[] = ['multicycle', 'pipeline'];
const DATAPATH_MODE_LABELS: Record<DatapathMode, string> = {
  multicycle: '多周期',
  pipeline: '流水线',
};

const PIPELINE_STAGE_KEYS: readonly PipelineStageKey[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];
function getRegisterFrameRadius(component: ComponentConfig): number {
  if (component.skin === 'textbook-clock-source') {
    return 3;
  }

  if (component.skin && component.skin !== 'default') {
    return component.skin === 'textbook-constant' ? 4 : 6;
  }

  return 18;
}

function shouldRenderTopActiveRegisterFrame(component: ComponentConfig): boolean {
  return component.type === 'register'
    && component.bodyHidden !== true
    && component.size.width > 0
    && component.size.height > 0;
}

function createTopActiveRegisterFrame(component: ComponentConfig) {
  const tone = getComponentTone(component.type);
  const { width, height } = component.size;
  const radius = getRegisterFrameRadius(component);

  return (
    <g
      key={`active-register-frame-${component.id}`}
      transform={`translate(${component.position.x} ${component.position.y})`}
      aria-hidden="true"
      pointerEvents="none"
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx={radius}
        fill="none"
        stroke={tone.activeFrame}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
    </g>
  );
}

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 0.55), 1.75);
}

function getActivePipelineStageCount(snapshot: CycleSnapshot): number {
  return PIPELINE_STAGE_KEYS.filter((stageKey) => {
    return snapshot.pipeline.stages[stageKey].decodedInstruction !== null;
  }).length;
}

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

interface StatusItem {
  label: string;
  value: string;
}

function getStatusCellClassName(active: boolean, variant?: 'result'): string {
  return [
    'datapath-status-cell',
    active ? 'datapath-status-cell--active' : '',
    variant === 'result' ? 'datapath-status-cell--result' : '',
  ].filter(Boolean).join(' ');
}

export const DatapathCanvas = memo(function DatapathCanvas() {
  const {
    datapathMode,
    config,
    currentSnapshot,
    stage,
    currentInstruction,
    runStatus,
    setDatapathMode,
  } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      config: state.datapathConfig,
      currentSnapshot: state.currentSnapshot,
      stage: state.stage,
      currentInstruction: state.currentInstruction,
      runStatus: state.runStatus,
      setDatapathMode: state.setDatapathMode,
    }))
  );

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>(INITIAL_VIEWPORT);
  const [isDragging, setIsDragging] = useState(false);
  const geometryIssueSignatureRef = useRef('');

  const mapper = useMemo(() => new ViewMapper(config), [config]);
  const viewState = useMemo(() => mapper.mapSnapshot(currentSnapshot), [currentSnapshot, mapper]);
  const componentsById = useMemo(
    () => new Map(config.components.map((component) => [component.id, component])),
    [config.components]
  );
  const animateFlow = runStatus !== 'running';
  const isPipelineMode = datapathMode === 'pipeline';
  const statusImm32Value =
    isPipelineMode && currentSnapshot.pipeline.registers.idEx.decodedInstruction
      ? currentSnapshot.pipeline.registers.idEx.immediate
      : currentSnapshot.decodedInstruction.immediate;
  const statusResultItems: readonly StatusItem[] = useMemo(
    () => [
      { label: 'A', value: formatWord(currentSnapshot.pipelineRegs.A) },
      { label: 'B', value: formatWord(currentSnapshot.pipelineRegs.B) },
      { label: 'F', value: formatWord(currentSnapshot.pipelineRegs.ALUOut) },
      { label: 'imm32', value: formatWord(statusImm32Value) },
    ],
    [
      currentSnapshot.pipelineRegs.A,
      currentSnapshot.pipelineRegs.ALUOut,
      currentSnapshot.pipelineRegs.B,
      statusImm32Value,
    ]
  );
  const statusContextItems: readonly StatusItem[] = useMemo(
    () => [
      { label: 'PC', value: formatWord(currentSnapshot.pc) },
      { label: 'PC0', value: formatWord(currentSnapshot.instructionAddress) },
      { label: 'IR', value: formatWord(currentSnapshot.pipelineRegs.IR) },
      { label: 'FR', value: currentSnapshot.aluDetail.zero ? '1' : '0' },
      { label: 'MDR', value: formatWord(currentSnapshot.pipelineRegs.MDR) },
    ],
    [currentSnapshot]
  );
  const changedStatusLabels = useMemo(() => {
    const labels = new Set<string>();
    const changeTargets: Readonly<Record<string, string>> = {
      pc: 'PC',
      IR: 'IR',
      A: 'A',
      B: 'B',
      ALUOut: 'F',
      MDR: 'MDR',
    };

    currentSnapshot.changes.forEach((change) => {
      const label = changeTargets[change.target];
      if (label) {
        labels.add(label);
      }
    });

    currentSnapshot.activeDataPaths.forEach((path) => {
      if (path.to === 'pc0') {
        labels.add('PC0');
      }
      if (path.to === 'alu-out') {
        labels.add('F');
      }
      if (path.to === 'flag-reg') {
        labels.add('FR');
      }
      if ([path.portFrom, path.portTo].some((port) => port.toLowerCase().includes('imm32'))) {
        labels.add('imm32');
      }
    });

    return labels;
  }, [currentSnapshot.activeDataPaths, currentSnapshot.changes]);
  const statusSignalRows = useMemo(
    () => isPipelineMode
      ? buildPipelineTextbookSignalRows(currentSnapshot)
      : buildMulticycleTextbookSignalRows({
          stage,
          controlSignals: currentSnapshot.controlSignals,
          currentInstruction,
        }),
    [currentInstruction, currentSnapshot, isPipelineMode, stage]
  );

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
  const activePipelineStageCount = isPipelineMode ? getActivePipelineStageCount(currentSnapshot) : 0;

  const configValidationReport = useMemo(() => validateDatapathConfig(config), [config]);
  const annotations = config.annotations ?? [];

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

  const renderedWires = useMemo(
    () => orderWiresForRendering(config.wires, activeWireIds).map((wire) => (
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

  const renderedActiveRegisterFrames = useMemo(
    () => config.components
      .filter((component) => activeComponentIds.has(component.id) && shouldRenderTopActiveRegisterFrame(component))
      .map(createTopActiveRegisterFrame),
    [activeComponentIds, config.components]
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

  useEffect(() => {
    setViewport(INITIAL_VIEWPORT);
  }, [config.metadata.type]);

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
          <h2>{datapathMode === 'pipeline' ? 'CPU 流水线数据通路' : 'CPU 多周期数据通路'}</h2>
        </div>

        <div className="canvas-chip-row">
          <span className="editor-pill">{config.metadata.name}</span>
          {isPipelineMode ? (
            <>
              <span className="status-chip status-chip--accent">周期 {currentSnapshot.cycleNumber}</span>
              <span className="editor-pill">在途 {activePipelineStageCount}/5</span>
            </>
          ) : (
            <span className="status-chip status-chip--accent">阶段 {stage}</span>
          )}
          <span className="editor-pill">缩放 {viewport.scale.toFixed(2)}x</span>
          <span className="editor-pill">{animateFlow ? '暂停态细节模式' : '运行态流畅模式'}</span>
        </div>
      </div>

      <div className="datapath-toolbar datapath-toolbar--compact">
        <div className="datapath-toolbar-actions">
          <div className="datapath-mode-switch" role="group" aria-label="数据通路图模式">
            {DATAPATH_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={datapathMode === mode ? 'mode-switch-button mode-switch-button--active' : 'mode-switch-button'}
                aria-pressed={datapathMode === mode}
                onClick={() => {
                  if (datapathMode !== mode) {
                    setDatapathMode(mode);
                  }
                }}
              >
                {DATAPATH_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale + 0.12)}>
            放大
          </button>
          <button type="button" className="preset-pill" onClick={() => adjustScale(viewport.scale - 0.12)}>
            缩小
          </button>
          <button
            type="button"
            className="preset-pill"
            onClick={() => setViewport(INITIAL_VIEWPORT)}
          >
            归位
          </button>
        </div>

        <div className="canvas-summary canvas-summary--legend">
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
            <DatapathAnnotations annotations={annotations} />
            {renderedActiveRegisterFrames}
          </motion.g>
        </svg>
      </div>

      <div className="datapath-status-bar" aria-label="数据通路状态栏">
        <div className="datapath-status-section datapath-status-section--results">
          <span className="datapath-status-title">数据</span>
          <div className="datapath-status-grid datapath-status-grid--results">
            {statusResultItems.map((item) => (
              <span
                key={item.label}
                className={getStatusCellClassName(changedStatusLabels.has(item.label), 'result')}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="datapath-status-section datapath-status-section--context">
          <span className="datapath-status-title">状态</span>
          <div className="datapath-status-grid datapath-status-grid--context">
            {statusContextItems.map((item) => (
              <span
                key={item.label}
                className={getStatusCellClassName(changedStatusLabels.has(item.label))}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="datapath-status-section datapath-status-section--signals">
          <span className="datapath-status-title">控制</span>
          <div className="datapath-status-grid datapath-status-grid--signals">
            {statusSignalRows.map((row) => (
              <span
                key={row.label}
                className={row.active ? 'datapath-status-cell datapath-status-cell--active' : 'datapath-status-cell'}
                title={row.meaning}
              >
                <span>{row.label}</span>
                <strong>{formatTextbookSignalValue(row.value)}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
