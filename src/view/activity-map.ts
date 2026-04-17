import { Stage } from '../types';

export const STAGE_ACTIVE_COMPONENTS: Record<Stage, string[]> = {
  [Stage.IF]: ['pc', 'instr-mem', 'ir', 'alu'],
  [Stage.ID]: ['ir', 'control-unit', 'reg-file', 'imm-gen', 'reg-a', 'reg-b'],
  [Stage.EX]: ['alu-src-a', 'alu-src-b', 'alu', 'alu-out', 'branch-logic', 'jump-target'],
  [Stage.MEM]: ['data-mem', 'mdr', 'reg-b', 'alu-out'],
  [Stage.WB]: ['mux-wb', 'reg-file', 'alu-out', 'mdr'],
};

export const STAGE_ACTIVE_WIRES: Record<Stage, string[]> = {
  [Stage.IF]: ['pc-to-imem', 'imem-to-ir', 'pc-to-alu', 'alu-to-pc', 'ctrl-to-pc-write', 'ctrl-to-ir-write'],
  [Stage.ID]: ['ir-to-ctrl', 'ir-to-regfile', 'regfile-to-a', 'regfile-to-b', 'ir-to-immgen'],
  [Stage.EX]: ['a-to-alusrc', 'b-to-alusrc', 'alusrca-to-alu', 'alusrcb-to-alu', 'alu-to-aluout', 'jump-target-to-pc'],
  [Stage.MEM]: ['aluout-to-dmem', 'dmem-to-mdr', 'regb-to-dmem', 'ctrl-to-dmem-read', 'ctrl-to-dmem-write'],
  [Stage.WB]: ['muxwb-to-regfile', 'aluout-to-muxwb', 'mdr-to-muxwb', 'ctrl-to-regfile-write'],
};
