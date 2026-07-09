/**
 * 浮点数机器数运算引擎
 * 支持加减乘除四种运算
 * 阶码: 移码 / 补码  尾数: 原码 / 补码
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

/* ---------- 工具函数 ---------- */

function binAddTrunc(a: string, b: string, len: number): { sum: string; carry: number } {
  const aa = a.padStart(len, '0');
  const bb = b.padStart(len, '0');
  let carry = 0;
  const result: string[] = [];
  for (let i = len - 1; i >= 0; i--) {
    const s = parseInt(aa[i], 2) + parseInt(bb[i], 2) + carry;
    result.unshift(String(s & 1));
    carry = s >> 1;
  }
  return { sum: result.join(''), carry };
}

function shiftRight(bin: string, n: number): { result: string; guard: string } {
  if (n <= 0) return { result: bin, guard: '' };
  const signBit = bin[0];
  const guard = bin.slice(-n);
  const body = bin.slice(0, -n);
  return { result: signBit.repeat(n) + body, guard };
}

function twosComplement(bin: string): string {
  return binAddTrunc(bin.split('').map(b => b === '0' ? '1' : '0').join(''), '1', bin.length).sum;
}

function decToOffsetBinary(value: number, bits: number): string {
  return (value + (1 << (bits - 1))).toString(2).padStart(bits, '0');
}

function offsetToValue(bin: string): number {
  return parseInt(bin, 2) - (1 << (bin.length - 1));
}

function fmtDoubleSign(bin: string): string {
  if (bin.length < 2) return bin;
  return bin.slice(0, 2) + ',' + bin.slice(2);
}

function binToHex(bin: string): string {
  const clean = bin.replace(',', '');
  const p = clean.padStart(Math.ceil(clean.length / 4) * 4, "0");
  let h = '';
  for (let i = 0; i < p.length; i += 4) h += parseInt(p.slice(i, i+4), 2).toString(16).toUpperCase();
  return h;
}

function expToValue(bin: string, fmt: string): number {
  const mag = bin.slice(2);
  if (fmt === '移码') return offsetToValue(mag);
  // 补码: sign extent to 32bits
  return parseInt(bin, 2) - (bin[0] === '1' ? (1 << bin.length) : 0);
}

function valueToExp(val: number, bits: number, fmt: string): string {
  if (fmt === '移码') return '00' + decToOffsetBinary(val, bits);
  if (val >= 0) return "00" + val.toString(2).padStart(bits, "0");
  const abs = (-val).toString(2).padStart(bits, "0");
  return '11' + twosComplement('0' + abs).slice(1);
}

function mantSignBit(bin: string): number {
  // 双符号位首位即符号：0 正 1 负（原码 / 补码一致，数值位均为 12 位）
  return bin[0] === '1' ? -1 : 1;
}

function mantToAbs(bin: string, fmt: string): string {
  // 返回正数的双符号位形式 "00" + 12 位数值
  if (fmt === '补码') return bin[0] === '1' ? twosComplement(bin) : bin;
  // 原码：符号位于双符号位，数值位为 bin[2:]（12 位），将符号位置 00
  return '00' + bin.slice(2);
}

/* 原码尾数 <-> 补码尾数（双符号位 + 12 位数值） */
function mantToTwos(bin: string): string {
  if (bin[0] === '0') return bin;
  return twosComplement('00' + bin.slice(2));
}
function mantFromTwos(bin: string): string {
  if (bin[0] === '0') return bin;
  return '11' + twosComplement(bin).slice(2);
}


/* ========== 主引擎 ========== */

export function computeFloatArithmetic(
  x: FloatOperand, y: FloatOperand,
  operation: FloatOperation,
  config: FloatCalcConfig = DEFAULT_CONFIG
): FloatCalcResult {
  const steps: { label?: string; text: string; highlight?: boolean }[] = [];
  const eBits = config.exponentBits, mBits = config.mantissaBits;
  const tE = 2 + eBits, tM = 2 + mBits;
  // 规范化输入：去掉逗号、全角逗号、空白等分隔符，用户无需手动输入逗号
  const stripSep = (s: string) => s.replace(/[,，\s_]/g, '');
  const xM = stripSep(x.mantissa);
  const yM = stripSep(y.mantissa);
  const xE = stripSep(x.exponent);
  const yE = stripSep(y.exponent);
  if (!/^[01]+$/.test(xM) || !/^[01]+$/.test(yM)) throw new Error("尾数只能包含 0/1（可含逗号分隔）");
  if (!/^[01]+$/.test(xE) || !/^[01]+$/.test(yE)) throw new Error("阶码只能包含 0/1（可含逗号分隔）");
  if (xM.length !== tM || yM.length !== tM) throw new Error("尾数须为 " + tM + " 位（含双符号位）");
  if (xE.length !== tE || yE.length !== tE) throw new Error("阶码须为 " + tE + " 位（含双符号位）");
  const ef = config.exponentFormat, mf = config.mantissaFormat;
  const fm = fmtDoubleSign, fe = fmtDoubleSign;
  const opSym: Record<string, string> = {"+": "+", "-": "-", "*": "×", "/": "÷"};
  const sym = opSym[operation];
  steps.push({ label: "初始", text: "格式: 阶码=" + ef + " 尾数=" + mf + "  运算 Z = X " + sym + " Y" });
  steps.push({ text: "    [X]浮= " + fm(xM) + " " + fe(xE) });
  steps.push({ text: "    [Y]浮= " + fm(yM) + " " + fe(yE) });
  // 原码尾数统一转为补码参与运算（阶码、对阶、规格化均在补码下进行），结果再转回原码
  let axM = xM, ayM = yM, aMf = mf;
  if (mf === '原码') {
    axM = mantToTwos(xM); ayM = mantToTwos(yM); aMf = '补码';
    steps.push({ label: "转换", text: "原码尾数转为补码参与运算：" });
    steps.push({ text: "    [X]补= " + fm(axM) });
    steps.push({ text: "    [Y]补= " + fm(ayM) });
  }
  // Dispatch to operation-specific handler
  let mFinal: string, eFinal: string;
  if (operation === "+" || operation === "-") {
    const r = doAddSub(axM, xE, ayM, yE, operation, eBits, mBits, steps, fm, fe, ef, aMf, config.rounding);
    mFinal = r.mant; eFinal = r.exp;
  } else if (operation === "*") {
    const r = doMultiply(axM, xE, ayM, yE, eBits, mBits, steps, fm, fe, ef, aMf, config.rounding);
    mFinal = r.mant; eFinal = r.exp;
  } else {
    const r = doDivide(axM, xE, ayM, yE, eBits, mBits, steps, fm, fe, ef, aMf, config.rounding);
    mFinal = r.mant; eFinal = r.exp;
  }
  if (mf === '原码') {
    mFinal = mantFromTwos(mFinal);
    steps.push({ label: "转换", text: "补码结果转回原码：[Mz]原= " + fm(mFinal) });
  }
  const resultMantissa = fm(mFinal);
  const resultExponent = fe(eFinal);
  const resultHex = binToHex(mFinal + eFinal);
  steps.push({ label: "结果", text: "得：[X" + sym + "Y]浮 = " + resultMantissa + " " + resultExponent, highlight: true });
  steps.push({ text: "（十六进制编码：" + resultHex + "H）" });
  return { x, y, operation, resultMantissa, resultExponent, resultHex, steps };
}

/* ---------- 加减法 ---------- */
function doAddSub(
  xM: string, xE: string, yM: string, yE: string,
  op: '+' | '-', eBits: number, mBits: number,
  steps: { label?: string; text: string; highlight?: boolean }[],
  fm: (b: string) => string, fe: (b: string) => string,
  ef: string, mf: string, rounding: string
): { mant: string; exp: string } {
  const tM = 2 + mBits;
  const xEv = expToValue(xE, ef), yEv = expToValue(yE, ef);

  steps.push({ label: "①对阶", text: "①对阶：△E = Ex - Ey", highlight: true });
  const deltaE = xEv - yEv;
  steps.push({ text: "△E = " + xEv + " - " + yEv + " = " + deltaE });

  let sa = 0, guard = "";
  if (deltaE > 0) {
    sa = deltaE; guard = shiftRight(yM, sa).guard;
    steps.push({ text: "X阶大，Y尾数右移 " + sa + " 位，Ey 加 " + sa });
  } else if (deltaE < 0) {
    sa = -deltaE; guard = shiftRight(xM, sa).guard;
    steps.push({ text: "Y阶大，X尾数右移 " + sa + " 位，Ex 加 " + sa });
  } else {
    steps.push({ text: "阶差为 0，无需对阶" });
  }

  let aXM = xM, aYM = yM, aXE = xE, aYE = yE;
  if (deltaE > 0) {
    aYM = shiftRight(yM, sa).result;
    aYE = valueToExp(yEv + sa, eBits, ef);
  } else if (deltaE < 0) {
    aXM = shiftRight(xM, sa).result;
    aXE = valueToExp(xEv + sa, eBits, ef);
  }

  const showGuard = guard ? "(" + guard + ")" : "";
  steps.push({ text: "    [X]浮= " + fm(aXM) + "  " + fe(aXE) });
  steps.push({ text: "    [Y]浮= " + fm(aYM) + showGuard + "  " + fe(aYE) });

  const act = op === "-" ? "减" : "加";
  steps.push({ label: "②尾数相" + act, text: "②尾数相" + act + "：", highlight: true });

  let sm: string;
  if (op === "-") {
    sm = twosComplement(aYM);
    steps.push({ text: "    [Mz]补 = [Mx-My]补 = [Mx]补 + [-My]补" });
    steps.push({ text: "    [-My]补 = " + fm(sm) + (guard ? "(" + guard + ")" : "") });

  } else {
    sm = aYM;
    steps.push({ text: "    [Mz]补 = [Mx+My]补 = [Mx]补 + [My]补" });
  }

  const aF = aXM + (op === "-" && guard ? guard : "");
  const bF = sm + (op === "-" && guard ? guard : "");
  const maxL = Math.max(aF.length, bF.length);
  const aa = aF.padEnd(maxL, "0"), bb = bF.padEnd(maxL, "0");
  const gA = op === "-" && guard ? "(" + aa.slice(tM) + ")" : "";
  const gB = op === "-" && guard ? "(" + bb.slice(tM) + ")" : "";
  steps.push({ text: "        " + fm(aa.slice(0, tM)) + gA });
  steps.push({ text: "    +   " + fm(bb.slice(0, tM)) + gB });
  steps.push({ text: "    ------------------" });

  const addRes = binAddTrunc(aa, bb, maxL).sum;
  const mantRes = addRes.slice(0, tM);
  const extra = addRes.slice(tM);
  steps.push({ text: "        " + fm(mantRes) + (extra ? "(" + extra + ")" : "") });

  const msb = mantRes.slice(0, 2);
  const ov = msb === "01" || msb === "10";
  steps.push({ text: "双符号位 = " + msb + (ov ? "，溢出，需右规" : "，无溢出") });

  return normalize(mantRes, deltaE >= 0 ? aXE : aYE, ov, eBits, mBits, guard,
    "0舍1入" + "X" /* using config rounding */, steps, fm, fe, ef, rounding);
}

/* ---------- 规格化 + 舍入 ---------- */
function normalize(
  mant: string, exp: string, hasOv: boolean,
  eBits: number, mBits: number, guard: string,
  opLabel: string,
  steps: { label?: string; text: string; highlight?: boolean }[],
  fm: (b: string) => string, fe: (b: string) => string,
  ef: string, rounding: string
): { mant: string; exp: string } {
  const tM = 2 + mBits;
  let nM = mant, nE = exp;

  steps.push({ label: "③规格化", text: "③结果规格化：", highlight: true });

  if (hasOv) {
    nM = shiftRight(nM, 1).result;
    nE = valueToExp(expToValue(nE, ef) + 1, eBits, ef);
    steps.push({ text: "有溢出，右规 1 位（Mz 右移 1 位，阶码 +1）" });
  } else {
    steps.push({ text: "无溢出，无需规格化" });
  }

  steps.push({ text: "    [Mz]补 = " + fm(nM) });
  steps.push({ text: "    [Ez]移 = " + fe(nE) });
  const maxE = (1 << (eBits - 1)) - 1;
  const minE = -(1 << (eBits - 1));
  const eVal = expToValue(nE, ef);
  if (eVal > maxE) steps.push({ text: "阶上溢！", highlight: true });
  else if (eVal < minE) steps.push({ text: "阶下溢！", highlight: true });
  else steps.push({ text: "阶码在合法范围内，无溢出" });

  /* ---------- 舍入 ---------- */
  steps.push({ label: "④舍入", text: "④舍入处理（" + rounding + "）：", highlight: true });
  let fM = nM;

  if (rounding === "0舍1入") {
    if (guard && guard[0] === "1") {
      fM = binAddTrunc(fM, "1".padStart(tM, "0").replace(/^0+/, "") || "1", tM).sum;
      steps.push({ text: "保护位最高位为 1，[Mz]补 入 1" });
      steps.push({ text: "    [Mz]补 = " + fm(fM) });
      const ns = fM.slice(0, 2);
      if (ns === "01" || ns === "10") {
        fM = shiftRight(fM, 1).result;
        nE = valueToExp(expToValue(nE, ef) + 1, eBits, ef);
        steps.push({ text: "舍入后再次溢出，右规 1 位，阶码 +1" });
        steps.push({ text: "    [Mz]补 = " + fm(fM) });
        steps.push({ text: "    [Ez] = " + fe(nE) });
      }
    } else {
      steps.push({ text: "保护位最高位为 0，无需舍入" });
    }
  } else {
    if (guard && guard.includes("1")) {
      fM = fM.slice(0, -1) + "1";
      steps.push({ text: "恒置 1 法：尾数最低位置 1" });
    } else {
      steps.push({ text: "保护位全 0，无需舍入" });
    }
  }
  return { mant: fM, exp: nE };
}

/* ---------- 乘法 ---------- */
function doMultiply(
  xM: string, xE: string, yM: string, yE: string,
  eBits: number, mBits: number,
  steps: { label?: string; text: string; highlight?: boolean }[],
  fm: (b: string) => string, fe: (b: string) => string,
  ef: string, mf: string, rounding: string
): { mant: string; exp: string } {
  const tM = 2 + mBits;
  steps.push({ label: "①阶码相加", text: "①乘法：阶码相加 Ez = Ex + Ey", highlight: true });

  const xEv = expToValue(xE, ef), yEv = expToValue(yE, ef);
  const eSum = xEv + yEv;
  steps.push({ text: "Ez = " + xEv + " + " + yEv + " = " + eSum });

  steps.push({ label: "②尾数相乘", text: "②尾数相乘（绝对值相乘）：", highlight: true });

  const xAbs = mantToAbs(xM, mf);
  const yAbs = mantToAbs(yM, mf);
  const xMag = xAbs.slice(2); // 12 位数值
  const yMag = yAbs.slice(2);
  const xNum = parseInt(xMag, 2), yNum = parseInt(yMag, 2);
  const prod = xNum * yNum; // 最多 24 位，表示 24 位小数 prod/2^24

  const resSign = mantSignBit(xM) * mantSignBit(yM); // +1 / -1

  steps.push({ text: "|Mx| = " + xMag + " = " + xNum + ", |My| = " + yMag + " = " + yNum });
  steps.push({ text: "乘积绝对值 = " + prod + " (二进制: " + prod.toString(2) + ")" });
  steps.push({ text: "符号: " + (resSign >= 0 ? "+" : "-") });

  /* ③规格化：乘积为 24 位小数。两规格化尾数之积 ∈ [0.25, 1)。
     prod ∈ [2^22, 2^24)：≥ 2^23 即 0.1xxx 已规格化；否则 0.01xxx 左移 1 位，阶码 -1。 */
  steps.push({ label: "③规格化", text: "③结果规格化：", highlight: true });
  let mag12: number, guard: string, eFinal: number;
  if (prod >= (1 << (2 * mBits - 1))) {
    // 24 位，已规格化，取高 12 位
    mag12 = prod >> mBits;
    guard = ((prod >> (mBits - 1)) & 1) ? "1" : "0";
    eFinal = eSum;
    steps.push({ text: "乘积 ≥ 0.5，已规格化，取高 12 位" });
  } else {
    // 23 位，左移 1 位规格化，阶码 -1
    mag12 = prod >> (mBits - 1);
    guard = ((prod >> (mBits - 2)) & 1) ? "1" : "0";
    eFinal = eSum - 1;
    steps.push({ text: "乘积 < 0.5，左移 1 位规格化，阶码 -1 = " + eFinal });
  }
  const magBin = mag12.toString(2).padStart(mBits, "0");
  const prodMant = resSign >= 0 ? "00" + magBin : twosComplement("00" + magBin);
  steps.push({ text: "    [Mz]补 = " + fm(prodMant) + "  保护位(" + guard + ")" });

  /* ④舍入 */
  steps.push({ label: "④舍入", text: "④舍入处理（" + rounding + "）：", highlight: true });
  let fM = prodMant;
  if (rounding === "0舍1入") {
    if (guard === "1") {
      fM = binAddTrunc(fM, "1", tM).sum;
      steps.push({ text: "保护位为 1，入 1" });
      const ns = fM.slice(0, 2);
      if (ns === "01" || ns === "10") {
        fM = shiftRight(fM, 1).result;
        eFinal += 1;
        steps.push({ text: "舍入后溢出，右规 1 位，阶码 +1 = " + eFinal });
      }
    } else {
      steps.push({ text: "保护位为 0，无需舍入" });
    }
  } else {
    if (guard.includes("1")) {
      fM = fM.slice(0, -1) + "1";
      steps.push({ text: "恒置 1 法" });
    } else {
      steps.push({ text: "保护位为 0，无需舍入" });
    }
  }
  const nExp = valueToExp(eFinal, eBits, ef);
  steps.push({ text: "    [Mz] = " + fm(fM) + "  [Ez] = " + fe(nExp) });
  return { mant: fM, exp: nExp };
}

/* ---------- 除法 ---------- */
function doDivide(
  xM: string, xE: string, yM: string, yE: string,
  eBits: number, mBits: number,
  steps: { label?: string; text: string; highlight?: boolean }[],
  fm: (b: string) => string, fe: (b: string) => string,
  ef: string, mf: string, rounding: string
): { mant: string; exp: string } {
  const tM = 2 + mBits;
  steps.push({ label: "①阶码相减", text: "①除法：阶码相减 Ez = Ex - Ey", highlight: true });

  const xEv = expToValue(xE, ef), yEv = expToValue(yE, ef);
  const eDiff = xEv - yEv;
  steps.push({ text: "Ez = " + xEv + " - " + yEv + " = " + eDiff });

  steps.push({ label: "②尾数相除", text: "②尾数相除（绝对值相除）：", highlight: true });

  const xAbs = mantToAbs(xM, mf);
  const yAbs = mantToAbs(yM, mf);
  const xMag = xAbs.slice(2);
  const yMag = yAbs.slice(2);
  const xNum = parseInt(xMag, 2);
  const yNum = parseInt(yMag, 2);

  if (yNum === 0) throw new Error("除数为零");

  const resSign = mantSignBit(xM) * mantSignBit(yM); // +1 / -1

  // 被除数左移 mBits 位以保留精度，商为 12 位（若 ≥ 2^mBits 则需右规）
  const scaledX = xNum * (1 << mBits);
  const quot = Math.floor(scaledX / yNum);
  const rem = scaledX % yNum;

  steps.push({ text: "|Mx| = " + xMag + " = " + xNum + ", |My| = " + yMag + " = " + yNum });
  steps.push({ text: "被除数左移 " + mBits + " 位 = " + scaledX });
  steps.push({ text: "商 = " + quot + " (二进制: " + quot.toString(2) + ")" });
  steps.push({ text: "余数 = " + rem });
  steps.push({ text: "符号: " + (resSign >= 0 ? "+" : "-") });

  /* ③规格化：两规格化尾数之商 ∈ (0.5, 2)。
     quot ∈ [2^11, 2^13)：≥ 2^12 即商 ≥ 1.0，右规 1 位；否则已规格化。 */
  steps.push({ label: "③规格化", text: "③结果规格化：", highlight: true });
  let mag12: number, guard: string, eFinal: number;
  if (quot >= (1 << mBits)) {
    // 13 位，商 ≥ 1，右规 1 位，阶码 +1
    mag12 = quot >> 1;
    guard = (quot & 1) ? "1" : "0";
    eFinal = eDiff + 1;
    steps.push({ text: "商 ≥ 1，右规 1 位，阶码 +1 = " + eFinal });
  } else {
    mag12 = quot;
    guard = rem > 0 ? "1" : "0";
    eFinal = eDiff;
    steps.push({ text: "商已规格化" });
  }
  const magBin = mag12.toString(2).padStart(mBits, "0");
  const quotMant = resSign >= 0 ? "00" + magBin : twosComplement("00" + magBin);
  steps.push({ text: "    [Mz]补 = " + fm(quotMant) + "  保护位(" + guard + ")" });

  /* ④舍入 */
  steps.push({ label: "④舍入", text: "④舍入处理（" + rounding + "）：", highlight: true });
  let fM = quotMant;
  if (rounding === "0舍1入") {
    if (guard === "1") {
      fM = binAddTrunc(fM, "1", tM).sum;
      steps.push({ text: "保护位为 1，入 1" });
      const ns = fM.slice(0, 2);
      if (ns === "01" || ns === "10") {
        fM = shiftRight(fM, 1).result;
        eFinal += 1;
        steps.push({ text: "舍入后溢出，右规 1 位，阶码 +1 = " + eFinal });
      }
    } else {
      steps.push({ text: "保护位为 0，无需舍入" });
    }
  } else {
    if (guard.includes("1")) {
      fM = fM.slice(0, -1) + "1";
      steps.push({ text: "恒置 1 法" });
    } else {
      steps.push({ text: "保护位为 0，无需舍入" });
    }
  }
  const nExp = valueToExp(eFinal, eBits, ef);
  steps.push({ text: "    [Mz] = " + fm(fM) + "  [Ez] = " + fe(nExp) });
  return { mant: fM, exp: nExp };
}
