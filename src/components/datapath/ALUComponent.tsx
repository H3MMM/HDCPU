import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

export function ALUComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { width, height } = props.component.size;
  const points = [
    `18,0`,
    `${width - 18},0`,
    `${width},${height * 0.22}`,
    `${width - 14},${height}`,
    `14,${height}`,
    `0,${height * 0.22}`,
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
        points={`22,10 ${width - 22},10 ${width - 16},${height * 0.24} ${width - 24},${height - 10} 24,${height - 10} 16,${height * 0.24}`}
        fill={tone.fillSoft}
        opacity="0.55"
      />
      <text
        x={width / 2}
        y={height / 2 - 18}
        textAnchor="middle"
        fontFamily="Consolas, SFMono-Regular, monospace"
        fontSize="20"
        fontWeight="700"
        fill={tone.detail}
      >
        ALU
      </text>
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
