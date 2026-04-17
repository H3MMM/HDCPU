import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

export function MemoryComponent(props: DatapathComponentProps) {
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
      <rect x="10" y="10" width={width - 20} height="18" rx="9" fill={tone.fillSoft} />
      {Array.from({ length: 4 }, (_, index) => (
        <rect
          key={index}
          x="12"
          y={40 + index * 18}
          width={width - 24}
          height="10"
          rx="5"
          fill={index % 2 === 0 ? 'rgba(255,255,255,0.65)' : tone.fillSoft}
          opacity={0.9}
        />
      ))}
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
