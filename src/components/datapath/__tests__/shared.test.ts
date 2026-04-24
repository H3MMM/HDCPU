import { describe, expect, it } from 'vitest';
import { getComponentTone, getPortPlacementFromAbsoluteCoordinates, getSignalTone } from '../shared';
import type { ComponentConfig, PortConfig } from '../../../types';

describe('datapath shared helpers', () => {
  it('converts absolute port coordinates to component-local render placement', () => {
    const component: ComponentConfig = {
      id: 'alu',
      type: 'alu',
      label: 'ALU',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 120 },
      ports: [],
    };
    const port: PortConfig = {
      id: 'result',
      name: 'result',
      direction: 'out',
      position: 'right',
      side: 'right',
      x: 180,
      y: 248,
      busWidth: 32,
      signalType: 'data',
    };

    const placement = getPortPlacementFromAbsoluteCoordinates(port, component);

    expect(placement).toEqual({
      x: 80,
      y: 48,
      labelX: 92,
      labelY: 52,
      textAnchor: 'start',
    });
  });

  it('keeps long textbook side port labels inside the owning component', () => {
    const component: ComponentConfig = {
      id: 'data-mem',
      type: 'memory',
      label: 'DM',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 120 },
      skin: 'textbook-memory',
      portStyle: 'minimal',
      ports: [],
    };
    const port: PortConfig = {
      id: 'data_out',
      name: 'data_out',
      label: 'M_R_Data',
      direction: 'out',
      position: 'right',
      side: 'right',
      x: 180,
      y: 248,
      busWidth: 32,
      signalType: 'data',
    };

    const placement = getPortPlacementFromAbsoluteCoordinates(port, component);

    expect(placement).toEqual({
      x: 80,
      y: 48,
      labelX: 66,
      labelY: 52,
      textAnchor: 'end',
    });
  });

  it('supports placing top and bottom port labels inside a component explicitly', () => {
    const component: ComponentConfig = {
      id: 'reg-file',
      type: 'register-file',
      label: 'Regs',
      position: { x: 100, y: 200 },
      size: { width: 180, height: 240 },
      portStyle: 'minimal',
      portLabelPlacement: 'inside',
      ports: [],
    };
    const topPort: PortConfig = {
      id: 'write',
      name: 'write',
      label: 'Reg_Write',
      direction: 'in',
      position: 'top',
      side: 'top',
      x: 190,
      y: 200,
      busWidth: 1,
      signalType: 'control',
    };
    const bottomPort: PortConfig = {
      id: 'clk',
      name: 'clk',
      label: 'clk_Regs',
      direction: 'in',
      position: 'bottom',
      side: 'bottom',
      x: 190,
      y: 440,
      busWidth: 1,
      signalType: 'control',
    };

    expect(getPortPlacementFromAbsoluteCoordinates(topPort, component)).toEqual({
      x: 90,
      y: 0,
      labelX: 90,
      labelY: 16,
      textAnchor: 'middle',
    });
    expect(getPortPlacementFromAbsoluteCoordinates(bottomPort, component)).toEqual({
      x: 90,
      y: 240,
      labelX: 90,
      labelY: 232,
      textAnchor: 'middle',
    });
  });

  it('returns null when absolute coordinates are missing', () => {
    const component: ComponentConfig = {
      id: 'alu',
      type: 'alu',
      label: 'ALU',
      position: { x: 100, y: 200 },
      size: { width: 80, height: 120 },
      ports: [],
    };
    const port: PortConfig = {
      id: 'a',
      name: 'a',
      direction: 'in',
      position: 'left',
      busWidth: 32,
      signalType: 'data',
    };

    expect(getPortPlacementFromAbsoluteCoordinates(port, component)).toBeNull();
  });

  it('returns stable tones for component and signal categories', () => {
    expect(getComponentTone('alu').frame).toBe('#61734f');
    expect(getSignalTone('control')).toBe('#1b6b72');
  });
});
