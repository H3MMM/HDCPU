
import os

out = 'D:/HDCPU/src/engine/float-calc.ts'
with open(out, 'w', encoding='utf-8') as f:
    pass

def append(s):
    with open(out, 'a', encoding='utf-8') as f:
        f.write(s + chr(10))

append(/**
 * 浮点数机器数运算引擎
 * 支持加减乘除四种运算
 * 阶码: 移码 / 补码
 * 尾数: 原码 / 补码
 * 均采用双符号位
 */

export interface FloatOperand {
  mantissa: string;
  exponent: string;
}

export type FloatOperation = '+' | '-' | '*' | '/';
export type ExponentFormat = '移码' | '补码';
export type MantissaFormat = '原码' | '补码';
export type RoundingMode = '0舍1入' | '恒置1';

export interface FloatCalcResult {
  x: FloatOperand;
  y: FloatOperand;
  operation: FloatOperation;
  resultMantissa: string;
  resultExponent: string;
  resultHex: string;
  steps: { label?: string; text: string; highlight?: boolean }[];
}

export interface FloatCalcConfig {
  exponentBits: number;
  mantissaBits: number;
  exponentFormat: ExponentFormat;
  mantissaFormat: MantissaFormat;
  rounding: RoundingMode;
}

export const DEFAULT_CONFIG: FloatCalcConfig = {
  exponentBits: 2,
  mantissaBits: 12,
  exponentFormat: '移码',
  mantissaFormat: '补码',
  rounding: '0舍1入',
};
)

print('Part 1 (interfaces) done')
