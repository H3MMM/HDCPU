import defaultDatapathConfig from '../config/multicycle-datapath.json';
import { STAGE_ACTIVE_COMPONENTS, STAGE_ACTIVE_WIRES } from './activity-map';
import {
  AnimationSequence,
  ComponentConfig,
  ComponentViewState,
  CycleSnapshot,
  DataPathActivity,
  DatapathConfig,
  DisplayValue,
  IViewMapper,
  PortConfig,
  PortState,
  StateChange,
  ViewState,
  WireConfig,
  WireViewState,
} from '../types';

const CHANGE_TARGET_COMPONENTS: Record<string, string> = {
  pc: 'pc',
  IR: 'ir',
  MDR: 'mdr',
  A: 'reg-a',
  B: 'reg-b',
  ALUOut: 'alu-out',
};

interface PortActivity {
  active: boolean;
  value: number | null;
}

export class ViewMapper implements IViewMapper {
  constructor(private readonly config: DatapathConfig = defaultDatapathConfig as DatapathConfig) {}

  mapSnapshot(snapshot: CycleSnapshot): ViewState {
    const stageComponents = new Set(STAGE_ACTIVE_COMPONENTS[snapshot.stage] ?? []);
    const stageWires = new Set(STAGE_ACTIVE_WIRES[snapshot.stage] ?? []);
    const changedComponents = this.resolveChangedComponents(snapshot.changes);
    const portActivity = new Map<string, PortActivity>();
    const wires = new Map<string, WireViewState>();

    for (const activity of snapshot.activeDataPaths) {
      this.recordPortActivity(portActivity, activity.from, activity.portFrom, activity.value);
      this.recordPortActivity(portActivity, activity.to, activity.portTo, activity.value);
    }

    for (const wire of this.config.wires) {
      const matchingActivity = this.findMatchingActivity(snapshot.activeDataPaths, wire);
      const stateValue = wire.stateKey ? this.resolvePath(snapshot, wire.stateKey) : undefined;
      const controlActive = wire.signalType === 'control' && this.isControlActive(stateValue);
      const active = stageWires.has(wire.id) || matchingActivity !== null || controlActive;
      const value = active ? this.coerceNumeric(matchingActivity?.value ?? stateValue) : null;

      wires.set(wire.id, {
        id: wire.id,
        active,
        value,
        signalType: wire.signalType,
        animationDirection: active ? 'forward' : 'none',
        busWidth: wire.busWidth,
      });

      if (active) {
        this.recordPortActivity(portActivity, wire.from.component, wire.from.port, value);
        this.recordPortActivity(portActivity, wire.to.component, wire.to.port, value);
      }
    }

    const components = new Map<string, ComponentViewState>();
    for (const component of this.config.components) {
      const highlighted =
        stageComponents.has(component.id) ||
        changedComponents.has(component.id) ||
        this.hasActiveConnection(component.id, snapshot.activeDataPaths, wires);
      const displayValues = this.createDisplayValues(
        component.id,
        component.stateKey ? this.resolvePath(snapshot, component.stateKey) : undefined
      );

      components.set(component.id, {
        id: component.id,
        highlighted,
        displayValues,
        inputPorts: this.createPortStates(component.ports, portActivity, component.id, 'in'),
        outputPorts: this.createPortStates(component.ports, portActivity, component.id, 'out'),
        tooltip: this.createTooltip(component, displayValues),
      });
    }

    return {
      components,
      wires,
      stage: snapshot.stage,
      cycleInfo: {
        cycleNumber: snapshot.cycleNumber,
        instructionASM: snapshot.decodedInstruction.asmString,
      },
    };
  }

  computeTransition(from: CycleSnapshot, to: CycleSnapshot): AnimationSequence {
    const previousView = this.mapSnapshot(from);
    const nextView = this.mapSnapshot(to);
    const activationTargets: AnimationSequence['steps'][number]['targets'] = [];
    const valueTargets: AnimationSequence['steps'][number]['targets'] = [];

    for (const [componentId, nextComponent] of nextView.components) {
      const previousComponent = previousView.components.get(componentId);
      if (!previousComponent) {
        continue;
      }

      if (previousComponent.highlighted !== nextComponent.highlighted) {
        activationTargets.push({
          componentId,
          property: 'highlighted',
          from: previousComponent.highlighted,
          to: nextComponent.highlighted,
        });
      }

      if (JSON.stringify(previousComponent.displayValues) !== JSON.stringify(nextComponent.displayValues)) {
        valueTargets.push({
          componentId,
          property: 'displayValues',
          from: previousComponent.displayValues,
          to: nextComponent.displayValues,
        });
      }
    }

    for (const [wireId, nextWire] of nextView.wires) {
      const previousWire = previousView.wires.get(wireId);
      if (!previousWire) {
        continue;
      }

      if (previousWire.active !== nextWire.active) {
        activationTargets.push({
          wireId,
          property: 'active',
          from: previousWire.active,
          to: nextWire.active,
        });
      }

      if (previousWire.value !== nextWire.value) {
        valueTargets.push({
          wireId,
          property: 'value',
          from: previousWire.value,
          to: nextWire.value,
        });
      }
    }

    if (previousView.stage !== nextView.stage) {
      activationTargets.push({
        property: 'stage',
        from: previousView.stage,
        to: nextView.stage,
      });
    }

    if (activationTargets.length === 0 && valueTargets.length === 0) {
      return {
        steps: [],
        totalDuration: 0,
      };
    }

    const steps = [];
    if (activationTargets.length > 0) {
      steps.push({
        delay: 0,
        duration: 120,
        targets: activationTargets,
      });
    }

    if (valueTargets.length > 0) {
      steps.push({
        delay: steps.length === 0 ? 0 : 120,
        duration: 120,
        targets: valueTargets,
      });
    }

    const lastStep = steps[steps.length - 1];
    return {
      steps,
      totalDuration: lastStep.delay + lastStep.duration,
    };
  }

  private findMatchingActivity(
    activities: readonly DataPathActivity[],
    wire: WireConfig
  ): DataPathActivity | null {
    return (
      activities.find((activity) => {
        return (
          activity.from === wire.from.component &&
          activity.to === wire.to.component &&
          activity.portFrom === wire.from.port &&
          activity.portTo === wire.to.port
        );
      }) ?? null
    );
  }

  private resolveChangedComponents(changes: readonly StateChange[]): Set<string> {
    const changedComponents = new Set<string>();

    for (const change of changes) {
      if (change.target.startsWith('registers[')) {
        changedComponents.add('reg-file');
        continue;
      }

      const componentId = CHANGE_TARGET_COMPONENTS[change.target];
      if (componentId) {
        changedComponents.add(componentId);
      }
    }

    return changedComponents;
  }

  private hasActiveConnection(
    componentId: string,
    activities: readonly DataPathActivity[],
    wires: ReadonlyMap<string, WireViewState>
  ): boolean {
    if (activities.some((activity) => activity.from === componentId || activity.to === componentId)) {
      return true;
    }

    for (const wire of this.config.wires) {
      if (!wires.get(wire.id)?.active) {
        continue;
      }

      if (wire.from.component === componentId || wire.to.component === componentId) {
        return true;
      }
    }

    return false;
  }

  private createPortStates(
    ports: readonly PortConfig[],
    portActivity: ReadonlyMap<string, PortActivity>,
    componentId: string,
    direction: 'in' | 'out'
  ): PortState[] {
    return ports
      .filter((port) => port.direction === direction)
      .map((port) => {
        const activity = portActivity.get(this.createPortKey(componentId, port.name));
        return {
          name: port.name,
          active: activity?.active ?? false,
          value: activity?.value ?? null,
        };
      });
  }

  private createDisplayValues(componentId: string, value: unknown): DisplayValue[] {
    if (value === undefined || value === null) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.slice(0, 4).map((entry, index) => ({
        label: componentId === 'reg-file' ? `x${index}` : `[${index}]`,
        value: this.formatHex(entry),
        format: 'hex',
      }));
    }

    if (typeof value === 'number') {
      return [
        { label: 'hex', value: this.formatHex(value), format: 'hex' },
        { label: 'dec', value: String(value | 0), format: 'dec' },
      ];
    }

    if (typeof value === 'boolean') {
      return [{ label: 'bool', value: value ? '1' : '0', format: 'dec' }];
    }

    return [{ label: 'value', value: String(value), format: 'dec' }];
  }

  private createTooltip(component: ComponentConfig, displayValues: readonly DisplayValue[]): string {
    if (displayValues.length === 0) {
      return `${component.label} (${component.id})`;
    }

    const primaryValue = displayValues[0];
    return `${component.label} (${component.id}) - ${primaryValue.label}: ${primaryValue.value}`;
  }

  private recordPortActivity(
    portActivity: Map<string, PortActivity>,
    componentId: string,
    portName: string,
    value: number | null
  ): void {
    portActivity.set(this.createPortKey(componentId, portName), {
      active: true,
      value,
    });
  }

  private createPortKey(componentId: string, portName: string): string {
    return `${componentId}:${portName}`;
  }

  private resolvePath(source: unknown, path: string): unknown {
    const tokens = path.match(/([^[.\]]+)|\[(\d+)\]/g) ?? [];
    let current: unknown = source;

    for (const token of tokens) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (token.startsWith('[')) {
        const index = Number.parseInt(token.slice(1, -1), 10);
        current = (current as ArrayLike<unknown>)[index];
        continue;
      }

      current = (current as Record<string, unknown>)[token];
    }

    return current;
  }

  private coerceNumeric(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return null;
  }

  private isControlActive(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return false;
  }

  private formatHex(value: number): string {
    return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
  }
}
