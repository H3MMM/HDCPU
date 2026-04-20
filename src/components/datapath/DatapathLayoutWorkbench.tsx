import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDatapathLayoutPatch, hasDatapathLayoutPatchChanges } from '../../config/datapath-layout-patch';
import { getDatapathConfig } from '../../config/load-datapath-config';
import type { DatapathConfig, WireConfig } from '../../types';
import {
    ComponentFactory,
    INITIAL_DATAPATH_VIEWPORT,
    type ComponentFactoryHandle,
    type DatapathWireLayout,
} from './ComponentFactory';

const COORDINATE_EPSILON = 0.0005;

function cloneConfig(config: DatapathConfig): DatapathConfig {
    return JSON.parse(JSON.stringify(config)) as DatapathConfig;
}

function clampScale(scale: number): number {
    return Math.min(Math.max(scale, 0.55), 1.75);
}

function clampOffset(offset: number): number {
    return Math.min(Math.max(offset, 0), 1);
}

function roundCoordinate(value: number): number {
    return Number(value.toFixed(3));
}

function isSameCoordinate(left: number, right: number): boolean {
    return Math.abs(left - right) <= COORDINATE_EPSILON;
}

function isSameWaypoint(
    left: { x: number; y: number },
    right: { x: number; y: number }
): boolean {
    return isSameCoordinate(left.x, right.x) && isSameCoordinate(left.y, right.y);
}

function isSameWaypoints(
    left: readonly { x: number; y: number }[],
    right: readonly { x: number; y: number }[]
): boolean {
    if (left.length !== right.length) {
        return false;
    }

    for (let index = 0; index < left.length; index += 1) {
        if (!isSameWaypoint(left[index], right[index])) {
            return false;
        }
    }

    return true;
}

function hasWireLayoutChanged(currentWire: WireConfig, nextLayout: DatapathWireLayout): boolean {
    if (
        currentWire.from.component !== nextLayout.from.component ||
        currentWire.from.port !== nextLayout.from.port ||
        currentWire.to.component !== nextLayout.to.component ||
        currentWire.to.port !== nextLayout.to.port
    ) {
        return true;
    }

    const currentWaypoints = currentWire.waypoints ?? [];
    return !isSameWaypoints(currentWaypoints, nextLayout.waypoints);
}

function createDownload(fileName: string, content: string, mimeType = 'application/json') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function formatFileStamp(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolvePortPoint(
    config: DatapathConfig,
    componentId: string,
    portName: string
): { x: number; y: number } {
    const component = config.components.find((item) => item.id === componentId);
    if (!component) {
        return { x: 0, y: 0 };
    }

    const port = component.ports.find((item) => item.name === portName);
    if (!port) {
        return {
            x: roundCoordinate(component.position.x + component.size.width / 2),
            y: roundCoordinate(component.position.y + component.size.height / 2),
        };
    }

    const offset = clampOffset(typeof port.offset === 'number' ? port.offset : 0.5);
    switch (port.position) {
        case 'left':
            return {
                x: roundCoordinate(component.position.x),
                y: roundCoordinate(component.position.y + component.size.height * offset),
            };
        case 'right':
            return {
                x: roundCoordinate(component.position.x + component.size.width),
                y: roundCoordinate(component.position.y + component.size.height * offset),
            };
        case 'top':
            return {
                x: roundCoordinate(component.position.x + component.size.width * offset),
                y: roundCoordinate(component.position.y),
            };
        case 'bottom':
            return {
                x: roundCoordinate(component.position.x + component.size.width * offset),
                y: roundCoordinate(component.position.y + component.size.height),
            };
        default:
            return {
                x: roundCoordinate(component.position.x + component.size.width / 2),
                y: roundCoordinate(component.position.y + component.size.height / 2),
            };
    }
}

function createDefaultWireWaypoints(config: DatapathConfig, wire: WireConfig): Array<{ x: number; y: number }> {
    const sourcePoint = resolvePortPoint(config, wire.from.component, wire.from.port);
    const targetPoint = resolvePortPoint(config, wire.to.component, wire.to.port);
    const middleX = roundCoordinate((sourcePoint.x + targetPoint.x) / 2);

    return [
        sourcePoint,
        { x: middleX, y: sourcePoint.y },
        { x: middleX, y: targetPoint.y },
        targetPoint,
    ];
}

export function DatapathLayoutWorkbench() {
    const baselineConfig = useMemo(() => cloneConfig(getDatapathConfig()), []);
    const [workingConfig, setWorkingConfig] = useState<DatapathConfig>(() => cloneConfig(baselineConfig));
    const [selectedComponentId, setSelectedComponentId] = useState(() => baselineConfig.components[0]?.id ?? '');
    const [selectedPortName, setSelectedPortName] = useState('');
    const [selectedWireId, setSelectedWireId] = useState(() => baselineConfig.wires[0]?.id ?? '');
    const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_DATAPATH_VIEWPORT.scale);
    const [feedback, setFeedback] = useState('提示: 在画布中拖动连线折点和端点，随后导出补丁。');
    const canvasRef = useRef<ComponentFactoryHandle | null>(null);

    useEffect(() => {
        if (workingConfig.components.some((component) => component.id === selectedComponentId)) {
            return;
        }

        setSelectedComponentId(workingConfig.components[0]?.id ?? '');
    }, [selectedComponentId, workingConfig.components]);

    useEffect(() => {
        if (workingConfig.wires.some((wire) => wire.id === selectedWireId)) {
            return;
        }

        setSelectedWireId(workingConfig.wires[0]?.id ?? '');
    }, [selectedWireId, workingConfig.wires]);

    const selectedComponent = useMemo(
        () => workingConfig.components.find((component) => component.id === selectedComponentId) ?? null,
        [selectedComponentId, workingConfig.components]
    );

    useEffect(() => {
        if (!selectedComponent) {
            setSelectedPortName('');
            return;
        }

        if (selectedComponent.ports.some((port) => port.name === selectedPortName)) {
            return;
        }

        setSelectedPortName(selectedComponent.ports[0]?.name ?? '');
    }, [selectedComponent, selectedPortName]);

    const selectedPort = useMemo(
        () => selectedComponent?.ports.find((port) => port.name === selectedPortName) ?? null,
        [selectedComponent, selectedPortName]
    );

    const selectedWire = useMemo(
        () => workingConfig.wires.find((wire) => wire.id === selectedWireId) ?? null,
        [selectedWireId, workingConfig.wires]
    );

    const middleWaypoints = useMemo(() => {
        if (!selectedWire?.waypoints || selectedWire.waypoints.length < 3) {
            return [];
        }

        return selectedWire.waypoints.slice(1, -1);
    }, [selectedWire]);

    const layoutPatch = useMemo(
        () => buildDatapathLayoutPatch(baselineConfig, workingConfig),
        [baselineConfig, workingConfig]
    );

    const patchJson = useMemo(() => JSON.stringify(layoutPatch, null, 2), [layoutPatch]);
    const hasChanges = hasDatapathLayoutPatchChanges(layoutPatch);

    const activeComponentIds = useMemo(
        () => new Set(selectedComponentId ? [selectedComponentId] : []),
        [selectedComponentId]
    );
    const activeWireIds = useMemo(() => new Set(selectedWireId ? [selectedWireId] : []), [selectedWireId]);

    const componentDetails = useMemo(
        () => new Map(workingConfig.components.map((component) => [component.id, component.id])),
        [workingConfig.components]
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

    function handleWireLayoutChange(wireId: string, nextLayout: DatapathWireLayout) {
        setWorkingConfig((previousConfig) => {
            let changed = false;

            const nextWires: WireConfig[] = previousConfig.wires.map((wire): WireConfig => {
                if (wire.id !== wireId) {
                    return wire;
                }

                if (!hasWireLayoutChanged(wire, nextLayout)) {
                    return wire;
                }

                changed = true;
                const nextWireBase: WireConfig = {
                    ...wire,
                    from: { ...nextLayout.from },
                    to: { ...nextLayout.to },
                    waypoints: nextLayout.waypoints.map((point) => ({
                        x: roundCoordinate(point.x),
                        y: roundCoordinate(point.y),
                    })),
                };

                if (nextLayout.waypoints.length >= 3) {
                    return {
                        ...nextWireBase,
                        routeMode: 'guided' as const,
                    };
                }

                const nextWire: WireConfig = {
                    ...nextWireBase,
                };
                delete nextWire.routeMode;
                return nextWire;
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                wires: nextWires,
            };
        });
    }

    function updateSelectedPortOffset(nextOffsetValue: number) {
        if (!selectedComponent || !selectedPort) {
            return;
        }

        const nextOffset = roundCoordinate(clampOffset(nextOffsetValue));

        setWorkingConfig((previousConfig) => {
            let changed = false;
            const nextComponents = previousConfig.components.map((component) => {
                if (component.id !== selectedComponent.id) {
                    return component;
                }

                const nextPorts = component.ports.map((port) => {
                    if (port.name !== selectedPort.name) {
                        return port;
                    }

                    if (typeof port.offset === 'number' && isSameCoordinate(port.offset, nextOffset)) {
                        return port;
                    }

                    changed = true;
                    return {
                        ...port,
                        offset: nextOffset,
                    };
                });

                return changed
                    ? {
                        ...component,
                        ports: nextPorts,
                    }
                    : component;
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                components: nextComponents,
            };
        });
    }

    function setSelectedWireRouteMode(routeMode: 'auto' | 'guided') {
        if (!selectedWire) {
            return;
        }

        setWorkingConfig((previousConfig) => {
            let changed = false;

            const nextWires: WireConfig[] = previousConfig.wires.map((wire): WireConfig => {
                if (wire.id !== selectedWire.id) {
                    return wire;
                }

                const currentRouteMode = wire.routeMode ?? 'auto';
                if (currentRouteMode === routeMode) {
                    return wire;
                }

                changed = true;
                if (routeMode === 'guided') {
                    return {
                        ...wire,
                        routeMode: 'guided' as const,
                        waypoints:
                            wire.waypoints && wire.waypoints.length >= 3
                                ? wire.waypoints
                                : createDefaultWireWaypoints(previousConfig, wire),
                    };
                }

                const nextWire: WireConfig = {
                    ...wire,
                };
                delete nextWire.routeMode;
                return nextWire;
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                wires: nextWires,
            };
        });
    }

    function addMiddleWaypoint() {
        if (!selectedWire) {
            return;
        }

        setWorkingConfig((previousConfig) => {
            let changed = false;

            const nextWires: WireConfig[] = previousConfig.wires.map((wire): WireConfig => {
                if (wire.id !== selectedWire.id) {
                    return wire;
                }

                const baseWaypoints =
                    wire.waypoints && wire.waypoints.length >= 2
                        ? [...wire.waypoints]
                        : createDefaultWireWaypoints(previousConfig, wire);

                const insertIndex = Math.max(1, baseWaypoints.length - 1);
                const previousPoint = baseWaypoints[insertIndex - 1];
                const nextPoint = baseWaypoints[insertIndex] ?? previousPoint;
                const newWaypoint = {
                    x: roundCoordinate((previousPoint.x + nextPoint.x) / 2),
                    y: roundCoordinate((previousPoint.y + nextPoint.y) / 2),
                };

                baseWaypoints.splice(insertIndex, 0, newWaypoint);
                changed = true;

                return {
                    ...wire,
                    routeMode: 'guided' as const,
                    waypoints: baseWaypoints,
                };
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                wires: nextWires,
            };
        });
    }

    function removeMiddleWaypoint(index: number) {
        if (!selectedWire) {
            return;
        }

        setWorkingConfig((previousConfig) => {
            let changed = false;

            const nextWires: WireConfig[] = previousConfig.wires.map((wire): WireConfig => {
                if (wire.id !== selectedWire.id) {
                    return wire;
                }

                const waypoints = wire.waypoints ? [...wire.waypoints] : [];
                const targetIndex = index + 1;
                if (targetIndex <= 0 || targetIndex >= waypoints.length - 1) {
                    return wire;
                }

                waypoints.splice(targetIndex, 1);
                changed = true;

                const nextWireBase: WireConfig = {
                    ...wire,
                    waypoints,
                };

                if (waypoints.length >= 3) {
                    return {
                        ...nextWireBase,
                        routeMode: 'guided' as const,
                    };
                }

                const nextWire: WireConfig = {
                    ...nextWireBase,
                };
                delete nextWire.routeMode;
                return nextWire;
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                wires: nextWires,
            };
        });
    }

    function updateMiddleWaypoint(index: number, axis: 'x' | 'y', value: number) {
        if (!selectedWire) {
            return;
        }

        setWorkingConfig((previousConfig) => {
            let changed = false;

            const nextWires: WireConfig[] = previousConfig.wires.map((wire): WireConfig => {
                if (wire.id !== selectedWire.id || !wire.waypoints || wire.waypoints.length < 3) {
                    return wire;
                }

                const targetIndex = index + 1;
                if (targetIndex <= 0 || targetIndex >= wire.waypoints.length - 1) {
                    return wire;
                }

                const nextCoordinate = roundCoordinate(value);
                const existingPoint = wire.waypoints[targetIndex];

                if (isSameCoordinate(existingPoint[axis], nextCoordinate)) {
                    return wire;
                }

                const nextWaypoints = wire.waypoints.map((point, pointIndex) => {
                    if (pointIndex !== targetIndex) {
                        return point;
                    }

                    return {
                        ...point,
                        [axis]: nextCoordinate,
                    };
                });

                changed = true;
                return {
                    ...wire,
                    routeMode: 'guided' as const,
                    waypoints: nextWaypoints,
                };
            });

            if (!changed) {
                return previousConfig;
            }

            return {
                ...previousConfig,
                wires: nextWires,
            };
        });
    }

    async function copyPatchToClipboard() {
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                throw new Error('clipboard-not-supported');
            }

            await navigator.clipboard.writeText(patchJson);
            setFeedback('已复制布局补丁到剪贴板。');
        } catch {
            setFeedback('复制失败: 当前环境不支持剪贴板写入，请使用下载按钮。');
        }
    }

    function downloadPatch() {
        const stamp = formatFileStamp();
        createDownload(`datapath-layout-patch-${stamp}.json`, `${patchJson}\n`);
        setFeedback('补丁文件已下载。');
    }

    function downloadFullConfig() {
        const stamp = formatFileStamp();
        const fullConfigText = `${JSON.stringify(workingConfig, null, 2)}\n`;
        createDownload(`multicycle-datapath-tuned-${stamp}.json`, fullConfigText);
        setFeedback('完整配置文件已下载。');
    }

    function resetToBaseline() {
        setWorkingConfig(cloneConfig(baselineConfig));
        setFeedback('已恢复到基线布局。');
    }

    return (
        <div className="layout-workbench-shell">
            <header className="layout-workbench-header">
                <div>
                    <p className="eyebrow">离线校准模式</p>
                    <h1>数据通路布局校准台</h1>
                    <p className="layout-workbench-copy">
                        这个页面只用于一次性微调连线和锚点 offset。调完后导出补丁，再通过脚本合入主配置。
                    </p>
                </div>

                <div className="layout-workbench-actions">
                    <a className="preset-pill" href="/">
                        返回主界面
                    </a>
                    <button type="button" className="preset-pill" onClick={resetToBaseline}>
                        重置到基线
                    </button>
                    <button type="button" className="preset-pill" onClick={downloadFullConfig}>
                        下载完整配置
                    </button>
                    <button type="button" className="preset-pill" onClick={downloadPatch}>
                        下载布局补丁
                    </button>
                    <button type="button" className="preset-pill" onClick={copyPatchToClipboard}>
                        复制补丁 JSON
                    </button>
                </div>
            </header>

            <div className="layout-workbench-status">{feedback}</div>

            <main className="layout-workbench-grid">
                <section className="layout-workbench-panel">
                    <div className="layout-workbench-section">
                        <h2>锚点微调</h2>

                        <label className="layout-workbench-field">
                            组件
                            <select
                                value={selectedComponentId}
                                onChange={(event) => setSelectedComponentId(event.target.value)}
                            >
                                {workingConfig.components.map((component) => (
                                    <option key={component.id} value={component.id}>
                                        {component.label} ({component.id})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="layout-workbench-field">
                            端口
                            <select value={selectedPortName} onChange={(event) => setSelectedPortName(event.target.value)}>
                                {selectedComponent?.ports.map((port) => (
                                    <option key={port.name} value={port.name}>
                                        {port.name} · {port.position}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="layout-workbench-field">
                            offset (0 ~ 1)
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={typeof selectedPort?.offset === 'number' ? selectedPort.offset : 0.5}
                                onChange={(event) => updateSelectedPortOffset(Number(event.target.value))}
                                disabled={!selectedPort}
                            />
                        </label>

                        <label className="layout-workbench-field layout-workbench-field--inline">
                            精确值
                            <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.001}
                                value={typeof selectedPort?.offset === 'number' ? selectedPort.offset : 0.5}
                                onChange={(event) => updateSelectedPortOffset(Number(event.target.value))}
                                disabled={!selectedPort}
                            />
                        </label>
                    </div>

                    <div className="layout-workbench-section">
                        <h2>连线微调</h2>

                        <label className="layout-workbench-field">
                            连线
                            <select value={selectedWireId} onChange={(event) => setSelectedWireId(event.target.value)}>
                                {workingConfig.wires.map((wire) => (
                                    <option key={wire.id} value={wire.id}>
                                        {wire.id}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="layout-workbench-field">
                            路由模式
                            <select
                                value={selectedWire?.routeMode ?? 'auto'}
                                onChange={(event) => setSelectedWireRouteMode(event.target.value as 'auto' | 'guided')}
                                disabled={!selectedWire}
                            >
                                <option value="auto">auto</option>
                                <option value="guided">guided</option>
                            </select>
                        </label>

                        <div className="layout-workbench-waypoint-actions">
                            <button type="button" className="preset-pill" onClick={addMiddleWaypoint} disabled={!selectedWire}>
                                添加折点
                            </button>
                        </div>

                        <div className="layout-waypoint-list">
                            {middleWaypoints.length === 0 ? (
                                <p className="layout-waypoint-empty">当前没有中间折点。可在画布拖出折点或点击“添加折点”。</p>
                            ) : (
                                middleWaypoints.map((point, index) => (
                                    <article key={`${selectedWireId}-middle-${index}`} className="layout-waypoint-card">
                                        <div className="layout-waypoint-head">
                                            <strong>折点 {index + 1}</strong>
                                            <button
                                                type="button"
                                                className="preset-pill"
                                                onClick={() => removeMiddleWaypoint(index)}
                                            >
                                                删除
                                            </button>
                                        </div>

                                        <label className="layout-workbench-field layout-workbench-field--inline">
                                            X
                                            <input
                                                type="number"
                                                step={1}
                                                value={point.x}
                                                onChange={(event) =>
                                                    updateMiddleWaypoint(index, 'x', Number(event.target.value))
                                                }
                                            />
                                        </label>

                                        <label className="layout-workbench-field layout-workbench-field--inline">
                                            Y
                                            <input
                                                type="number"
                                                step={1}
                                                value={point.y}
                                                onChange={(event) =>
                                                    updateMiddleWaypoint(index, 'y', Number(event.target.value))
                                                }
                                            />
                                        </label>
                                    </article>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                <section className="layout-workbench-canvas-panel">
                    <div className="layout-workbench-canvas-toolbar">
                        <span className="editor-pill">缩放 {zoomLevel.toFixed(2)}x</span>
                        <span className="editor-pill">左键拖动折点/端点，右键平移</span>
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

                    <div className="datapath-canvas-shell layout-workbench-canvas-shell">
                        <ComponentFactory
                            ref={canvasRef}
                            config={workingConfig}
                            activeComponentIds={activeComponentIds}
                            activeWireIds={activeWireIds}
                            componentDetails={componentDetails}
                            editable
                            onZoomLevelChange={(nextScale) => setZoomLevel(clampScale(nextScale))}
                            onWireLayoutChange={handleWireLayoutChange}
                        />
                    </div>
                </section>

                <section className="layout-workbench-panel">
                    <div className="layout-workbench-section">
                        <h2>补丁预览</h2>
                        <p className="layout-workbench-copy">
                            当前变更: 组件 {layoutPatch.components.length} 项，连线 {layoutPatch.wires.length} 项。
                        </p>
                        <p className="layout-workbench-copy">
                            {hasChanges ? '可以直接导出补丁。' : '当前没有差异。'}
                        </p>
                        <textarea className="layout-workbench-json" value={patchJson} readOnly />
                        <p className="layout-workbench-copy">
                            合入命令: npm run layout:apply -- 路径/你的补丁.json
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
