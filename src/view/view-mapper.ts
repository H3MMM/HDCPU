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
  PipelineForwardingSignal,
  PipelineInstructionSlot,
  PipelineStageKey,
  PortConfig,
  PortState,
  Stage,
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

const PIPELINE_STAGE_KEYS: readonly PipelineStageKey[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const PIPELINE_IF_COMPONENTS = ['pc', 'instr-mem', 'pc-plus4', 'pc-mux', 'if-id'] as const;
const PIPELINE_ID_COMPONENTS = ['if-id', 'control-unit', 'reg-file', 'imm-gen', 'id-ex'] as const;
const PIPELINE_EX_COMPONENTS = ['id-ex', 'alu-src-b', 'alu', 'ex-mem'] as const;
const PIPELINE_MEM_COMPONENTS = ['ex-mem', 'mem-wb'] as const;
const PIPELINE_WB_COMPONENTS = ['mem-wb', 'wb-mux', 'reg-file'] as const;

interface PortActivity {
  active: boolean;
  value: number | null;
}

export class ViewMapper implements IViewMapper {
  constructor(private readonly config: DatapathConfig = defaultDatapathConfig as DatapathConfig) {}

  mapSnapshot(snapshot: CycleSnapshot): ViewState {
    const stageComponents = this.resolveActiveStageComponents(snapshot);
    const stageWires = this.resolveActiveStageWires(snapshot);
    for (const componentId of this.resolvePipelineEventComponents(snapshot)) {
      stageComponents.add(componentId);
    }
    for (const wireId of this.resolvePipelineEventWires(snapshot)) {
      stageWires.add(wireId);
    }
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
      const controlActive =
        wire.signalType === 'control' &&
        this.matchesActiveStage(snapshot.stage, wire.activeStages) &&
        this.isControlActive(stateValue, wire.controlActiveMode ?? 'truthy') &&
        this.matchesActivationGuards(snapshot, wire.activeWhenAll);
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

  private resolveActiveStageComponents(snapshot: CycleSnapshot): Set<string> {
    const components = new Set<string>();

    if (this.config.metadata.type !== 'pipeline') {
      for (const componentId of STAGE_ACTIVE_COMPONENTS[snapshot.stage] ?? []) {
        components.add(componentId);
      }

      return components;
    }

    for (const slot of this.getActivePipelineSlots(snapshot)) {
      for (const componentId of this.getPipelineStageComponents(slot)) {
        components.add(componentId);
      }
    }

    return components;
  }

  private resolveActiveStageWires(snapshot: CycleSnapshot): Set<string> {
    const wires = new Set<string>();

    if (this.config.metadata.type !== 'pipeline') {
      for (const wireId of STAGE_ACTIVE_WIRES[snapshot.stage] ?? []) {
        wires.add(wireId);
      }

      return wires;
    }

    for (const slot of this.getActivePipelineSlots(snapshot)) {
      for (const wireId of this.getPipelineStageWires(slot)) {
        wires.add(wireId);
      }
    }

    return wires;
  }

  private resolvePipelineEventComponents(snapshot: CycleSnapshot): Set<string> {
    const components = new Set<string>();

    if (this.config.metadata.type !== 'pipeline') {
      return components;
    }

    if (snapshot.pipeline.hazard.type === 'raw') {
      for (const componentId of ['pc', 'instr-mem', 'if-id', 'control-unit', 'id-ex']) {
        components.add(componentId);
      }
    }

    if (snapshot.pipeline.hazard.type === 'control' && snapshot.pipeline.hazard.action === 'stall') {
      for (const componentId of ['pc', 'instr-mem', 'if-id', 'control-unit', 'id-ex']) {
        components.add(componentId);
      }
    }

    if (snapshot.pipeline.hazard.type === 'control' && snapshot.pipeline.hazard.action === 'flush') {
      for (const componentId of ['pc', 'pc-mux', 'branch-logic', 'if-id', 'id-ex']) {
        components.add(componentId);
      }
    }

    this.addForwardingComponents(components, snapshot.pipeline.forwarding.ForwardA, ['id-ex', 'alu']);
    this.addForwardingComponents(components, snapshot.pipeline.forwarding.ForwardB, ['id-ex', 'alu-src-b', 'alu']);
    this.addForwardingComponents(components, snapshot.pipeline.forwarding.StoreForward, ['id-ex', 'ex-mem', 'data-mem']);

    return components;
  }

  private resolvePipelineEventWires(snapshot: CycleSnapshot): Set<string> {
    const wires = new Set<string>();

    if (this.config.metadata.type !== 'pipeline') {
      return wires;
    }

    if (snapshot.pipeline.hazard.type === 'raw') {
      wires.add('pipeline-wire-469-instr-mem-ir-to-if-id');
      wires.add('pipeline-wire-515-control-unit-to-id-ex-control');
    }

    if (snapshot.pipeline.hazard.type === 'control' && snapshot.pipeline.hazard.action === 'stall') {
      wires.add('pipeline-wire-469-instr-mem-ir-to-if-id');
      wires.add('pipeline-wire-515-control-unit-to-id-ex-control');
    }

    if (snapshot.pipeline.hazard.type === 'control' && snapshot.pipeline.hazard.action === 'flush') {
      wires.add('pipeline-wire-465-branch-target-to-pc-mux');
      wires.add('pipeline-wire-466-pc-mux-to-pc');
      wires.add('pipeline-wire-535-pc-select-to-pc-mux');
      wires.add('pipeline-wire-536-ex-mem-feedback-to-pc-mux');
    }

    this.addForwardingWires(wires, snapshot.pipeline.forwarding.ForwardA, [
      'pipeline-wire-501-id-ex-a-to-alu',
    ]);
    this.addForwardingWires(wires, snapshot.pipeline.forwarding.ForwardB, [
      'pipeline-wire-493-id-ex-b-to-alu-src-b',
      'pipeline-wire-420-alu-src-b-to-alu-b',
    ]);
    this.addForwardingWires(wires, snapshot.pipeline.forwarding.StoreForward, [
      'pipeline-wire-419-bypass-b-to-ex-mem',
      'pipeline-wire-449-ex-mem-b-to-data-mem-write-data',
    ]);

    return wires;
  }

  private addForwardingComponents(
    components: Set<string>,
    signal: PipelineForwardingSignal,
    consumerComponents: readonly string[]
  ): void {
    if (signal.source === 'none') {
      return;
    }

    for (const componentId of consumerComponents) {
      components.add(componentId);
    }

    if (signal.source === 'exMem') {
      components.add('ex-mem');
      if (signal.producer && this.isLoadRef(signal.producer)) {
        components.add('data-mem');
      }
      return;
    }

    components.add('mem-wb');
    components.add('wb-mux');
    components.add('reg-file');
  }

  private addForwardingWires(
    wires: Set<string>,
    signal: PipelineForwardingSignal,
    consumerWires: readonly string[]
  ): void {
    if (signal.source === 'none') {
      return;
    }

    for (const wireId of consumerWires) {
      wires.add(wireId);
    }

    if (signal.source === 'exMem') {
      if (signal.producer && this.isLoadRef(signal.producer)) {
        wires.add('pipeline-wire-453-data-mem-read-to-mem-wb');
        wires.add('pipeline-wire-458-ex-mem-alu-result-to-data-mem');
      } else {
        wires.add('pipeline-wire-500-alu-result-to-ex-mem');
      }
      return;
    }

    wires.add('pipeline-wire-507-wb-mux-to-regfile-write-data');
    if (!signal.producer) {
      return;
    }

    if (this.isLoadRef(signal.producer)) {
      wires.add('pipeline-wire-540-mem-wb-read-data-to-wb-mux');
    } else if (this.isLuiRef(signal.producer)) {
      wires.add('pipeline-wire-541-mem-wb-imm32-to-wb-mux');
    } else if (this.isJumpRef(signal.producer)) {
      wires.add('pipeline-wire-544-mem-wb-pc4-to-wb-mux');
    } else {
      wires.add('pipeline-wire-467-mem-wb-alu-result-to-wb-mux');
    }
  }

  private getActivePipelineSlots(snapshot: CycleSnapshot): PipelineInstructionSlot[] {
    return PIPELINE_STAGE_KEYS
      .map((stageKey) => snapshot.pipeline.stages[stageKey])
      .filter((slot) => slot.status === 'valid' && slot.decodedInstruction !== null);
  }

  private getPipelineStageComponents(slot: PipelineInstructionSlot): readonly string[] {
    const instruction = slot.decodedInstruction;
    switch (slot.stage) {
      case Stage.IF:
        return PIPELINE_IF_COMPONENTS;
      case Stage.ID:
        return PIPELINE_ID_COMPONENTS;
      case Stage.EX:
        if (instruction && (this.isBranch(instruction) || this.isJump(instruction))) {
          return [...PIPELINE_EX_COMPONENTS, 'branch-adder', 'branch-logic', 'pc-mux'];
        }

        return PIPELINE_EX_COMPONENTS;
      case Stage.MEM:
        if (instruction && (this.isLoad(instruction) || this.isStore(instruction))) {
          return [...PIPELINE_MEM_COMPONENTS, 'data-mem'];
        }

        if (instruction && (this.isBranch(instruction) || this.isJump(instruction))) {
          return [...PIPELINE_MEM_COMPONENTS, 'pc-mux'];
        }

        return PIPELINE_MEM_COMPONENTS;
      case Stage.WB:
        return instruction && this.writesRegister(instruction) ? PIPELINE_WB_COMPONENTS : ['mem-wb'];
      default:
        return [];
    }
  }

  private getPipelineStageWires(slot: PipelineInstructionSlot): readonly string[] {
    const instruction = slot.decodedInstruction;
    if (!instruction) {
      return [];
    }

    switch (slot.stage) {
      case Stage.IF:
        return STAGE_ACTIVE_WIRES[Stage.IF];
      case Stage.ID:
        return STAGE_ACTIVE_WIRES[Stage.ID];
      case Stage.EX:
        return this.getPipelineEXWires(instruction);
      case Stage.MEM:
        return this.getPipelineMEMWires(instruction);
      case Stage.WB:
        return this.getPipelineWBWires(instruction);
      default:
        return [];
    }
  }

  private getPipelineEXWires(instruction: PipelineInstructionSlot['decodedInstruction']): readonly string[] {
    if (!instruction) {
      return [];
    }

    if (this.isBranch(instruction)) {
      return [
        'pipeline-wire-493-id-ex-b-to-alu-src-b',
        'pipeline-wire-495-id-ex-pc0-to-branch-adder',
        'pipeline-wire-497-id-ex-imm32-to-branch-adder',
        'pipeline-wire-559-id-ex-imm32-to-imm-junction',
        'pipeline-wire-499-id-ex-alu-op-to-alu',
        'pipeline-wire-510-id-ex-bcc-to-branch-logic',
        'pipeline-wire-511-branch-logic-to-branch-target',
        'pipeline-wire-512-alu-flag-to-branch-logic',
        'pipeline-wire-514-alu-branch-flag-to-branch-logic',
        'pipeline-wire-518-branch-adder-output-stub',
        'pipeline-wire-531-id-ex-control-to-ex-mem',
        'pipeline-wire-538-branch-adder-to-branch-logic',
      ];
    }

    if (this.isJump(instruction)) {
      return [
        'pipeline-wire-495-id-ex-pc0-to-branch-adder',
        'pipeline-wire-497-id-ex-imm32-to-branch-adder',
        'pipeline-wire-559-id-ex-imm32-to-imm-junction',
        'pipeline-wire-511-branch-logic-to-branch-target',
        'pipeline-wire-517-id-ex-pc4-to-ex-mem',
        'pipeline-wire-518-branch-adder-output-stub',
        'pipeline-wire-531-id-ex-control-to-ex-mem',
        'pipeline-wire-535-pc-select-to-pc-mux',
        'pipeline-wire-536-ex-mem-feedback-to-pc-mux',
        'pipeline-wire-538-branch-adder-to-branch-logic',
      ];
    }

    if (this.isLui(instruction)) {
      return [
        'pipeline-wire-508-id-ex-imm32-to-ex-mem',
        'pipeline-wire-531-id-ex-control-to-ex-mem',
      ];
    }

    const wires = [
      'pipeline-wire-420-alu-src-b-to-alu-b',
      'pipeline-wire-499-id-ex-alu-op-to-alu',
      'pipeline-wire-500-alu-result-to-ex-mem',
      'pipeline-wire-501-id-ex-a-to-alu',
      'pipeline-wire-559-id-ex-imm32-to-imm-junction',
      'pipeline-wire-531-id-ex-control-to-ex-mem',
    ];

    if (this.usesRegisterOperandB(instruction)) {
      return [
        ...wires,
        'pipeline-wire-493-id-ex-b-to-alu-src-b',
      ];
    }

    const immediateWires = [
      ...wires,
      'pipeline-wire-457-id-ex-imm32-to-alu-src-b',
      'pipeline-wire-498-id-ex-rs2-imm-select-to-mux',
    ];

    return this.isStore(instruction)
      ? [...immediateWires, 'pipeline-wire-419-bypass-b-to-ex-mem']
      : immediateWires;
  }

  private getPipelineMEMWires(instruction: PipelineInstructionSlot['decodedInstruction']): readonly string[] {
    if (!instruction) {
      return [];
    }

    if (this.isLoad(instruction)) {
      return [
        'pipeline-wire-453-data-mem-read-to-mem-wb',
        'pipeline-wire-458-ex-mem-alu-result-to-data-mem',
      ];
    }

    if (this.isStore(instruction)) {
      return [
        'pipeline-wire-449-ex-mem-b-to-data-mem-write-data',
        'pipeline-wire-458-ex-mem-alu-result-to-data-mem',
        'pipeline-wire-530-ex-mem-mem-write-to-data-mem',
      ];
    }

    if (this.isBranch(instruction)) {
      return [
        'pipeline-wire-465-branch-target-to-pc-mux',
        'pipeline-wire-535-pc-select-to-pc-mux',
        'pipeline-wire-536-ex-mem-feedback-to-pc-mux',
      ];
    }

    if (this.isJump(instruction)) {
      return [
        'pipeline-wire-465-branch-target-to-pc-mux',
        'pipeline-wire-535-pc-select-to-pc-mux',
        'pipeline-wire-536-ex-mem-feedback-to-pc-mux',
        'pipeline-wire-543-ex-mem-pc4-to-mem-wb',
      ];
    }

    return [];
  }

  private getPipelineWBWires(instruction: PipelineInstructionSlot['decodedInstruction']): readonly string[] {
    if (!instruction || !this.writesRegister(instruction)) {
      return [];
    }

    const commonWires = [
      'pipeline-wire-448-mem-wb-control-to-wb-mux',
      'pipeline-wire-507-wb-mux-to-regfile-write-data',
      'pipeline-wire-553-mem-wb-rd-to-regfile-wa',
      'pipeline-wire-554-mem-wb-reg-write-to-regfile',
    ];

    if (this.isLoad(instruction)) {
      return [...commonWires, 'pipeline-wire-540-mem-wb-read-data-to-wb-mux'];
    }

    if (this.isLui(instruction)) {
      return [...commonWires, 'pipeline-wire-541-mem-wb-imm32-to-wb-mux'];
    }

    if (this.isJump(instruction)) {
      return [...commonWires, 'pipeline-wire-544-mem-wb-pc4-to-wb-mux'];
    }

    return [...commonWires, 'pipeline-wire-467-mem-wb-alu-result-to-wb-mux'];
  }

  private isLoad(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x03;
  }

  private isLoadRef(ref: NonNullable<PipelineForwardingSignal['producer']>): boolean {
    return (ref.instructionWord & 0x7F) === 0x03;
  }

  private isStore(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x23;
  }

  private isBranch(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x63;
  }

  private isJump(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x67 || instruction?.opcode === 0x6F;
  }

  private isJumpRef(ref: NonNullable<PipelineForwardingSignal['producer']>): boolean {
    const opcode = ref.instructionWord & 0x7F;
    return opcode === 0x67 || opcode === 0x6F;
  }

  private isLui(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x37;
  }

  private isLuiRef(ref: NonNullable<PipelineForwardingSignal['producer']>): boolean {
    return (ref.instructionWord & 0x7F) === 0x37;
  }

  private usesRegisterOperandB(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return instruction?.opcode === 0x33;
  }

  private writesRegister(instruction: PipelineInstructionSlot['decodedInstruction']): boolean {
    return !!instruction && instruction.rd !== 0 && (
      instruction.opcode === 0x03 ||
      instruction.opcode === 0x13 ||
      instruction.opcode === 0x17 ||
      instruction.opcode === 0x33 ||
      instruction.opcode === 0x37 ||
      instruction.opcode === 0x67 ||
      instruction.opcode === 0x6F
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

  private isControlActive(value: unknown, mode: 'truthy' | 'defined'): boolean {
    if (mode === 'defined') {
      return value !== undefined && value !== null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    return false;
  }

  private matchesActivationGuards(
    snapshot: CycleSnapshot,
    guards?: WireConfig['activeWhenAll']
  ): boolean {
    if (!guards || guards.length === 0) {
      return true;
    }

    return guards.every((guard) => {
      const value = this.resolvePath(snapshot, guard.stateKey);
      if (!this.isControlActive(value, guard.mode ?? 'truthy')) {
        return false;
      }

      if (guard.equals !== undefined) {
        return value === guard.equals;
      }

      if (guard.oneOf && guard.oneOf.length > 0) {
        return guard.oneOf.some((candidate) => candidate === value);
      }

      return true;
    });
  }

  private matchesActiveStage(stage: string, activeStages?: readonly string[]): boolean {
    if (!activeStages || activeStages.length === 0) {
      return true;
    }

    return activeStages.includes(stage);
  }

  private formatHex(value: number): string {
    return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
  }
}
