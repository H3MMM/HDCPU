import rawDatapathConfig from './multicycle-datapath.json';
import type { ComponentType, DatapathConfig } from '../types';

const datapathConfig = rawDatapathConfig as DatapathConfig;

export interface DatapathSummary {
  componentCount: number;
  wireCount: number;
  canvasSize: DatapathConfig['metadata']['canvasSize'];
  componentTypeCounts: Partial<Record<ComponentType, number>>;
}

export function getDatapathConfig(): DatapathConfig {
  return datapathConfig;
}

export function summarizeDatapathConfig(config: DatapathConfig = datapathConfig): DatapathSummary {
  const componentTypeCounts = config.components.reduce<Partial<Record<ComponentType, number>>>((counts, component) => {
    counts[component.type] = (counts[component.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    componentCount: config.components.length,
    wireCount: config.wires.length,
    canvasSize: config.metadata.canvasSize,
    componentTypeCounts,
  };
}
