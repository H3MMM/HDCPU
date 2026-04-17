import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

export function RegisterComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { width, height } = props.component.size;

  return (
    <DatapathShell {...props}>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="18"
        fill={tone.fill}
        stroke={props.active ? tone.frameStrong : tone.frame}
        strokeWidth={props.active ? '3' : '2'}
      />
      <rect x="8" y="8" width="9" height={height - 16} rx="4.5" fill={tone.fillSoft} />
      <rect
        x="20"
        y="10"
        width={width - 30}
        height="18"
        rx="9"
        fill="rgba(255,255,255,0.5)"
      />
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
