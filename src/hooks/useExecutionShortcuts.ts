import { useEffect } from 'react';
import { useCPUStore } from '../store/cpu-store';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) {
    return true;
  }

  if (target.closest('.cm-editor')) {
    return true;
  }

  return false;
}

export function useExecutionShortcuts() {
  const runStatus = useCPUStore((state) => state.runStatus);
  const run = useCPUStore((state) => state.run);
  const pause = useCPUStore((state) => state.pause);
  const reset = useCPUStore((state) => state.reset);
  const stepCycle = useCPUStore((state) => state.stepCycle);
  const stepInstruction = useCPUStore((state) => state.stepInstruction);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (runStatus === 'running') {
          pause();
        } else {
          run();
        }
        return;
      }

      if (runStatus === 'running') {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepCycle();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        stepInstruction();
        return;
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        reset();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pause, reset, run, runStatus, stepCycle, stepInstruction]);
}
