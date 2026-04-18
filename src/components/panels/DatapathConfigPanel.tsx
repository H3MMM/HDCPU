import { memo, useMemo } from 'react';
import { summarizeDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';

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

export const DatapathConfigPanel = memo(function DatapathConfigPanel() {
  const datapathConfig = useCPUStore((state) => state.datapathConfig);
  const summary = useMemo(() => summarizeDatapathConfig(datapathConfig), [datapathConfig]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">配置检查</p>
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
        {datapathConfig.components.map((component) => {
          const style = {
            left: `${(component.position.x / summary.canvasSize.width) * 100}%`,
            top: `${(component.position.y / summary.canvasSize.height) * 100}%`,
            width: `${Math.max((component.size.width / summary.canvasSize.width) * 100, 5.4)}%`,
            minHeight: `${Math.max((component.size.height / summary.canvasSize.height) * 180, 36)}px`,
          };

          return (
            <div
              key={component.id}
              className="config-node"
              style={style}
              data-type={component.type}
              title={`${component.label}（${getComponentTypeLabel(component.type)}）`}
            >
              <span>{component.label}</span>
              <small>{getComponentTypeLabel(component.type)}</small>
            </div>
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
            {datapathConfig.components.slice(0, 8).map((component) => (
              <div key={component.id} className="component-row">
                <div>
                  <strong>{component.label}</strong>
                  <span>{component.id}</span>
                </div>
                <span>{component.ports.length} 个端口</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">配置概览</p>
              <h2>画布与连线</h2>
            </div>
          </div>

          <div className="detail-grid">
            <article className="detail-item">
              <span className="detail-label">画布大小</span>
              <strong className="detail-value">
                {summary.canvasSize.width} × {summary.canvasSize.height}
              </strong>
            </article>
            <article className="detail-item">
              <span className="detail-label">部件总数</span>
              <strong className="detail-value">{summary.componentCount}</strong>
            </article>
            <article className="detail-item">
              <span className="detail-label">连线总数</span>
              <strong className="detail-value">{summary.wireCount}</strong>
            </article>
          </div>

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
            {datapathConfig.wires.slice(0, 6).map((wire) => (
              <li key={wire.id}>
                <strong>{wire.id}</strong> · {wire.from.component}.{wire.from.port} → {wire.to.component}.{wire.to.port}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
});
