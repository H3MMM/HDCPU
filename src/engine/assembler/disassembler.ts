import { Decoder } from '../core/decoder';

/**
 * 反汇编器
 * 将单条机器码转换为汇编字符串
 */
export class Disassembler {
  private readonly decoder = new Decoder();

  disassemble(machineCode: number): string {
    return this.decoder.decode(machineCode).asmString;
  }
}
