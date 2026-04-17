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
          <p className="eyebrow">第 2 天 / 编辑器</p>
          <h2>代码编辑器</h2>
        </div>
        <span className="editor-pill">行号 + 高亮</span>
      </div>

      <div className="editor-toolbar">
        <p className="panel-caption">
          当前先用通用语法高亮承载汇编输入，后续如果要接专用 RISC-V 语言扩展，可以直接替换编辑器扩展配置。
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
        编辑器内容已经接入 Zustand store，所以无论是汇编、反汇编、错误标注还是执行控制，都可以沿着同一套状态流继续扩展。
      </p>
    </section>
  );
}
