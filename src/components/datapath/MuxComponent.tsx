import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

export function MuxComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { width, height } = props.component.size;
  const points = [
    `0,0`,
    `${width - 14},0`,
    `${width},${height / 2}`,
    `${width - 14},${height}`,
    `0,${height}`,
    `10,${height / 2}`,
  ].join(' ');

  return (
    <DatapathShell {...props}>
      <polygon
        points={points}
        fill={tone.fill}
        stroke={props.active ? tone.frameStrong : tone.frame}
        strokeWidth={props.active ? '3' : '2'}
      />
      <polygon
        points={`10,8 ${width - 24},8 ${width - 12},${height / 2} ${width - 24},${height - 8} 10,${height - 8} 18,${height / 2}`}
        fill={tone.fillSoft}
        opacity="0.65"
      />
      <text
        x={width / 2}
        y={height / 2 - 10}
        textAnchor="middle"
        fontFamily="Consolas, SFMono-Regular, monospace"
        fontSize="18"
        fontWeight="700"
        fill={tone.detail}
      >
        MUX
      </text>
      <DatapathHeaderText {...props} tone={tone} subtitle="Selector" />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
