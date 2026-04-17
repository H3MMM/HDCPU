# RISC-V CPU 可视化教学应用 — 系统架构设计文档

> 版本: 1.0 | 日期: 2026-04-14 | 架构: 多周期 CPU（预留流水线扩展）

---

## 目录

- [第一部分：技术栈选型与 UI 渲染方案](#第一部分技术栈选型与-ui-渲染方案)
- [第二部分：系统模块划分（核心解耦）](#第二部分系统模块划分核心解耦)
- [第三部分：核心数据结构设计](#第三部分核心数据结构设计)
- [第四部分：AI 编程实施路径](#第四部分ai-编程vibecoding实施路径)
- [附录](#附录)

---

## 第一部分：技术栈选型与 UI 渲染方案

### 1.1 总体技术栈

| 层级 | 选型 | 理由 |
|------|------|------|
| **框架** | React 18+ (TypeScript) | 组件化模型天然匹配 CPU 部件拆分；TypeScript 提供类型安全，对 AI 生成代码的约束力强 |
| **构建工具** | Vite | 开发体验好，HMR 快，零配置 TypeScript |
| **状态管理** | Zustand | 轻量、无 boilerplate、支持 selector 精细订阅，避免不必要的重渲染 |
| **CPU 渲染层** | **SVG + React 组件（推荐方案）** | 详见下方对比分析 |
| **动画** | Framer Motion + CSS Transitions | 数据流动画、高亮闪烁、信号传播动效 |
| **汇编编辑器** | CodeMirror 6 | 支持自定义语法高亮（RISC-V ASM），轻量可嵌入 |
| **样式** | Tailwind CSS | 工具类优先，AI 生成代码时样式意图清晰 |
| **测试** | Vitest + React Testing Library | 与 Vite 生态一致，模拟器引擎可纯逻辑单测 |
| **后端（可选）** | 无（纯前端） | 所有模拟逻辑在浏览器内运行，无需服务端 |

### 1.2 渲染方案对比与选型

#### 方案 A：React Flow
- **优点**：节点-边模型开箱即用，拖拽/缩放内置
- **缺点**：
  - 节点布局自由度不够 — CPU 数据通路是**固定拓扑**，不需要自动布局
  - 边的样式控制有限，难以表达总线宽度、信号类型
  - 对"部件内部细节"（如 ALU 内部运算展示、MUX 选择端高亮）支持差
  - 抽象层级过高，反而增加定制成本

#### 方案 B：D3.js
- **优点**：数据驱动，底层控制力强
- **缺点**：
  - 命令式 API 与 React 声明式模型冲突，集成复杂
  - AI 生成 D3 代码容易出错（API 面大、链式调用易混淆）

#### ✅ 方案 C：SVG + React 组件（推荐）
- **优点**：
  - CPU 数据通路是**静态拓扑 + 动态状态**，SVG 的声明式特性完美匹配
  - 每个 CPU 部件 = 一个 React 组件，内部用 SVG 绘制外形
  - 连线 = SVG `<path>` / `<line>`，通过 props 控制颜色、宽度、动画
  - 信号流动画 = SVG `<animateMotion>` 或 Framer Motion
  - React 的 diff 机制天然处理"只更新变化的部件"
  - **AI 友好度最高**：每个部件是独立的 `.tsx` 文件，上下文小，AI 可逐个生成
  - 支持浏览器原生缩放、无障碍（文本可选中/可搜索）
- **缺点**：
  - 大量 SVG 节点时性能可能下降（但 CPU 部件数量有限，约 20-30 个，无此问题）

#### 方案 D：Canvas (PixiJS / Konva)
- **优点**：大量元素时性能好
- **缺点**：
  - 失去 DOM 语义，调试困难
  - 文本渲染质量不如 SVG
  - 事件处理需要手动 hit-test
  - CPU 部件数量少（<50），Canvas 的性能优势无法体现



---

## 第二部分：系统模块划分（核心解耦）

---

### 2.2 模拟器引擎（Layer 1）

#### 2.2.1 引擎职责

引擎是一个**纯函数式状态机**：给定当前状态 + 时钟信号 → 产出下一状态。

```typescript
// 引擎核心接口
interface ICPUEngine {
  // 初始化：加载程序到指令存储器
  loadProgram(instructions: Uint32Array): void;

  // 核心：推进一个时钟周期，返回新的快照
  tick(): CycleSnapshot;

  // 推进一个完整指令（自动执行多个 tick 直到指令完成）
  step(): CycleSnapshot[];

  // 重置 CPU 状态
  reset(): void;

  // 获取当前快照（不推进时钟）
  getSnapshot(): CycleSnapshot;

  // 获取完整执行历史（支持时间旅行调试）
  getHistory(): CycleSnapshot[];

  // 回退到指定周期
  rewindTo(cycleNumber: number): CycleSnapshot;
}
```

#### 2.2.2 引擎内部状态

```typescript
// 引擎内部维护的完整 CPU 状态
interface CPUState {
  // === 程序员可见状态 ===
  pc: number;                    // 程序计数器 (32-bit)
  registers: Int32Array;         // x0-x31 通用寄存器 (x0 恒为 0)

  // === 存储器 ===
  instructionMemory: Uint32Array; // 指令存储器
  dataMemory: Uint8Array;         // 数据存储器 (字节寻址, 默认 4KB)

  // === 多周期段间暂存器 ===
  IR: number;       // 指令寄存器 (Instruction Register)
  MDR: number;      // 存储器数据寄存器 (Memory Data Register)
  A: number;        // 寄存器堆读出暂存 A
  B: number;        // 寄存器堆读出暂存 B
  ALUOut: number;   // ALU 输出暂存

  // === 控制状态 ===
  currentStage: Stage;           // 当前所处阶段
  controlSignals: ControlSignals; // 当前控制信号集合
  cycleCount: number;            // 全局时钟周期计数
  instructionCount: number;      // 已完成指令计数
  halted: boolean;               // CPU 是否停机
}
```

#### 2.2.3 多周期状态机

```
         ┌──────────────────────────────────────────┐
         │                                          │
         ▼                                          │
    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
    │   IF    │───→│   ID    │───→│   EX    │      │
    │ 取指    │    │ 译码    │    │ 执行    │      │
    └─────────┘    └─────────┘    └────┬────┘      │
                                       │            │
                          ┌────────────┼────────┐   │
                          ▼            ▼        │   │
                     ┌─────────┐  ┌─────────┐  │   │
                     │  MEM   │  │  WB-ALU │──┼───┘
                     │ 访存   │  │(R/I型回写)│  │
                     └────┬────┘  └─────────┘  │
                          ▼                    │
                     ┌─────────┐               │
                     │  WB-MEM │───────────────┘
                     │(Load回写)│
                     └─────────┘
```

每个阶段对应一组确定的控制信号，引擎内部实现为有限状态机：

```typescript
enum Stage {
  IF  = 'IF',   // 取指：PC → 指令存储器 → IR, PC+4
  ID  = 'ID',   // 译码：IR 解码, 读寄存器堆 → A/B, 符号扩展立即数
  EX  = 'EX',   // 执行：ALU 运算, 分支判断
  MEM = 'MEM',  // 访存：数据存储器读/写
  WB  = 'WB',   // 写回：结果写入寄存器堆
}
```

#### 2.2.4 控制信号定义

```typescript
interface ControlSignals {
  // --- 主控制信号 ---
  PCWrite: boolean;        // PC 写使能
  PCWriteCond: boolean;    // 条件 PC 写（分支）
  IorD: boolean;           // 存储器地址来源: 0=PC, 1=ALUOut
  MemRead: boolean;        // 存储器读使能
  MemWrite: boolean;       // 存储器写使能
  MemToReg: 0 | 1;        // 写回数据来源: 0=ALUOut, 1=MDR
  IRWrite: boolean;        // IR 写使能
  RegWrite: boolean;       // 寄存器堆写使能

  // --- ALU 控制 ---
  ALUSrcA: 0 | 1;         // ALU 输入 A: 0=PC, 1=寄存器A
  ALUSrcB: 0 | 1 | 2 | 3; // ALU 输入 B: 0=寄存器B, 1=4, 2=立即数, 3=立即数<<1
  ALUOp: ALUOp;           // ALU 操作类型

  // --- 分支/跳转 ---
  PCSource: 0 | 1 | 2;    // PC 来源: 0=ALU结果, 1=ALUOut, 2=跳转地址
  Branch: boolean;         // 是否为分支指令

  // --- 扩展信号（便于可视化） ---
  ImmSrc: ImmType;         // 立即数类型 (I/S/B/U/J)
}

enum ALUOp {
  ADD  = 'ADD',
  SUB  = 'SUB',
  AND  = 'AND',
  OR   = 'OR',
  XOR  = 'XOR',
  SLT  = 'SLT',
  SLTU = 'SLTU',
  SLL  = 'SLL',
  SRL  = 'SRL',
  SRA  = 'SRA',
  PASS_B = 'PASS_B', // 直通（用于 LUI 等）
}

enum ImmType {
  I = 'I', S = 'S', B = 'B', U = 'U', J = 'J', NONE = 'NONE',
}
```

#### 2.2.5 快照（Snapshot）设计

引擎每次 `tick()` 后生成一个**不可变快照**，这是引擎与视图层的唯一通信契约：

```typescript
interface CycleSnapshot {
  // --- 元信息 ---
  cycleNumber: number;          // 全局周期编号
  stage: Stage;                 // 当前阶段
  instructionIndex: number;     // 当前指令序号
  instructionWord: number;      // 当前指令机器码
  instructionASM: string;       // 反汇编文本 (如 "add x1, x2, x3")
  decodedInstruction: DecodedInstruction; // 解码后的结构化指令

  // --- CPU 状态 ---
  pc: number;
  nextPC: number;               // 下一个 PC 值
  registers: number[];          // x0-x31 的值（数组副本）

  // --- 段间暂存器 ---
  pipelineRegs: {
    IR: number;
    MDR: number;
    A: number;
    B: number;
    ALUOut: number;
  };

  // --- 控制信号 ---
  controlSignals: ControlSignals;

  // --- ALU 详情 ---
  aluDetail: {
    inputA: number;
    inputB: number;
    operation: ALUOp;
    result: number;
    zero: boolean;              // 零标志
  };

  // --- 数据流标注（核心：驱动可视化连线高亮）---
  activeDataPaths: DataPathActivity[];

  // --- 存储器访问 ---
  memoryAccess: {
    type: 'none' | 'read' | 'write';
    address: number;
    data: number;
  } | null;

  // --- 变更摘要（用于差异高亮）---
  changes: StateChange[];
}

// 数据通路活动：描述本周期内哪些连线是"活跃"的
interface DataPathActivity {
  from: ComponentID;    // 源部件
  to: ComponentID;      // 目标部件
  portFrom: string;     // 源端口名
  portTo: string;       // 目标端口名
  value: number;        // 传输的数据值
  busWidth: number;     // 总线宽度 (1/5/12/32)
  signalType: 'data' | 'control' | 'address'; // 信号类型
}

// 状态变更记录
interface StateChange {
  target: string;       // 如 "registers[1]", "pc", "ALUOut"
  oldValue: number;
  newValue: number;
}
```

#### 2.2.6 引擎模块内部拆分

```
engine/
├── assembler/
│   ├── lexer.ts          # 词法分析
│   ├── parser.ts         # 语法分析 → AST
│   ├── encoder.ts        # AST → 机器码
│   └── types.ts          # 汇编器类型定义
├── core/
│   ├── cpu.ts            # CPU 主类（状态机驱动）
│   ├── alu.ts            # ALU 模块
│   ├── control.ts        # 控制单元（主控 + ALU 控制）
│   ├── decoder.ts        # 指令解码器
│   ├── memory.ts         # 存储器模块（指令 + 数据）
│   ├── register-file.ts  # 寄存器堆
│   └── immediate-gen.ts  # 立即数生成器
├── snapshot.ts           # 快照生成与序列化
├── history.ts            # 执行历史管理（支持回退）
├── types.ts              # 所有引擎层类型定义
└── index.ts              # 引擎公共 API 导出
```

#### 2.2.7 流水线扩展预留

引擎设计中为流水线预留的关键接口：

```typescript
// 流水线模式下，快照将包含多条指令的并行状态
interface PipelineSnapshot extends CycleSnapshot {
  // 各流水段当前处理的指令（多条指令同时在不同阶段）
  stages: {
    IF:  StageState | null;
    ID:  StageState | null;
    EX:  StageState | null;
    MEM: StageState | null;
    WB:  StageState | null;
  };

  // 冒险检测
  hazards: {
    dataHazard: DataHazard | null;
    controlHazard: ControlHazard | null;
    structuralHazard: StructuralHazard | null;
  };

  // 转发路径
  forwardingPaths: ForwardingPath[];

  // 流水线气泡/停顿
  stalls: StallInfo[];
}

// CPU 引擎工厂：根据架构类型创建不同引擎
interface ICPUEngineFactory {
  create(arch: 'multicycle' | 'pipeline'): ICPUEngine;
}
```

---

### 2.3 视图映射层（Layer 2）

#### 2.3.1 职责

将引擎的 `CycleSnapshot` 转换为 UI 可直接消费的视觉属性：

```typescript
// 视图映射器
interface IViewMapper {
  // 将快照映射为所有组件的视觉状态
  mapSnapshot(snapshot: CycleSnapshot): ViewState;

  // 计算两个快照之间的差异，生成动画序列
  computeTransition(from: CycleSnapshot, to: CycleSnapshot): AnimationSequence;
}

// 视觉状态：所有 UI 组件的渲染属性
interface ViewState {
  components: Map<ComponentID, ComponentViewState>;
  wires: Map<WireID, WireViewState>;
  stage: Stage;
  cycleInfo: { cycleNumber: number; instructionASM: string };
}

// 单个部件的视觉状态
interface ComponentViewState {
  id: ComponentID;
  highlighted: boolean;          // 是否高亮（本周期活跃）
  displayValues: DisplayValue[]; // 要显示的数值
  inputPorts: PortState[];       // 输入端口状态
  outputPorts: PortState[];      // 输出端口状态
  tooltip: string;               // 悬停提示信息
}

// 单条连线的视觉状态
interface WireViewState {
  id: WireID;
  active: boolean;               // 是否有数据流过
  value: number | null;          // 传输的值
  signalType: 'data' | 'control' | 'address';
  animationDirection: 'forward' | 'backward' | 'none';
  busWidth: number;              // 影响线宽渲染
}

// 动画序列
interface AnimationSequence {
  steps: AnimationStep[];
  totalDuration: number;
}

interface AnimationStep {
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
```

#### 2.3.2 映射规则示例

```typescript
// 阶段 → 活跃部件映射表
const STAGE_ACTIVE_COMPONENTS: Record<Stage, ComponentID[]> = {
  IF:  ['pc', 'instr-mem', 'ir', 'adder-pc4'],
  ID:  ['ir', 'control-unit', 'reg-file', 'imm-gen', 'reg-a', 'reg-b'],
  EX:  ['mux-alu-a', 'mux-alu-b', 'alu', 'alu-out', 'branch-logic'],
  MEM: ['data-mem', 'mdr'],
  WB:  ['mux-wb', 'reg-file'],
};

// 阶段 → 活跃连线映射表
const STAGE_ACTIVE_WIRES: Record<Stage, WireID[]> = {
  IF:  ['pc-to-imem', 'imem-to-ir', 'pc-to-add4', 'add4-to-pc'],
  ID:  ['ir-to-ctrl', 'ir-to-regfile', 'regfile-to-a', 'regfile-to-b', 'ir-to-immgen'],
  EX:  ['a-to-muxa', 'b-to-muxb', 'muxa-to-alu', 'muxb-to-alu', 'alu-to-aluout'],
  MEM: ['aluout-to-dmem', 'dmem-to-mdr', 'b-to-dmem'],
  WB:  ['mux-wb-to-regfile', 'aluout-to-muxwb', 'mdr-to-muxwb'],
};
```

---

### 2.4 视图层（Layer 3）

#### 2.4.1 组件树结构

```
<App>
├── <Header />                          # 应用标题、帮助按钮
├── <MainLayout>                        # 主布局（左右分栏）
│   ├── <ControlPanel>                  # 左侧控制面板
│   │   ├── <CodeEditor />              # 汇编代码编辑器 (CodeMirror)
│   │   ├── <MachineCodeView />         # 机器码十六进制视图
│   │   ├── <ExecutionControls />       # 运行/暂停/单步/重置/速度
│   │   ├── <RegisterView />            # 寄存器堆表格视图
│   │   ├── <MemoryView />              # 数据存储器视图
│   │   └── <SignalTable />             # 控制信号真值表
│   │
│   └── <DatapathCanvas>               # 右侧 CPU 数据通路画布
│       └── <svg viewBox="0 0 1200 800">
│           ├── <WireLayer />           # 底层：所有连线
│           │   ├── <Wire id="pc-to-imem" ... />
│           │   ├── <Wire id="imem-to-ir" ... />
│           │   └── ...
│           ├── <ComponentLayer />      # 上层：所有部件
│           │   ├── <PCComponent />
│           │   ├── <InstrMemComponent />
│           │   ├── <IRComponent />
│           │   ├── <ControlUnitComponent />
│           │   ├── <RegFileComponent />
│           │   ├── <ImmGenComponent />
│           │   ├── <MuxComponent id="mux-alu-a" />
│           │   ├── <MuxComponent id="mux-alu-b" />
│           │   ├── <ALUComponent />
│           │   ├── <DataMemComponent />
│           │   ├── <MuxComponent id="mux-wb" />
│           │   └── ...暂存器组件 (A, B, ALUOut, MDR)
│           └── <DataFlowAnimation />   # 数据流动画覆盖层
│
├── <StageIndicator />                  # 底部阶段进度指示器
└── <HistoryTimeline />                 # 时间线（支持回退）
```

#### 2.4.2 Zustand Store 设计

```typescript
interface AppStore {
  // --- 引擎实例 ---
  engine: ICPUEngine;

  // --- 当前快照 ---
  currentSnapshot: CycleSnapshot | null;

  // --- 视觉状态（由映射层计算） ---
  viewState: ViewState | null;

  // --- UI 控制状态 ---
  executionSpeed: number;        // 动画速度 (ms/周期)
  isRunning: boolean;            // 是否自动运行中
  selectedComponent: ComponentID | null; // 选中的部件（显示详情）

  // --- 源代码 ---
  sourceCode: string;            // 汇编源代码
  assembleErrors: AssembleError[]; // 汇编错误

  // --- Actions ---
  loadAndAssemble: (source: string) => void;
  tick: () => void;              // 单周期步进
  step: () => void;              // 单指令步进
  run: () => void;               // 连续运行
  pause: () => void;             // 暂停
  reset: () => void;             // 重置
  rewindTo: (cycle: number) => void; // 回退
  setSpeed: (speed: number) => void;
  selectComponent: (id: ComponentID | null) => void;
}
```

---

## 第三部分：核心数据结构设计

### 3.1 CPU 周期状态对象（完整 TypeScript 定义）

```typescript
// ============================================================
// 文件: src/engine/types.ts
// 描述: 引擎层所有核心类型定义
// ============================================================

// --- 指令格式类型 ---
type InstructionFormat = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';

// --- 解码后的指令 ---
interface DecodedInstruction {
  raw: number;                   // 原始 32 位机器码
  format: InstructionFormat;
  opcode: number;                // [6:0]
  rd: number;                    // [11:7]  目的寄存器
  funct3: number;                // [14:12]
  rs1: number;                   // [19:15] 源寄存器 1
  rs2: number;                   // [24:20] 源寄存器 2
  funct7: number;                // [31:25]
  immediate: number;             // 符号扩展后的立即数
  asmString: string;             // 反汇编字符串
  description: string;           // 人类可读描述 (教学用)
}

// --- 完整的周期快照 ---
interface CycleSnapshot {
  // 元信息
  cycleNumber: number;
  stage: Stage;
  instructionIndex: number;
  decodedInstruction: DecodedInstruction;

  // 程序员可见状态
  pc: number;
  nextPC: number;
  registers: readonly number[];  // 不可变数组

  // 段间暂存器
  pipelineRegs: Readonly<{
    IR: number;
    MDR: number;
    A: number;
    B: number;
    ALUOut: number;
  }>;

  // 控制信号
  controlSignals: Readonly<ControlSignals>;

  // ALU 详情
  aluDetail: Readonly<{
    inputA: number;
    inputB: number;
    operation: ALUOp;
    result: number;
    zero: boolean;
  }>;

  // 数据通路活动
  activeDataPaths: readonly DataPathActivity[];

  // 存储器访问
  memoryAccess: Readonly<{
    type: 'none' | 'read' | 'write';
    address: number;
    data: number;
  }>;

  // 状态变更
  changes: readonly StateChange[];
}
```

### 3.2 CPU 部件配置与连线定义（JSON Schema）

以下 JSON Schema 定义了 CPU 数据通路的**拓扑配置**，使得 UI 渲染层可以根据配置文件动态生成数据通路图，而非硬编码。

```jsonc
// ============================================================
// 文件: src/config/datapath-schema.json
// 描述: CPU 数据通路拓扑配置的 JSON Schema
// ============================================================
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CPU Datapath Configuration",
  "description": "定义 CPU 数据通路中所有部件和连线的拓扑结构",
  "type": "object",
  "required": ["metadata", "components", "wires"],
  "properties": {

    "metadata": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "架构名称" },
        "type": {
          "type": "string",
          "enum": ["multicycle", "pipeline"],
          "description": "CPU 架构类型"
        },
        "version": { "type": "string" },
        "canvasSize": {
          "type": "object",
          "properties": {
            "width": { "type": "number" },
            "height": { "type": "number" }
          }
        }
      }
    },

    "components": {
      "type": "array",
      "description": "所有 CPU 部件定义",
      "items": {
        "type": "object",
        "required": ["id", "type", "label", "position", "size"],
        "properties": {
          "id": {
            "type": "string",
            "description": "部件唯一标识符",
            "examples": ["pc", "instr-mem", "reg-file", "alu", "data-mem"]
          },
          "type": {
            "type": "string",
            "enum": [
              "register",       // 寄存器 (PC, IR, A, B, ALUOut, MDR)
              "memory",         // 存储器 (指令存储器, 数据存储器)
              "register-file",  // 寄存器堆
              "alu",            // 算术逻辑单元
              "mux",            // 多路选择器
              "control",        // 控制单元
              "imm-gen",        // 立即数生成器
              "adder",          // 加法器
              "sign-extend",    // 符号扩展
              "branch-logic",   // 分支判断逻辑
              "constant"        // 常数源 (如 +4)
            ],
            "description": "部件类型，决定渲染外形和行为"
          },
          "label": {
            "type": "string",
            "description": "显示名称",
            "examples": ["PC", "指令存储器", "寄存器堆", "ALU"]
          },
          "position": {
            "type": "object",
            "description": "SVG 画布上的位置 (左上角)",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" }
            }
          },
          "size": {
            "type": "object",
            "description": "部件尺寸",
            "properties": {
              "width": { "type": "number" },
              "height": { "type": "number" }
            }
          },
          "ports": {
            "type": "array",
            "description": "部件的输入/输出端口",
            "items": {
              "type": "object",
              "required": ["name", "direction", "position", "busWidth"],
              "properties": {
                "name": {
                  "type": "string",
                  "description": "端口名称",
                  "examples": ["in", "out", "addr", "data", "sel", "wr_en"]
                },
                "direction": {
                  "type": "string",
                  "enum": ["in", "out"],
                  "description": "端口方向"
                },
                "position": {
                  "type": "string",
                  "enum": ["top", "bottom", "left", "right"],
                  "description": "端口在部件上的位置"
                },
                "offset": {
                  "type": "number",
                  "description": "沿边的偏移比例 (0-1)",
                  "default": 0.5
                },
                "busWidth": {
                  "type": "number",
                  "description": "总线宽度 (位数)",
                  "examples": [1, 5, 12, 32]
                },
                "signalType": {
                  "type": "string",
                  "enum": ["data", "control", "address"],
                  "default": "data"
                }
              }
            }
          },
          "muxInputCount": {
            "type": "number",
            "description": "仅 mux 类型：输入路数",
            "examples": [2, 3, 4]
          },
          "stateKey": {
            "type": "string",
            "description": "映射到 CycleSnapshot 中的字段路径",
            "examples": ["pc", "pipelineRegs.IR", "aluDetail.result"]
          }
        }
      }
    },

    "wires": {
      "type": "array",
      "description": "所有连线定义",
      "items": {
        "type": "object",
        "required": ["id", "from", "to"],
        "properties": {
          "id": {
            "type": "string",
            "description": "连线唯一标识符",
            "examples": ["pc-to-imem", "alu-to-aluout"]
          },
          "from": {
            "type": "object",
            "properties": {
              "component": { "type": "string", "description": "源部件 ID" },
              "port": { "type": "string", "description": "源端口名" }
            }
          },
          "to": {
            "type": "object",
            "properties": {
              "component": { "type": "string", "description": "目标部件 ID" },
              "port": { "type": "string", "description": "目标端口名" }
            }
          },
          "busWidth": {
            "type": "number",
            "description": "总线宽度，影响线宽渲染",
            "default": 32
          },
          "signalType": {
            "type": "string",
            "enum": ["data", "control", "address"],
            "default": "data",
            "description": "信号类型，影响颜色: data=蓝, control=红, address=绿"
          },
          "waypoints": {
            "type": "array",
            "description": "连线途经点（用于避免交叉）",
            "items": {
              "type": "object",
              "properties": {
                "x": { "type": "number" },
                "y": { "type": "number" }
              }
            }
          },
          "label": {
            "type": "string",
            "description": "连线上显示的标签",
            "examples": ["32", "5", "addr"]
          },
          "stateKey": {
            "type": "string",
            "description": "映射到快照中的数据值字段",
            "examples": ["pc", "pipelineRegs.A", "aluDetail.result"]
          }
        }
      }
    }
  }
}
```

### 3.3 多周期数据通路配置实例（部分）

```jsonc
// ============================================================
// 文件: src/config/multicycle-datapath.json
// 描述: 多周期 RISC-V CPU 数据通路配置（核心部件示例）
// ============================================================
{
  "metadata": {
    "name": "RISC-V 多周期 CPU",
    "type": "multicycle",
    "version": "1.0.0",
    "canvasSize": { "width": 1200, "height": 800 }
  },
  "components": [
    {
      "id": "pc",
      "type": "register",
      "label": "PC",
      "position": { "x": 50, "y": 350 },
      "size": { "width": 60, "height": 80 },
      "ports": [
        { "name": "in", "direction": "in", "position": "left", "offset": 0.5, "busWidth": 32, "signalType": "address" },
        { "name": "out", "direction": "out", "position": "right", "offset": 0.5, "busWidth": 32, "signalType": "address" },
        { "name": "write", "direction": "in", "position": "top", "offset": 0.5, "busWidth": 1, "signalType": "control" }
      ],
      "stateKey": "pc"
    },
    {
      "id": "instr-mem",
      "type": "memory",
      "label": "指令存储器",
      "position": { "x": 170, "y": 300 },
      "size": { "width": 100, "height": 160 },
      "ports": [
        { "name": "addr", "direction": "in", "position": "left", "offset": 0.3, "busWidth": 32, "signalType": "address" },
        { "name": "data_out", "direction": "out", "position": "right", "offset": 0.5, "busWidth": 32, "signalType": "data" },
        { "name": "rd_en", "direction": "in", "position": "top", "offset": 0.5, "busWidth": 1, "signalType": "control" }
      ],
      "stateKey": "decodedInstruction.raw"
    },
    {
      "id": "reg-file",
      "type": "register-file",
      "label": "寄存器堆",
      "position": { "x": 420, "y": 250 },
      "size": { "width": 120, "height": 200 },
      "ports": [
        { "name": "rs1_addr", "direction": "in", "position": "left", "offset": 0.2, "busWidth": 5, "signalType": "address" },
        { "name": "rs2_addr", "direction": "in", "position": "left", "offset": 0.4, "busWidth": 5, "signalType": "address" },
        { "name": "rd_addr", "direction": "in", "position": "left", "offset": 0.6, "busWidth": 5, "signalType": "address" },
        { "name": "rd_data", "direction": "in", "position": "left", "offset": 0.8, "busWidth": 32, "signalType": "data" },
        { "name": "rs1_data", "direction": "out", "position": "right", "offset": 0.3, "busWidth": 32, "signalType": "data" },
        { "name": "rs2_data", "direction": "out", "position": "right", "offset": 0.7, "busWidth": 32, "signalType": "data" },
        { "name": "wr_en", "direction": "in", "position": "top", "offset": 0.5, "busWidth": 1, "signalType": "control" }
      ]
    },
    {
      "id": "alu",
      "type": "alu",
      "label": "ALU",
      "position": { "x": 750, "y": 300 },
      "size": { "width": 80, "height": 140 },
      "ports": [
        { "name": "a", "direction": "in", "position": "left", "offset": 0.3, "busWidth": 32, "signalType": "data" },
        { "name": "b", "direction": "in", "position": "left", "offset": 0.7, "busWidth": 32, "signalType": "data" },
        { "name": "op", "direction": "in", "position": "top", "offset": 0.5, "busWidth": 4, "signalType": "control" },
        { "name": "result", "direction": "out", "position": "right", "offset": 0.4, "busWidth": 32, "signalType": "data" },
        { "name": "zero", "direction": "out", "position": "right", "offset": 0.7, "busWidth": 1, "signalType": "control" }
      ],
      "stateKey": "aluDetail.result"
    },
    {
      "id": "mux-alu-b",
      "type": "mux",
      "label": "MUX",
      "position": { "x": 680, "y": 380 },
      "size": { "width": 40, "height": 80 },
      "muxInputCount": 4,
      "ports": [
        { "name": "in0", "direction": "in", "position": "left", "offset": 0.2, "busWidth": 32, "signalType": "data" },
        { "name": "in1", "direction": "in", "position": "left", "offset": 0.4, "busWidth": 32, "signalType": "data" },
        { "name": "in2", "direction": "in", "position": "left", "offset": 0.6, "busWidth": 32, "signalType": "data" },
        { "name": "in3", "direction": "in", "position": "left", "offset": 0.8, "busWidth": 32, "signalType": "data" },
        { "name": "sel", "direction": "in", "position": "top", "offset": 0.5, "busWidth": 2, "signalType": "control" },
        { "name": "out", "direction": "out", "position": "right", "offset": 0.5, "busWidth": 32, "signalType": "data" }
      ]
    },
    {
      "id": "control-unit",
      "type": "control",
      "label": "控制单元",
      "position": { "x": 420, "y": 80 },
      "size": { "width": 160, "height": 100 },
      "ports": [
        { "name": "opcode", "direction": "in", "position": "left", "offset": 0.5, "busWidth": 7, "signalType": "data" },
        { "name": "funct3", "direction": "in", "position": "left", "offset": 0.8, "busWidth": 3, "signalType": "data" },
        { "name": "signals", "direction": "out", "position": "bottom", "offset": 0.5, "busWidth": 1, "signalType": "control" }
      ]
    }
  ],
  "wires": [
    {
      "id": "pc-to-imem",
      "from": { "component": "pc", "port": "out" },
      "to": { "component": "instr-mem", "port": "addr" },
      "busWidth": 32,
      "signalType": "address",
      "stateKey": "pc"
    },
    {
      "id": "imem-to-ir",
      "from": { "component": "instr-mem", "port": "data_out" },
      "to": { "component": "ir", "port": "in" },
      "busWidth": 32,
      "signalType": "data",
      "stateKey": "pipelineRegs.IR"
    },
    {
      "id": "regfile-to-a",
      "from": { "component": "reg-file", "port": "rs1_data" },
      "to": { "component": "reg-a", "port": "in" },
      "busWidth": 32,
      "signalType": "data",
      "stateKey": "pipelineRegs.A"
    },
    {
      "id": "muxb-to-alu",
      "from": { "component": "mux-alu-b", "port": "out" },
      "to": { "component": "alu", "port": "b" },
      "busWidth": 32,
      "signalType": "data"
    },
    {
      "id": "ctrl-to-regwrite",
      "from": { "component": "control-unit", "port": "signals" },
      "to": { "component": "reg-file", "port": "wr_en" },
      "busWidth": 1,
      "signalType": "control",
      "label": "RegWrite",
      "stateKey": "controlSignals.RegWrite"
    }
  ]
}
```

---

## 第四部分：AI 编程（Vibecoding）实施路径

### 4.1 总体原则

1. **每个阶段的产物必须可独立测试** — 不依赖后续阶段
2. **每个 AI 指令的上下文控制在单个模块内** — 避免跨文件引用过多
3. **先纯逻辑后 UI** — 引擎层完全就绪后再做可视化
4. **类型先行** — 先让 AI 生成类型定义，后续模块基于类型约束生成

### 4.2 分阶段开发路径

```
阶段 0 ──→ 阶段 1 ──→ 阶段 2 ──→ 阶段 3 ──→ 阶段 4 ──→ 阶段 5 ──→ 阶段 6
项目骨架    类型定义    汇编器     CPU 引擎    视图映射    UI 组件     集成调试
```

---

#### 阶段 0：项目脚手架（1 个 Prompt）

**目标**：初始化项目结构，安装依赖

**Prompt 示例**：
> 用 Vite + React + TypeScript 初始化项目。安装以下依赖：zustand, framer-motion, @codemirror/basic-setup。
> 创建如下目录结构：
> ```
> src/
>   engine/          # CPU 模拟器引擎（纯逻辑，零 UI 依赖）
>     assembler/     # RISC-V 汇编器
>     core/          # CPU 核心模块
>   view/            # 视图映射层
>   components/      # React UI 组件
>     datapath/      # 数据通路 SVG 组件
>     panels/        # 控制面板组件
>   config/          # 数据通路拓扑配置 JSON
>   store/           # Zustand 状态管理
>   types/           # 共享类型定义
> ```
> 配置 Tailwind CSS。配置 Vitest。

---

#### 阶段 1：核心类型定义（1-2 个 Prompt）

**目标**：定义所有接口和类型，作为后续所有模块的契约

**Prompt 1**：
> 根据以下架构设计，在 `src/types/` 下创建类型定义文件。
> （附上本文档第三部分 3.1 节的类型定义）
> 创建以下文件：
> - `src/types/cpu.ts` — Stage, ALUOp, ImmType, ControlSignals, DecodedInstruction
> - `src/types/snapshot.ts` — CycleSnapshot, DataPathActivity, StateChange
> - `src/types/engine.ts` — ICPUEngine 接口
> - `src/types/view.ts` — ViewState, ComponentViewState, WireViewState
> - `src/types/datapath-config.ts` — 部件和连线配置的 TypeScript 类型

**Prompt 2**：
> 在 `src/config/multicycle-datapath.json` 中创建多周期 RISC-V CPU 的数据通路拓扑配置。
> （附上本文档 3.3 节的 JSON 配置，要求补全所有部件和连线）

---

#### 阶段 2：RISC-V 汇编器（2-3 个 Prompt）

**目标**：实现汇编文本 → 机器码的转换

**Prompt 1**：
> 在 `src/engine/assembler/` 下实现 RISC-V RV32I 汇编器。
> 支持的指令集：
> - R 型: add, sub, and, or, xor, sll, srl, sra, slt, sltu
> - I 型: addi, andi, ori, xori, slti, sltiu, lw, lb, lh, jalr
> - S 型: sw, sb, sh
> - B 型: beq, bne, blt, bge, bltu, bgeu
> - U 型: lui, auipc
> - J 型: jal
> 支持标签（label）和注释（# 或 //）。
> 输入：汇编文本字符串。输出：Uint32Array 机器码数组。
> 同时实现反汇编函数：机器码 → 汇编文本。
> 为每条指令编写单元测试。

**Prompt 2**：
> 为汇编器添加错误处理：
> - 未定义的标签
> - 无效的寄存器名
> - 立即数超出范围
> - 语法错误
> 错误信息需包含行号和列号。编写对应的错误用例测试。

**Prompt 3（可选）**：
> 添加伪指令支持：li, la, mv, nop, j, ret, call, beqz, bnez, bgt, ble。
> 伪指令展开为真实指令序列。

---

#### 阶段 3：CPU 模拟器引擎（3-4 个 Prompt，核心阶段）

**Prompt 1 — ALU 与基础模块**：
> 在 `src/engine/core/` 下实现以下独立模块，每个模块一个文件：
> - `alu.ts`: ALU 模块，接受两个 32 位输入和操作码，返回结果和零标志
> - `decoder.ts`: 指令解码器，将 32 位机器码解码为 DecodedInstruction
> - `immediate-gen.ts`: 立即数生成器，根据指令格式提取并符号扩展立即数
> - `memory.ts`: 存储器模块，支持字节/半字/字的读写，大小 4KB
> - `register-file.ts`: 寄存器堆，32 个 32 位寄存器，x0 恒为 0
> 每个模块都是纯函数或简单类，无副作用。为每个模块编写单元测试。

**Prompt 2 — 控制单元**：
> 实现 `src/engine/core/control.ts` — 多周期控制单元。
> 这是一个有限状态机，根据当前阶段（Stage）和指令类型，输出 ControlSignals。
> 状态转移规则：
> - IF → ID（所有指令）
> - ID → EX（所有指令）
> - EX → MEM（load/store）, EX → WB（R/I 型）, EX → IF（branch/jump）
> - MEM → WB（load）, MEM → IF（store）
> - WB → IF（所有）
> 为每种指令类型的每个阶段编写控制信号真值表测试。

**Prompt 3 — CPU 主类**：
> 实现 `src/engine/core/cpu.ts` — CPU 主类，实现 ICPUEngine 接口。
> 组合所有子模块（ALU、控制单元、解码器、存储器、寄存器堆）。
> 实现 tick() 方法：根据当前 Stage 执行对应操作，生成 CycleSnapshot。
> 实现 step() 方法：连续 tick 直到一条指令执行完毕。
> 实现 reset()、loadProgram()、getSnapshot()。
> 关键：tick() 必须生成完整的 activeDataPaths 和 changes 信息。

**Prompt 4 — 历史与回退**：
> 实现 `src/engine/history.ts` — 执行历史管理器。
> - 每次 tick 后保存快照到历史栈
> - 支持 rewindTo(cycleNumber) 回退到任意周期
> - 内存优化：超过 1000 个快照时，对早期快照进行压缩（只保留关键帧）
> 编写测试：执行 10 条指令后回退到第 3 个周期，验证状态正确。

---

#### 阶段 4：视图映射层（1-2 个 Prompt）

**Prompt 1**：
> 实现 `src/view/view-mapper.ts` — 视图映射器。
> 输入：CycleSnapshot + 数据通路配置 JSON。
> 输出：ViewState（所有组件和连线的视觉属性）。
> 映射规则：
> 1. 根据 snapshot.stage 确定当前活跃的部件和连线（参考 STAGE_ACTIVE_COMPONENTS 映射表）
> 2. 根据 snapshot.activeDataPaths 设置连线的 active 状态和传输值
> 3. 根据 snapshot.controlSignals 设置控制信号连线的状态
> 4. 根据 snapshot.changes 标记发生变化的部件为高亮
> 5. 为每个部件生成 displayValues（从快照中提取对应的值）

**Prompt 2**：
> 实现 `src/view/animation-scheduler.ts` — 动画编排器。
> 输入：前一个 ViewState 和当前 ViewState。
> 输出：AnimationSequence — 按时间排列的动画步骤。
> 动画顺序应模拟真实信号传播：
> - 先高亮源部件 → 连线动画（数据流动） → 高亮目标部件
> - 控制信号先于数据信号
> - 同一阶段内的并行信号可同时动画

---

#### 阶段 5：UI 组件（4-5 个 Prompt）

**Prompt 1 — SVG 基础部件**：
> 在 `src/components/datapath/` 下实现以下 SVG 组件，每个组件一个文件：
> - `RegisterComponent.tsx`: 矩形，显示寄存器名和当前值，高亮时边框变色
> - `MemoryComponent.tsx`: 较大矩形，显示名称，读/写时有不同高亮色
> - `ALUComponent.tsx`: 梯形/V 形，显示当前运算符号，结果值
> - `MuxComponent.tsx`: 梯形，高亮选中的输入端
> - `ControlUnitComponent.tsx`: 圆角矩形，显示当前阶段，输出信号列表
> 所有组件接受 ComponentViewState 作为 props。
> 使用 Framer Motion 实现高亮的淡入淡出动画。

**Prompt 2 — 连线组件**：
> 实现 `src/components/datapath/Wire.tsx` — SVG 连线组件。
> Props: WireViewState + 起止坐标 + waypoints。
> 功能：
> - 非活跃时灰色细线，活跃时根据 signalType 变色（data=蓝, control=红, address=绿）
> - 活跃时显示数据流动画（SVG animateMotion 或 stroke-dashoffset 动画）
> - 总线宽度 > 1 时用双线表示
> - 悬停显示当前传输值的 tooltip

**Prompt 3 — 数据通路画布**：
> 实现 `src/components/datapath/DatapathCanvas.tsx`。
> 读取 multicycle-datapath.json 配置，动态渲染所有部件和连线。
> 从 Zustand store 订阅 viewState，将视觉状态分发给各子组件。
> 支持画布缩放（鼠标滚轮）和平移（拖拽）。
> 点击部件时在侧面板显示详细信息。

**Prompt 4 — 控制面板**：
> 实现左侧控制面板组件：
> - `CodeEditor.tsx`: 集成 CodeMirror 6，RISC-V 汇编语法高亮，错误行标记
> - `ExecutionControls.tsx`: 运行/暂停/单步(周期)/单步(指令)/重置/速度滑块
> - `RegisterView.tsx`: 32 个寄存器的表格，变化的寄存器高亮闪烁
> - `MemoryView.tsx`: 数据存储器的十六进制视图，支持地址跳转
> - `SignalTable.tsx`: 当前所有控制信号的表格，活跃信号高亮

**Prompt 5 — 阶段指示器与时间线**：
> 实现底部组件：
> - `StageIndicator.tsx`: 显示 IF→ID→EX→MEM→WB 五个阶段，当前阶段高亮，已完成阶段打勾
> - `HistoryTimeline.tsx`: 水平时间线，显示已执行的周期，可点击任意周期回退
> - 时间线上用不同颜色标记不同指令的周期

---

#### 阶段 6：状态管理与集成（1-2 个 Prompt）

**Prompt 1**：
> 实现 `src/store/cpu-store.ts` — Zustand store。
> （附上 2.4.2 节的 store 设计）
> 关键逻辑：
> - loadAndAssemble: 调用汇编器，加载到引擎，生成初始快照
> - tick/step: 调用引擎方法，通过 ViewMapper 更新 viewState
> - run: 使用 requestAnimationFrame 循环调用 tick，受 executionSpeed 控制
> - rewindTo: 调用引擎回退，更新快照和视图

**Prompt 2**：
> 实现 `src/App.tsx` 主布局，将所有组件组装在一起。
> 左侧 30% 宽度放控制面板，右侧 70% 放数据通路画布。
> 底部放阶段指示器和时间线。
> 添加键盘快捷键：Space=运行/暂停, →=单步周期, ↓=单步指令, R=重置。
> 添加一个预置示例程序下拉菜单（如：斐波那契、冒泡排序、阶乘）。

---

### 4.3 Prompt 编写最佳实践

| 原则 | 说明 |
|------|------|
| **单一职责** | 每个 Prompt 只处理一个模块或一组紧密相关的文件 |
| **类型约束** | 始终在 Prompt 中引用已定义的 TypeScript 接口，让 AI 基于类型生成 |
| **测试驱动** | 每个 Prompt 都要求附带单元测试 |
| **上下文最小化** | 只附上当前模块需要的类型定义，不要把整个项目代码贴进去 |
| **示例驱动** | 给 AI 一个输入/输出示例，比描述规则更有效 |
| **渐进增强** | 先实现核心功能，再用后续 Prompt 添加边界情况处理 |

### 4.4 验证检查点

| 阶段完成后 | 验证方式 |
|-----------|---------|
| 阶段 2 (汇编器) | `assembler.assemble("add x1, x2, x3")` → `0x003100B3` |
| 阶段 3 (引擎) | 加载 3 条指令，step() 3 次，验证寄存器和 PC 值正确 |
| 阶段 4 (映射层) | 给定一个 snapshot，验证输出的 ViewState 中活跃部件/连线正确 |
| 阶段 5 (UI) | 浏览器中看到静态数据通路图，部件可点击 |
| 阶段 6 (集成) | 输入汇编代码，点击运行，看到完整的动画执行过程 |

---

## 附录

### A. 支持的 RV32I 指令速查表

| 格式 | 指令 | 操作 |
|------|------|------|
| R | add, sub, and, or, xor, sll, srl, sra, slt, sltu | 寄存器-寄存器运算 |
| I | addi, andi, ori, xori, slti, sltiu | 寄存器-立即数运算 |
| I | lw, lh, lb, lhu, lbu | 加载 |
| I | jalr | 寄存器跳转 |
| S | sw, sh, sb | 存储 |
| B | beq, bne, blt, bge, bltu, bgeu | 条件分支 |
| U | lui, auipc | 高位立即数 |
| J | jal | 跳转并链接 |

### B. 多周期各阶段控制信号真值表

| 阶段 | PCWrite | IorD | MemRead | MemWrite | IRWrite | RegWrite | ALUSrcA | ALUSrcB | ALUOp | MemToReg | PCSource |
|------|---------|------|---------|----------|---------|----------|---------|---------|-------|----------|----------|
| IF   | 1       | 0    | 1       | 0        | 1       | 0        | 0       | 1       | ADD   | -        | 0        |
| ID   | 0       | -    | 0       | 0        | 0       | 0        | 0       | 2       | ADD   | -        | -        |
| EX(R)| 0       | -    | 0       | 0        | 0       | 0        | 1       | 0       | *     | -        | -        |
| EX(I)| 0       | -    | 0       | 0        | 0       | 0        | 1       | 2       | *     | -        | -        |
| EX(L)| 0       | -    | 0       | 0        | 0       | 0        | 1       | 2       | ADD   | -        | -        |
| EX(S)| 0       | -    | 0       | 0        | 0       | 0        | 1       | 2       | ADD   | -        | -        |
| EX(B)| *       | -    | 0       | 0        | 0       | 0        | 1       | 0       | SUB   | -        | 1        |
| MEM(L)| 0      | 1    | 1       | 0        | 0       | 0        | -       | -       | -     | -        | -        |
| MEM(S)| 0      | 1    | 0       | 1        | 0       | 0        | -       | -       | -     | -        | -        |
| WB(R)| 0       | -    | 0       | 0        | 0       | 1        | -       | -       | -     | 0        | -        |
| WB(L)| 0       | -    | 0       | 0        | 0       | 1        | -       | -       | -     | 1        | -        |

> `*` 表示根据具体指令决定，`-` 表示无关项

### C. 项目目录结构总览

```
risc-v-cpu-visualizer/
├── public/
│   └── index.html
├── src/
│   ├── types/                          # 共享类型定义
│   │   ├── cpu.ts                      # CPU 相关枚举和接口
│   │   ├── snapshot.ts                 # 快照类型
│   │   ├── engine.ts                   # 引擎接口
│   │   ├── view.ts                     # 视图层类型
│   │   └── datapath-config.ts          # 配置类型
│   │
│   ├── engine/                         # 模拟器引擎（纯逻辑）
│   │   ├── assembler/
│   │   │   ├── lexer.ts
│   │   │   ├── parser.ts
│   │   │   ├── encoder.ts
│   │   │   ├── disassembler.ts
│   │   │   ├── pseudo-instructions.ts
│   │   │   ├── types.ts
│   │   │   └── __tests__/
│   │   │       ├── lexer.test.ts
│   │   │       ├── parser.test.ts
│   │   │       ├── encoder.test.ts
│   │   │       └── integration.test.ts
│   │   ├── core/
│   │   │   ├── cpu.ts                  # CPU 主类
│   │   │   ├── alu.ts
│   │   │   ├── control.ts             # 控制单元状态机
│   │   │   ├── decoder.ts
│   │   │   ├── memory.ts
│   │   │   ├── register-file.ts
│   │   │   ├── immediate-gen.ts
│   │   │   └── __tests__/
│   │   │       ├── cpu.test.ts
│   │   │       ├── alu.test.ts
│   │   │       ├── control.test.ts
│   │   │       └── decoder.test.ts
│   │   ├── snapshot.ts
│   │   ├── history.ts
│   │   └── index.ts
│   │
│   ├── view/                           # 视图映射层
│   │   ├── view-mapper.ts
│   │   ├── animation-scheduler.ts
│   │   └── __tests__/
│   │       └── view-mapper.test.ts
│   │
│   ├── config/                         # 配置文件
│   │   ├── datapath-schema.json        # JSON Schema
│   │   ├── multicycle-datapath.json    # 多周期拓扑配置
│   │   └── examples/                   # 示例程序
│   │       ├── fibonacci.asm
│   │       ├── bubble-sort.asm
│   │       └── factorial.asm
│   │
│   ├── components/                     # React UI 组件
│   │   ├── datapath/                   # 数据通路 SVG 组件
│   │   │   ├── DatapathCanvas.tsx
│   │   │   ├── RegisterComponent.tsx
│   │   │   ├── MemoryComponent.tsx
│   │   │   ├── ALUComponent.tsx
│   │   │   ├── MuxComponent.tsx
│   │   │   ├── ControlUnitComponent.tsx
│   │   │   ├── Wire.tsx
│   │   │   ├── DataFlowAnimation.tsx
│   │   │   └── ComponentFactory.tsx    # 根据 type 动态创建组件
│   │   ├── panels/                     # 控制面板组件
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── ExecutionControls.tsx
│   │   │   ├── RegisterView.tsx
│   │   │   ├── MemoryView.tsx
│   │   │   └── SignalTable.tsx
│   │   ├── timeline/
│   │   │   ├── StageIndicator.tsx
│   │   │   └── HistoryTimeline.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── MainLayout.tsx
│   │
│   ├── store/                          # 状态管理
│   │   └── cpu-store.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── vitest.config.ts
```

### D. 视觉设计规范

| 元素 | 非活跃状态 | 活跃状态 | 变更高亮 |
|------|-----------|---------|---------|
| 部件边框 | `#94a3b8` (slate-400) | `#3b82f6` (blue-500) | `#f59e0b` (amber-500) 闪烁 |
| 部件背景 | `#f8fafc` (slate-50) | `#eff6ff` (blue-50) | `#fffbeb` (amber-50) |
| 数据连线 | `#cbd5e1` (slate-300) 1px | `#3b82f6` (blue-500) 2px | - |
| 控制连线 | `#cbd5e1` (slate-300) 1px 虚线 | `#ef4444` (red-500) 2px | - |
| 地址连线 | `#cbd5e1` (slate-300) 1px | `#22c55e` (green-500) 2px | - |
| 数值文本 | `#64748b` (slate-500) | `#1e40af` (blue-800) 加粗 | `#b45309` (amber-700) |

---

*文档结束。本架构设计为 AI 辅助开发提供了完整的类型契约、模块边界和实施路径，确保每个开发阶段的产物可独立验证，最终集成为完整的 RISC-V CPU 可视化教学应用。*
