# 队友的详细任务清单（两周计划）

## Day 1 上午（今天，已完成）

### ✅ 已完成
- [x] 项目脚手架创建
- [x] 依赖安装
- [x] Tailwind CSS 配置
- [x] Vitest 配置
- [x] 目录结构创建

---

## Day 1 下午（今天，剩余2小时）

### 🎯 现在要做的

1. **验证项目运行**（15分钟）
   ```bash
   npm run dev    # 应该能看到 Vite 默认页面
   npm test       # 应该能运行测试
   ```

2. **创建基础布局组件**（1.5小时）
   - 创建 `src/components/layout/Header.tsx`
   - 创建 `src/components/layout/MainLayout.tsx`
   - 创建简单的左右分栏布局（左30%，右70%）

3. **创建 Zustand Store 骨架**（30分钟）
   - 创建 `src/store/cpu-store.ts`
   - 定义 store 接口（先不实现逻辑）

---

## Day 2（明天，全天）

### 上午（4小时）

1. **创建数据通路配置 JSON**（3小时）
   - 创建 `src/config/multicycle-datapath.json`
   - 定义所有 CPU 部件的位置和端口
   - 定义所有连线
   - 参考 `arch.md` 第 804-945 行

2. **测试配置加载**（1小时）
   - 创建一个简单的组件读取配置
   - 在浏览器中验证配置正确

### 下午（4小时）

1. **集成 CodeMirror**（2小时）
   - 创建 `src/components/panels/CodeEditor.tsx`
   - 配置基础的代码编辑器
   - 添加行号和语法高亮（先用 JavaScript 高亮）

2. **创建控制按钮组件**（2小时）
   - 创建 `src/components/panels/ExecutionControls.tsx`
   - 添加按钮：运行、暂停、单步（周期）、单步（指令）、重置
   - 添加速度滑块

---

## Day 3-4（UI 框架搭建）

### Day 3

1. **寄存器视图组件**（3小时）
   - 创建 `src/components/panels/RegisterView.tsx`
   - 显示 32 个寄存器的表格
   - 支持十六进制/十进制切换

2. **内存视图组件**（3小时）
   - 创建 `src/components/panels/MemoryView.tsx`
   - 十六进制内存视图
   - 支持地址跳转

### Day 4

1. **控制信号表组件**（2小时）
   - 创建 `src/components/panels/SignalTable.tsx`
   - 显示所有控制信号的真值表

2. **机器码视图**（2小时）
   - 创建 `src/components/panels/MachineCodeView.tsx`
   - 显示汇编代码对应的机器码

---

## Day 5（开始 SVG 组件）

### 全天（8小时）

1. **创建基础 SVG 部件组件**（6小时）
   - `src/components/datapath/RegisterComponent.tsx` - 寄存器
   - `src/components/datapath/MemoryComponent.tsx` - 存储器
   - `src/components/datapath/ALUComponent.tsx` - ALU
   - `src/components/datapath/MuxComponent.tsx` - 多路选择器
   - `src/components/datapath/ControlUnitComponent.tsx` - 控制单元

2. **测试静态渲染**（2小时）
   - 在画布上放置几个部件
   - 验证位置和样式正确

---

## Day 6（连线组件）

### 全天（8小时）

1. **实现连线组件**（4小时）
   - 创建 `src/components/datapath/Wire.tsx`
   - 支持直线和折线
   - 支持不同颜色（data/control/address）

2. **实现数据通路画布**（4小时）
   - 创建 `src/components/datapath/DatapathCanvas.tsx`
   - 根据配置 JSON 动态渲染所有部件和连线
   - 支持缩放和平移

---

## Day 7-9（动画和交互）

### Day 7

1. **添加部件高亮动画**（4小时）
   - 使用 Framer Motion
   - 活跃部件边框变色
   - 淡入淡出效果

2. **添加连线动画**（4小时）
   - 数据流动画（stroke-dashoffset）
   - 活跃连线变色变粗

### Day 8

1. **实现阶段指示器**（2小时）
   - 创建 `src/components/timeline/StageIndicator.tsx`
   - 显示 IF → ID → EX → MEM → WB
   - 当前阶段高亮

2. **实现时间线组件**（4小时）
   - 创建 `src/components/timeline/HistoryTimeline.tsx`
   - 水平时间线
   - 可点击回退

3. **添加键盘快捷键**（2小时）
   - Space: 运行/暂停
   - →: 单步周期
   - ↓: 单步指令
   - R: 重置

### Day 9

1. **完善 Zustand Store**（4小时）
   - 实现所有 actions
   - 连接引擎接口（你的队友会提供）

2. **组件工厂**（2小时）
   - 创建 `src/components/datapath/ComponentFactory.tsx`
   - 根据配置类型动态创建组件

---

## Day 10-12（集成和完善）

### Day 10

1. **集成引擎和 UI**（全天）
   - 连接 store 和引擎
   - 测试数据流
   - 修复集成问题

### Day 11

1. **实现运行控制逻辑**（4小时）
   - 连续运行（requestAnimationFrame）
   - 速度控制
   - 暂停/恢复

2. **实现回退功能**（4小时）
   - 点击时间线回退
   - 更新所有视图

### Day 12

1. **UI 细节打磨**（全天）
   - 响应式布局
   - 错误提示
   - 加载状态
   - 工具提示

---

## Day 13-14（完善和收尾）

### Day 13

1. **添加示例程序下拉菜单**（2小时）
2. **添加帮助文档**（2小时）
3. **性能优化**（4小时）

### Day 14

1. **最终测试**（4小时）
2. **部署准备**（2小时）
3. **文档完善**（2小时）

---

## 关键里程碑检查点

### ✅ Checkpoint 1（Day 2 结束）
- [ ] 基础布局完成
- [ ] 代码编辑器可用
- [ ] 配置 JSON 创建完成

### ✅ Checkpoint 2（Day 4 结束）
- [ ] 所有控制面板组件完成
- [ ] 寄存器视图、内存视图可用

### ✅ Checkpoint 3（Day 6 结束）
- [ ] 静态数据通路图渲染正确
- [ ] 所有部件和连线显示

### ✅ Checkpoint 4（Day 9 结束）
- [ ] 动画效果完成
- [ ] 键盘快捷键可用
- [ ] Store 集成完成

### ✅ Checkpoint 5（Day 12 结束）
- [ ] 完整的运行/暂停/单步功能
- [ ] 回退功能正常
- [ ] UI 流畅无卡顿

---

## 今天下午的具体步骤（现在开始）

1. 验证项目运行：
   ```bash
   npm run dev
   ```

2. 创建 Header 组件：
   ```tsx
   // src/components/layout/Header.tsx
   export function Header() {
     return (
       <header className="bg-slate-800 text-white p-4">
         <h1 className="text-2xl font-bold">RISC-V CPU 可视化</h1>
       </header>
     );
   }
   ```

3. 创建 MainLayout 组件（左右分栏）

4. 在 `App.tsx` 中使用这些组件

5. 在浏览器中看到基础布局 ✅

开始吧！有问题随时问我。