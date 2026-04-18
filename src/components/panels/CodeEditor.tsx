import { memo, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useShallow } from 'zustand/react/shallow';
import {
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
    ? undefined
    : getExampleProgramById(selectedExampleId) ?? DEFAULT_EXAMPLE_PROGRAM;

  function handleExampleChange(exampleId: string) {
    const nextExample = getExampleProgramById(exampleId);
    if (nextExample) {
      setSourceCode(nextExample.source);
    }
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">第 13 天 / 编辑器增强</p>
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
          height="420px"
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
        编辑器内容已经接入 Zustand store，所以无论是示例装载、汇编、反汇编、错误标注还是执行控制，都走同一套状态流。
      </p>
    </section>
  );
});
