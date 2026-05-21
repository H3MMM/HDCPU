import { memo, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useShallow } from 'zustand/react/shallow';
import {
  CUSTOM_PROGRAM_SUMMARY,
  CUSTOM_PROGRAM_TEMPLATE,
  DEFAULT_EXAMPLE_PROGRAM,
  EXAMPLE_PROGRAMS,
  getExampleProgramById,
  normalizeExampleSource,
} from '../../content/example-programs';
import { useCPUStore } from '../../store/cpu-store';

export const CodeEditor = memo(function CodeEditor() {
  const { sourceCode, setSourceCode } = useCPUStore(
    useShallow((state) => ({
      sourceCode: state.sourceCode,
      setSourceCode: state.setSourceCode,
    }))
  );

  const selectedExampleId = useMemo(() => {
    const currentSource = normalizeExampleSource(sourceCode);
    return EXAMPLE_PROGRAMS.find((program) => normalizeExampleSource(program.source) === currentSource)?.id ?? 'custom';
  }, [sourceCode]);

  const selectedExample = selectedExampleId === 'custom'
    ? { summary: CUSTOM_PROGRAM_SUMMARY }
    : getExampleProgramById(selectedExampleId) ?? DEFAULT_EXAMPLE_PROGRAM;

  function handleExampleChange(exampleId: string) {
    if (exampleId === 'custom') {
      setSourceCode(CUSTOM_PROGRAM_TEMPLATE);
      return;
    }

    const nextExample = getExampleProgramById(exampleId);
    if (nextExample) {
      setSourceCode(nextExample.source);
    }
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">程序输入</p>
          <h2>代码编辑器</h2>
        </div>
        <span className="editor-pill">示例程序 + 行号高亮</span>
      </div>

      <div className="editor-toolbar editor-toolbar--stacked">
        <div className="editor-toolbar-group">
          <label className="range-label" htmlFor="example-program-select">
            示例程序
          </label>
          <select
            id="example-program-select"
            className="editor-select"
            value={selectedExampleId}
            onChange={(event) => handleExampleChange(event.target.value)}
          >
            {EXAMPLE_PROGRAMS.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
            <option value="custom">自定义程序</option>
          </select>
        </div>

        <p className="panel-caption">
          {selectedExample?.summary ?? '当前源码已脱离内置示例，你可以自由编辑并立即观察汇编与执行结果。'}
        </p>
      </div>

      <div className="editor-shell">
        <CodeMirror
          value={sourceCode}
          height="260px"
          extensions={[javascript()]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
          }}
          onChange={(value) => setSourceCode(value)}
        />
      </div>

      <p className="editor-note">
        这里输入的代码会立即重新汇编，并同步到中央画布、机器码、控制信号、寄存器和内存面板。
      </p>
    </section>
  );
});
