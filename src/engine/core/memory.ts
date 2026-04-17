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
    this.checkRange(address, 2);
    this.checkAlignment(address, 2, 'halfword');
    return this.data[address] | (this.data[address + 1] << 8);
  }

  /**
   * 读取字 (4 字节)
   */
  readWord(address: number): number {
    this.checkRange(address, 4);
    this.checkAlignment(address, 4, 'word');
    return (
      this.data[address] |
      (this.data[address + 1] << 8) |
      (this.data[address + 2] << 16) |
      (this.data[address + 3] << 24)
    ) | 0;
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
    this.checkRange(address, 2);
    this.checkAlignment(address, 2, 'halfword');
    this.data[address] = value & 0xFF;
    this.data[address + 1] = (value >>> 8) & 0xFF;
  }

  /**
   * 写入字 (4 字节)
   */
  writeWord(address: number, value: number): void {
    this.checkRange(address, 4);
    this.checkAlignment(address, 4, 'word');
    this.data[address] = value & 0xFF;
    this.data[address + 1] = (value >>> 8) & 0xFF;
    this.data[address + 2] = (value >>> 16) & 0xFF;
    this.data[address + 3] = (value >>> 24) & 0xFF;
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

  private checkRange(address: number, byteLength: number): void {
    if (address < 0 || address + byteLength > this.size) {
      throw new Error(`Memory access out of bounds: ${address}`);
    }
  }

  private checkAlignment(address: number, alignment: number, type: 'halfword' | 'word'): void {
    if (address % alignment !== 0) {
      throw new Error(`Unaligned ${type} address: ${address}`);
    }
  }
}
