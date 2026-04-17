import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useCPUStore } from '../../store/cpu-store';

export function CodeEditor() {
  const sourceCode = useCPUStore((state) => state.sourceCode);
  const setSourceCode = useCPUStore((state) => state.setSourceCode);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 2 / CodeMirror</p>
          <h2>代码编辑器</h2>
        </div>
        <span className="editor-pill">Line Numbers + Highlight</span>
      </div>

      <div className="editor-toolbar">
        <p className="panel-caption">
          当前先用 JavaScript 高亮占位，后面接入汇编语法时可以直接替换 language extension。
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
        编辑器内容已经接入 Zustand store，所以后续无论是汇编、反汇编还是错误标注，都可以沿着同一套状态流继续扩展。
      </p>
    </section>
  );
}
