import { memo, useState } from 'react';
import { computeFloatArithmetic, type FloatOperand, type FloatCalcResult } from '../../engine/float-calc';

const DEFAULT_X: FloatOperand = { mantissa: '00,101100101011', exponent: '00,10' };
const DEFAULT_Y: FloatOperand = { mantissa: '00,001110101101', exponent: '00,01' };

export const FloatArithmeticPanel = memo(function FloatArithmeticPanel() {
  const [xMant, setXMant] = useState(DEFAULT_X.mantissa);
  const [xExp, setXExp] = useState(DEFAULT_X.exponent);
  const [yMant, setYMant] = useState(DEFAULT_Y.mantissa);
  const [yExp, setYExp] = useState(DEFAULT_Y.exponent);
  const [op, setOp] = useState<'add' | 'sub'>('sub');
  const [result, setResult] = useState<FloatCalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    setError(null);
    try {
      const x: FloatOperand = { mantissa: xMant.trim(), exponent: xExp.trim() };
      const y: FloatOperand = { mantissa: yMant.trim(), exponent: yExp.trim() };
      const r = computeFloatArithmetic(x, y, op === 'sub' ? '-' : '+');
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }

  return (
    <section className='panel-card' style={{ contentVisibility: 'visible', containIntrinsicSize: 'auto' }}>
      <div className='panel-header'>
        <div>
          <p className='eyebrow'>浮点数运算</p>
          <h2>机器数运算演示</h2>
        </div>
        <span className='editor-pill'>阶码 2+2位 · 尾数 12+2位</span>
      </div>

      <p className='panel-copy'>
        输入两个规格化浮点数的机器数表示（双符号位补码尾数 + 双符号位移码阶码），
        工具会逐步展示对阶、尾数相减、规格化、舍入的完整过程。
      </p>

      <div className='float-input-grid'>
        <div className='float-input-group'>
          <span className='detail-label'>[X]浮</span>
          <label>尾数 <input className='memory-input' value={xMant} onChange={e => setXMant(e.target.value)} placeholder='00,101100101011' /></label>
          <label>阶码 <input className='memory-input' value={xExp} onChange={e => setXExp(e.target.value)} placeholder='00,10' /></label>
        </div>
        <div className='float-input-group'>
          <span className='detail-label'>[Y]浮</span>
          <label>尾数 <input className='memory-input' value={yMant} onChange={e => setYMant(e.target.value)} placeholder='00,001110101101' /></label>
          <label>阶码 <input className='memory-input' value={yExp} onChange={e => setYExp(e.target.value)} placeholder='00,01' /></label>
        </div>
      </div>

      <div className='editor-toolbar'>
        <div className='segmented-control' role='group' aria-label='运算选择'>
          <button type='button' className={op === 'sub' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('sub')}>X - Y</button>
          <button type='button' className={op === 'add' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('add')}>X + Y</button>
        </div>
        <button type='button' className='control-button control-button--secondary' onClick={handleCalculate}>计算</button>
      </div>

      {error ? <div className='assembler-error-item' style={{ marginTop: '0.75rem' }}><strong>错误</strong><span>{error}</span></div> : null}

      {result ? (
        <div className='float-result-steps'>
          {result.steps.map((step, i) => (
            <div key={i} className={step.highlight ? 'float-step-row float-step-row--highlight' : 'float-step-row'} style={{ fontFamily: step.text.startsWith('    ') ? 'Consolas, SFMono-Regular, monospace' : undefined }}>
              {step.label ? <span className='float-step-label'>{step.label}</span> : null}
              <span>{step.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
});
