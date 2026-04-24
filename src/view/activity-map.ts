import { Stage } from '../types';

export const STAGE_ACTIVE_COMPONENTS: Record<Stage, string[]> = {
  [Stage.IF]: ['pc', 'alu-src-a', 'pc-plus4', 'pc0', 'instr-mem', 'ir'],
  [Stage.ID]: ['ir', 'id-decoder', 'control-unit', 'reg-file', 'reg-a', 'reg-b'],
  [Stage.EX]: ['pc0', 'reg-a', 'reg-b', 'alu-src-b', 'alu', 'branch-logic', 'flag-reg', 'alu-out', 'jump-target', 'alu-src-a'],
  [Stage.MEM]: ['data-mem', 'mdr', 'reg-b', 'alu-out'],
  [Stage.WB]: ['mux-wb', 'reg-file', 'alu-out', 'mdr', 'pc-plus4'],
};

export const STAGE_ACTIVE_WIRES: Record<Stage, string[]> = {
  [Stage.IF]: [],
  [Stage.ID]: [],
  [Stage.EX]: [],
  [Stage.MEM]: [],
  [Stage.WB]: [],
};
