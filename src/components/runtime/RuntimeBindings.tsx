import { memo } from 'react';
import { useExecutionLoop } from '../../hooks/useExecutionLoop';
import { useExecutionShortcuts } from '../../hooks/useExecutionShortcuts';

export const RuntimeBindings = memo(function RuntimeBindings() {
  useExecutionShortcuts();
  useExecutionLoop();
  return null;
});
