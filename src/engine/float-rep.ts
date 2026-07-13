/**
 * 浮点数「表示 / 转换」引擎（与 float-calc.ts 的运算引擎相互独立）
 *
 * 表示约定：
 *  浮点 = [阶码] [尾数]，符号位在尾数首位（IEEE754 同样把符号位放在尾数首位展示）。
 *  - 阶码 expBits 位：移码（无符号位，偏置）；原码 / 反码 / 补码（1 位符号 + expBits-1 位数值）。
 *  - 尾数 mantBits 位数值 + 1 位符号：自定义用 0.1xxx 显式规格化（首位 1 存入）；IEEE754 用 1.f 隐式 1。
 *
 * 偏置：自定义移码偏置 = 2^(expBits-1)（与本应用 float-calc 一致）；
 *       IEEE754 偏置 = 2^(expBits-1)-1（标准，且保留全 0 / 全 1 阶码为特殊值）。
 */

export type ExpCode = '原码' | '反码' | '补码' | '移码';
export type MantCode = '原码' | '反码' | '补码';
export type FloatRepPreset = 'custom' | 'ieee-single' | 'ieee-double';

export interface FloatRepConfig {
  preset: FloatRepPreset;
  expBits: number;
  mantBits: number;
  expCode: ExpCode;
  mantCode: MantCode;
}

export interface FloatRepStep { label?: string; text: string; highlight?: boolean; }
export type FloatRepSpecial = 'zero' | 'denormal' | 'inf' | 'nan' | 'overflow' | 'underflow' | null;

export interface FloatRepResult {
  sign: string;        // '0' / '1'
  exponent: string;    // 阶码机器数（带「,」分隔符号位）
  mantissa: string;    // 尾数机器数（符号位 + 数值位，带「,」）
  realValue: string;   // 反映的十进制真值（溢出/非数时为 Inf/NaN/0）
  special: FloatRepSpecial;
  steps: FloatRepStep[];
}

export const IEEE_PRESETS: Record<Exclude<FloatRepPreset, 'custom'>, FloatRepConfig> = {
  'ieee-single': { preset: 'ieee-single', expBits: 8, mantBits: 23, expCode: '移码', mantCode: '原码' },
  'ieee-double': { preset: 'ieee-double', expBits: 11, mantBits: 52, expCode: '移码', mantCode: '原码' },
};

/* ---------- 工具 ---------- */

function inv(bin: string): string {
  return bin.split('').map(c => (c === '0' ? '1' : '0')).join('');
}
function twos(bin: string): string {
  // 对一个与 bin 等宽的取反后 +1
  const flipped = inv(bin);
  let carry = 1;
  const out: string[] = [];
  for (let i = flipped.length - 1; i >= 0; i--) {
    const s = (flipped[i] === '1' ? 1 : 0) + carry;
    out.unshift(s & 1 ? '1' : '0');
    carry = s >> 1;
  }
  return out.join('');
}
function pad(bin: string, n: number): string { return bin.padStart(n, '0'); }
function commaAfter1(bin: string): string {
  return bin.length < 2 ? bin : bin[0] + ',' + bin.slice(1);
}

/* 阶码：把真值 E 编码为 expBits 位机器数。返回 { bits, ok }，越界时 ok=false。 */
function encodeExp(E: number, cfg: FloatRepConfig): { bits: string; ok: boolean } {
  const { expBits, expCode, preset } = cfg;
  if (expCode === '移码') {
    const bias = preset === 'custom' ? (1 << (expBits - 1)) : ((1 << (expBits - 1)) - 1);
    const stored = E + bias;
    if (preset === 'custom') {
      // 自定义移码：[-2^(b-1), 2^(b-1)-1]
      if (stored < 0 || stored >= (1 << expBits)) return { bits: '', ok: false };
    } else {
      // IEEE：保留全 0 / 全 1，正常 E 范围 [1-bias, 2^b-2-bias] = [Emin, Emax]
      if (E < 1 - bias || E > (1 << expBits) - 2 - bias) return { bits: '', ok: false };
    }
    return { bits: pad(stored.toString(2), expBits), ok: true };
  }
  // 原码 / 反码 / 补码：1 位符号 + (expBits-1) 位数值
  const valBits = expBits - 1;
  const maxMag = (1 << valBits) - 1; // 原码 / 反码 可表 |E| ≤ maxMag
  const sign = E < 0 ? '1' : '0';
  const mag = Math.abs(E);
  const magBin = pad(mag.toString(2), valBits);
  if (expCode === '原码') {
    if (mag > maxMag) return { bits: '', ok: false };
    return { bits: sign + magBin, ok: true };
  }
  if (expCode === '反码') {
    if (mag > maxMag) return { bits: '', ok: false };
    return { bits: sign + (E < 0 ? inv(magBin) : magBin), ok: true };
  }
  // 补码：|E| ≤ 2^valBits - 1（正） / 2^valBits（负）
  if (E >= 0) {
    if (E > maxMag) return { bits: '', ok: false };
    return { bits: '0' + magBin, ok: true };
  }
  if (mag > (1 << valBits)) return { bits: '', ok: false };
  // 负数补码 = 2^expBits + E
  const stored = (1 << expBits) + E;
  return { bits: pad(stored.toString(2), expBits), ok: true };
}

/* 阶码：从机器数 bits 解码为真值 E。 */
function decodeExp(bits: string, cfg: FloatRepConfig): number {
  const { expBits, expCode, preset } = cfg;
  if (expCode === '移码') {
    const bias = preset === 'custom' ? (1 << (expBits - 1)) : ((1 << (expBits - 1)) - 1);
    return parseInt(bits, 2) - bias;
  }
  if (expCode === '补码') {
    return parseInt(bits, 2) - (bits[0] === '1' ? (1 << bits.length) : 0);
  }
  // 原码 / 反码
  const sign = bits[0] === '1' ? -1 : 1;
  const val = bits.slice(1);
  const magBits = expCode === '反码' && sign < 0 ? inv(val) : val;
  return sign * parseInt(magBits || '0', 2);
}

/* 尾数：把规格化数值位 magBits（mantBits 位，含符号时由 mantCode 处理）按 mantCode 组装符号位。
   输入：sign '0'/'1'，magBin mantBits 位正数值。返回符号位+数值位 (mantBits+1 位)。 */
function encodeMant(sign: string, magBin: string, cfg: FloatRepConfig): string {
  const { mantCode, mantBits } = cfg;
  const mag = pad(magBin, mantBits);
  if (sign === '0') return '0' + mag;
  if (mantCode === '原码') return '1' + mag;
  if (mantCode === '反码') return '1' + inv(mag);
  return '1' + twos(mag); // 补码：对 mantBits 位数值取补，等价于 1+(-mag) 在 mantBits+1 位下的形式
}

/* 尾数：从机器数（符号位 + mantBits 数值位）解码出 { sign, magValue }，magValue 为数值的十进制（绝对值形式）。 */
function decodeMant(bits: string, cfg: FloatRepConfig): { sign: number; mag: number } {
  const { mantCode, mantBits } = cfg;
  const signBit = bits[0];
  const val = bits.slice(1, 1 + mantBits);
  if (signBit === '0') return { sign: 1, mag: parseInt(val || '0', 2) };
  // 负数
  if (mantCode === '原码') return { sign: -1, mag: parseInt(val || '0', 2) };
  if (mantCode === '反码') return { sign: -1, mag: parseInt(inv(val) || '0', 2) };
  // 补码：负数，绝对值 = 取反 +1
  return { sign: -1, mag: parseInt(twos(val) || '0', 2) };
}

/* ---------- 真值 -> 浮点数 ---------- */

export function realToFloat(input: string, cfg: FloatRepConfig): FloatRepResult {
  const steps: FloatRepStep[] = [];
  const isIEEE = cfg.preset !== 'custom';
  const bias = cfg.expCode === '移码'
    ? (isIEEE ? (1 << (cfg.expBits - 1)) - 1 : (1 << (cfg.expBits - 1)))
    : 0;

  // 解析二进制真值（仅 0/1/. /-）
  const trimmed = input.trim();
  let sign = '0';
  let s = trimmed;
  if (s.startsWith('-')) { sign = '1'; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[01]*\.?[01]*$/.test(s) || s === '' || s === '.') {
    throw new Error('真值只能包含 0 / 1 / . / -（且不能为空）');
  }
  const [intP = '', fracP = ''] = s.split('.');
  const allBits = intP + fracP;
  const firstOne = allBits.indexOf('1');

  // 0：±0
  if (firstOne === -1) {
    steps.push({ label: '规格化', text: '真值为 0 → 机器零', highlight: true });
    const expBitsStr = '0'.repeat(cfg.expBits);
    const mantStr = sign + '0'.repeat(cfg.mantBits);
    return { sign, exponent: cfg.expCode === '移码' ? expBitsStr : commaAfter1(expBitsStr), mantissa: commaAfter1(mantStr), realValue: sign === '1' ? '-0' : '+0', special: 'zero', steps };
  }

  // 1.f 形式下的指数 E：首位 1 的位置
  let E: number;
  if (firstOne < intP.length) E = intP.length - 1 - firstOne;
  else E = -(firstOne - intP.length + 1);
  const fracBits = allBits.slice(firstOne + 1); // 尾随小数位（1.f 中的 f）
  steps.push({ label: '规格化', text: '规格化：1.' + fracBits + ' × 2^' + E });

  if (isIEEE) {
    return realToIEEE(E, fracBits, sign, cfg, bias, steps);
  }
  return realToCustom(E, fracBits, sign, cfg, steps);
}

/* 自定义格式：0.1xxx 显式规格化。1.f×2^E = 0.(1f)×2^(E+1)，故阶码真值 E' = E+1，数值位 = '1' + 前 (mantBits-1) 位 f。 */
function realToCustom(E: number, fracBits: string, sign: string, cfg: FloatRepConfig, steps: FloatRepStep[]): FloatRepResult {
  const Eexp = E + 1;
  steps.push({ text: '转为 0.1xxx 形式：阶码真值 E = ' + E + ' + 1 = ' + Eexp });

  // 数值位：'1' + 前 (mantBits-1) 位小数
  const valueBits = '1' + fracBits.slice(0, cfg.mantBits - 1).padEnd(cfg.mantBits - 1, '0');
  const truncated = fracBits.length > cfg.mantBits - 1;
  if (truncated) steps.push({ label: '尾数下溢', text: '尾数位数不足，按截断处理（丢弃 ' + (fracBits.length - (cfg.mantBits - 1)) + ' 位）', highlight: true });

  // 阶码
  const enc = encodeExp(Eexp, cfg);
  if (!enc.ok) {
    steps.push({ label: '阶码溢出', text: '阶码 ' + Eexp + ' 超出可表示范围 → 溢出', highlight: true });
    return { sign, exponent: '溢出', mantissa: commaAfter1(encodeMant(sign, valueBits, cfg)), realValue: sign === '1' ? '-Inf' : '+Inf', special: 'overflow', steps };
  }
  const expStr = cfg.expCode === '移码' ? enc.bits : commaAfter1(enc.bits);
  const mantStr = commaAfter1(encodeMant(sign, valueBits, cfg));
  steps.push({ label: '结果', text: '阶码 = ' + expStr + '  尾数 = ' + mantStr, highlight: true });
  const dec = decodeMant(mantStr.replace(',', ''), cfg);
  const decExp = decodeExp(enc.bits, cfg);
  const real = dec.sign * (dec.mag / Math.pow(2, cfg.mantBits)) * Math.pow(2, decExp);
  return { sign, exponent: expStr, mantissa: mantStr, realValue: formatReal(real), special: truncated ? 'underflow' : null, steps };
}

/* IEEE754：1.f 隐式 1，偏置 bias = 2^(b-1)-1。全 0 / 全 1 阶码为特殊值。 */
function realToIEEE(E: number, fracBits: string, sign: string, cfg: FloatRepConfig, bias: number, steps: FloatRepStep[]): FloatRepResult {
  const allOnes = (1 << cfg.expBits) - 1;
  const Emin = 1 - bias;
  const Emax = allOnes - 1 - bias; // 正常阶码上限
  const frac = fracBits.slice(0, cfg.mantBits).padEnd(cfg.mantBits, '0');
  const truncated = fracBits.length > cfg.mantBits;

  // 阶码溢出 → Inf
  if (E > Emax) {
    steps.push({ label: '阶码溢出', text: 'E = ' + E + ' > Emax(' + Emax + ') → 无穷大 Inf', highlight: true });
    return {
      sign,
      exponent: pad(allOnes.toString(2), cfg.expBits),
      mantissa: commaAfter1(sign + '0'.repeat(cfg.mantBits)),
      realValue: sign === '1' ? '-Inf' : '+Inf',
      special: 'inf',
      steps,
    };
  }
  // 阶码下溢 → 非规格化 / 0
  if (E < Emin) {
    // 右移 significand 使阶码降到 Emin：f 右移 (Emin - E) 位
    const shift = Emin - E;
    const denormFrac = ('0'.repeat(shift - 1) + '1' + fracBits).slice(0, cfg.mantBits).padEnd(cfg.mantBits, '0');
    if (parseInt(denormFrac, 2) === 0) {
      steps.push({ label: '阶码下溢', text: 'E = ' + E + ' < Emin(' + Emin + ') 且太小 → 机器零', highlight: true });
      return { sign, exponent: '0'.repeat(cfg.expBits), mantissa: commaAfter1(sign + '0'.repeat(cfg.mantBits)), realValue: sign === '1' ? '-0' : '+0', special: 'zero', steps };
    }
    steps.push({ label: '非规格化', text: 'E = ' + E + ' < Emin(' + Emin + ') → 非规格化数', highlight: true });
    if (truncated) steps.push({ text: '尾数位数不足，按截断处理' });
    return {
      sign,
      exponent: '0'.repeat(cfg.expBits),
      mantissa: commaAfter1(sign + denormFrac),
      realValue: formatReal(decodeIEEE(sign, '0'.repeat(cfg.expBits), denormFrac, cfg, bias).v),
      special: 'denormal',
      steps,
    };
  }

  // 正常规格化
  if (truncated) steps.push({ label: '尾数下溢', text: '尾数位数不足，按截断处理（丢弃 ' + (fracBits.length - cfg.mantBits) + ' 位）', highlight: true });
  const field = E + bias;
  const expStr = pad(field.toString(2), cfg.expBits);
  const mantStr = commaAfter1(sign + frac);
  steps.push({ label: '结果', text: '阶码(' + field + ') = ' + expStr + '  尾数 = ' + sign + ',' + frac, highlight: true });
  return {
    sign,
    exponent: expStr,
    mantissa: mantStr,
    realValue: formatReal(decodeIEEE(sign, expStr, frac, cfg, bias).v),
    special: truncated ? 'underflow' : null,
    steps,
  };
}

/* ---------- 浮点数 -> 真值 ---------- */

export function floatToReal(expInput: string, mantInput: string, cfg: FloatRepConfig): FloatRepResult {
  const steps: FloatRepStep[] = [];
  const isIEEE = cfg.preset !== 'custom';
  const bias = cfg.expCode === '移码'
    ? (isIEEE ? (1 << (cfg.expBits - 1)) - 1 : (1 << (cfg.expBits - 1)))
    : 0;

  const strip = (x: string) => x.replace(/[,，\s_]/g, '');
  let expBits = strip(expInput);
  let mantBits = strip(mantInput);
  if (!/^[01]+$/.test(expBits)) throw new Error('阶码只能包含 0/1');
  if (!/^[01]+$/.test(mantBits)) throw new Error('尾数只能包含 0/1');
  // 尾数 = 符号位 + mantBits 数值位；阶码按 code 位数
  const expLen = cfg.expCode === '移码' ? cfg.expBits : cfg.expBits; // 均 = expBits
  if (expBits.length !== expLen) throw new Error('阶码位数应为 ' + expLen + ' 位');
  if (mantBits.length !== cfg.mantBits + 1) throw new Error('尾数位数应为 ' + (cfg.mantBits + 1) + ' 位（含符号位）');
  expBits = pad(expBits, expLen);
  mantBits = pad(mantBits, cfg.mantBits + 1);

  const sign = mantBits[0];

  if (isIEEE) {
    const allOnes = (1 << cfg.expBits) - 1;
    const field = parseInt(expBits, 2);
    const frac = mantBits.slice(1);
    if (field === allOnes) {
      if (parseInt(frac, 2) === 0) {
        steps.push({ label: '特殊值', text: '阶码全 1、尾数 0 → ' + (sign === '1' ? '-' : '+') + 'Inf', highlight: true });
        return { sign, exponent: expBits, mantissa: commaAfter1(mantBits), realValue: sign === '1' ? '-Inf' : '+Inf', special: 'inf', steps };
      }
      steps.push({ label: '特殊值', text: '阶码全 1、尾数非 0 → NaN', highlight: true });
      return { sign, exponent: expBits, mantissa: commaAfter1(mantBits), realValue: 'NaN', special: 'nan', steps };
    }
    if (field === 0) {
      if (parseInt(frac, 2) === 0) {
        steps.push({ label: '特殊值', text: '阶码全 0、尾数 0 → ' + (sign === '1' ? '-' : '+') + '0', highlight: true });
        return { sign, exponent: expBits, mantissa: commaAfter1(mantBits), realValue: sign === '1' ? '-0' : '+0', special: 'zero', steps };
      }
      steps.push({ label: '非规格化', text: '阶码全 0、尾数非 0 → 非规格化数 0.' + frac + ' × 2^' + (1 - bias), highlight: true });
      const v = (sign === '1' ? -1 : 1) * (parseInt(frac, 2) / Math.pow(2, cfg.mantBits)) * Math.pow(2, 1 - bias);
      return { sign, exponent: expBits, mantissa: commaAfter1(mantBits), realValue: formatReal(v), special: 'denormal', steps };
    }
    // 正常
    const E = field - bias;
    const { v } = decodeIEEE(sign, expBits, frac, cfg, bias);
    steps.push({ label: '规格化', text: '阶码 = ' + E + '，1.' + frac + ' × 2^' + E });
    return { sign, exponent: expBits, mantissa: commaAfter1(mantBits), realValue: formatReal(v), special: null, steps };
  }

  // 自定义
  const E = decodeExp(expBits, cfg);
  const { sign: sgn, mag } = decodeMant(mantBits, cfg);
  steps.push({ label: '规格化', text: '阶码真值 = ' + E + '，尾数数值 = 0.' + pad(mag.toString(2), cfg.mantBits) });
  const v = sgn * (mag / Math.pow(2, cfg.mantBits)) * Math.pow(2, E);
  steps.push({ label: '结果', text: '真值 = ' + formatReal(v), highlight: true });
  return { sign, exponent: cfg.expCode === '移码' ? expBits : commaAfter1(expBits), mantissa: commaAfter1(mantBits), realValue: formatReal(v), special: null, steps };
}

/* IEEE 解码（正常 / 非规格化由调用方分流） */
function decodeIEEE(sign: string, expBits: string, frac: string, cfg: FloatRepConfig, bias: number): { v: number } {
  const field = parseInt(expBits, 2);
  if (field === 0) {
    const v = (sign === '1' ? -1 : 1) * (parseInt(frac, 2) / Math.pow(2, cfg.mantBits)) * Math.pow(2, 1 - bias);
    return { v };
  }
  const E = field - bias;
  const v = (sign === '1' ? -1 : 1) * (1 + parseInt(frac, 2) / Math.pow(2, cfg.mantBits)) * Math.pow(2, E);
  return { v };
}

function formatReal(v: number): string {
  if (!isFinite(v)) return v > 0 ? '+Inf' : '-Inf';
  if (Object.is(v, 0)) return Object.is(v, -0) ? '-0' : '0';
  // 用二进制 + 十进制双表示更直观
  const bin = v.toString(2);
  if (Math.abs(v) >= 1e-4 && Math.abs(v) < 1e16) return `${v} (二进制 ${bin})`;
  return `${v.toExponential()} (二进制 ${bin})`;
}
