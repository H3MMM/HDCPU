import { memo, useState } from 'react';
import { computeFloatArithmetic, type FloatOperand, type FloatCalcResult, type FloatOperation, type ExponentFormat, type MantissaFormat } from '../../engine/float-calc';

const DEFAULT_X: FloatOperand = { mantissa: '00,101100101011', exponent: '00,10' };
const DEFAULT_Y: FloatOperand = { mantissa: '00,001110101101', exponent: '00,01' };

export const FloatArithmeticPanel = memo(function FloatArithmeticPanel() {
  const [xMant, setXMant] = useState(DEFAULT_X.mantissa);
  const [xExp, setXExp] = useState(DEFAULT_X.exponent);
  const [yMant, setYMant] = useState(DEFAULT_Y.mantissa);
  const [yExp, setYExp] = useState(DEFAULT_Y.exponent);
  const [op, setOp] = useState<FloatOperation>('+');
  const [expFmt, setExpFmt] = useState<ExponentFormat>('移码');
  const [mantFmt, setMantFmt] = useState<MantissaFormat>('原码');
  const [result, setResult] = useState<FloatCalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    setError(null);
    try {
      const x: FloatOperand = { mantissa: xMant.trim(), exponent: xExp.trim() };
      const y: FloatOperand = { mantissa: yMant.trim(), exponent: yExp.trim() };
      const r = computeFloatArithmetic(x, y, op, { exponentBits: 2, mantissaBits: 12, exponentFormat: expFmt, mantissaFormat: mantFmt, rounding: '0舍1入' });
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
        <span className='editor-pill'>2+2 阶码 · 12+2 尾数</span>
      </div>
      <br/>

      <div className='float-format-row'>
        <span className='range-label'>编码方式</span>
        <div className='segmented-control'>
          <button className={expFmt === '移码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setExpFmt('移码')}>阶码移码</button>
          <button className={expFmt === '补码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setExpFmt('补码')}>阶码补码</button>
        </div>
        <div className='segmented-control'>
          <button className={mantFmt === '原码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setMantFmt('原码')}>尾数原码</button>
          <button className={mantFmt === '补码' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setMantFmt('补码')}>尾数补码</button>
        </div>
      </div>

      <div className='float-input-grid'>
        <div className='float-input-group'>
          <div className='float-input-head'>
            <span className='detail-label'>[X]浮</span>
            <span className='type-pill'>{expFmt === '移码' ? '阶移' : '阶补'}·{mantFmt === '原码' ? '尾原' : '尾补'}</span>
          </div>
          <label className='float-input-label'>尾数<input className='memory-input float-input-field' value={xMant} onChange={e => setXMant(e.target.value)} placeholder='00,101100101011' /></label>
          <label className='float-input-label'>阶码<input className='memory-input float-input-field' value={xExp} onChange={e => setXExp(e.target.value)} placeholder='00,10' /></label>
        </div>
        <div className='float-input-group'>
          <div className='float-input-head'>
            <span className='detail-label'>[Y]浮</span>
            <span className='type-pill'>{expFmt === '移码' ? '阶移' : '阶补'}·{mantFmt === '原码' ? '尾原' : '尾补'}</span>
          </div>
          <label className='float-input-label'>尾数<input className='memory-input float-input-field' value={yMant} onChange={e => setYMant(e.target.value)} placeholder='00,001110101101' /></label>
          <label className='float-input-label'>阶码<input className='memory-input float-input-field' value={yExp} onChange={e => setYExp(e.target.value)} placeholder='00,01' /></label>
        </div>
      </div>

      <div className='float-action-bar'>
        <div className='segmented-control' role='group' aria-label='运算选择'>
          <button type='button' className={op === '+' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('+')}>X + Y</button>
          <button type='button' className={op === '-' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('-')}>X − Y</button>
          <button type='button' className={op === '*' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('*')}>X × Y</button>
          <button type='button' className={op === '/' ? 'segment-button segment-button--active' : 'segment-button'} onClick={() => setOp('/')}>X ÷ Y</button>
        </div>
        <button type='button' className='control-button control-button--secondary' onClick={handleCalculate}>开始计算</button>
      </div>

      {error ? <div className='assembler-error-item' style={{ marginTop: '0.5rem' }}><strong>错误</strong><span>{error}</span></div> : null}

      {result ? (
        <div className='float-result-steps'>
          {result.steps.map((step, i) => (
            <div key={i} className={step.highlight ? 'float-step-row float-step-row--highlight' : 'float-step-row'}>
              {step.label ? <span className='float-step-label'>{step.label}</span> : null}
              <span className={step.text.startsWith('    ') ? 'float-step-mono' : undefined}>{step.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
});
