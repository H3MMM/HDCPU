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
});
