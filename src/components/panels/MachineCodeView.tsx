import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore, type MachineCodeRow } from '../../store/cpu-store';
import type { DecodedInstruction, InstructionFormat } from '../../types';

interface EncodingFieldTemplate {
  bitRange: string;
  field: string;
  high: number;
  low: number;
}

interface EncodingField extends EncodingFieldTemplate {
  bits: string;
}

interface InstructionDetailField {
  label: string;
  value: string;
}

const INSTRUCTION_ENCODING_FIELDS: Record<InstructionFormat, readonly EncodingFieldTemplate[]> = {
  R: [
    { bitRange: 'I[31:25]', field: 'funct7', high: 31, low: 25 },
    { bitRange: 'I[24:20]', field: 'rs2', high: 24, low: 20 },
    { bitRange: 'I[19:15]', field: 'rs1', high: 19, low: 15 },
    { bitRange: 'I[14:12]', field: 'funct3', high: 14, low: 12 },
    { bitRange: 'I[11:7]', field: 'rd', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
  I: [
    { bitRange: 'I[31:20]', field: 'imm12', high: 31, low: 20 },
    { bitRange: 'I[19:15]', field: 'rs1', high: 19, low: 15 },
    { bitRange: 'I[14:12]', field: 'funct3', high: 14, low: 12 },
    { bitRange: 'I[11:7]', field: 'rd', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
  S: [
    { bitRange: 'I[31:25]', field: 'imm[11:5]', high: 31, low: 25 },
    { bitRange: 'I[24:20]', field: 'rs2', high: 24, low: 20 },
    { bitRange: 'I[19:15]', field: 'rs1', high: 19, low: 15 },
    { bitRange: 'I[14:12]', field: 'funct3', high: 14, low: 12 },
    { bitRange: 'I[11:7]', field: 'imm[4:0]', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
  B: [
    { bitRange: 'I[31:25]', field: 'imm[12,10:5]', high: 31, low: 25 },
    { bitRange: 'I[24:20]', field: 'rs2', high: 24, low: 20 },
    { bitRange: 'I[19:15]', field: 'rs1', high: 19, low: 15 },
    { bitRange: 'I[14:12]', field: 'funct3', high: 14, low: 12 },
    { bitRange: 'I[11:7]', field: 'imm[4:1,11]', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
  U: [
    { bitRange: 'I[31:12]', field: 'imm20', high: 31, low: 12 },
    { bitRange: 'I[11:7]', field: 'rd', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
  J: [
    { bitRange: 'I[31:12]', field: 'imm[20,10:1,11,19:12]', high: 31, low: 12 },
    { bitRange: 'I[11:7]', field: 'rd', high: 11, low: 7 },
    { bitRange: 'I[6:0]', field: 'opcode', high: 6, low: 0 },
  ],
};

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatAddress(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatBinaryWord(value: number): string {
  return (value >>> 0).toString(2).padStart(32, '0');
}

function formatBinaryRows(value: number): string[] {
  const binary = formatBinaryWord(value);
  return [binary.slice(0, 16), binary.slice(16)].map((half) => half.match(/.{1,4}/g)?.join(' ') ?? half);
}

function formatInstructionType(format: InstructionFormat | undefined): string {
  return format ? `${format} 型` : '无';
}

function readInstructionBits(binary: string, high: number, low: number): string {
  return binary.slice(31 - high, 32 - low);
}

function formatBits(value: number, width: number): string {
  return (value >>> 0).toString(2).padStart(32, '0').slice(-width);
}

function getImmediateBitWidth(format: InstructionFormat): number | null {
  switch (format) {
    case 'I':
    case 'S':
      return 12;
    case 'B':
      return 13;
    case 'U':
      return 20;
    case 'J':
      return 21;
    case 'R':
      return null;
    default:
      return null;
  }
}

function formatImmediateValue(instruction: DecodedInstruction): number {
  return instruction.format === 'U' ? instruction.immediate >> 12 : instruction.immediate;
}

function compact<T>(items: readonly (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

function getInstructionMnemonic(instruction: DecodedInstruction): string {
  return instruction.asmString.match(/^[a-z0-9]+/i)?.[0] ?? 'unknown';
}

function immediateField(instruction: DecodedInstruction): InstructionDetailField | null {
  const width = getImmediateBitWidth(instruction.format);
  if (width === null) {
    return null;
  }

  const value = formatImmediateValue(instruction);
  return {
    label: 'imm',
    value: `${value}(${formatBits(value, width)})`,
  };
}

function registerField(label: 'rd' | 'rs1' | 'rs2', index: number): InstructionDetailField {
  return {
    label,
    value: `x${index}(${formatBits(index, 5)})`,
  };
}

function binaryField(label: 'funct3' | 'funct7', value: number, width: number): InstructionDetailField {
  return {
    label,
    value: formatBits(value, width),
  };
}

function opcodeField(instruction: DecodedInstruction): InstructionDetailField {
  return {
    label: 'opcode',
    value: `${getInstructionMnemonic(instruction)}(${formatBits(instruction.opcode, 7)})`,
  };
}

function getInstructionDetailFields(instruction: DecodedInstruction | null): InstructionDetailField[] {
  if (!instruction) {
    return [];
  }

  switch (instruction.format) {
    case 'R':
      return [
        binaryField('funct7', instruction.funct7, 7),
        registerField('rs2', instruction.rs2),
        registerField('rs1', instruction.rs1),
        binaryField('funct3', instruction.funct3, 3),
        registerField('rd', instruction.rd),
        opcodeField(instruction),
      ];
    case 'I':
      return compact([
        immediateField(instruction),
        registerField('rs1', instruction.rs1),
        binaryField('funct3', instruction.funct3, 3),
        registerField('rd', instruction.rd),
        opcodeField(instruction),
      ]);
    case 'S':
      return compact([
        immediateField(instruction),
        registerField('rs2', instruction.rs2),
        registerField('rs1', instruction.rs1),
        binaryField('funct3', instruction.funct3, 3),
        opcodeField(instruction),
      ]);
    case 'B':
      return compact([
        immediateField(instruction),
        registerField('rs2', instruction.rs2),
        registerField('rs1', instruction.rs1),
        binaryField('funct3', instruction.funct3, 3),
        opcodeField(instruction),
      ]);
    case 'U':
      return compact([
        immediateField(instruction),
        registerField('rd', instruction.rd),
        opcodeField(instruction),
      ]);
    case 'J':
      return compact([
        immediateField(instruction),
        registerField('rd', instruction.rd),
        opcodeField(instruction),
      ]);
    default:
      return [];
  }
}

function getInstructionEncodingFields(format: InstructionFormat | undefined, word: number | null): EncodingField[] {
  if (!format || word === null) {
    return [];
  }

  const binary = formatBinaryWord(word);
  return INSTRUCTION_ENCODING_FIELDS[format].map((field) => ({
    ...field,
    bits: readInstructionBits(binary, field.high, field.low),
  }));
}

interface MachineCodeTableRowProps {
  row: MachineCodeRow;
}

const MachineCodeTableRow = memo(function MachineCodeTableRow({ row }: MachineCodeTableRowProps) {
  return (
    <tr className={row.current ? 'machine-row machine-row--current' : 'machine-row'}>
      <td className="machine-address">{formatAddress(row.address)}</td>
      <td className="machine-hex">{formatWord(row.machineCode)}</td>
      <td className="machine-assembly">{row.assembly}</td>
    </tr>
  );
});

export const MachineCodeView = memo(function MachineCodeView() {
  const {
    machineCodeRows,
    assembleErrors,
    currentInstruction,
    currentMachineWord,
  } = useCPUStore(
    useShallow((state) => ({
      machineCodeRows: state.machineCodeRows,
      assembleErrors: state.assembleErrors,
      currentInstruction: state.currentInstruction,
      currentMachineWord: state.currentMachineWord,
    }))
  );

  const handleExport = () => {
    const lines = machineCodeRows.map((row) => formatWord(row.machineCode));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'machine-code.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const binaryRows = useMemo(
    () => currentMachineWord === null ? [] : formatBinaryRows(currentMachineWord),
    [currentMachineWord]
  );
  const encodingFields = useMemo(
    () => getInstructionEncodingFields(currentInstruction?.format, currentMachineWord),
    [currentInstruction?.format, currentMachineWord]
  );
  const detailFields = useMemo(
    () => getInstructionDetailFields(currentInstruction),
    [currentInstruction]
  );

  return (
    <section className="panel-card panel-card--machine">
      <div className="panel-header">
        <div>
          <p className="eyebrow">机器码</p>
          <h2>机器码视图</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <span className="editor-pill">{machineCodeRows.length} 条指令</span>
          {machineCodeRows.length > 0 && (
            <button className="editor-pill editor-pill--action" onClick={handleExport}>
              导出当前程序机器码
            </button>
          )}
        </div>
      </div>
      <br></br>
      <div className="machine-summary-grid">
        <article className="metric-card machine-summary-card--binary">
          <span className="metric-label">当前二进制</span>
          {currentMachineWord === null ? (
            <strong>无</strong>
          ) : (
            <strong className="machine-binary-block">
              {binaryRows.map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </strong>
          )}
        </article>
        <article className="metric-card machine-summary-card--compact">
          <span className="metric-label">当前机器字</span>
          <strong>{currentMachineWord === null ? '无' : formatWord(currentMachineWord)}</strong>
        </article>
        <article className="metric-card machine-summary-card--compact">
          <span className="metric-label">当前译码</span>
          <strong>{currentInstruction?.asmString ?? '未译码'}</strong>
        </article>
        <article className="metric-card machine-summary-card--compact">
          <span className="metric-label">当前指令类型</span>
          <strong>{formatInstructionType(currentInstruction?.format)}</strong>
        </article>
        <article className="metric-card machine-encoding-card">
          <span className="metric-label">当前指令编码格式</span>
          {encodingFields.length === 0 ? (
            <strong>无</strong>
          ) : (
            <div className="instruction-format-table-shell">
              <table className="instruction-format-table">
                <thead>
                  <tr>
                    {encodingFields.map((field) => (
                      <th key={field.bitRange}>{field.bitRange}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {encodingFields.map((field) => (
                      <td key={field.bitRange}>{field.field}</td>
                    ))}
                  </tr>
                  <tr>
                    {encodingFields.map((field) => (
                      <td key={`${field.bitRange}-bits`}>{field.bits}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>

      <div className="machine-table-shell machine-table-shell--compact">
        <div className="machine-table-layout">
          <table className="machine-table machine-table--compact">
            <thead>
              <tr>
                <th>地址</th>
                <th>机器码</th>
                <th>汇编</th>
              </tr>
            </thead>
            <tbody>
              {machineCodeRows.map((row) => (
                <MachineCodeTableRow key={row.index} row={row} />
              ))}
            </tbody>
          </table>

          <aside className="machine-fields-panel" aria-label="当前指令字段拆解">
            <div className="machine-fields-panel__head">字段拆解</div>
            <div className="machine-fields-panel__body">
              <span className="metric-label">当前指令字段</span>
              {detailFields.length === 0 ? (
                <p className="machine-fields-empty">暂无字段拆解</p>
              ) : (
                <table className="machine-field-table">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailFields.map((field) => (
                      <tr key={field.label}>
                        <td>{field.label}</td>
                        <td>{field.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      </div>

      {assembleErrors.length > 0 ? (
        <div className="assembler-error-list" role="status">
          {assembleErrors.map((error, index) => (
            <div key={`${error.line}-${error.column}-${index}`} className="assembler-error-item">
              <strong>
                第 {error.line} 行 / 第 {error.column} 列
              </strong>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
});
