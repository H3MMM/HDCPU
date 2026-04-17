import { describe, expect, it } from 'vitest';
import { ImmediateGenerator } from '../immediate-gen';

describe('ImmediateGenerator', () => {
  const generator = new ImmediateGenerator();

  it('should extract I-type immediates', () => {
    expect(generator.generate(0x00C12083, 'I')).toBe(12);
  });

  it('should extract S-type immediates', () => {
    expect(generator.generate(0xFE112E23, 'S')).toBe(-4);
  });

  it('should extract B-type immediates', () => {
    expect(generator.generate(0xFE208EE3, 'B')).toBe(-4);
  });

  it('should extract U-type immediates', () => {
    expect(generator.generate(0x12345137, 'U')).toBe(0x12345000);
  });

  it('should extract J-type immediates', () => {
    expect(generator.generate(0x008000EF, 'J')).toBe(8);
  });
});
