import { describe, expect, it } from 'vitest';
import { createCPUStore, type CPUStoreState } from '../../../store/cpu-store';
import { Stage } from '../../../types';
import { ViewMapper } from '../../../view/view-mapper';
import { resolveActiveStatusLabels } from '../datapath-status';

function getActiveWireIds(state: Pick<CPUStoreState, 'currentSnapshot' | 'datapathConfig'>): Set<string> {
  const mapper = new ViewMapper(state.datapathConfig);
  const viewState = mapper.mapSnapshot(state.currentSnapshot);
  const activeWireIds = new Set<string>();

  viewState.wires.forEach((wireState) => {
    if (wireState.active) {
      activeWireIds.add(wireState.id);
    }
  });

  return activeWireIds;
}

describe('datapath status bar highlights', () => {
  it('drives multicycle status labels from active canvas wires, not changed values', () => {
    const store = createCPUStore();
    const state = store.getState();

    expect(state.currentSnapshot.stage).toBe(Stage.IF);

    const activeLabels = resolveActiveStatusLabels(state.datapathMode, getActiveWireIds(state));

    expect(Array.from(activeLabels)).toEqual(
      expect.arrayContaining(['PC', 'PC0', 'IR', 'PC_s', 'PC_Write', 'PC0_Write', 'IR_Write'])
    );
    expect(activeLabels.has('A')).toBe(false);
    expect(activeLabels.has('B')).toBe(false);
    expect(activeLabels.has('MDR')).toBe(false);
  });

  it('tracks pipeline status labels from the same active wires used by the pipeline canvas', () => {
    const store = createCPUStore();

    store.getState().setSourceCode(`
      addi x1, x0, 10
      addi x2, x0, 20
    `);
    store.getState().setDatapathMode('pipeline');
    store.getState().stepCycle();
    store.getState().stepCycle();

    const state = store.getState();
    const activeWireIds = getActiveWireIds(state);
    const activeLabels = resolveActiveStatusLabels('pipeline', activeWireIds);

    expect(state.currentSnapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('addi x1, x0, 10');
    expect(activeWireIds.has('pipeline-wire-501-id-ex-a-to-alu')).toBe(true);
    expect(activeLabels.has('A')).toBe(true);
    expect(activeLabels.has('ALU_OP')).toBe(true);
    expect(activeLabels.has('MDR')).toBe(false);
  });
});
