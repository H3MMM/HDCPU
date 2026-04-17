import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

export function ControlUnitComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { width, height } = props.component.size;

  return (
    <DatapathShell {...props}>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="22"
        fill={tone.fill}
        stroke={props.active ? tone.frameStrong : tone.frame}
        strokeWidth={props.active ? '3' : '2'}
      />
      <path
        d={`M16 ${height * 0.34} C 26 ${height * 0.16}, 42 ${height * 0.52}, 54 ${height * 0.3}
            S 86 ${height * 0.54}, 104 ${height * 0.28}
            S ${width - 26} ${height * 0.56}, ${width - 14} ${height * 0.34}`}
        fill="none"
        stroke={tone.frame}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="16" y={height - 34} width={width - 32} height="16" rx="8" fill={tone.fillSoft} />
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
