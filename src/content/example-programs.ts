export interface ExampleProgram {
  id: string;
  title: string;
  summary: string;
  source: string;
}

export const EXAMPLE_PROGRAMS: readonly ExampleProgram[] = [
  {
    id: 'multicycle-demo',
    title: '基础算术与访存',
    summary: '先做加法，再把结果写入内存并读回，适合观察完整的访存链路。',
    source: `# RISC-V 多周期实验程序
addi x1, x0, 5
addi x2, x0, 9
add  x3, x1, x2
sw   x3, 64(x0)
lw   x4, 64(x0)`,
  },
  {
    id: 'countdown-loop',
    title: '循环与分支',
    summary: '通过减计数和条件分支观察 EX 阶段如何决定是否跳转。',
    source: `# countdown loop
addi x1, x0, 4
addi x2, x0, 1
loop:
sub  x1, x1, x2
bne  x1, x0, loop
sw   x1, 80(x0)`,
  },
  {
    id: 'jump-link',
    title: '跳转与返回地址',
    summary: '用 jal / jalr 模拟一次子程序调用与返回，最后再落回主流程结束。',
    source: `# jump and link
addi x5, x0, 12
jal  x1, subr
addi x6, x0, 21
sw   x6, 112(x0)
jal  x0, done
subr:
addi x7, x1, 4
jalr x0, 0(x1)
done:
lw   x8, 112(x0)`,
  },
  {
    id: 'immediates-and-shifts',
    title: '立即数与移位',
    summary: '覆盖 lui、ori、slli、srli 等指令，便于查看 ALU 输入切换。',
    source: `# immediates and shifts
lui  x8, 0x12345
ori  x8, x8, 15
slli x9, x8, 1
srli x10, x9, 2
sw   x10, 96(x0)`,
  },
];

export const DEFAULT_EXAMPLE_PROGRAM = EXAMPLE_PROGRAMS[0];
export const CUSTOM_PROGRAM_TEMPLATE = `# 自定义程序模板
# 你可以从这里开始自由修改
addi x1, x0, 3
addi x2, x0, 4
add  x3, x1, x2
sw   x3, 64(x0)
lw   x4, 64(x0)`;
export const CUSTOM_PROGRAM_SUMMARY = '已切换到自定义模板。你可以直接修改这段代码，然后点击“运行”或使用单步观察数据通路变化。';

export function getExampleProgramById(id: string): ExampleProgram | undefined {
  return EXAMPLE_PROGRAMS.find((program) => program.id === id);
}

export function normalizeExampleSource(source: string): string {
  return source.replace(/\r\n/g, '\n').trim();
}
