# HDCPU

HDCPU 是一个面向计算机组成原理教学的浏览器端 RISC-V CPU 模拟与数据通路可视化工具。项目使用 React、TypeScript 和 Vite 构建，在前端完成汇编、执行、状态追踪和 SVG 数据通路渲染，不依赖后端服务。

当前应用支持多周期 CPU 与五级流水线两种执行模型，适合用来观察指令在取指、译码、执行、访存、写回阶段中的状态变化，以及流水线中的数据冲突、控制冲突、停顿、冲刷和旁路行为。

## 功能特性

- RISC-V 汇编编辑、示例程序加载、汇编错误提示与机器码查看。
- 多周期 CPU 执行模型：支持按周期、按指令、连续运行和重置。
- 五级流水线执行模型：支持流水线寄存器、冲突检测、旁路与控制策略观察。
- 数据通路 SVG 可视化：根据当前快照高亮活跃部件、连线和控制信号。
- 执行检查面板：查看 ALU 输入输出、PC、寄存器、内存访问和状态变化。
- 时间线回退：点击历史周期可回到指定执行状态，便于课堂演示和调试。
- 教学练习面板：围绕控制信号、阶段路径和流水线冲突进行交互式检查。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | React 19, TypeScript |
| 构建工具 | Vite 5 |
| 状态管理 | Zustand |
| 代码编辑器 | CodeMirror |
| 动画 | Framer Motion, CSS |
| 测试 | Vitest |
| 代码质量 | ESLint, TypeScript |

## 快速开始

### 环境要求

- Node.js 18 或更高版本，推荐 Node.js 20 LTS。
- npm。项目包含 `package-lock.json`，默认使用 npm 安装依赖。

### 安装与启动

```bash
npm install
npm run dev
```

开发服务器默认运行在：

```text
http://127.0.0.1:5173
```

### 构建与预览

```bash
npm run build
npm run preview
```

预览服务器默认运行在：

```text
http://127.0.0.1:4173
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm run lint` | 执行 ESLint 检查 |
| `npm test` | 以监听模式运行 Vitest |
| `npm run test:run` | 单次运行全部测试 |
| `npm run build` | 类型检查并生成生产构建 |
| `npm run preview` | 本地预览生产构建 |
| `npm run deploy:check` | 校验 `dist` 产物是否完整 |
| `npm run verify` | 依次运行 lint、测试、构建与产物校验 |

## 使用流程

1. 打开应用后，在左侧“程序输入”中选择示例程序或编辑自定义 RISC-V 汇编。
2. 在“运行控制”中选择多周期或流水线数据通路模式。
3. 点击“运行”“单步周期”或“单步指令”推进模拟。
4. 在中心画布观察当前活跃的数据通路部件与连线。
5. 在右侧面板查看总览、执行检查、寄存器、内存、控制信号和机器码。
6. 需要复盘时，点击时间线中的历史周期进行回退。

常用快捷键：

| 快捷键 | 作用 |
| --- | --- |
| `Space` | 运行 / 暂停 |
| `ArrowRight` | 单步周期 |
| `ArrowLeft` | 回到上一周期 |
| `ArrowDown` | 单步指令 |
| `R` | 重置程序 |

## 汇编支持范围

寄存器使用 `x0` 到 `x31` 命名，支持十进制和十六进制立即数，支持 `#` 与 `//` 注释。

| 类型 | 指令 |
| --- | --- |
| R-type | `add`, `sub`, `sll`, `slt`, `sltu`, `xor`, `srl`, `sra`, `or`, `and` |
| I-type 算术 | `addi`, `slti`, `sltiu`, `xori`, `ori`, `andi`, `slli`, `srli`, `srai` |
| Load | `lb`, `lh`, `lw`, `lbu`, `lhu` |
| Store | `sb`, `sh`, `sw` |
| Branch | `beq`, `bne`, `blt`, `bge`, `bltu`, `bgeu` |
| Jump | `jal`, `jalr` |
| U-type | `lui`, `auipc` |
| 伪指令 | `li`, `la`, `mv`, `nop`, `j`, `ret`, `call`, `beqz`, `bnez`, `bgt`, `ble` |

示例：

```asm
# RISC-V 多周期实验程序
addi x1, x0, 5
addi x2, x0, 9
add  x3, x1, x2
sw   x3, 64(x0)
lw   x4, 64(x0)
```

## 项目结构

```text
HDCPU/
├─ doc/                         # 项目计划、架构与协作文档
├─ scripts/                     # 构建、部署和数据通路配置辅助脚本
├─ src/
│  ├─ components/               # React UI 组件
│  │  ├─ datapath/              # SVG 数据通路画布、部件与连线
│  │  ├─ layout/                # 页面布局
│  │  ├─ panels/                # 编辑器、控制、寄存器、内存等面板
│  │  ├─ runtime/               # 运行时快捷键与循环绑定
│  │  └─ timeline/              # 执行时间线
│  ├─ config/                   # 多周期与流水线数据通路 JSON 配置
│  ├─ content/                  # 内置示例程序
│  ├─ engine/                   # 汇编器与 CPU 执行引擎
│  │  ├─ assembler/             # 词法、语法、编码、反汇编
│  │  └─ core/                  # ALU、控制器、存储器、寄存器、CPU
│  ├─ hooks/                    # 执行循环与快捷键 Hook
│  ├─ store/                    # Zustand 应用状态
│  ├─ teaching/                 # 教学练习与检查逻辑
│  ├─ types/                    # 共享 TypeScript 类型
│  ├─ view/                     # 快照到可视化状态的映射
│  ├─ App.tsx
│  └─ main.tsx
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.mjs
└─ vitest.config.mjs
```

## 架构概览

项目的主数据流如下：

```text
汇编源码
  -> Assembler 生成机器码
  -> CPU / PipelineCPU 执行 tick 或 step
  -> CycleSnapshot 记录当前周期状态
  -> View Mapper 和 Zustand Store 派生 UI 状态
  -> React + SVG 渲染数据通路、面板和时间线
```

关键设计点：

- `src/engine/assembler/` 负责把汇编源码转换为 `Uint32Array` 机器码，并提供反汇编能力。
- `src/engine/core/cpu.ts` 实现多周期 CPU，引擎接口以快照为核心。
- `src/engine/core/pipeline-cpu.ts` 实现五级流水线 CPU，并输出冲突、旁路和流水寄存器状态。
- `src/store/cpu-store.ts` 统一管理源码、机器码、当前快照、历史时间线、寄存器、内存和运行状态。
- `src/config/*.json` 描述数据通路部件、端口和连线，便于调整可视化布局。

## 部署配置

生产构建默认使用 `/` 作为资源基础路径。如需部署到子路径，可以设置 `HDCPU_BASE_PATH`：

```bash
HDCPU_BASE_PATH=/HDCPU/ npm run build
```

PowerShell：

```powershell
$env:HDCPU_BASE_PATH = '/HDCPU/'
npm run build
```

如需生成 sourcemap：

```bash
HDCPU_SOURCEMAP=true npm run build
```

PowerShell：

```powershell
$env:HDCPU_SOURCEMAP = 'true'
npm run build
```

构建完成后，运行下面的命令校验 `dist` 目录中的入口和静态资源引用：

```bash
npm run deploy:check
```

## 开发建议

- 修改 CPU 执行语义时，优先补充或更新 `src/engine/core/__tests__/` 中的单元测试。
- 修改汇编语法或编码时，同步检查 `src/engine/assembler/__tests__/`。
- 修改数据通路 JSON 后，关注端口、连线 ID 和正交线段是否仍然有效。
- 提交前建议运行：

```bash
npm run verify
```

## 相关文档

- `doc/arch.md`：系统架构设计说明。
- `doc/PROJECT_PLAN.md`：项目开发计划。
- `doc/YOUR_TASKS.md` 与 `doc/TEAMMATE_TASKS.md`：协作任务拆分。
- `doc/架构简化版.md`：简化版架构说明。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
