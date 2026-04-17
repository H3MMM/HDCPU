import { describe, expect, it } from 'vitest';
import { getCycleIntervalMs } from '../useExecutionLoop';

describe('useExecutionLoop helper', () => {
  it('maps higher playback speeds to shorter cycle intervals', () => {
    expect(getCycleIntervalMs(0.25)).toBe(1000);
    expect(getCycleIntervalMs(1)).toBe(250);
    expect(getCycleIntervalMs(3)).toBeCloseTo(83.333, 2);
  });

  it('clamps unsupported speeds into the allowed playback range', () => {
    expect(getCycleIntervalMs(0)).toBe(1000);
    expect(getCycleIntervalMs(99)).toBeCloseTo(83.333, 2);
  });
});
