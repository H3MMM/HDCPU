import { useEffect } from 'react';
import { useCPUStore } from '../store/cpu-store';

const BASE_CYCLES_PER_SECOND = 4;
const MAX_CYCLES_PER_FRAME = 6;

export function getCycleIntervalMs(speed: number): number {
  const normalizedSpeed = Math.min(Math.max(speed, 0.25), 3);
  return 1000 / (BASE_CYCLES_PER_SECOND * normalizedSpeed);
}

export function useExecutionLoop() {
  const runStatus = useCPUStore((state) => state.runStatus);
  const speed = useCPUStore((state) => state.speed);
  const stepCycle = useCPUStore((state) => state.stepCycle);

  useEffect(() => {
    if (runStatus !== 'running') {
      return undefined;
    }

    const intervalMs = getCycleIntervalMs(speed);
    let frameId = 0;
    let lastTimestamp = 0;
    let accumulatedMs = 0;

    function tick(timestamp: number) {
      if (useCPUStore.getState().runStatus !== 'running') {
        return;
      }

      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
      }

      accumulatedMs += timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      let cyclesThisFrame = 0;
      while (accumulatedMs >= intervalMs && cyclesThisFrame < MAX_CYCLES_PER_FRAME) {
        if (useCPUStore.getState().runStatus !== 'running') {
          break;
        }

        stepCycle();
        accumulatedMs -= intervalMs;
        cyclesThisFrame += 1;
      }

      if (useCPUStore.getState().runStatus === 'running') {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [runStatus, speed, stepCycle]);
}
