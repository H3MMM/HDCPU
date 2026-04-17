import { useCPUStore } from '../../store/cpu-store';

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatChangeValue(value: number): string {
  return `${value | 0} / ${formatWord(value)}`;
}

export function ExecutionInspector() {
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const latestMemoryAccess = useCPUStore((state) => state.latestMemoryAccess);

  const pipelineRegisters = [
    { label: 'PC', value: formatWord(currentSnapshot.pc) },
    { label: 'Next PC', value: formatWord(currentSnapshot.nextPC) },
    { label: 'IR', value: formatWord(currentSnapshot.pipelineRegs.IR) },
    { label: 'MDR', value: formatWord(currentSnapshot.pipelineRegs.MDR) },
    { label: 'A', value: formatWord(currentSnapshot.pipelineRegs.A) },
    { label: 'B', value: formatWord(currentSnapshot.pipelineRegs.B) },
    { label: 'ALUOut', value: formatWord(currentSnapshot.pipelineRegs.ALUOut) },
  ];

  const memoryAccessLabel = latestMemoryAccess.type === 'none'
    ? 'No memory access in the latest cycle.'
    : `${latestMemoryAccess.type.toUpperCase()} @ ${formatWord(latestMemoryAccess.address)} = ${formatWord(latestMemoryAccess.data)}`;

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 10 / Execution Inspector</p>
          <h2>Engine Snapshot Inspector</h2>
        </div>
        <span className="editor-pill">Cycle {currentSnapshot.cycleNumber}</span>
      </div>

      <p className="panel-copy">
        This panel is wired straight to the CPU engine snapshot so we can verify the UI is consuming the same
        pipeline registers, ALU details, memory access metadata, and state changes that the core is emitting.
      </p>

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">Instruction</span>
          <strong>{currentInstruction?.asmString ?? 'Program complete'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">Active Paths</span>
          <strong>{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">State Changes</span>
          <strong>{currentSnapshot.changes.length}</strong>
        </article>
      </div>

      <div className="inspector-register-grid">
        {pipelineRegisters.map((registerEntry) => (
          <article key={registerEntry.label} className="inspector-register-card">
            <span className="detail-label">{registerEntry.label}</span>
            <strong className="detail-value">{registerEntry.value}</strong>
          </article>
        ))}
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">ALU Detail</span>
          <div className="inspector-list">
            <div className="inspector-list-item">
              <span>Input A</span>
              <strong>{formatWord(currentSnapshot.aluDetail.inputA)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Input B</span>
              <strong>{formatWord(currentSnapshot.aluDetail.inputB)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Operation</span>
              <strong>{currentSnapshot.aluDetail.operation}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Result</span>
              <strong>{formatWord(currentSnapshot.aluDetail.result)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Zero Flag</span>
              <strong>{currentSnapshot.aluDetail.zero ? '1' : '0'}</strong>
            </div>
          </div>
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">Memory Access</span>
          <strong className="detail-value inspector-callout">{memoryAccessLabel}</strong>
          <div className="inspector-list">
            <div className="inspector-list-item">
              <span>Access Type</span>
              <strong>{latestMemoryAccess.type}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Address</span>
              <strong>{formatWord(latestMemoryAccess.address)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>Data</span>
              <strong>{formatWord(latestMemoryAccess.data)}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">Recent State Changes</span>
          {currentSnapshot.changes.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.changes.map((change) => (
                <div key={`${change.target}-${change.newValue}`} className="inspector-list-item">
                  <span>{change.target}</span>
                  <strong>
                    {formatChangeValue(change.oldValue)} {'->'} {formatChangeValue(change.newValue)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">No architectural state changed in the latest visible snapshot.</p>
          )}
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">Active Data Paths</span>
          {currentSnapshot.activeDataPaths.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.activeDataPaths.map((path, index) => (
                <div
                  key={`${path.from}-${path.to}-${path.portFrom}-${path.portTo}-${index}`}
                  className="inspector-list-item"
                >
                  <span>
                    {path.from}.{path.portFrom} {'->'} {path.to}.{path.portTo}
                  </span>
                  <strong>
                    {formatWord(path.value)} / {path.signalType}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">No animated datapath activity is currently being emitted.</p>
          )}
        </article>
      </div>
    </section>
  );
}
