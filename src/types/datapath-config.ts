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

export type DatapathSkin =
  | 'default'
  | 'textbook-register'
  | 'textbook-memory'
  | 'textbook-register-file'
  | 'textbook-control'
  | 'textbook-decoder'
  | 'textbook-alu'
  | 'textbook-adder'
  | 'textbook-mux'
  | 'textbook-constant';

export interface PortConfig {
  name: string;
  direction: PortDirection;
  position: PortPosition;
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
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports: PortConfig[];
  muxInputCount?: number;
  stateKey?: string;
  skin?: DatapathSkin;
  portStyle?: DatapathPortStyle;
  labelLines?: string[];
  labelRotate?: number;
  labelFontSize?: number;
  labelLineGap?: number;
  labelOffset?: { x: number; y: number };
  choiceLabels?: string[];
  hideLabel?: boolean;
  hideSubtitle?: boolean;
  hideDetail?: boolean;
  clocked?: boolean;
}

export interface WireConfig {
  id: string;
  from: { component: string; port: string };
  to: { component: string; port: string };
  busWidth: number;
  signalType: SignalType;
  waypoints?: { x: number; y: number }[];
  label?: string;
  labelPosition?: { x: number; y: number };
  labelRotate?: number;
  labelSignalType?: SignalType;
  stateKey?: string;
  activeStages?: string[];
  controlActiveMode?: 'truthy' | 'defined';
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
