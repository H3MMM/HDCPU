import { describe, it, expect } from 'vitest';
import {
  computeFloatArithmetic,
  type FloatOperand,
  type FloatCalcConfig,
  type ExponentFormat,
  type MantissaFormat,
  type FloatOperation,
} from '../float-calc';

/**
 * 浮点数运算引擎测试
 *
 * 表示约定（与 float-calc.ts 一致）：
 *  - 阶码：双符号位 + 2 位阶值，共 4 位。移码 / 补码。
 *  - 尾数：双符号位 + 12 位数值，共 14 位。原码 / 补码。
 *  - 真值 = (-1)^sign × 0.(尾数数值) × 2^阶码真值，规格化尾数数值最高位为 1。
 *
 * 测试策略：对每种「运算 × 编码方式」组合，用一组真值明确的输入，
 * 计算结果后再解码回真值，断言其等于数学上的正确结果。
 * 这样一旦引擎在某组合上算错，对应断言即可失败暴露问题。
 */

const EXP_BITS = 2;
const MANT_BITS = 12;

type FmtCombo = { ef: ExponentFormat; mf: MantissaFormat };

const FMT_COMBOS: FmtCombo[] = [
  { ef: '移码', mf: '补码' },
  { ef: '移码', mf: '原码' },
  { ef: '补码', mf: '补码' },
  { ef: '补码', mf: '原码' },
];

/* ---------- 与引擎一致的编解码工具 ---------- */

function twosComp(bin: string): string {
  const inv = bin.split('').map(c => (c === '0' ? '1' : '0')).join('');
  let carry = 1;
  const res: string[] = [];
  for (let i = inv.length - 1; i >= 0; i--) {
    const s = (inv[i] === '1' ? 1 : 0) + carry;
    res.unshift(s & 1 ? '1' : '0');
    carry = s >> 1;
  }
  return res.join('');
}

/** 阶码真值 -> 带「,」的双符号位阶码串（与引擎 valueToExp 一致）。 */
function encodeExp(val: number, fmt: ExponentFormat, bits = EXP_BITS): string {
  let full: string;
  if (fmt === '移码') {
    full = '00' + (val + (1 << (bits - 1))).toString(2).padStart(bits, '0');
  } else if (val >= 0) {
    full = '00' + val.toString(2).padStart(bits, '0');
  } else {
    // 负数补码阶码：双符号位 11 + 数值位补码（与引擎 valueToExp 一致）
    const abs = (-val).toString(2).padStart(bits, '0');
    full = '11' + twosComp('0' + abs).slice(1);
  }
  return full.slice(0, 2) + ',' + full.slice(2);
}

/** 尾数数值（带符号，规格化 |m|∈[0.5,1)）-> 带「,」的双符号位尾数串。 */
function encodeMant(mantFrac: number, fmt: MantissaFormat, bits = MANT_BITS): string {
  const sign = mantFrac < 0;
  const abs = Math.abs(mantFrac);
  let full: string;
  if (fmt === '补码') {
    const mag = Math.round(abs * (1 << bits));
    const magBin = mag.toString(2).padStart(bits, '0');
    full = sign ? twosComp('00' + magBin) : '00' + magBin;
  } else {
    // 原码：双符号位 + bits 位数值（符号在双符号位，数值位与补码一致）
    const mag = Math.round(abs * (1 << bits));
    const magBin = mag.toString(2).padStart(bits, '0');
    const ss = sign ? '11' : '00';
    full = ss + magBin;
  }
  return full.slice(0, 2) + ',' + full.slice(2);
}

/** 真值 -> 规格化操作数（自选阶码，使尾数数值落在 [0.5,1)）。 */
function encodeValue(value: number, ef: ExponentFormat, mf: MantissaFormat, eBits = EXP_BITS, mBits = MANT_BITS): FloatOperand {
  if (value === 0) {
    return { mantissa: encodeMant(0.5, mf, mBits), exponent: encodeExp(0, ef, eBits) };
  }
  let exp = Math.floor(Math.log2(Math.abs(value)));
  let mantFrac = value / Math.pow(2, exp);
  if (Math.abs(mantFrac) >= 1) {
    mantFrac /= 2;
    exp += 1;
  }
  return { mantissa: encodeMant(mantFrac, mf, mBits), exponent: encodeExp(exp, ef, eBits) };
}

/** 把引擎输出的尾数+阶码串解码回真值（位宽无关，可识别非正常宽度输出）。 */
function decodeValue(
  mantStr: string,
  expStr: string,
  ef: ExponentFormat,
  mf: MantissaFormat,
): number {
  const m = mantStr.replace(',', '');
  const e = expStr.replace(',', '');

  // 移码：偏置 = 1 << (数值位长度 - 1)，数值位 = 去掉双符号位后的部分
  const eVal =
    ef === '移码'
      ? parseInt(e.slice(2), 2) - (1 << (e.length - 2 - 1))
      : parseInt(e, 2) - (e[0] === '1' ? 1 << e.length : 0);

  let mag: number;
  let sign: number;
  if (mf === '补码') {
    sign = m[0] === '1' ? -1 : 1;
    const magStr = sign < 0 ? twosComp(m) : m;
    mag = parseInt(magStr.slice(2), 2);
  } else {
    sign = m.slice(0, 2) === '11' ? -1 : 1;
    mag = parseInt(m.slice(2), 2);
  }
  const frac = mag / Math.pow(2, m.length - 2);
  return sign * frac * Math.pow(2, eVal);
}

function run(
  x: number,
  y: number,
  op: FloatOperation,
  ef: ExponentFormat,
  mf: MantissaFormat,
) {
  const config: FloatCalcConfig = {
    exponentBits: EXP_BITS,
    mantissaBits: MANT_BITS,
    exponentFormat: ef,
    mantissaFormat: mf,
    rounding: '0舍1入',
  };
  const r = computeFloatArithmetic(
    encodeValue(x, ef, mf),
    encodeValue(y, ef, mf),
    op,
    config,
  );
  return decodeValue(r.resultMantissa, r.resultExponent, ef, mf);
}

/** 指定阶码/尾数数值位的运行器，用于位宽可配置测试。decode 与位宽无关。 */
function runBits(
  x: number, y: number, op: FloatOperation,
  ef: ExponentFormat, mf: MantissaFormat,
  eBits: number, mBits: number,
) {
  const config: FloatCalcConfig = {
    exponentBits: eBits,
    mantissaBits: mBits,
    exponentFormat: ef,
    mantissaFormat: mf,
    rounding: '0舍1入',
  };
  const r = computeFloatArithmetic(
    encodeValue(x, ef, mf, eBits, mBits),
    encodeValue(y, ef, mf, eBits, mBits),
    op,
    config,
  );
  return decodeValue(r.resultMantissa, r.resultExponent, ef, mf);
}

/* ---------- 加法 ---------- */
describe('浮点加法 X + Y', () => {
  const cases: [number, number, number][] = [
    [0.5, 0.25, 0.75],
    [0.5, 0.5, 1.0],
    [0.25, 0.25, 0.5],
    [-0.5, 0.25, -0.25],
    [-0.5, -0.25, -0.75],
    [0.625, 0.125, 0.75],
  ];

  for (const { ef, mf } of FMT_COMBOS) {
    describe(`阶码=${ef} 尾数=${mf}`, () => {
      for (const [x, y, expected] of cases) {
        it(`${x} + ${y} = ${expected}`, () => {
          expect(run(x, y, '+', ef, mf)).toBeCloseTo(expected, 6);
        });
      }
    });
  }
});

/* ---------- 减法 ---------- */
describe('浮点减法 X - Y', () => {
  const cases: [number, number, number][] = [
    [0.5, 0.25, 0.25],
    [0.5, 0.5, 0.0],
    [0.75, 0.25, 0.5],
    [0.25, 0.5, -0.25],
    [-0.5, 0.25, -0.75],
  ];

  for (const { ef, mf } of FMT_COMBOS) {
    describe(`阶码=${ef} 尾数=${mf}`, () => {
      for (const [x, y, expected] of cases) {
        it(`${x} - ${y} = ${expected}`, () => {
          expect(run(x, y, '-', ef, mf)).toBeCloseTo(expected, 6);
        });
      }
    });
  }
});

/* ---------- 乘法 ---------- */
describe('浮点乘法 X × Y', () => {
  const cases: [number, number, number][] = [
    [0.5, 0.5, 0.25],
    [0.5, 0.25, 0.125],
    [0.75, 0.75, 0.5625],
    [-0.5, 0.5, -0.25],
    [0.75, 0.5, 0.375],
  ];

  for (const { ef, mf } of FMT_COMBOS) {
    describe(`阶码=${ef} 尾数=${mf}`, () => {
      for (const [x, y, expected] of cases) {
        it(`${x} × ${y} = ${expected}`, () => {
          expect(run(x, y, '*', ef, mf)).toBeCloseTo(expected, 6);
        });
      }
    });
  }
});

/* ---------- 除法 ---------- */
describe('浮点除法 X ÷ Y', () => {
  const cases: [number, number, number][] = [
    [0.5, 0.5, 1.0],
    [0.25, 0.5, 0.5],
    [0.75, 0.5, 1.5],
    [-0.5, 0.5, -1.0],
  ];

  for (const { ef, mf } of FMT_COMBOS) {
    describe(`阶码=${ef} 尾数=${mf}`, () => {
      for (const [x, y, expected] of cases) {
        it(`${x} ÷ ${y} = ${expected}`, () => {
          expect(run(x, y, '/', ef, mf)).toBeCloseTo(expected, 6);
        });
      }
    });
  }
});

/* ---------- 编码方式选择不改变真值结果 ---------- */
describe('编码方式选择一致性', () => {
  it('阶码移码与补码对同一加法应得到相同真值', () => {
    const a = run(0.5, 0.25, '+', '移码', '补码');
    const b = run(0.5, 0.25, '+', '补码', '补码');
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(0.75, 6);
  });

  it('尾数原码与补码对同一加法应得到相同真值', () => {
    const a = run(0.5, 0.25, '+', '移码', '补码');
    const b = run(0.5, 0.25, '+', '移码', '原码');
    expect(a).toBeCloseTo(b, 6);
  });

  it('尾数原码与补码对同一乘法应得到相同真值', () => {
    const a = run(0.5, 0.5, '*', '移码', '补码');
    const b = run(0.5, 0.5, '*', '移码', '原码');
    expect(a).toBeCloseTo(b, 6);
  });
});

/* ---------- 边界 / 异常 ---------- */
describe('边界与异常', () => {
  it('除数为零应抛出错误', () => {
    const zeroOperand: FloatOperand = { mantissa: '00,000000000000', exponent: '00,10' };
    expect(() =>
      computeFloatArithmetic(encodeValue(0.5, '移码', '补码'), zeroOperand, '/', {
        exponentBits: EXP_BITS,
        mantissaBits: MANT_BITS,
        exponentFormat: '移码',
        mantissaFormat: '补码',
        rounding: '0舍1入',
      }),
    ).toThrow();
  });

  it('结果阶码应落在合法范围 [-2, 1] 内（以 0.5+0.5=1.0 为例）', () => {
    const r = computeFloatArithmetic(
      encodeValue(0.5, '移码', '补码'),
      encodeValue(0.5, '移码', '补码'),
      '+',
      { exponentBits: EXP_BITS, mantissaBits: MANT_BITS, exponentFormat: '移码', mantissaFormat: '补码', rounding: '0舍1入' },
    );
    const e = r.resultExponent.replace(',', '');
    const eVal = parseInt(e.slice(2), 2) - (1 << (e.length - 2 - 1));
    expect(eVal).toBeGreaterThanOrEqual(-2);
    expect(eVal).toBeLessThanOrEqual(1);
  });

  it('结果尾数应为规格化形式（数值最高位为 1）—— 0.5+0.25=0.75', () => {
    const r = computeFloatArithmetic(
      encodeValue(0.5, '移码', '补码'),
      encodeValue(0.25, '移码', '补码'),
      '+',
      { exponentBits: EXP_BITS, mantissaBits: MANT_BITS, exponentFormat: '移码', mantissaFormat: '补码', rounding: '0舍1入' },
    );
    const m = r.resultMantissa.replace(',', '');
    // 数值最高位（双符号位之后第一位）应为 1
    expect(m[2]).toBe('1');
  });
});

/* ---------- 输入规范化（不强制用户输入逗号） ---------- */
describe('输入规范化', () => {
  const cfg: FloatCalcConfig = {
    exponentBits: EXP_BITS,
    mantissaBits: MANT_BITS,
    exponentFormat: '移码',
    mantissaFormat: '补码',
    rounding: '0舍1入',
  };

  it('带逗号的输入与不带逗号的输入应得到相同结果', () => {
    const a = computeFloatArithmetic(
      { mantissa: '00,100000000000', exponent: '00,10' },
      { mantissa: '00,100000000000', exponent: '00,01' },
      '+', cfg,
    );
    const b = computeFloatArithmetic(
      { mantissa: '00100000000000', exponent: '0010' },
      { mantissa: '00100000000000', exponent: '0001' },
      '+', cfg,
    );
    expect(b.resultMantissa).toBe(a.resultMantissa);
    expect(b.resultExponent).toBe(a.resultExponent);
  });

  it('含空格 / 全角逗号的输入应被容忍', () => {
    const r = computeFloatArithmetic(
      { mantissa: '00，100000000000', exponent: '00 10' },
      { mantissa: '00,100000000000', exponent: '00,01' },
      '+', cfg,
    );
    expect(decodeValue(r.resultMantissa, r.resultExponent, '移码', '补码')).toBeCloseTo(0.75, 6);
  });

  it('结果尾数应为规范 14 位（双符号位 + 12 数值位）—— 乘法 0.5×0.5', () => {
    const r = computeFloatArithmetic(
      encodeValue(0.5, '移码', '补码'),
      encodeValue(0.5, '移码', '补码'),
      '*',
      { exponentBits: EXP_BITS, mantissaBits: MANT_BITS, exponentFormat: '移码', mantissaFormat: '补码', rounding: '0舍1入' },
    );
    const m = r.resultMantissa.replace(',', '');
    expect(m.length).toBe(EXP_BITS + MANT_BITS); // 2 + 12 = 14
    expect(m[2]).toBe('1'); // 规格化
  });

  it('结果尾数应为规范 14 位 —— 除法 0.5÷0.5', () => {
    const r = computeFloatArithmetic(
      encodeValue(0.5, '移码', '补码'),
      encodeValue(0.5, '移码', '补码'),
      '/',
      { exponentBits: EXP_BITS, mantissaBits: MANT_BITS, exponentFormat: '移码', mantissaFormat: '补码', rounding: '0舍1入' },
    );
    const m = r.resultMantissa.replace(',', '');
    expect(m.length).toBe(EXP_BITS + MANT_BITS);
    expect(m[2]).toBe('1');
  });

  it('非法字符应抛出错误', () => {
    expect(() =>
      computeFloatArithmetic(
        { mantissa: '00,1x0000000000', exponent: '00,10' },
        { mantissa: '00,100000000000', exponent: '00,01' },
        '+', cfg,
      ),
    ).toThrow();
  });
});

/* ---------- 位宽可配置（阶码/尾数数值位 2..16） ---------- */
describe('位宽可配置', () => {
  // 尾数数值位 = 4，阶码数值位 = 3：尾数小但仍可精确表示 0.5/0.25/0.75
  describe('尾数 4 位 / 阶码 3 位', () => {
    for (const { ef, mf } of FMT_COMBOS) {
      it(`(${ef}/${mf}) 0.5 + 0.25 = 0.75`, () => {
        expect(runBits(0.5, 0.25, '+', ef, mf, 3, 4)).toBeCloseTo(0.75, 6);
      });
      it(`(${ef}/${mf}) 0.5 - 0.25 = 0.25`, () => {
        expect(runBits(0.5, 0.25, '-', ef, mf, 3, 4)).toBeCloseTo(0.25, 6);
      });
      it(`(${ef}/${mf}) 0.5 × 0.5 = 0.25`, () => {
        expect(runBits(0.5, 0.5, '*', ef, mf, 3, 4)).toBeCloseTo(0.25, 6);
      });
      it(`(${ef}/${mf}) 0.75 × 0.75 = 0.5625`, () => {
        expect(runBits(0.75, 0.75, '*', ef, mf, 3, 4)).toBeCloseTo(0.5625, 6);
      });
      it(`(${ef}/${mf}) 0.5 ÷ 0.5 = 1`, () => {
        expect(runBits(0.5, 0.5, '/', ef, mf, 3, 4)).toBeCloseTo(1.0, 6);
      });
    }
  });

  // 尾数数值位 = 8
  describe('尾数 8 位 / 阶码 3 位', () => {
    for (const { ef, mf } of FMT_COMBOS) {
      it(`(${ef}/${mf}) 0.625 × 0.5 = 0.3125`, () => {
        expect(runBits(0.625, 0.5, '*', ef, mf, 3, 8)).toBeCloseTo(0.3125, 6);
      });
      it(`(${ef}/${mf}) 0.75 ÷ 0.5 = 1.5`, () => {
        expect(runBits(0.75, 0.5, '/', ef, mf, 3, 8)).toBeCloseTo(1.5, 6);
      });
    }
  });

  // 尾数数值位 = 16（最大值）：验证大位宽不触发 JS 32 位溢出
  describe('尾数 16 位 / 阶码 4 位（最大位宽）', () => {
    for (const { ef, mf } of FMT_COMBOS) {
      it(`(${ef}/${mf}) 0.5 × 0.5 = 0.25`, () => {
        expect(runBits(0.5, 0.5, '*', ef, mf, 4, 16)).toBeCloseTo(0.25, 6);
      });
      // 0.75×0.75：乘积 49152² = 2,415,919,104 > 2^31，专门验证 >> 不溢出（结果仍精确为 0.5625）
      it(`(${ef}/${mf}) 0.75 × 0.75 = 0.5625（乘积 > 2^31）`, () => {
        expect(runBits(0.75, 0.75, '*', ef, mf, 4, 16)).toBeCloseTo(0.5625, 6);
      });
      it(`(${ef}/${mf}) 0.5 ÷ 0.5 = 1`, () => {
        expect(runBits(0.5, 0.5, '/', ef, mf, 4, 16)).toBeCloseTo(1.0, 6);
      });
      it(`(${ef}/${mf}) 0.5 + 0.25 = 0.75`, () => {
        expect(runBits(0.5, 0.25, '+', ef, mf, 4, 16)).toBeCloseTo(0.75, 6);
      });
    }
  });

  // 阶码 2..16 均可正常编解码（移码/补码）
  describe('阶码位宽 2..16 编解码一致', () => {
    for (const eb of [2, 3, 4, 8, 16]) {
      for (const ef of ['移码', '补码'] as ExponentFormat[]) {
        it(`阶码 ${eb} 位 ${ef}：0.5 + 0.25 = 0.75`, () => {
          expect(runBits(0.5, 0.25, '+', ef, '补码', eb, 12)).toBeCloseTo(0.75, 6);
        });
      }
    }
  });
});
