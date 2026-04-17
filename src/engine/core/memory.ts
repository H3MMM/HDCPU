/**
 * 存储器模块
 * 支持字节/半字/字的读写
 */
export class Memory {
  private data: Uint8Array;
  private size: number;

  constructor(size: number = 4096) {
    this.size = size;
    this.data = new Uint8Array(size);
  }

  /**
   * 读取字节
   */
  readByte(address: number): number {
    this.checkAddress(address);
    return this.data[address];
  }

  /**
   * 读取半字 (2 字节)
   */
  readHalfWord(address: number): number {
    this.checkAddress(address);
    // TODO: 实现小端序读取
    return 0;
  }

  /**
   * 读取字 (4 字节)
   */
  readWord(address: number): number {
    this.checkAddress(address);
    // TODO: 实现小端序读取
    return 0;
  }

  /**
   * 写入字节
   */
  writeByte(address: number, value: number): void {
    this.checkAddress(address);
    this.data[address] = value & 0xFF;
  }

  /**
   * 写入半字 (2 字节)
   */
  writeHalfWord(address: number, value: number): void {
    this.checkAddress(address);
    // TODO: 实现小端序写入
  }

  /**
   * 写入字 (4 字节)
   */
  writeWord(address: number, value: number): void {
    this.checkAddress(address);
    // TODO: 实现小端序写入
  }

  /**
   * 重置存储器
   */
  reset(): void {
    this.data.fill(0);
  }

  /**
   * 加载数据到存储器
   */
  load(data: Uint8Array, offset: number = 0): void {
    this.data.set(data, offset);
  }

  private checkAddress(address: number): void {
    if (address < 0 || address >= this.size) {
      throw new Error(`Memory address out of bounds: ${address}`);
    }
  }
}
