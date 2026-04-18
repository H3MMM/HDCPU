import { memo } from 'react';

const HELP_SECTIONS = [
  {
    title: '快速开始',
    items: [
      '先在编辑器里从示例程序下拉框加载一个例子。',
      '点击“运行”观察数据通路高亮，或用“单步周期 / 单步指令”细看阶段变化。',
      '如果需要回看，直接点击时间线中的任意检查点即可回退。',
    ],
  },
  {
    title: '键盘快捷键',
    items: ['Space：运行 / 暂停', '→：单步周期', '←：回到上一周期', '↓：单步指令', 'R：重置程序'],
  },
  {
    title: '怎么看各面板',
    items: [
      '数据通路画布：看当前阶段哪些部件和连线在活跃。',
      '控制信号表：核对当前阶段控制器发出的信号值。',
      '执行检查器：查看 ALU、流水寄存器、访存和状态变化。',
      '寄存器与内存：验证写回和访存结果有没有落到预期位置。',
    ],
  },
] as const;

export const HelpPanel = memo(function HelpPanel() {
  return (
    <section className="panel-card panel-card--compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">使用帮助</p>
          <h2>上手说明</h2>
        </div>
        <span className="editor-pill">帮助文档</span>
      </div>

      <p className="panel-copy">
        如果你是第一次打开这个实验台，按下面这三组说明走一遍，基本就能顺畅地完成装载程序、观察执行、回退检查这条主链路。
      </p>

      <div className="help-grid">
        {HELP_SECTIONS.map((section) => (
          <details key={section.title} className="help-section" open>
            <summary>{section.title}</summary>
            <ul className="help-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
});
