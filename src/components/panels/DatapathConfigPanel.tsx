import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { summarizeDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';
import type { DatapathConfig } from '../../types';

interface DatapathConfigPanelProps {
  config: DatapathConfig;
}

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  register: '寄存器',
  'register-file': '寄存器堆',
  memory: '存储器',
  control: '控制器',
  mux: '选择器',
  alu: '算逻单元',
  adder: '加法器',
  'imm-gen': '立即数生成',
  'sign-extend': '符号扩展',
  'branch-logic': '分支逻辑',
  constant: '常量源',
};

function getComponentTypeLabel(type: string): string {
  return COMPONENT_TYPE_LABELS[type] ?? type;
}

export function DatapathConfigPanel({ config }: DatapathConfigPanelProps) {
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
  const selectComponent = useCPUStore((state) => state.selectComponent);

  const summary = useMemo(() => summarizeDatapathConfig(config), [config]);
  const selectedComponent =
    config.components.find((component) => component.id === selectedComponentId) ?? config.components[0] ?? null;

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">第 2 天 / 配置加载</p>
          <h2>数据通路配置总览</h2>
        </div>
        <span className="editor-pill">已加载 {summary.componentCount} 个部件</span>
      </div>

      <div className="config-toolbar">
        {Object.entries(summary.componentTypeCounts).map(([type, count]) => (
          <span key={type} className="type-pill">
            {getComponentTypeLabel(type)} × {count}
          </span>
        ))}
      </div>

      <div className="config-canvas" aria-label="数据通路配置预览">
        {config.components.map((component) => {
          const style: CSSProperties = {
            left: `${(component.position.x / summary.canvasSize.width) * 100}%`,
            top: `${(component.position.y / summary.canvasSize.height) * 100}%`,
            width: `${Math.max((component.size.width / summary.canvasSize.width) * 100, 5.4)}%`,
            minHeight: `${Math.max((component.size.height / summary.canvasSize.height) * 180, 36)}px`,
          };

          const isActive = selectedComponent?.id === component.id;
          const className = isActive ? 'config-node config-node--active' : 'config-node';

          return (
            <button
              key={component.id}
              type="button"
              className={className}
              style={style}
              data-type={component.type}
              title={`${component.label}（${getComponentTypeLabel(component.type)}）`}
              onClick={() => selectComponent(component.id)}
            >
              <span>{component.label}</span>
              <small>{getComponentTypeLabel(component.type)}</small>
            </button>
          );
        })}
      </div>

      <div className="config-grid">
        <div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">部件索引</p>
              <h2>部件清单</h2>
            </div>
          </div>

          <div className="component-list">
            {config.components.slice(0, 8).map((component) => {
              const isActive = selectedComponent?.id === component.id;
              const className = isActive ? 'component-row component-row--active' : 'component-row';

              return (
                <button
                  key={component.id}
                  type="button"
                  className={className}
                  onClick={() => selectComponent(component.id)}
                >
                  <div>
                    <strong>{component.label}</strong>
                    <span>{component.id}</span>
                  </div>
                  <span>{component.ports.length} 个端口</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">当前焦点</p>
              <h2>{selectedComponent?.label ?? '未选中部件'}</h2>
            </div>
          </div>

          {selectedComponent ? (
            <div className="detail-grid">
              <article className="detail-item">
                <span className="detail-label">ID</span>
                <strong className="detail-value">{selectedComponent.id}</strong>
              </article>
              <article className="detail-item">
                <span className="detail-label">位置</span>
                <strong className="detail-value">
                  {selectedComponent.position.x}, {selectedComponent.position.y}
                </strong>
              </article>
              <article className="detail-item">
                <span className="detail-label">尺寸</span>
                <strong className="detail-value">
                  {selectedComponent.size.width} × {selectedComponent.size.height}
                </strong>
              </article>
            </div>
          ) : null}

          <p className="panel-caption">
            这个面板直接读取 JSON 配置并按比例渲染，所以配置加载是否成功、坐标是否合理、部件数量是否齐全，都能在这里很快看出来。
          </p>

          <div className="panel-header" style={{ marginTop: '1rem' }}>
            <div>
              <p className="eyebrow">连线快照</p>
              <h2>关键连线</h2>
            </div>
          </div>

          <ul className="wire-list">
            {config.wires.slice(0, 6).map((wire) => (
              <li key={wire.id}>
                <strong>{wire.id}</strong> · {wire.from.component}.{wire.from.port} → {wire.to.component}.{wire.to.port}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
