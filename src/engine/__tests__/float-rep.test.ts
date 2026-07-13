import { describe, it, expect } from 'vitest';
import { realToFloat, floatToReal, type FloatRepConfig } from '../float-rep';

/** 从 realValue（如 "5.5 (二进制 101.1)"）取出数值；Inf/NaN 由调用方按字符串判断。 */
function num(s: string): number {
  return parseFloat(s);
}

function rt(input: string, cfg: FloatRepConfig) {
  const f = realToFloat(input, cfg);
  const back = floatToReal(f.exponent.replace(/,/g, ''), f.mantissa.replace(/,/g, ''), cfg);
  return { f, back };
}

const CUSTOM = (expBits: number, mantBits: number, expCode: FloatRepConfig['expCode'], mantCode: FloatRepConfig['mantCode']): FloatRepConfig =>
  ({ preset: 'custom', expBits, mantBits, expCode, mantCode });

/* ---------- 自定义格式：正向真值 ---------- */
describe('浮点表示·自定义 正向', () => {
  it('移码/原码：101.1 = 5.5', () => {
    const { f } = rt('101.1', CUSTOM(4, 4, '移码', '原码'));
    expect(f.exponent.replace(/,/g, '')).toBe('1011');
    expect(f.mantissa.replace(/,/g, '')).toBe('01011');
    expect(num(f.realValue)).toBeCloseTo(5.5, 6);
  });

  it('移码/原码 负数：-101.1 = -5.5', () => {
    const { f } = rt('-101.1', CUSTOM(4, 4, '移码', '原码'));
    expect(f.mantissa.replace(/,/g, '')).toBe('11011'); // 原码负数：符号 1 + 数值
    expect(num(f.realValue)).toBeCloseTo(-5.5, 6);
  });

  it('移码/反码 负数：-101.1 = -5.5', () => {
    const { f } = rt('-101.1', CUSTOM(4, 4, '移码', '反码'));
    expect(f.mantissa.replace(/,/g, '')).toBe('10100'); // 反码：1 + inv(1011)=0100
    expect(num(f.realValue)).toBeCloseTo(-5.5, 6);
  });

  it('移码/补码 负数：-101.1 = -5.5', () => {
    const { f } = rt('-101.1', CUSTOM(4, 4, '移码', '补码'));
    expect(f.mantissa.replace(/,/g, '')).toBe('10101'); // 补码：1 + twos(1011)=0101
    expect(num(f.realValue)).toBeCloseTo(-5.5, 6);
  });

  it('补码阶码 正数：101.1 = 5.5', () => {
    const { f } = rt('101.1', CUSTOM(4, 4, '补码', '原码'));
    expect(f.exponent.replace(/,/g, '')).toBe('0011'); // 1 符号 + 3 数值，E'=3
    expect(num(f.realValue)).toBeCloseTo(5.5, 6);
  });

  it('补码阶码 负数：0.0001 = 0.0625', () => {
    const { f } = rt('0.0001', CUSTOM(4, 4, '补码', '原码'));
    expect(num(f.realValue)).toBeCloseTo(0.0625, 6);
  });

  it('移码阶码：0.01 = 0.25', () => {
    const { f } = rt('0.01', CUSTOM(4, 4, '移码', '原码'));
    expect(f.exponent.replace(/,/g, '')).toBe('0111');
    expect(num(f.realValue)).toBeCloseTo(0.25, 6);
  });
});

/* ---------- 反向（浮点→真值）与往返一致 ---------- */
describe('浮点表示·自定义 反向 + 往返', () => {
  const codes: [FloatRepConfig['expCode'], FloatRepConfig['mantCode']][] = [
    ['移码', '原码'], ['移码', '反码'], ['移码', '补码'],
    ['补码', '原码'], ['反码', '反码'], ['原码', '原码'],
  ];
  for (const [ec, mc] of codes) {
    it(`往返一致 (${ec}阶/${mc}尾) 5.5 → 浮点 → 5.5`, () => {
      const { f, back } = rt('101.1', CUSTOM(4, 4, ec, mc));
      expect(num(back.realValue)).toBeCloseTo(5.5, 6);
      expect(num(f.realValue)).toBeCloseTo(num(back.realValue), 6);
    });
    it(`往返一致 (${ec}阶/${mc}尾) -5.5`, () => {
      const { back } = rt('-101.1', CUSTOM(4, 4, ec, mc));
      expect(num(back.realValue)).toBeCloseTo(-5.5, 6);
    });
  }
});

/* ---------- 边界：±0 / 溢出 / 下溢 ---------- */
describe('浮点表示·边界', () => {
  it('+0 与 -0（自定义）', () => {
    const p = realToFloat('0', CUSTOM(4, 4, '移码', '原码'));
    const n = realToFloat('-0', CUSTOM(4, 4, '移码', '原码'));
    expect(p.special).toBe('zero');
    expect(n.special).toBe('zero');
    expect(p.sign).toBe('0');
    expect(n.sign).toBe('1');
  });

  it('阶码溢出（自定义移码）：超大真值 → overflow', () => {
    // 移码 4 位 bias=8，E' 范围 [-8,7]，对应真值 0.1xxx × 2^[-8..7]，最大 ~2^7；给个远超的
    const f = realToFloat('1'.repeat(40), CUSTOM(4, 4, '移码', '原码'));
    expect(f.special).toBe('overflow');
  });

  it('尾数下溢（截断）：1.10101 在 4 位尾数下丢弃多余位', () => {
    const f = realToFloat('1.10101', CUSTOM(4, 4, '移码', '原码'));
    expect(f.special).toBe('underflow');
    // 截断后 1.101 → 数值位 1101（含首位 1）
    expect(f.mantissa.replace(/,/g, '')).toBe('01101');
  });
});

/* ---------- IEEE754 ---------- */
describe('浮点表示·IEEE754 单精度', () => {
  const S: FloatRepConfig = { preset: 'ieee-single', expBits: 8, mantBits: 23, expCode: '移码', mantCode: '原码' };

  it('1.0', () => {
    const f = realToFloat('1', S);
    expect(f.exponent).toBe('01111111'); // bias 127 → E=0 → field 127
    expect(num(f.realValue)).toBeCloseTo(1, 6);
  });
  it('-1.0', () => {
    const f = realToFloat('-1', S);
    expect(f.sign).toBe('1');
    expect(num(f.realValue)).toBeCloseTo(-1, 6);
  });
  it('0.5', () => {
    const f = realToFloat('0.1', S);
    expect(f.exponent).toBe('01111110'); // E=-1 → 126
    expect(num(f.realValue)).toBeCloseTo(0.5, 6);
  });
  it('2.0', () => {
    const f = realToFloat('10', S);
    expect(f.exponent).toBe('10000000'); // E=1 → 128
    expect(num(f.realValue)).toBeCloseTo(2, 6);
  });
  it('+0 / -0', () => {
    expect(realToFloat('0', S).special).toBe('zero');
    expect(realToFloat('-0', S).sign).toBe('1');
  });
  it('Inf：超大真值 → 阶码全 1、尾数 0', () => {
    const f = realToFloat('1'.repeat(400), S);
    expect(f.special).toBe('inf');
    expect(f.exponent).toBe('11111111');
    expect(f.mantissa.replace(/,/g, '').slice(1)).toBe('0'.repeat(23));
  });
  it('NaN（反向）：阶码全 1、尾数非 0', () => {
    const r = floatToReal('11111111', '0' + '1'.repeat(23), S);
    expect(r.special).toBe('nan');
    expect(r.realValue).toBe('NaN');
  });
  it('Inf（反向）：阶码全 1、尾数 0', () => {
    const r = floatToReal('11111111', '0' + '0'.repeat(23), S);
    expect(r.special).toBe('inf');
    expect(r.realValue).toBe('+Inf');
  });
  it('非规格化：2^-128 落入非规格化区', () => {
    const f = realToFloat('0.' + '0'.repeat(127) + '1', S);
    expect(f.special).toBe('denormal');
    expect(f.exponent).toBe('0'.repeat(8));
    expect(num(f.realValue)).toBeCloseTo(Math.pow(2, -128), 6);
  });
});

describe('浮点表示·IEEE754 双精度', () => {
  const D: FloatRepConfig = { preset: 'ieee-double', expBits: 11, mantBits: 52, expCode: '移码', mantCode: '原码' };
  it('1.0', () => {
    const f = realToFloat('1', D);
    expect(f.exponent).toBe('01111111111'); // bias 1023 → 1023
    expect(num(f.realValue)).toBeCloseTo(1, 6);
  });
  it('2.0', () => {
    const f = realToFloat('10', D);
    expect(f.exponent).toBe('10000000000'); // E=1 → 1024
    expect(num(f.realValue)).toBeCloseTo(2, 6);
  });
});

/* ---------- 输入校验 ---------- */
describe('浮点表示·输入校验', () => {
  it('非法字符抛错', () => {
    expect(() => realToFloat('1x0.1', CUSTOM(4, 4, '移码', '原码'))).toThrow();
    expect(() => realToFloat('', CUSTOM(4, 4, '移码', '原码'))).toThrow();
  });
  it('反向位数不符抛错', () => {
    expect(() => floatToReal('101', '01011', CUSTOM(4, 4, '移码', '原码'))).toThrow();
    expect(() => floatToReal('1011', '010', CUSTOM(4, 4, '移码', '原码'))).toThrow();
  });
});
