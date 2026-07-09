import { memo, useState } from 'react';
import { computeFloatArithmetic, type FloatOperand, type FloatCalcResult, type FloatOperation, type ExponentFormat, type MantissaFormat, DEFAULT_CONFIG } from '../../engine/float-calc';

const DEFAULT_X: FloatOperand = { mantissa: '00,101100101011', exponent: '00,10' };
const DEFAULT_Y: FloatOperand = { mantissa: '00,001110101101', exponent: '00,01' };

export const FloatArithmeticPanel = memo(function FloatArithmeticPanel() {
  const [xMant, setXMant] = useState(DEFAULT_X.mantissa);
  const [xExp, setXExp] = useState(DEFAULT_X.exponent);
  const [yMant, setYMant] = useState(DEFAULT_Y.mantissa);
  const [yExp, setYExp] = useState(DEFAULT_Y.exponent);
  const [op, setOp] = useState<FloatOperation>('-');
  const [expFmt, setExpFmt] = useState<ExponentFormat>(DEFAULT_CONFIG.exponentFormat);
  const [mantFmt, setMantFmt] = useState<MantissaFormat>(DEFAULT_CONFIG.mantissaFormat);
  const [result, setResult] = useState<FloatCalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    setError(null);
    try {
      const x: FloatOperand = { mantissa: xMant.trim(), exponent: xExp.trim() };
      const y: FloatOperand = { mantissa: yMant.trim(), exponent: yExp.trim() };
      const r = computeFloatArithmetic(x, y, op, { ...DEFAULT_CONFIG, exponentFormat: expFmt, mantissaFormat: mantFmt });
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
        输入两个规格化浮点数的机器数表示（双符号位尾数 + 双符号位阶码），
        选择阶码/尾数编码方式与运算类型，工具会逐步展示完整计算过程。
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div>
          <span className='range-label'>阶码格式</span>
          <div className='segmented-control' style={{ marginTop: '0.3rem' }}>
            <button className={expFmt === '移码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setExpFmt('移码')}>移码</button>
            <button className={expFmt === '补码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setExpFmt('补码')}>补码</button>
          </div>
        </div>
        <div>
          <span className='range-label'>尾数格式</span>
          <div className='segmented-control' style={{ marginTop: '0.3rem' }}>
            <button className={mantFmt === '原码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setMantFmt('原码')}>原码</button>
            <button className={mantFmt === '补码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setMantFmt('补码')}>补码</button>
          </div>
        </div>
      </div>

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
          <button type='button' className={op === '+' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('+')}>X + Y</button>
          <button type='button' className={op === '-' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('-')}>X - Y</button>
          <button type='button' className={op === '*' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('*')}>X × Y</button>
          <button type='button' className={op === '/' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('/')}>X ÷ Y</button>
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
