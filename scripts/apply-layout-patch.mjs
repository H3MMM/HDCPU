import fs from 'node:fs/promises';
import path from 'node:path';

function roundCoordinate(value) {
    return Number(Number(value).toFixed(3));
}

function normalizeCoordinate(point) {
    return {
        x: roundCoordinate(point.x),
        y: roundCoordinate(point.y),
    };
}

function normalizeWaypoints(points) {
    return (points ?? []).map((point) => normalizeCoordinate(point));
}

function fail(message) {
    console.error(`[layout:apply] ${message}`);
    process.exit(1);
}

function ensureArray(value, fieldName) {
    if (!Array.isArray(value)) {
        fail(`字段 ${fieldName} 必须是数组。`);
    }
}

async function main() {
    const patchArg = process.argv[2];
    if (!patchArg) {
        fail('请传入补丁文件路径，例如: npm run layout:apply -- ./patches/layout.json');
    }

    const projectRoot = process.cwd();
    const configPath = path.resolve(projectRoot, 'src/config/multicycle-datapath.json');
    const patchPath = path.resolve(projectRoot, patchArg);

    const [configRaw, patchRaw] = await Promise.all([
        fs.readFile(configPath, 'utf8'),
        fs.readFile(patchPath, 'utf8'),
    ]);

    const config = JSON.parse(configRaw);
    const patch = JSON.parse(patchRaw);

    if (patch.schemaVersion !== 1) {
        fail(`不支持的 schemaVersion: ${String(patch.schemaVersion)}`);
    }

    ensureArray(patch.components, 'components');
    ensureArray(patch.wires, 'wires');

    const componentMap = new Map(config.components.map((component) => [component.id, component]));
    const wireMap = new Map(config.wires.map((wire) => [wire.id, wire]));

    for (const componentPatch of patch.components) {
        const component = componentMap.get(componentPatch.id);
        if (!component) {
            fail(`补丁引用了未知组件: ${componentPatch.id}`);
        }

        if (componentPatch.position) {
            component.position = normalizeCoordinate(componentPatch.position);
        }

        if (!componentPatch.ports) {
            continue;
        }

        ensureArray(componentPatch.ports, `components.${componentPatch.id}.ports`);

        const portMap = new Map(component.ports.map((port) => [port.name, port]));
        for (const portPatch of componentPatch.ports) {
            const port = portMap.get(portPatch.name);
            if (!port) {
                fail(`补丁引用了未知端口: ${componentPatch.id}.${portPatch.name}`);
            }

            port.offset = roundCoordinate(portPatch.offset);
        }
    }

    for (const wirePatch of patch.wires) {
        const wire = wireMap.get(wirePatch.id);
        if (!wire) {
            fail(`补丁引用了未知连线: ${wirePatch.id}`);
        }

        if (wirePatch.from) {
            wire.from = {
                component: String(wirePatch.from.component),
                port: String(wirePatch.from.port),
            };
        }

        if (wirePatch.to) {
            wire.to = {
                component: String(wirePatch.to.component),
                port: String(wirePatch.to.port),
            };
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

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

    console.log(`[layout:apply] 已应用补丁: ${patchPath}`);
    console.log(`[layout:apply] 已写回配置: ${configPath}`);
}

main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
});
