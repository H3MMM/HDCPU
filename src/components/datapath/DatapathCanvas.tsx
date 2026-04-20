import { memo, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { ViewMapper } from '../../view/view-mapper';
import { ComponentFactory, INITIAL_DATAPATH_VIEWPORT, type ComponentFactoryHandle } from './ComponentFactory';

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

  const canvasRef = useRef<ComponentFactoryHandle | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_DATAPATH_VIEWPORT.scale);

  const mapper = useMemo(() => new ViewMapper(config), [config]);
  const viewState = useMemo(() => mapper.mapSnapshot(currentSnapshot), [currentSnapshot, mapper]);
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

  const componentDetails = useMemo(
    () =>
      new Map(
        config.components.map((component) => [
          component.id,
          viewState.components.get(component.id)?.displayValues[0]?.value ?? component.id,
        ])
      ),
    [config.components, viewState.components]
  );

  function adjustScale(nextScale: number) {
    const scale = clampScale(nextScale);
    canvasRef.current?.setZoom(scale);
    setZoomLevel(scale);
  }

  function resetViewport() {
    setZoomLevel(INITIAL_DATAPATH_VIEWPORT.scale);
    canvasRef.current?.resetViewport();
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
          <span className="editor-pill">缩放 {zoomLevel.toFixed(2)}x</span>
          <span className="editor-pill">{animateFlow ? '暂停态细节模式' : '运行态流畅模式'}</span>
        </div>
      </div>

      <div className="datapath-toolbar datapath-toolbar--compact">
        <div className="datapath-toolbar-actions">
          <button type="button" className="preset-pill" onClick={() => adjustScale(zoomLevel + 0.12)}>
            放大
          </button>
          <button type="button" className="preset-pill" onClick={() => adjustScale(zoomLevel - 0.12)}>
            缩小
          </button>
          <button type="button" className="preset-pill" onClick={resetViewport}>
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

      <div className="datapath-canvas-shell">
        <ComponentFactory
          ref={canvasRef}
          config={config}
          activeComponentIds={activeComponentIds}
          activeWireIds={activeWireIds}
          componentDetails={componentDetails}
          onZoomLevelChange={(nextScale) => setZoomLevel(clampScale(nextScale))}
        />
      </div>
    </section>
  );
});
