import { ComponentID, WireID } from './cpu';
import { CycleSnapshot } from './snapshot';

// 视觉状态：所有 UI 组件的渲染属性
export interface ViewState {
  components: Map<ComponentID, ComponentViewState>;
  wires: Map<WireID, WireViewState>;
  stage: string;
  cycleInfo: { cycleNumber: number; instructionASM: string };
}

// 单个部件的视觉状态
export interface ComponentViewState {
  id: ComponentID;
  highlighted: boolean;          // 是否高亮（本周期活跃）
  displayValues: DisplayValue[]; // 要显示的数值
  inputPorts: PortState[];       // 输入端口状态
  outputPorts: PortState[];      // 输出端口状态
  tooltip: string;               // 悬停提示信息
}

// 显示值
export interface DisplayValue {
  label: string;
  value: string;
  format: 'hex' | 'dec' | 'bin';
}

// 端口状态
export interface PortState {
  name: string;
  active: boolean;
  value: number | null;
}

// 单条连线的视觉状态
export interface WireViewState {
  id: WireID;
  active: boolean;               // 是否有数据流过
  value: number | null;          // 传输的值
  signalType: 'data' | 'control' | 'address';
  animationDirection: 'forward' | 'backward' | 'none';
  busWidth: number;              // 影响线宽渲染
}

// 动画序列
export interface AnimationSequence {
  steps: AnimationStep[];
  totalDuration: number;
}

// 动画步骤
export interface AnimationStep {
  delay: number;                 // 相对于序列开始的延迟 (ms)
  duration: number;              // 动画持续时间 (ms)
  targets: {
    componentId?: ComponentID;
    wireId?: WireID;
    property: string;            // 如 'highlighted', 'active', 'value'
    from: any;
    to: any;
  }[];
}

// 视图映射器接口
export interface IViewMapper {
  // 将快照映射为所有组件的视觉状态
  mapSnapshot(snapshot: CycleSnapshot): ViewState;

  // 计算两个快照之间的差异，生成动画序列
  computeTransition(from: CycleSnapshot, to: CycleSnapshot): AnimationSequence;
}
