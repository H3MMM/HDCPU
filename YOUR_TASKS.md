# 你的详细任务清单（两周计划）

## Day 1 下午（今天，剩余2小时）

### ✅ 已完成
- [x] 类型定义已创建（我帮你完成了）
- [x] 引擎模块骨架已创建

### 🎯 你现在要做的

1. **审查类型定义**（30分钟）
   - 阅读 `src/types/` 下的所有文件
   - 确认 `ControlSignals`、`Stage`、`ALUOp` 等定义符合你的理解
   - 如有问题，告诉我修改

2. **实现 ALU 模块**（1小时）
   - 打开 `src/engine/core/alu.ts`
   - 实现所有 ALU 操作（ADD, SUB, AND, OR, XOR, SLT, SLTU, SLL, SRL, SRA）
   - 注意：
     - JavaScript 的位运算是 32 位的
     - 使用 `| 0` 确保结果是 32 位有符号整数
     - 右移：`>>` 是算术右移，`>>>` 是逻辑右移
   - 运行测试：`npm test alu.test.ts`

3. **完成 RegisterFile 测试**（30分钟）
   - 创建 `src/engine/core/__tests__/register-file.test.ts`
   - 测试：
     - x0 恒为 0
     - 读写其他寄存器
     - 边界情况

---

## Day 2（明天，全天）

### 上午（4小时）

1. **完成 Decoder 模块**（3小时）
   - 实现 `getInstructionFormat()` - 根据 opcode 判断指令格式
   - 实现 `extractImmediate()` - 提取各种格式的立即数
   - 实现 `generateASM()` - 生成汇编字符串
   - 参考资料：RISC-V 指令编码表（我可以提供）

2. **完成 Memory 模块**（1小时）
   - 实现小端序读写
   - 测试字节对齐

### 下午（4小时）

1. **实现立即数生成器**（1小时）
   - 创建 `src/engine/core/immediate-gen.ts`
   - 根据指令格式提取并符号扩展立即数

2. **开始汇编器**（3小时）
   - 创建 `src/engine/assembler/lexer.ts` - 词法分析
   - 创建 `src/engine/assembler/parser.ts` - 语法分析
   - 创建 `src/engine/assembler/encoder.ts` - 编码器

---

## Day 3-4（汇编器完成）

### 目标
- 完整的汇编器，支持所有 RV32I 指令
- 支持标签和注释
- 错误处理
- 反汇编器
- 完整的测试覆盖

### 验收标准
```typescript
const asm = new Assembler();
const result = asm.assemble(`
  addi x1, x0, 10
  addi x2, x0, 20
  add x3, x1, x2
`);
// result.machineCode 应该是正确的机器码
// result.errors 应该是空数组
```

---

## Day 5（汇编器完善）

- 添加伪指令支持（li, la, mv, j, ret等）
- 完善错误信息（行号、列号）
- 边界情况测试

---

## Day 6（基础模块完成）

### 上午
- 确保 ALU、Decoder、Memory、RegisterFile 都有完整测试
- 修复所有 bug

### 下午
- 开始控制单元状态机
- 创建 `src/engine/core/control.ts`
- 定义状态转移表

---

## Day 7-9（CPU 核心引擎）

这是最关键的三天！

### Day 7
- 完成控制单元状态机
- 为每个阶段定义控制信号

### Day 8
- 创建 `src/engine/core/cpu.ts` - CPU 主类
- 实现 `tick()` 方法
- 实现各个阶段的逻辑（IF, ID, EX, MEM, WB）

### Day 9
- 实现 `step()` 方法
- 实现快照生成
- 实现 `activeDataPaths` 和 `changes` 的生成
- 集成测试

---

## Day 10（视图映射层）

- 创建 `src/view/view-mapper.ts`
- 实现 `mapSnapshot()` 方法
- 实现 `computeTransition()` 方法

---

## Day 11-12（集成和调试）

- 协助队友集成引擎和 UI
- 修复 bug
- 性能优化

---

## Day 13-14（完善和收尾）

- 编写示例程序
- 文档
- 最终测试

---

## 关键里程碑检查点

### ✅ Checkpoint 1（Day 2 结束）
- [ ] ALU 所有操作正确
- [ ] Decoder 能正确解码所有指令格式
- [ ] Memory 读写正确
- [ ] RegisterFile 测试通过

### ✅ Checkpoint 2（Day 4 结束）
- [ ] 汇编器能将简单程序转换为机器码
- [ ] 反汇编器能还原汇编代码
- [ ] 测试：`add x1, x2, x3` → `0x003100B3`

### ✅ Checkpoint 3（Day 9 结束）
- [ ] CPU 能执行简单的 3 条指令程序
- [ ] 快照包含正确的寄存器值和 PC
- [ ] 状态机正确转移

### ✅ Checkpoint 4（Day 12 结束）
- [ ] 在浏览器中看到 CPU 动画执行
- [ ] 单步执行正确
- [ ] 寄存器值实时更新

---

## 需要帮助时

如果遇到以下问题，随时问我：
1. RISC-V 指令编码细节
2. 立即数提取算法
3. 控制信号真值表
4. 状态机转移逻辑
5. 快照生成策略
6. 任何 bug 调试

---

## 今天下午的具体步骤（现在开始）

1. 打开 `src/engine/core/alu.ts`
2. 实现 ADD 操作：
   ```typescript
   case ALUOp.ADD:
     result = (a + b) | 0;
     break;
   ```
3. 实现其他操作
4. 运行测试：`npm test alu.test.ts`
5. 看到所有测试通过 ✅

开始吧！有问题随时问我。
