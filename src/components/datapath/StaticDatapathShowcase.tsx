import { useMemo } from 'react';
import { useCPUStore } from '../../store/cpu-store';
import type { ComponentConfig } from '../../types';
import { ALUComponent } from './ALUComponent';
import { ControlUnitComponent } from './ControlUnitComponent';
import { MemoryComponent } from './MemoryComponent';
import { MuxComponent } from './MuxComponent';
import { RegisterComponent } from './RegisterComponent';

const SHOWCASE_IDS = ['pc', 'instr-mem', 'control-unit', 'alu-src-a', 'alu', 'data-mem', 'alu-out', 'mux-wb'] as const;
const SHOWCASE_VIEWBOX = { x: 0, y: 60, width: 1180, height: 580 };

function renderComponent(
  component: ComponentConfig,
  selectedComponentId: string | null,
  onSelect: (componentId: string) => void,
  subtitle: string,
  detail: string
) {
  const commonProps = {
    key: component.id,
    component,
    active: selectedComponentId === component.id,
    onClick: () => onSelect(component.id),
    subtitle,
    detail,
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

  if (component.type === 'control') {
    return (
      <g key={component.id} transform={transform}>
        <ControlUnitComponent {...commonProps} />
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

  return (
    <g key={component.id} transform={transform}>
      <ALUComponent {...commonProps} />
    </g>
  );
}

export function StaticDatapathShowcase() {
  const config = useCPUStore((state) => state.datapathConfig);
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const controlSignals = useCPUStore((state) => state.controlSignals);
  const selectComponent = useCPUStore((state) => state.selectComponent);

  const showcaseComponents = useMemo(
    () =>
      SHOWCASE_IDS.map((id) => config.components.find((component) => component.id === id)).filter(
        (component): component is ComponentConfig => Boolean(component)
      ),
    [config.components]
  );

  const selectedComponent =
    showcaseComponents.find((component) => component.id === selectedComponentId) ?? showcaseComponents[0] ?? null;

  const componentSummaries = useMemo(
    () => ({
      pc: currentInstruction ? `PC feed · ${currentInstruction.asmString}` : 'PC feed',
      'instr-mem': 'Instruction memory',
      'control-unit': `IRWrite ${controlSignals.IRWrite ? '1' : '0'} · MemRead ${controlSignals.MemRead ? '1' : '0'}`,
      'alu-src-a': `A src ${controlSignals.ALUSrcA}`,
      alu: `ALU ${controlSignals.ALUOp}`,
      'data-mem': `MemWrite ${controlSignals.MemWrite ? '1' : '0'}`,
      'alu-out': `PCSource ${controlSignals.PCSource}`,
      'mux-wb': `MemToReg ${controlSignals.MemToReg}`,
    }),
    [controlSignals, currentInstruction]
  );

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 5 / SVG Components</p>
          <h2>静态数据通路预览</h2>
        </div>
        <span className="editor-pill">{showcaseComponents.length} SVG modules</span>
      </div>

      <p className="panel-copy">
        这里开始使用真正的 SVG 部件来替代前面的配置方块。Day5 先验证形状、位置和端口样式，Day6 再把连线和动态画布接上。
      </p>

      <div className="datapath-showcase-shell">
        <svg
          className="datapath-showcase-svg"
          viewBox={`${SHOWCASE_VIEWBOX.x} ${SHOWCASE_VIEWBOX.y} ${SHOWCASE_VIEWBOX.width} ${SHOWCASE_VIEWBOX.height}`}
          aria-label="静态数据通路 SVG 预览"
        >
          <defs>
            <pattern id="datapath-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(35, 51, 63, 0.08)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect
            x={SHOWCASE_VIEWBOX.x}
            y={SHOWCASE_VIEWBOX.y}
            width={SHOWCASE_VIEWBOX.width}
            height={SHOWCASE_VIEWBOX.height}
            rx="32"
            fill="url(#datapath-grid)"
          />

          <path
            d="M 70 356 C 154 356, 212 356, 278 340"
            fill="none"
            stroke="rgba(27, 107, 114, 0.12)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 717 320 C 740 320, 748 320, 760 320"
            fill="none"
            stroke="rgba(190, 93, 52, 0.12)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 856 350 C 924 350, 982 330, 1040 324"
            fill="none"
            stroke="rgba(97, 115, 79, 0.12)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {showcaseComponents.map((component) =>
            renderComponent(
              component,
              selectedComponentId,
              selectComponent,
              component.type === 'alu'
                ? 'ALU Core'
                : component.type === 'mux'
                  ? 'Selector'
                  : component.type === 'control'
                    ? 'Finite Control'
                    : component.type === 'memory'
                      ? 'Memory Bank'
                      : 'State Register',
              componentSummaries[component.id as keyof typeof componentSummaries] ?? component.id
            )
          )}
        </svg>
      </div>

      <div className="datapath-showcase-grid">
        <div className="datapath-legend">
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--data" />
            Data Ports
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--control" />
            Control Ports
          </span>
          <span className="datapath-legend-item">
            <span className="datapath-legend-dot datapath-legend-dot--address" />
            Address Ports
          </span>
        </div>

        <div className="detail-grid">
          <article className="detail-item">
            <span className="detail-label">Focused Module</span>
            <strong className="detail-value">{selectedComponent?.label ?? 'none'}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">Ports</span>
            <strong className="detail-value">{selectedComponent?.ports.length ?? 0}</strong>
          </article>
          <article className="detail-item">
            <span className="detail-label">Footprint</span>
            <strong className="detail-value">
              {selectedComponent ? `${selectedComponent.size.width} × ${selectedComponent.size.height}` : 'n/a'}
            </strong>
          </article>
        </div>
      </div>
    </section>
  );
}
