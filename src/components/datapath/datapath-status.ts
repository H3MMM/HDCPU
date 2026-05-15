import type { DatapathMode } from '../../config/load-datapath-config';

const MULTICYCLE_STATUS_WIRES = {
  A: ['regfile-to-a', 'rega-to-alu'],
  B: ['regfile-to-b', 'regb-to-rs2mux', 'regb-to-dmem'],
  F: ['alu-to-aluout', 'aluout-to-pcsrc', 'aluout-to-dmem', 'aluout-to-muxwb'],
  imm32: ['immgen-to-rs2mux', 'immgen-to-jumptarget', 'immgen-to-muxwb'],
  PC: ['pc-to-imem', 'pc-to-pc0', 'pc-to-pcplus4', 'pcsrc-to-pc'],
  PC0: ['pc-to-pc0', 'pc0-to-jumptarget'],
  IR: ['imem-to-ir', 'ir-to-decoder'],
  FR: ['alu-to-branchlogic', 'branchlogic-to-flagreg', 'flagreg-to-ctrl'],
  MDR: ['dmem-to-mdr', 'mdr-to-muxwb'],
  PC_s: ['ctrl-to-pc-select'],
  PC_Write: ['ctrl-to-pc-write'],
  PC0_Write: ['ctrl-to-pc0-write'],
  IR_Write: ['ctrl-to-ir-write'],
  Reg_Write: ['ctrl-to-regfile-write'],
  rs2_imm_s: ['ctrl-to-rs2mux-select'],
  ALU_OP: ['ctrl-to-alu-op'],
  Mem_Write: ['ctrl-to-dmem-write'],
  w_data_s: ['ctrl-to-muxwb-select'],
  Size_s: ['ctrl-to-size-select'],
  SE_s: ['ctrl-to-se-select'],
} as const;

const PIPELINE_STATUS_WIRES = {
  A: ['pipeline-wire-492-regfile-rd-a-to-id-ex', 'pipeline-wire-501-id-ex-a-to-alu'],
  B: [
    'pipeline-wire-491-regfile-rd-b-to-id-ex',
    'pipeline-wire-493-id-ex-b-to-alu-src-b',
    'pipeline-wire-561-id-ex-b-to-bypass-junction',
    'pipeline-wire-419-bypass-b-to-ex-mem',
    'pipeline-wire-449-ex-mem-b-to-data-mem-write-data',
  ],
  F: [
    'pipeline-wire-500-alu-result-to-ex-mem',
    'pipeline-wire-458-ex-mem-alu-result-to-data-mem',
    'pipeline-wire-467-mem-wb-alu-result-to-wb-mux',
    'pipeline-wire-560-ex-mem-alu-result-to-feedback-junction',
  ],
  imm32: [
    'pipeline-wire-557-if-id-imm-to-imm-gen',
    'pipeline-wire-558-imm-gen-offset-to-id-ex',
    'pipeline-wire-559-id-ex-imm32-to-imm-junction',
    'pipeline-wire-457-id-ex-imm32-to-alu-src-b',
    'pipeline-wire-497-id-ex-imm32-to-branch-adder',
    'pipeline-wire-508-id-ex-imm32-to-ex-mem',
    'pipeline-wire-541-mem-wb-imm32-to-wb-mux',
  ],
  PC: [
    'pipeline-wire-418-pc-to-instr-mem-addr',
    'pipeline-wire-423-pc-line-to-pc-plus4',
    'pipeline-wire-426-pc-plus4-to-pc-mux',
    'pipeline-wire-466-pc-mux-to-pc',
    'pipeline-wire-465-branch-target-to-pc-mux',
    'pipeline-wire-536-ex-mem-feedback-to-pc-mux',
    'pipeline-wire-560-ex-mem-alu-result-to-feedback-junction',
  ],
  PC0: [
    'pipeline-wire-475-pc0-entry-to-if-id',
    'pipeline-wire-473-if-id-pc0-to-id-ex',
    'pipeline-wire-495-id-ex-pc0-to-branch-adder',
  ],
  IR: [
    'pipeline-wire-469-instr-mem-ir-to-if-id',
    'pipeline-wire-441-if-id-ir-to-control',
    'pipeline-wire-557-if-id-imm-to-imm-gen',
  ],
  FR: ['pipeline-wire-512-alu-flag-to-branch-logic', 'pipeline-wire-514-alu-branch-flag-to-branch-logic'],
  MDR: ['pipeline-wire-453-data-mem-read-to-mem-wb', 'pipeline-wire-540-mem-wb-read-data-to-wb-mux'],
  PC_s: ['pipeline-wire-535-pc-select-to-pc-mux'],
  bcc: ['pipeline-wire-510-id-ex-bcc-to-branch-logic'],
  ALU_OP: ['pipeline-wire-499-id-ex-alu-op-to-alu'],
  rs2_imm_s: ['pipeline-wire-498-id-ex-rs2-imm-select-to-mux'],
  Reg_Write: ['pipeline-wire-554-mem-wb-reg-write-to-regfile'],
  Mem_Write: ['pipeline-wire-530-ex-mem-mem-write-to-data-mem'],
  w_data_s: ['pipeline-wire-448-mem-wb-control-to-wb-mux'],
} as const;

const STATUS_WIRES_BY_MODE = {
  multicycle: MULTICYCLE_STATUS_WIRES,
  pipeline: PIPELINE_STATUS_WIRES,
} as const satisfies Record<DatapathMode, Readonly<Record<string, readonly string[]>>>;

export function resolveActiveStatusLabels(
  datapathMode: DatapathMode,
  activeWireIds: ReadonlySet<string>
): ReadonlySet<string> {
  const activeLabels = new Set<string>();
  const statusWires = STATUS_WIRES_BY_MODE[datapathMode];
  const entries = Object.entries(statusWires) as Array<[string, readonly string[]]>;

  entries.forEach(([label, wireIds]) => {
    if (wireIds.some((wireId) => activeWireIds.has(wireId))) {
      activeLabels.add(label);
    }
  });

  return activeLabels;
}
