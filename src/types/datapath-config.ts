export type ComponentType =
  | 'register'
  | 'memory'
  | 'register-file'
  | 'alu'
  | 'mux'
  | 'control'
  | 'imm-gen'
  | 'adder'
  | 'sign-extend'
  | 'branch-logic'
  | 'constant';

export type PortDirection = 'in' | 'out';

export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

export type SignalType = 'data' | 'control' | 'address';

export type DatapathPortStyle = 'outlined' | 'minimal' | 'hidden';

export type DatapathPortLabelPlacement = 'auto' | 'inside' | 'outside';

export interface Point {
  x: number;
  y: number;
}

export type DatapathSkin =
  | 'default'
  | 'textbook-register'
  | 'textbook-memory'
  | 'textbook-register-file'
  | 'textbook-control'
  | 'textbook-decoder'
  | 'textbook-xor'
  | 'textbook-alu'
  | 'textbook-adder'
  | 'textbook-mux'
  | 'textbook-constant'
  | 'textbook-clock-source';

export interface PortConfig {
  id?: string;
  name: string;
  direction: PortDirection;
  position: PortPosition;
  side?: PortPosition;
  anchor?: Point;
  x?: number;
  y?: number;
  offset?: number;
  busWidth: number;
  signalType: SignalType;
  label?: string;
  hidden?: boolean;
  labelOffset?: { x: number; y: number };
  textAnchor?: 'start' | 'middle' | 'end';
}

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports: PortConfig[];
  muxInputCount?: number;
  stateKey?: string;
  skin?: DatapathSkin;
  portStyle?: DatapathPortStyle;
  portLabelPlacement?: DatapathPortLabelPlacement;
  labelLines?: string[];
  labelRotate?: number;
  labelFontSize?: number;
  labelFontStyle?: 'normal' | 'italic';
  labelSignalType?: SignalType;
  labelLineGap?: number;
  labelOffset?: { x: number; y: number };
  choiceLabels?: string[];
  bodyHidden?: boolean;
  hideLabel?: boolean;
  hideSubtitle?: boolean;
  hideDetail?: boolean;
  clocked?: boolean;
}

export interface WireEndpointConfig {
  component: string;
  port: string;
  componentId?: string;
  portId?: string;
}

export interface WireStyleConfig {
  dashed?: boolean;
  strokeWidth?: number;
  color?: string;
}

export interface WireActivationGuard {
  stateKey: string;
  mode?: 'truthy' | 'defined';
}

export interface WireConfig {
  id: string;
  from: WireEndpointConfig;
  to: WireEndpointConfig;
  busWidth: number;
  signalType: SignalType;
  waypoints?: Point[];
  kind?: 'data' | 'control' | 'clock' | 'other';
  label?: string;
  style?: WireStyleConfig;
  labelPosition?: Point;
  labelRotate?: number;
  labelSignalType?: SignalType;
  stateKey?: string;
  activeStages?: string[];
  controlActiveMode?: 'truthy' | 'defined';
  activeWhenAll?: WireActivationGuard[];
}

export interface DatapathConfig {
  metadata: {
    name: string;
    type: 'multicycle' | 'pipeline';
    version: string;
    canvasSize: { width: number; height: number };
  };
  components: ComponentConfig[];
  wires: WireConfig[];
}
