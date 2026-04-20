import type { DatapathConfig, WireConfig } from '../types';

const COORDINATE_EPSILON = 0.0005;

interface LayoutCoordinate {
    x: number;
    y: number;
}

export interface DatapathPortOffsetPatch {
    name: string;
    offset: number;
}

export interface DatapathComponentLayoutPatch {
    id: string;
    position?: LayoutCoordinate;
    ports?: DatapathPortOffsetPatch[];
}

export interface DatapathWireLayoutPatch {
    id: string;
    routeMode?: NonNullable<WireConfig['routeMode']>;
    from?: WireConfig['from'];
    to?: WireConfig['to'];
    waypoints?: LayoutCoordinate[];
}

export interface DatapathLayoutPatch {
    schemaVersion: 1;
    createdAt: string;
    sourceVersion: string;
    components: DatapathComponentLayoutPatch[];
    wires: DatapathWireLayoutPatch[];
}

function cloneConfig(config: DatapathConfig): DatapathConfig {
    return JSON.parse(JSON.stringify(config)) as DatapathConfig;
}

function roundCoordinate(value: number): number {
    return Number(value.toFixed(3));
}

function normalizeCoordinate(point: LayoutCoordinate): LayoutCoordinate {
    return {
        x: roundCoordinate(point.x),
        y: roundCoordinate(point.y),
    };
}

function normalizeWaypoints(points?: LayoutCoordinate[]): LayoutCoordinate[] {
    return (points ?? []).map((point) => normalizeCoordinate(point));
}

function isSameNumber(left?: number, right?: number): boolean {
    if (typeof left !== 'number' && typeof right !== 'number') {
        return true;
    }

    if (typeof left !== 'number' || typeof right !== 'number') {
        return false;
    }

    return Math.abs(left - right) <= COORDINATE_EPSILON;
}

function isSameCoordinate(left: LayoutCoordinate, right: LayoutCoordinate): boolean {
    return isSameNumber(left.x, right.x) && isSameNumber(left.y, right.y);
}

function isSameWaypoints(left?: LayoutCoordinate[], right?: LayoutCoordinate[]): boolean {
    const normalizedLeft = normalizeWaypoints(left);
    const normalizedRight = normalizeWaypoints(right);

    if (normalizedLeft.length !== normalizedRight.length) {
        return false;
    }

    for (let index = 0; index < normalizedLeft.length; index += 1) {
        if (!isSameCoordinate(normalizedLeft[index], normalizedRight[index])) {
            return false;
        }
    }

    return true;
}

function isSameTerminal(left: WireConfig['from'], right: WireConfig['from']): boolean {
    return left.component === right.component && left.port === right.port;
}

export function hasDatapathLayoutPatchChanges(patch: DatapathLayoutPatch): boolean {
    return patch.components.length > 0 || patch.wires.length > 0;
}

export function buildDatapathLayoutPatch(
    baseConfig: DatapathConfig,
    currentConfig: DatapathConfig,
    createdAt: string = new Date().toISOString()
): DatapathLayoutPatch {
    const baseComponents = new Map(baseConfig.components.map((component) => [component.id, component]));
    const baseWires = new Map(baseConfig.wires.map((wire) => [wire.id, wire]));
    const componentPatches: DatapathComponentLayoutPatch[] = [];
    const wirePatches: DatapathWireLayoutPatch[] = [];

    for (const component of currentConfig.components) {
        const baseline = baseComponents.get(component.id);
        if (!baseline) {
            continue;
        }

        let positionPatch: DatapathComponentLayoutPatch['position'];
        if (
            !isSameNumber(component.position.x, baseline.position.x) ||
            !isSameNumber(component.position.y, baseline.position.y)
        ) {
            positionPatch = normalizeCoordinate(component.position);
        }

        const baselinePorts = new Map(baseline.ports.map((port) => [port.name, port]));
        const portPatches: DatapathPortOffsetPatch[] = [];

        for (const port of component.ports) {
            const baselinePort = baselinePorts.get(port.name);
            if (!baselinePort) {
                continue;
            }

            if (!isSameNumber(port.offset, baselinePort.offset) && typeof port.offset === 'number') {
                portPatches.push({
                    name: port.name,
                    offset: roundCoordinate(port.offset),
                });
            }
        }

        if (positionPatch || portPatches.length > 0) {
            componentPatches.push({
                id: component.id,
                ...(positionPatch ? { position: positionPatch } : {}),
                ...(portPatches.length > 0 ? { ports: portPatches } : {}),
            });
        }
    }

    for (const wire of currentConfig.wires) {
        const baseline = baseWires.get(wire.id);
        if (!baseline) {
            continue;
        }

        const routeMode = wire.routeMode ?? 'auto';
        const baselineRouteMode = baseline.routeMode ?? 'auto';
        const routeModeChanged = routeMode !== baselineRouteMode;
        const fromChanged = !isSameTerminal(wire.from, baseline.from);
        const toChanged = !isSameTerminal(wire.to, baseline.to);
        const waypointsChanged = !isSameWaypoints(wire.waypoints, baseline.waypoints);

        if (routeModeChanged || fromChanged || toChanged || waypointsChanged) {
            wirePatches.push({
                id: wire.id,
                ...(routeModeChanged ? { routeMode } : {}),
                ...(fromChanged ? { from: { ...wire.from } } : {}),
                ...(toChanged ? { to: { ...wire.to } } : {}),
                ...(waypointsChanged ? { waypoints: normalizeWaypoints(wire.waypoints) } : {}),
            });
        }
    }

    return {
        schemaVersion: 1,
        createdAt,
        sourceVersion: baseConfig.metadata.version,
        components: componentPatches,
        wires: wirePatches,
    };
}

export function applyDatapathLayoutPatch(
    baseConfig: DatapathConfig,
    patch: DatapathLayoutPatch
): DatapathConfig {
    const nextConfig = cloneConfig(baseConfig);
    const componentMap = new Map(nextConfig.components.map((component) => [component.id, component]));
    const wireMap = new Map(nextConfig.wires.map((wire) => [wire.id, wire]));

    for (const componentPatch of patch.components) {
        const component = componentMap.get(componentPatch.id);
        if (!component) {
            throw new Error(`布局补丁包含未知组件: ${componentPatch.id}`);
        }

        if (componentPatch.position) {
            component.position = normalizeCoordinate(componentPatch.position);
        }

        if (!componentPatch.ports) {
            continue;
        }

        const portMap = new Map(component.ports.map((port) => [port.name, port]));
        for (const portPatch of componentPatch.ports) {
            const port = portMap.get(portPatch.name);
            if (!port) {
                throw new Error(`布局补丁包含未知端口: ${componentPatch.id}.${portPatch.name}`);
            }

            port.offset = roundCoordinate(portPatch.offset);
        }
    }

    for (const wirePatch of patch.wires) {
        const wire = wireMap.get(wirePatch.id);
        if (!wire) {
            throw new Error(`布局补丁包含未知连线: ${wirePatch.id}`);
        }

        if (wirePatch.from) {
            wire.from = { ...wirePatch.from };
        }

        if (wirePatch.to) {
            wire.to = { ...wirePatch.to };
        }

        if (Object.prototype.hasOwnProperty.call(wirePatch, 'routeMode')) {
            if (wirePatch.routeMode === 'guided') {
                wire.routeMode = 'guided';
            } else {
                delete wire.routeMode;
            }
        }

        if (wirePatch.waypoints) {
            wire.waypoints = normalizeWaypoints(wirePatch.waypoints);
        }
    }

    return nextConfig;
}
