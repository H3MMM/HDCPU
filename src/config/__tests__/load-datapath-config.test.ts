import { getDatapathConfig, summarizeDatapathConfig } from '../load-datapath-config';

describe('loadDatapathConfig', () => {
  it('loads the multicycle datapath configuration', () => {
    const config = getDatapathConfig();

    expect(config.metadata.name).toBe('RISC-V Multicycle CPU');
    expect(config.components.length).toBeGreaterThan(0);
    expect(config.wires.length).toBeGreaterThan(0);
  });

  it('summarizes the configuration for UI consumption', () => {
    const summary = summarizeDatapathConfig();

    expect(summary.componentCount).toBe(getDatapathConfig().components.length);
    expect(summary.wireCount).toBe(getDatapathConfig().wires.length);
    expect(summary.componentTypeCounts.register).toBeGreaterThan(0);
    expect(summary.componentTypeCounts.memory).toBeGreaterThan(0);
  });

  it('preserves the textbook source ordering for PC and write-back selection', () => {
    const config = getDatapathConfig();
    const wires = new Map(config.wires.map((wire) => [wire.id, wire]));
    const components = new Map(config.components.map((component) => [component.id, component]));

    expect(wires.get('pcplus4-to-pcsrc')).toMatchObject({
      from: { component: 'pc-plus4', port: 'out' },
      to: { component: 'alu-src-a', port: 'in0' },
    });
    expect(wires.get('aluout-to-pcsrc')).toMatchObject({
      from: { component: 'alu-out', port: 'out' },
      to: { component: 'alu-src-a', port: 'in1' },
    });
    expect(wires.get('jumptarget-to-pcsrc')).toMatchObject({
      from: { component: 'jump-target', port: 'out' },
      to: { component: 'alu-src-a', port: 'in2' },
    });

    expect(wires.get('aluout-to-muxwb')).toMatchObject({
      to: { component: 'mux-wb', port: 'in0' },
    });
    expect(wires.get('mdr-to-muxwb')).toMatchObject({
      from: { component: 'mdr', port: 'out' },
      to: { component: 'mux-wb', port: 'in1' },
    });
    expect(wires.get('pc-to-muxwb')).toMatchObject({
      from: { component: 'pc0', port: 'out' },
      to: { component: 'mux-wb', port: 'in2' },
    });
    expect(wires.get('immgen-to-muxwb')).toMatchObject({
      from: { component: 'jump-target', port: 'out' },
      to: { component: 'mux-wb', port: 'in3' },
    });

    expect(components.get('reg-file')?.ports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'write', position: 'top' }),
        expect.objectContaining({ name: 'clk', position: 'bottom' }),
      ])
    );
    expect(components.get('flag-reg')).toMatchObject({
      clocked: true,
    });
  });

  it('keeps every datapath wire attached to the textbook source and destination ports', () => {
    const config = getDatapathConfig();
    const wires = new Map(config.wires.map((wire) => [wire.id, wire]));
    const expectedConnections = [
      ['pc-to-imem', 'pc', 'out', 'instr-mem', 'addr'],
      ['imem-to-ir', 'instr-mem', 'data_out', 'ir', 'in'],
      ['pc-to-pc0', 'pc', 'out', 'pc0', 'in'],
      ['pc-to-pcplus4', 'pc', 'out', 'pc-plus4', 'a'],
      ['const4-to-pcplus4', 'const-4', 'out', 'pc-plus4', 'b'],
      ['pcplus4-to-pcsrc', 'pc-plus4', 'out', 'alu-src-a', 'in0'],
      ['pcsrc-to-pc', 'alu-src-a', 'out', 'pc', 'in'],
      ['ir-to-decoder', 'ir', 'out', 'id-decoder', 'instruction'],
      ['decoder-opcode-to-ctrl', 'id-decoder', 'opcode', 'control-unit', 'opcode'],
      ['decoder-funct7-to-ctrl', 'id-decoder', 'funct7', 'control-unit', 'funct7'],
      ['decoder-funct3-to-ctrl', 'id-decoder', 'funct3', 'control-unit', 'funct3'],
      ['decoder-rs1-to-regfile', 'id-decoder', 'rs1', 'reg-file', 'rs1_addr'],
      ['decoder-rs2-to-regfile', 'id-decoder', 'rs2', 'reg-file', 'rs2_addr'],
      ['decoder-rd-to-regfile', 'id-decoder', 'rd', 'reg-file', 'rd_addr'],
      ['decoder-to-immgen', 'id-decoder', 'imm32', 'imm-gen', 'in'],
      ['regfile-to-a', 'reg-file', 'rs1_data', 'reg-a', 'in'],
      ['regfile-to-b', 'reg-file', 'rs2_data', 'reg-b', 'in'],
      ['rega-to-alu', 'reg-a', 'out', 'alu', 'a'],
      ['regb-to-rs2mux', 'reg-b', 'out', 'alu-src-b', 'in0'],
      ['immgen-to-rs2mux', 'imm-gen', 'out', 'alu-src-b', 'in1'],
      ['rs2mux-to-alu', 'alu-src-b', 'out', 'alu', 'b'],
      ['alu-to-aluout', 'alu', 'result', 'alu-out', 'in'],
      ['alu-to-branchlogic', 'alu', 'result', 'branch-logic', 'in'],
      ['branchlogic-to-flagreg', 'branch-logic', 'out', 'flag-reg', 'in'],
      ['flagreg-to-ctrl', 'flag-reg', 'out', 'control-unit', 'flag'],
      ['pc0-to-jumptarget', 'pc0', 'out', 'jump-target', 'a'],
      ['immgen-to-jumptarget', 'imm-gen', 'out', 'jump-target', 'b'],
      ['jumptarget-to-pcsrc', 'jump-target', 'out', 'alu-src-a', 'in2'],
      ['aluout-to-pcsrc', 'alu-out', 'out', 'alu-src-a', 'in1'],
      ['aluout-to-dmem', 'alu-out', 'out', 'data-mem', 'addr'],
      ['regb-to-dmem', 'reg-b', 'out', 'data-mem', 'write_data'],
      ['dmem-to-mdr', 'data-mem', 'data_out', 'mdr', 'in'],
      ['aluout-to-muxwb', 'alu-out', 'out', 'mux-wb', 'in0'],
      ['mdr-to-muxwb', 'mdr', 'out', 'mux-wb', 'in1'],
      ['pc-to-muxwb', 'pc0', 'out', 'mux-wb', 'in2'],
      ['immgen-to-muxwb', 'jump-target', 'out', 'mux-wb', 'in3'],
      ['muxwb-to-regfile', 'mux-wb', 'out', 'reg-file', 'write_data'],
      ['ctrl-to-pc-select', 'control-unit', 'pc_select', 'alu-src-a', 'select'],
      ['ctrl-to-pc-write', 'control-unit', 'pc_write', 'pc', 'write'],
      ['ctrl-to-pc0-write', 'control-unit', 'pc0_write', 'pc0', 'write'],
      ['ctrl-to-ir-write', 'control-unit', 'ir_write', 'ir', 'write'],
      ['ctrl-to-regfile-write', 'control-unit', 'reg_write', 'reg-file', 'write'],
      ['ctrl-to-rs2mux-select', 'control-unit', 'rs2_imm_select', 'alu-src-b', 'select'],
      ['ctrl-to-alu-op', 'control-unit', 'alu_op', 'alu', 'op'],
      ['ctrl-to-dmem-write', 'control-unit', 'mem_write', 'data-mem', 'wr_en'],
      ['ctrl-to-muxwb-select', 'control-unit', 'wb_select', 'mux-wb', 'select'],
      ['clk-to-pc', 'clk-source', 'tap', 'pc', 'clk'],
      ['clk-to-imem', 'clk-source', 'out', 'instr-mem', 'rd_en'],
      ['clk-to-pc0', 'clk-source', 'out', 'pc0', 'clk'],
      ['clk-to-ir', 'clk-source', 'tap', 'ir', 'clk'],
      ['clk-to-regfile', 'clk-source', 'out', 'reg-file', 'clk'],
      ['clk-to-rega', 'clk-source', 'tap', 'reg-a', 'clk'],
      ['clk-to-regb', 'clk-source', 'tap', 'reg-b', 'clk'],
      ['clk-to-aluout', 'clk-source', 'tap', 'alu-out', 'clk'],
      ['clk-to-flagreg', 'clk-source', 'tap', 'flag-reg', 'clk'],
      ['clk-to-dmem', 'clk-source', 'out', 'data-mem', 'clock'],
      ['clk-to-mdr', 'clk-source', 'tap', 'mdr', 'clk'],
    ] as const;

    expect(wires.size).toBe(expectedConnections.length);

    for (const [id, fromComponent, fromPort, toComponent, toPort] of expectedConnections) {
      expect(wires.get(id)).toMatchObject({
        from: { component: fromComponent, port: fromPort },
        to: { component: toComponent, port: toPort },
      });
    }

    expect(wires.get('alu-to-branchlogic')).toMatchObject({
      busWidth: 32,
      signalType: 'data',
    });
    expect(wires.get('branchlogic-to-flagreg')).toMatchObject({
      busWidth: 1,
      signalType: 'control',
    });
  });
});
