import { describe, expect, it } from 'vitest';
import {
    applyDatapathLayoutPatch,
    buildDatapathLayoutPatch,
    hasDatapathLayoutPatchChanges,
    type DatapathLayoutPatch,
} from '../datapath-layout-patch';
import type { DatapathConfig } from '../../types';

function createBaseConfig(): DatapathConfig {
    return {
        metadata: {
            name: 'Test',
            type: 'multicycle',
            version: '1.0.0',
            canvasSize: { width: 640, height: 320 },
        },
        components: [
            {
                id: 'a',
                type: 'register',
                label: 'A',
                position: { x: 10, y: 20 },
                size: { width: 80, height: 60 },
                ports: [
                    {
                        name: 'out',
                        direction: 'out',
                        position: 'right',
                        offset: 0.5,
                        busWidth: 32,
                        signalType: 'data',
                    },
                ],
            },
            {
                id: 'b',
                type: 'register',
                label: 'B',
                position: { x: 220, y: 20 },
                size: { width: 80, height: 60 },
                ports: [
                    {
                        name: 'in',
                        direction: 'in',
                        position: 'left',
                        offset: 0.5,
                        busWidth: 32,
                        signalType: 'data',
                    },
                ],
            },
        ],
        wires: [
            {
                id: 'wire-a-b',
                from: { component: 'a', port: 'out' },
                to: { component: 'b', port: 'in' },
                busWidth: 32,
                signalType: 'data',
                waypoints: [
                    { x: 90, y: 50 },
                    { x: 155, y: 50 },
                    { x: 220, y: 50 },
                ],
            },
        ],
    };
}

describe('datapath-layout-patch', () => {
    it('builds a compact patch that only includes changed layout fields', () => {
        const base = createBaseConfig();
        const current = createBaseConfig();

        current.components[0].ports[0].offset = 0.72;
        current.wires[0].routeMode = 'guided';
        current.wires[0].waypoints = [
            { x: 90, y: 50 },
            { x: 140, y: 50 },
            { x: 140, y: 92 },
            { x: 220, y: 92 },
        ];

        const patch = buildDatapathLayoutPatch(base, current, '2026-04-20T00:00:00.000Z');

        expect(hasDatapathLayoutPatchChanges(patch)).toBe(true);
        expect(patch.components).toEqual([
            {
                id: 'a',
                ports: [{ name: 'out', offset: 0.72 }],
            },
        ]);
        expect(patch.wires).toEqual([
            {
                id: 'wire-a-b',
                routeMode: 'guided',
                waypoints: [
                    { x: 90, y: 50 },
                    { x: 140, y: 50 },
                    { x: 140, y: 92 },
                    { x: 220, y: 92 },
                ],
            },
        ]);
    });

    it('applies patch fields and clears routeMode when patch sets auto', () => {
        const base = createBaseConfig();
        const patch: DatapathLayoutPatch = {
            schemaVersion: 1,
            createdAt: '2026-04-20T00:00:00.000Z',
            sourceVersion: '1.0.0',
            components: [
                {
                    id: 'a',
                    position: { x: 12, y: 26 },
                    ports: [{ name: 'out', offset: 0.64 }],
                },
            ],
            wires: [
                {
                    id: 'wire-a-b',
                    routeMode: 'auto',
                    waypoints: [
                        { x: 90, y: 50 },
                        { x: 180, y: 50 },
                        { x: 220, y: 50 },
                    ],
                },
            ],
        };

        const next = applyDatapathLayoutPatch(base, patch);

        expect(next.components[0].position).toEqual({ x: 12, y: 26 });
        expect(next.components[0].ports[0].offset).toBe(0.64);
        expect(next.wires[0]).not.toHaveProperty('routeMode');
        expect(next.wires[0].waypoints).toEqual([
            { x: 90, y: 50 },
            { x: 180, y: 50 },
            { x: 220, y: 50 },
        ]);
    });
});
