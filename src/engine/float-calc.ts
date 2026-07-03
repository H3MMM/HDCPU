/**
 * 浮点数机器数运算引擎
 *
 * 格式约定：
 *   阶码 —— 移码表示，双符号位（2 位符号 + N 位数值）
 *   尾数 —— 补码表示，双符号位（2 位符号 + M 位数值）
 */

export interface FloatOperand {
  mantissa: string;
  exponent: string;
}

export interface FloatCalcResult {
  x: FloatOperand;
  y: FloatOperand;
  operation: '+' | '-';
  resultMantissa: string;
  resultExponent: string;
  resultHex: string;
  steps: { label?: string; text: string; highlight?: boolean }[];
}

export interface FloatCalcConfig {
  exponentBits: number;
  mantissaBits: number;
  rounding: '0舍1入' | '恒置1';
}

export const DEFAULT_CONFIG: FloatCalcConfig = {
  exponentBits: 2,
  mantissaBits: 12,
  rounding: '0舍1入',
};


function binAddTrunc(a: string, b: string, len: number): { sum: string; carry: number } {
  const aa = a.padStart(len, "0");
  const bb = b.padStart(len, "0");
  let carry = 0;
  const result: string[] = [];
  for (let i = len - 1; i >= 0; i--) {
    const s = parseInt(aa[i], 2) + parseInt(bb[i], 2) + carry;
    result.unshift(String(s & 1));
    carry = s >> 1;
  }
  return { sum: result.join(""), carry };
}

function shiftRight(bin: string, n: number): { result: string; guard: string } {
  if (n <= 0) return { result: bin, guard: "" };
  const signBit = bin[0];
  const guard = bin.slice(-n);
  const body = bin.slice(0, -n);
  return { result: signBit.repeat(n) + body, guard };
}

function twosComplement(bin: string): string {
  return binAddTrunc(bin.split("").map(b => b === "0" ? "1" : "0").join(""), "1", bin.length).sum;
}

function decToOffsetBinary(value: number, bits: number): string {
  return (value + (1 << (bits - 1))).toString(2).padStart(bits, "0");
}

function offsetToValue(bin: string): number {
  return parseInt(bin, 2) - (1 << (bin.length - 1));
}

function fmtDoubleSign(bin: string): string {
  if (bin.length < 2) return bin;
  return bin.slice(0, 2) + "," + bin.slice(2);
}

function binToHex(bin: string): string {
  const clean = bin.replace(",", "");
  const p = clean.padStart(Math.ceil(clean.length / 4) * 4, "0");
  let h = "";
  for (let i = 0; i < p.length; i += 4) h += parseInt(p.slice(i, i+4), 2).toString(16).toUpperCase();
  return h;
}


export function computeFloatArithmetic(
  x: FloatOperand,
  y: FloatOperand,
  operation: '+' | '-',
  config: FloatCalcConfig = DEFAULT_CONFIG
): FloatCalcResult {
  const steps: { label?: string; text: string; highlight?: boolean }[] = [];
  const expBits = config.exponentBits;
  const mantBits = config.mantissaBits;
  const totalExpBits = 2 + expBits;
  const totalMantBits = 2 + mantBits;

  const xMantBin = x.mantissa.replace(',', '');
  const yMantBin = y.mantissa.replace(',', '');
  const xExpBin = x.exponent.replace(',', '');
  const yExpBin = y.exponent.replace(',', '');

  if (xMantBin.length !== totalMantBits || yMantBin.length !== totalMantBits) {
    throw new Error('尾数必须为 ' + totalMantBits + ' 位（含双符号位）');
  }
  if (xExpBin.length !== totalExpBits || yExpBin.length !== totalExpBits) {
    throw new Error('阶码必须为 ' + totalExpBits + ' 位（含双符号位）');
  }

  const fmtM = (b: string) => fmtDoubleSign(b);
  const fmtE = (b: string) => fmtDoubleSign(b);

  steps.push({ label: '初始', text: '规格化浮点数如下，设 Z=X' + operation + 'Y：' });
  steps.push({ text: '    [X]浮= ' + fmtM(xMantBin) + ' ' + fmtE(xExpBin) });
  steps.push({ text: '    [Y]浮= ' + fmtM(yMantBin) + ' ' + fmtE(yExpBin) });


  // ----- ① 对阶 -----
  steps.push({ label: '①对阶', text: '①对阶：△E = [Ex]移 + [-Ey]补', highlight: true });

  const xExpVal = offsetToValue(xExpBin.slice(2));
  const yExpVal = offsetToValue(yExpBin.slice(2));
  const eyNeg = twosComplement(yExpBin);
  const deltaESum = binAddTrunc(xExpBin, eyNeg, totalExpBits).sum;

  steps.push({ text: '△E = ' + fmtE(xExpBin) + ' + ' + fmtE(eyNeg) + ' = ' + fmtE(deltaESum) });

  const deltaEValue = offsetToValue(deltaESum.slice(-expBits));

  let shiftAmount = 0;
  let guardBits = '';

  if (deltaEValue > 0) {
    shiftAmount = deltaEValue;
    steps.push({ text: '△E 真值 = ' + deltaEValue + '，X 阶码大，Y 尾数右移 ' + shiftAmount + ' 位' });
  } else if (deltaEValue < 0) {
    shiftAmount = -deltaEValue;
    steps.push({ text: '△E 真值 = ' + deltaEValue + '，Y 阶码大，X 尾数右移 ' + shiftAmount + ' 位' });
  } else {
    steps.push({ text: '△E 真值 = 0，无需对阶' });
  }

  let alignedXMant = xMantBin;
  let alignedYMant = yMantBin;
  let alignedXExp = xExpBin;
  let alignedYExp = yExpBin;

  if (deltaEValue > 0) {
    const sr = shiftRight(yMantBin, shiftAmount);
    alignedYMant = sr.result;
    guardBits = sr.guard;
    alignedYExp = '00' + decToOffsetBinary(yExpVal + shiftAmount, expBits);
  } else if (deltaEValue < 0) {
    const sr = shiftRight(xMantBin, shiftAmount);
    alignedXMant = sr.result;
    guardBits = sr.guard;
    alignedXExp = '00' + decToOffsetBinary(xExpVal + shiftAmount, expBits);
  }

  if (deltaEValue !== 0) {
    const gd = guardBits ? '(' + guardBits + ')' : '';
    steps.push({ text: 'My 右移 ' + shiftAmount + ' bit，Ey 加 ' + shiftAmount + '  （保留保护位 ' + (guardBits || '') + '）' });
    if (deltaEValue > 0) {
      steps.push({ text: '    [X]浮= ' + fmtM(alignedXMant) + '           ' + fmtE(alignedXExp) });
      steps.push({ text: '    [Y]浮= ' + fmtM(alignedYMant) + gd + '  ' + fmtE(alignedYExp) });
    } else {
      steps.push({ text: '    [X]浮= ' + fmtM(alignedXMant) + gd + '  ' + fmtE(alignedXExp) });
      steps.push({ text: '    [Y]浮= ' + fmtM(alignedYMant) + '           ' + fmtE(alignedYExp) });
    }
  } else {
    steps.push({ text: '    [X]浮= ' + fmtM(alignedXMant) + '           ' + fmtE(alignedXExp) });
    steps.push({ text: '    [Y]浮= ' + fmtM(alignedYMant) + '           ' + fmtE(alignedYExp) });
  }


  // ----- ② 尾数相减 -----
  const sl = operation === '-' ? '减' : '加';
  steps.push({ label: '②尾数相' + sl, text: '②尾数相' + sl + '：', highlight: true });

  let secondMant: string;
  if (operation === '-') {
    secondMant = twosComplement(alignedYMant);
    steps.push({ text: '    [Mz]补 = [Mx' + operation + 'My]补 = [Mx]补 + [-My]补' });
    steps.push({ text: '    [-My]补 = ' + fmtM(secondMant) + (guardBits ? '(' + guardBits + ')' : '') });
  } else {
    secondMant = alignedYMant;
    steps.push({ text: '    [Mz]补 = [Mx' + operation + 'My]补 = [Mx]补 + [My]补' });
  }

  const aFull = alignedXMant + (guardBits && operation === '-' ? guardBits : '');
  const bFull = secondMant + (guardBits && operation === '-' ? guardBits : '');
  const maxLen = Math.max(aFull.length, bFull.length);
  const aa = aFull.padEnd(maxLen, '0');
  const bb = bFull.padEnd(maxLen, '0');

  const pA = fmtM(aa.slice(0, totalMantBits));
  const gA = guardBits && operation === '-' ? '(' + aa.slice(totalMantBits) + ')' : '';
  const pB = fmtM(bb.slice(0, totalMantBits));
  const gB = guardBits && operation === '-' ? '(' + bb.slice(totalMantBits) + ')' : '';

  steps.push({ text: '        ' + pA + gA });
  steps.push({ text: '    +   ' + pB + gB });
  steps.push({ text: '    ------------------' });

  const addResult = binAddTrunc(aa, bb, maxLen).sum;
  const mantResult = addResult.slice(0, totalMantBits);
  const extraBits = addResult.slice(totalMantBits);

  steps.push({ text: '        ' + fmtM(mantResult) + (extraBits ? '(' + extraBits + ')' : '') });

  const mantSignBits = mantResult.slice(0, 2);
  const hasOverflow = mantSignBits === '01' || mantSignBits === '10';
  steps.push({ text: '双符号位 = ' + mantSignBits + (hasOverflow ? '，尾数溢出，需要右规' : '，尾数无溢出') });


  // ----- ③ 规格化 -----
  steps.push({ label: '③规格化', text: '③结果规格化：', highlight: true });

  let normalizedMant = mantResult;
  let normalizedExp = deltaEValue >= 0 ? alignedXExp : alignedYExp;

  if (hasOverflow) {
    normalizedMant = shiftRight(normalizedMant, 1).result;
    normalizedExp = '00' + decToOffsetBinary(offsetToValue(normalizedExp.slice(2)) + 1, expBits);
    steps.push({ text: '有溢出，右规 1 位（Mz 右移 1 位，阶码 +1）' });
  } else {
    steps.push({ text: '无溢出，无需规格化' });
  }

  steps.push({ text: '    [Mz]补 = ' + fmtM(normalizedMant) });
  steps.push({ text: '    [Ez]移 = ' + fmtE(normalizedExp) });


  // ----- ④ 舍入 -----
  steps.push({ label: '④舍入', text: '④舍入处理（' + config.rounding + '）：', highlight: true });

  let finalMant = normalizedMant;

  if (config.rounding === '0舍1入') {
    if (guardBits && guardBits[0] === '1') {
      const oneStr = '1'.padStart(totalMantBits, '0').replace(/^0+/, '') || '1';
      finalMant = binAddTrunc(finalMant, oneStr, totalMantBits).sum;
      steps.push({ text: '保护位最高位为 1，[Mz]补 入 1' });
      steps.push({ text: '    [Mz]补 = ' + fmtM(finalMant) });

      const ns = finalMant.slice(0, 2);
      if (ns === '01' || ns === '10') {
        finalMant = shiftRight(finalMant, 1).result;
        normalizedExp = '00' + decToOffsetBinary(offsetToValue(normalizedExp.slice(2)) + 1, expBits);
        steps.push({ text: '舍入后尾数再次溢出，右规 1 位，阶码 +1' });
        steps.push({ text: '    [Mz]补 = ' + fmtM(finalMant) });
        steps.push({ text: '    [Ez]移 = ' + fmtE(normalizedExp) });
      }
    } else {
      steps.push({ text: '保护位最高位为 0，无需舍入' });
    }
  } else {
    if (guardBits && guardBits.includes('1')) {
      finalMant = finalMant.slice(0, -1) + '1';
      steps.push({ text: '恒置 1 法：尾数最低位置 1' });
    } else {
      steps.push({ text: '保护位全 0，无需舍入' });
    }
  }


  // ============ 结果 ============
  const resultMantissa = fmtM(finalMant);
  const resultExponent = fmtE(normalizedExp);
  const combinedBits = finalMant + normalizedExp;
  const resultHex = binToHex(combinedBits);

  steps.push({ label: '结果', text: '得：[X' + operation + 'Y]浮 = ' + resultMantissa + ' ' + resultExponent, highlight: true });
  steps.push({ text: '（十六进制编码：' + resultHex + 'H）' });

  return {
    x, y, operation,
    resultMantissa, resultExponent, resultHex, steps,
  };
}
