import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { summarizeDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';
import type { DatapathConfig } from '../../types';

interface DatapathConfigPanelProps {
  config: DatapathConfig;
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
          <p className="eyebrow">Day 2 / Config Loader</p>
          <h2>数据通路配置概览</h2>
        </div>
        <span className="editor-pill">{summary.componentCount} 个部件已加载</span>
      </div>

      <div className="config-toolbar">
        {Object.entries(summary.componentTypeCounts).map(([type, count]) => (
          <span key={type} className="type-pill">
            {type} × {count}
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
              title={`${component.label} (${component.type})`}
              onClick={() => selectComponent(component.id)}
            >
              <span>{component.label}</span>
              <small>{component.type}</small>
            </button>
          );
        })}
      </div>

      <div className="config-grid">
        <div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Component Index</p>
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
                  <span>{component.ports.length} ports</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Focused Node</p>
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
                <span className="detail-label">Position</span>
                <strong className="detail-value">
                  {selectedComponent.position.x}, {selectedComponent.position.y}
                </strong>
              </article>
              <article className="detail-item">
                <span className="detail-label">Size</span>
                <strong className="detail-value">
                  {selectedComponent.size.width} × {selectedComponent.size.height}
                </strong>
              </article>
            </div>
          ) : null}

          <p className="panel-caption">
            这个面板直接读取 JSON 配置并渲染位置比例，因此 Day 2 的“配置加载验证”已经能在浏览器中直观看到结果。
          </p>

          <div className="panel-header" style={{ marginTop: '1rem' }}>
            <div>
              <p className="eyebrow">Wire Snapshot</p>
              <h2>连线摘要</h2>
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
