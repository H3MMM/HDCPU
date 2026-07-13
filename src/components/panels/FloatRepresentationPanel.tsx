import { memo, useState } from 'react';
import {
  realToFloat, floatToReal, IEEE_PRESETS,
  type FloatRepPreset, type ExpCode, type MantCode, type FloatRepConfig, type FloatRepResult,
} from '../../engine/float-rep';

const BIT_MIN = 2;
const BIT_MAX = 16;

function clampBits(n: number): number {
  return Math.max(BIT_MIN, Math.min(BIT_MAX, Number.isFinite(n) ? n : BIT_MIN));
}

function applyPreset(preset: FloatRepPreset): FloatRepConfig {
  if (preset === 'ieee-single') return { ...IEEE_PRESETS['ieee-single'] };
  if (preset === 'ieee-double') return { ...IEEE_PRESETS['ieee-double'] };
  return { preset: 'custom', expBits: 4, mantBits: 8, expCode: '移码', mantCode: '原码' };
}

export const FloatRepresentationPanel = memo(function FloatRepresentationPanel() {
  const [preset, setPreset] = useState<FloatRepPreset>('custom');
  const [expBits, setExpBits] = useState(4);
  const [mantBits, setMantBits] = useState(8);
  const [expCode, setExpCode] = useState<ExpCode>('移码');
  const [mantCode, setMantCode] = useState<MantCode>('原码');

  const [truth, setTruth] = useState('-101.1');
  const [expOut, setExpOut] = useState('');
  const [mantOut, setMantOut] = useState('');
  const [result, setResult] = useState<FloatRepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = preset !== 'custom';
  const cfg: FloatRepConfig = locked ? applyPreset(preset) : { preset, expBits, mantBits, expCode, mantCode };

  function handlePreset(p: FloatRepPreset) {
    setPreset(p);
    const c = applyPreset(p);
    setExpBits(c.expBits);
    setMantBits(c.mantBits);
    setExpCode(c.expCode);
    setMantCode(c.mantCode);
    setResult(null); setError(null);
  }

  function sanitizeTruth(v: string) {
    // 仅允许 0/1/. /-
    if (/^[01.-]*$/.test(v)) setTruth(v);
  }

  function sanitizeBits(v: string) {
    return v.replace(/[^01]/g, '');
  }

  function forward() {
    setError(null);
    try {
      const r = realToFloat(truth, cfg);
      setResult(r);
      setExpOut(r.exponent.replace(/,/g, ''));
      setMantOut(r.mantissa.replace(/,/g, ''));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }
  function backward() {
    setError(null);
    try {
      const r = floatToReal(expOut, mantOut, cfg);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }

  return (
    <section className='panel-card float-rep' style={{ contentVisibility: 'visible', containIntrinsicSize: 'auto' }}>
      <div className='panel-header'>
        <div>
          <p className='eyebrow'>浮点数表示</p>
          <h2>真值 ⇄ 机器数 转换</h2>
        </div>
        <span className='editor-pill'>{cfg.expBits} 位阶码 · {cfg.mantBits} 位尾数</span>
      </div>

      <div className='float-rep-grid'>
        {/* 左上：格式选择 */}
        <div className='float-rep-cell'>
          <p className='detail-label'>浮点数格式选择</p>
          <div className='float-rep-radios' role='radiogroup' aria-label='浮点数格式'>
            {([['custom', '自定义'], ['ieee-single', 'IEEE754 单精度'], ['ieee-double', 'IEEE754 双精度']] as [FloatRepPreset, string][]).map(([v, label]) => (
              <label key={v} className={preset === v ? 'float-rep-radio float-rep-radio--active' : 'float-rep-radio'}>
                <input type='radio' name='float-rep-preset' checked={preset === v} onChange={() => handlePreset(v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {locked ? <p className='float-rep-hint'>IEEE754 固定配置：阶码移码 + 尾数原码，含符号位 / 隐式 1 / Inf / NaN</p> : null}
        </div>

        {/* 右上：格式定义 */}
        <div className='float-rep-cell'>
          <p className='detail-label'>浮点数格式定义</p>
          <div className='float-rep-def'>
            <label className='float-bit-select'>阶码位数
              <input type='number' min={BIT_MIN} max={BIT_MAX} value={expBits} disabled={locked}
                onChange={e => setExpBits(clampBits(Number(e.target.value)))} />
            </label>
            <label className='float-bit-select'>尾数位数
              <input type='number' min={BIT_MIN} max={BIT_MAX} value={mantBits} disabled={locked}
                onChange={e => setMantBits(clampBits(Number(e.target.value)))} />
            </label>
            <label className='float-bit-select'>阶码机器数
              <select value={expCode} disabled={locked} onChange={e => setExpCode(e.target.value as ExpCode)}>
                {(['原码', '反码', '补码', '移码'] as ExpCode[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className='float-bit-select'>尾数机器数
              <select value={mantCode} disabled={locked} onChange={e => setMantCode(e.target.value as MantCode)}>
                {(['原码', '反码', '补码'] as MantCode[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {locked ? <p className='float-rep-hint'>IEEE754 模式下以上四项已锁定</p> : null}
        </div>

        {/* 左下：真值输入 */}
        <div className='float-rep-cell'>
          <p className='detail-label'>真值输入（二进制）</p>
          <div className='float-rep-truth'>
            <input className='memory-input float-input-field float-rep-truth-input'
              value={truth} onChange={e => sanitizeTruth(e.target.value)} placeholder='-101.1' aria-label='二进制真值' />
            <span className='float-rep-unit'>B</span>
          </div>
          <p className='float-rep-hint'>仅允许 0、1、.、- 字符</p>
        </div>

        {/* 右下：结果（可编辑，正向时回填、反向时作为输入） */}
        <div className='float-rep-cell'>
          <p className='detail-label'>浮点数机器数（阶码 + 尾数）</p>
          <label className='float-input-label'>阶码
            <input className='memory-input float-input-field float-rep-out'
              value={expOut} onChange={e => setExpOut(sanitizeBits(e.target.value))} placeholder='阶码机器数（二进制）' aria-label='阶码机器数' />
          </label>
          <label className='float-input-label'>尾数
            <input className='memory-input float-input-field float-rep-out'
              value={mantOut} onChange={e => setMantOut(sanitizeBits(e.target.value))} placeholder='尾数机器数（含符号位）' aria-label='尾数机器数' />
          </label>
          <p className='float-rep-hint'>正向转换后自动回填；反向转换时在此输入机器数</p>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className='float-rep-actions'>
        <button type='button' className='control-button control-button--secondary' onClick={forward}>转换 &gt;&gt;&gt;&gt;</button>
        <button type='button' className='control-button control-button--secondary' onClick={backward}>&lt;&lt;&lt;&lt; 转换</button>
      </div>

      {error ? <div className='assembler-error-item' style={{ marginTop: '0.5rem' }}><strong>错误</strong><span>{error}</span></div> : null}

      {result ? (
        <div className='float-result-steps'>
          {result.special ? <div className='float-step-row float-step-row--highlight'><span className='float-step-label'>注意</span><span>{specialLabel(result.special)}</span></div> : null}
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

function specialLabel(s: NonNullable<FloatRepResult['special']>): string {
  switch (s) {
    case 'zero': return '结果为机器零（±0）';
    case 'denormal': return '非规格化数';
    case 'inf': return '无穷大 Inf';
    case 'nan': return '非数 NaN';
    case 'overflow': return '阶码溢出';
    case 'underflow': return '尾数下溢（已截断）';
  }
}
