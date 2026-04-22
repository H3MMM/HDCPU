import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

function ClockMarker({ width, height, color }: { width: number; height: number; color: string }) {
  const centerX = width / 2;
  const baseY = height;

  return (
    <path
      d={`M ${centerX - 7} ${baseY} L ${centerX} ${baseY - 10} L ${centerX + 7} ${baseY}`}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function MemoryComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin, clocked } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.activeFrame : tone.frame;
  const strokeWidth = props.active ? '3.4' : '2';

  if (skin === 'textbook-memory') {
    return (
      <DatapathShell {...props}>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="6"
          fill={tone.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <rect
          x="8"
          y="8"
          width={width - 16}
          height={height - 16}
          rx="4"
          fill="rgba(255,255,255,0.22)"
        />
        {clocked ? <ClockMarker width={width} height={height} color={stroke} /> : null}
        <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
        <DatapathPorts component={props.component} />
      </DatapathShell>
    );
  }

  return (
    <DatapathShell {...props}>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="18"
        fill={tone.fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
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
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
