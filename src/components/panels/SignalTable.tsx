import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import {
  PIPELINE_TEXTBOOK_SIGNAL_GROUP_LABELS,
  TEXTBOOK_SIGNAL_GROUP_LABELS,
  buildMulticycleTextbookSignalRows,
  buildPipelineTextbookSignalRows,
  formatTextbookSignalValue,
  getTextbookSignalOptionLabel,
} from '../../teaching/textbook-signals';

export const SignalTable = memo(function SignalTable() {
  const { datapathMode, stage, controlSignals, currentInstruction, currentSnapshot } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      stage: state.stage,
      controlSignals: state.controlSignals,
      currentInstruction: state.currentInstruction,
      currentSnapshot: state.currentSnapshot,
    }))
  );

  const rows = useMemo(() => {
    return buildMulticycleTextbookSignalRows({
      stage,
      controlSignals,
      currentInstruction,
    });
  }, [controlSignals, currentInstruction, stage]);
  const pipelineRows = useMemo(() => buildPipelineTextbookSignalRows(currentSnapshot), [currentSnapshot]);

  if (datapathMode === 'pipeline') {
    return (
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">流水线控制信号</p>
            <h2>控制信号总览</h2>
          </div>
          <span className="editor-pill">周期 {currentSnapshot.cycleNumber}</span>
        </div>

        <br />

        <div className="signal-table-shell">
          <table className="signal-table">
            <thead>
              <tr>
                <th>信号</th>
                <th>值</th>
                <th>含义</th>
              </tr>
            </thead>
            <tbody>
              {pipelineRows.map((row) => (
                <tr key={row.label} className={row.active ? 'signal-row signal-row--active' : 'signal-row'}>
                  <td>
                    <div className="signal-name-cell">
                      <strong>{row.label}</strong>
                      <span className={`signal-group-tag signal-group-tag--${row.group}`}>
                        {PIPELINE_TEXTBOOK_SIGNAL_GROUP_LABELS[row.group]}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={row.active ? 'value-badge value-badge--active' : 'value-badge'}>
                      {getTextbookSignalOptionLabel(row.label, formatTextbookSignalValue(row.value), 'pipeline')}
                    </span>
                  </td>
                  <td className="signal-meaning">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">控制信号</p>
          <h2>控制信号总览</h2>
        </div>
        <span className="editor-pill">阶段 {stage}</span>
      </div>
      <br />

      <div className="signal-intro-card">
        <span className="detail-label">当前指令</span>
        <strong className="detail-value">{currentInstruction?.asmString ?? '暂无已译码指令'}</strong>
      </div>

      <div className="signal-table-shell">
        <table className="signal-table">
          <thead>
            <tr>
              <th>信号</th>
              <th>值</th>
              <th>含义</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.active ? 'signal-row signal-row--active' : 'signal-row'}>
                <td>
                  <div className="signal-name-cell">
                    <strong>{row.label}</strong>
                    <span className={`signal-group-tag signal-group-tag--${row.group}`}>
                      {TEXTBOOK_SIGNAL_GROUP_LABELS[row.group]}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={row.active ? 'value-badge value-badge--active' : 'value-badge'}>
                    {getTextbookSignalOptionLabel(row.label, formatTextbookSignalValue(row.value), 'multicycle')}
                  </span>
                </td>
                <td className="signal-meaning">{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
