// 数据通路配置类型定义

// 部件类型
export type ComponentType =
  | 'register'       // 寄存器 (PC, IR, A, B, ALUOut, MDR)
  | 'memory'         // 存储器 (指令存储器, 数据存储器)
  | 'register-file'  // 寄存器堆
  | 'alu'            // 算术逻辑单元
  | 'mux'            // 多路选择器
  | 'control'        // 控制单元
  | 'imm-gen'        // 立即数生成器
  | 'adder'          // 加法器
  | 'sign-extend'    // 符号扩展
  | 'branch-logic'   // 分支判断逻辑
  | 'constant';      // 常数源

// 端口方向
export type PortDirection = 'in' | 'out';

// 端口位置
export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

// 信号类型
export type SignalType = 'data' | 'control' | 'address';

// 端口定义
export interface PortConfig {
  name: string;
  direction: PortDirection;
  position: PortPosition;
  offset?: number;              // 沿边的偏移比例 (0-1)
  busWidth: number;             // 总线宽度 (位数)
  signalType: SignalType;
}

// 部件定义
export interface ComponentConfig {
  id: string;
  type: ComponentType;
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports: PortConfig[];
  muxInputCount?: number;       // 仅 mux 类型
  stateKey?: string;            // 映射到 CycleSnapshot 中的字段路径
}

// 连线定义
export interface WireConfig {
  id: string;
  from: { component: string; port: string };
  to: { component: string; port: string };
  busWidth: number;
  signalType: SignalType;
  waypoints?: { x: number; y: number }[];
  label?: string;
  stateKey?: string;
}

// 数据通路配置
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
