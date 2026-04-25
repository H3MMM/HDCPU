import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import type { InstructionFormat } from '../../types';

const INSTRUCTION_ENCODING_FORMATS: Record<InstructionFormat, string> = {
  R: 'funct7[31:25] | rs2[24:20] | rs1[19:15] | funct3[14:12] | rd[11:7] | opcode[6:0]',
  I: 'imm[11:0][31:20] | rs1[19:15] | funct3[14:12] | rd[11:7] | opcode[6:0]',
  S: 'imm[11:5][31:25] | rs2[24:20] | rs1[19:15] | funct3[14:12] | imm[4:0][11:7] | opcode[6:0]',
  B: 'imm[12|10:5][31:25] | rs2[24:20] | rs1[19:15] | funct3[14:12] | imm[4:1|11][11:7] | opcode[6:0]',
  U: 'imm[31:12] | rd[11:7] | opcode[6:0]',
  J: 'imm[20|10:1|11|19:12] | rd[11:7] | opcode[6:0]',
};

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatAddress(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

function formatBinaryRows(value: number): string[] {
  const binary = (value >>> 0).toString(2).padStart(32, '0');
  return [binary.slice(0, 16), binary.slice(16)].map((half) => half.match(/.{1,4}/g)?.join(' ') ?? half);
}

function formatInstructionType(format: InstructionFormat | undefined): string {
  return format ? `${format} 型` : '无';
}

function formatInstructionEncoding(format: InstructionFormat | undefined): string {
  return format ? INSTRUCTION_ENCODING_FORMATS[format] : '无';
}

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

  return (
    <section className="panel-card panel-card--machine">
      <div className="panel-header">
        <div>
          <p className="eyebrow">机器码</p>
          <h2>机器码视图</h2>
        </div>
        <span className="editor-pill">{machineCodeRows.length} 条指令</span>
      </div>
      <br></br>
      <div className="machine-summary-grid">
        <article className="metric-card">
          <div className="machine-metric-stack">
            <div className="machine-metric-item">
              <span className="metric-label">当前机器字</span>
              <strong>{currentMachineWord === null ? '无' : formatWord(currentMachineWord)}</strong>
            </div>
            <div className="machine-metric-item">
              <span className="metric-label">当前译码</span>
              <strong>{currentInstruction?.asmString ?? '未译码'}</strong>
            </div>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前二进制</span>
          {currentMachineWord === null ? (
            <strong>无</strong>
          ) : (
            <strong className="machine-binary-block">
              {formatBinaryRows(currentMachineWord).map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </strong>
          )}
        </article>
        <article className="metric-card">
          <div className="machine-metric-stack">
            <div className="machine-metric-item">
              <span className="metric-label">当前指令类型</span>
              <strong>{formatInstructionType(currentInstruction?.format)}</strong>
            </div>
            <div className="machine-metric-item">
              <span className="metric-label">当前指令编码格式</span>
              <strong className="machine-encoding-value">
                {formatInstructionEncoding(currentInstruction?.format)}
              </strong>
            </div>
          </div>
        </article>
      </div>

      <div className="machine-table-shell machine-table-shell--compact">
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
              <tr key={row.index} className={row.current ? 'machine-row machine-row--current' : 'machine-row'}>
                <td className="machine-address">{formatAddress(row.address)}</td>
                <td className="machine-hex">{formatWord(row.machineCode)}</td>
                <td className="machine-assembly">{row.assembly}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
