import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

type ClockMarkerPlacement = 'top' | 'bottom';

function ClockMarker({
  width,
  height,
  color,
  placement,
}: {
  width: number;
  height: number;
  color: string;
  placement: ClockMarkerPlacement;
}) {
  const centerX = width / 2;
  const path = placement === 'top'
    ? `M ${centerX - 7} 0 L ${centerX} 10 L ${centerX + 7} 0`
    : `M ${centerX - 7} ${height} L ${centerX} ${height - 10} L ${centerX + 7} ${height}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function getClockMarkerPlacement(component: DatapathComponentProps['component']): ClockMarkerPlacement {
  const clockPort = component.ports.find((port) => port.name === 'clk');

  if (clockPort?.anchor && clockPort.anchor.y <= component.size.height * 0.2) {
    return 'top';
  }

  if (!clockPort?.anchor && clockPort?.position === 'top') {
    return 'top';
  }

  return 'bottom';
}

export function RegisterComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin, clocked, bodyHidden } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.activeFrame : tone.frame;
  const strokeWidth = props.active ? '3.4' : '2';

  if (bodyHidden) {
    return (
      <DatapathShell {...props}>
        <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
        <DatapathPorts component={props.component} />
      </DatapathShell>
    );
  }

  if (skin && skin !== 'default') {
    if (skin === 'textbook-clock-source') {
      if (width <= 0 || height <= 0) {
        return (
          <DatapathShell {...props}>
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
            rx="3"
            fill={tone.fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={width + 4}
            cy={height / 2}
            r="4"
            fill="rgb(248, 246, 242)"
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
        {clocked ? (
          <ClockMarker
            width={width}
            height={height}
            color={stroke}
            placement={getClockMarkerPlacement(props.component)}
          />
        ) : null}
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
