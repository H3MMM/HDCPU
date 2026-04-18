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

export function RegisterComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin, clocked } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.frameStrong : tone.frame;
  const strokeWidth = props.active ? '3' : '2';

  if (skin && skin !== 'default') {
    if (skin === 'textbook-clock-source') {
      return (
        <DatapathShell {...props}>
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            rx="3"
            fill={tone.fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
          <DatapathPorts component={props.component} />
        </DatapathShell>
      );
    }

    const radius = skin === 'textbook-constant' ? 4 : 6;

    return (
      <DatapathShell {...props}>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={radius}
          fill={tone.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {skin === 'textbook-register-file' ? (
          <rect
            x="10"
            y="10"
            width={width - 20}
            height={height - 20}
            rx="4"
            fill="rgba(255,255,255,0.24)"
            opacity="0.9"
          />
        ) : null}
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
      <rect x="8" y="8" width="9" height={height - 16} rx="4.5" fill={tone.fillSoft} />
      <rect
        x="20"
        y="10"
        width={width - 30}
        height="18"
        rx="9"
        fill="rgba(255,255,255,0.5)"
      />
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
