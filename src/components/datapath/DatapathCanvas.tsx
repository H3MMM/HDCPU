import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { validateDatapathConfig, type DatapathMode } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';
import {
  buildMulticycleTextbookSignalRows,
  buildPipelineTextbookSignalRows,
  formatTextbookSignalValue,
} from '../../teaching/textbook-signals';
import type { ComponentConfig, CycleSnapshot } from '../../types';
import { ViewMapper } from '../../view/view-mapper';
import { createDatapathComponentNode } from './ComponentFactory';
import { DatapathAnnotations } from './DatapathAnnotations';
import { resolveActiveStatusLabels } from './datapath-status';
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

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

interface StatusItem {
  label: string;
  value: string;
}

function getStatusImm32Value(snapshot: CycleSnapshot, isPipelineMode: boolean): number {
  return isPipelineMode && snapshot.pipeline.registers.idEx.decodedInstruction
    ? snapshot.pipeline.registers.idEx.immediate
    : snapshot.decodedInstruction.immediate;
}

function getStatusComparableValues(
  snapshot: CycleSnapshot,
  isPipelineMode: boolean
): Readonly<Record<string, number>> {
  return {
    A: snapshot.pipelineRegs.A,
    B: snapshot.pipelineRegs.B,
    F: snapshot.pipelineRegs.ALUOut,
    imm32: getStatusImm32Value(snapshot, isPipelineMode),
    PC: snapshot.pc,
    PC0: snapshot.instructionAddress,
    IR: snapshot.pipelineRegs.IR,
    FR: snapshot.aluDetail.zero ? 1 : 0,
    MDR: snapshot.pipelineRegs.MDR,
  };
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
  const gRef = useRef<SVGGElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>(INITIAL_VIEWPORT);
  const [showRef, setShowRef] = useState(false);
  const geometryIssueSignatureRef = useRef('');

  useEffect(() => {
    if (!showRef) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowRef(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRef]);

  const mapper = useMemo(() => new ViewMapper(config), [config]);
  const viewState = useMemo(() => mapper.mapSnapshot(currentSnapshot), [currentSnapshot, mapper]);
  const componentsById = useMemo(
    () => new Map(config.components.map((component) => [component.id, component])),
    [config.components]
  );
  const animateFlow = runStatus !== 'running';
  const isPipelineMode = datapathMode === 'pipeline';
  const statusValues = useMemo(
    () => getStatusComparableValues(currentSnapshot, isPipelineMode),
    [currentSnapshot, isPipelineMode]
  );
  const statusResultItems: readonly StatusItem[] = useMemo(
    () => [
      { label: 'A', value: formatWord(statusValues.A) },
      { label: 'B', value: formatWord(statusValues.B) },
      { label: 'F', value: formatWord(statusValues.F) },
      { label: 'imm32', value: formatWord(statusValues.imm32) },
    ],
    [statusValues]
  );
  const statusContextItems: readonly StatusItem[] = useMemo(
    () => [
      { label: 'PC', value: formatWord(statusValues.PC) },
      { label: 'PC0', value: formatWord(statusValues.PC0) },
      { label: 'IR', value: formatWord(statusValues.IR) },
      { label: 'FR', value: statusValues.FR ? '1' : '0' },
      { label: 'MDR', value: formatWord(statusValues.MDR) },
    ],
    [statusValues]
  );
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
  const activeStatusLabels = useMemo(
    () => resolveActiveStatusLabels(datapathMode, activeWireIds),
    [activeWireIds, datapathMode]
  );
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
    if (!shell) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setViewport((v) => ({ ...v, scale: clampScale(v.scale + delta) }));
    };

    shell.addEventListener('wheel', handleWheel, { passive: false });
    return () => shell.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    setViewport(INITIAL_VIEWPORT);
  }, [config.metadata.type]);

  function adjustScale(nextScale: number) {
    setViewport((v) => ({ ...v, scale: clampScale(nextScale) }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;

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
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;

    const totalDeltaX = event.clientX - dragSession.startClientX;
    const totalDeltaY = event.clientY - dragSession.startClientY;

    if (!dragSession.active) {
      if (Math.hypot(totalDeltaX, totalDeltaY) < DRAG_THRESHOLD_PX) return;
      dragSession.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const g = gRef.current;
      if (g) g.style.transition = 'none';
    }

    event.preventDefault();

    const dx = (event.clientX - dragSession.lastClientX) / viewport.scale;
    const dy = (event.clientY - dragSession.lastClientY) / viewport.scale;

    viewport.x += dx;
    viewport.y += dy;

    const g = gRef.current;
    if (g) g.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;

    dragSession.lastClientX = event.clientX;
    dragSession.lastClientY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const wasActive = dragSessionRef.current?.active;
    dragSessionRef.current = null;

    if (wasActive) {
      const g = gRef.current;
      if (g) g.style.transition = '';
      setViewport((v) => ({ ...v }));
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
          <button type="button" className="riscv-ref-button" onClick={() => setShowRef(true)}>
            RISCV指令速查
          </button>
          <span className="editor-pill">缩放 {viewport.scale.toFixed(2)}x</span>
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

          <g
            ref={gRef}
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transition: 'transform 80ms ease-out',
              transformOrigin: '0 0',
            }}
          >
            {renderedWires}
            {renderedComponents}
            <DatapathAnnotations annotations={annotations} />
            {renderedActiveRegisterFrames}
          </g>
        </svg>
      </div>

      <div className={`datapath-status-bar datapath-status-bar--${datapathMode}`} aria-label="数据通路状态栏">
        <div className="datapath-status-section datapath-status-section--results">
          <span className="datapath-status-title">数据</span>
          <div className="datapath-status-grid datapath-status-grid--results">
            {statusResultItems.map((item) => (
              <span
                key={item.label}
                className={getStatusCellClassName(activeStatusLabels.has(item.label), 'result')}
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
                className={getStatusCellClassName(activeStatusLabels.has(item.label))}
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
                className={getStatusCellClassName(activeStatusLabels.has(row.label))}
                title={row.meaning}
              >
                <span>{row.label}</span>
                <strong>{formatTextbookSignalValue(row.value)}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {showRef && (
        <div className="riscv-ref-overlay" onClick={() => setShowRef(false)}>
          <div className="riscv-ref-card" onClick={(e) => e.stopPropagation()}>
            <div className="riscv-ref-header">
              <h3>RISC-V RV32I 指令速查</h3>
              <button type="button" className="riscv-ref-close" onClick={() => setShowRef(false)} aria-label="关闭">×</button>
            </div>
            <div className="riscv-ref-body">
              <h4>指令格式</h4>
              <table className="riscv-ref-format-table">
                <thead>
                  <tr><th>类型</th><th>指令格式</th></tr>
                </thead>
                <tbody>
                  <tr><td>R</td><td>funct7[31:25] | rs2[24:20] | rs1[19:15] | funct3[14:12] | rd[11:7] | opcode[6:0]</td></tr>
                  <tr><td>I</td><td>imm[11:0] | rs1[19:15] | funct3[14:12] | rd[11:7] | opcode[6:0]</td></tr>
                  <tr><td>S</td><td>imm[11:5] | rs2[24:20] | rs1[19:15] | funct3[14:12] | imm[4:0] | opcode[6:0]</td></tr>
                  <tr><td>B</td><td>imm[12|10:5] | rs2[24:20] | rs1[19:15] | funct3[14:12] | imm[4:1|11] | opcode[6:0]</td></tr>
                  <tr><td>U</td><td>imm[31:12] | rd[11:7] | opcode[6:0]</td></tr>
                  <tr><td>J</td><td>imm[20|10:1|11|19:12] | rd[11:7] | opcode[6:0]</td></tr>
                </tbody>
              </table>

              <h4>指令列表</h4>
              <table className="riscv-ref-table">
                <thead>
                  <tr><th>指令</th><th>类型</th><th>操作</th><th>说明</th></tr>
                </thead>
                <tbody>
                  <tr className="riscv-ref-group-row"><td colSpan={4}>算术与逻辑</td></tr>
                  <tr><td>add rd, rs1, rs2</td><td>R</td><td>rd = rs1 + rs2</td><td>加法</td></tr>
                  <tr><td>sub rd, rs1, rs2</td><td>R</td><td>rd = rs1 - rs2</td><td>减法</td></tr>
                  <tr><td>addi rd, rs1, imm</td><td>I</td><td>rd = rs1 + imm</td><td>立即数加法</td></tr>
                  <tr><td>and rd, rs1, rs2</td><td>R</td><td>rd = rs1 &amp; rs2</td><td>按位与</td></tr>
                  <tr><td>or rd, rs1, rs2</td><td>R</td><td>rd = rs1 | rs2</td><td>按位或</td></tr>
                  <tr><td>xor rd, rs1, rs2</td><td>R</td><td>rd = rs1 ^ rs2</td><td>按位异或</td></tr>
                  <tr><td>andi/ori/xori rd, rs1, imm</td><td>I</td><td>同上(立即数)</td><td>立即数逻辑运算</td></tr>
                  <tr><td>sll rd, rs1, rs2</td><td>R</td><td>rd = rs1 &lt;&lt; shamt</td><td>左移</td></tr>
                  <tr><td>srl rd, rs1, rs2</td><td>R</td><td>rd = rs1 &gt;&gt; shamt</td><td>逻辑右移</td></tr>
                  <tr><td>sra rd, rs1, rs2</td><td>R</td><td>rd = rs1 &gt;&gt;&gt; shamt</td><td>算术右移</td></tr>
                  <tr><td>slli/srli/srai rd, rs1, shamt</td><td>I</td><td>同上(立即数)</td><td>立即数移位</td></tr>
                  <tr><td>slt rd, rs1, rs2</td><td>R</td><td>rd = (rs1 &lt; rs2) ? 1 : 0</td><td>有符号比较</td></tr>
                  <tr><td>sltu rd, rs1, rs2</td><td>R</td><td>同上(无符号)</td><td>无符号比较</td></tr>
                  <tr><td>slti/sltiu rd, rs1, imm</td><td>I</td><td>同上(立即数)</td><td>立即数比较</td></tr>
                  <tr><td>lui rd, imm</td><td>U</td><td>rd = imm &lt;&lt; 12</td><td>高 20 位加载</td></tr>
                  <tr><td>auipc rd, imm</td><td>U</td><td>rd = PC + (imm &lt;&lt; 12)</td><td>PC + 高 20 位</td></tr>
                  <tr className="riscv-ref-group-row"><td colSpan={4}>访存</td></tr>
                  <tr><td>lw rd, offset(rs1)</td><td>I</td><td>rd = Mem[rs1+offset]</td><td>加载字</td></tr>
                  <tr><td>lh/lb/lhu/lbu rd, offset(rs1)</td><td>I</td><td>rd = Mem[rs1+offset]</td><td>加载半字/字节</td></tr>
                  <tr><td>sw rs2, offset(rs1)</td><td>S</td><td>Mem[rs1+offset] = rs2</td><td>存储字</td></tr>
                  <tr><td>sh/sb rs2, offset(rs1)</td><td>S</td><td>Mem[rs1+offset] = rs2</td><td>存储半字/字节</td></tr>
                  <tr className="riscv-ref-group-row"><td colSpan={4}>分支</td></tr>
                  <tr><td>beq rs1, rs2, offset</td><td>B</td><td>if(rs1==rs2) PC+=offset</td><td>相等跳转</td></tr>
                  <tr><td>bne rs1, rs2, offset</td><td>B</td><td>if(rs1!=rs2) PC+=offset</td><td>不等跳转</td></tr>
                  <tr><td>blt/bltu rs1, rs2, offset</td><td>B</td><td>if(rs1&lt;rs2) PC+=offset</td><td>小于跳转</td></tr>
                  <tr><td>bge/bgeu rs1, rs2, offset</td><td>B</td><td>if(rs1&gt;=rs2) PC+=offset</td><td>大于等于跳转</td></tr>
                  <tr className="riscv-ref-group-row"><td colSpan={4}>跳转</td></tr>
                  <tr><td>jal rd, offset</td><td>J</td><td>rd=PC+4; PC+=offset</td><td>跳转并链接</td></tr>
                  <tr><td>jalr rd, rs1, offset</td><td>I</td><td>rd=PC+4; PC=(rs1+offset)&amp;~1</td><td>寄存器跳转</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
