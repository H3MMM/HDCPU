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

function TextbookXorGate({
  width,
  height,
  stroke,
}: {
  width: number;
  height: number;
  stroke: string;
}) {
  const outline = `
    M ${width * 0.18} ${height * 0.12}
    Q ${width * 0.54} ${height * 0.2} ${width * 0.82} ${height * 0.52}
    Q ${width * 0.54} ${height * 0.84} ${width * 0.18} ${height * 0.9}
    Q ${width * 0.4} ${height * 0.54} ${width * 0.18} ${height * 0.12}
    Z
  `;

  const xorLead = `
    M ${width * 0.06} ${height * 0.14}
    Q ${width * 0.28} ${height * 0.52} ${width * 0.06} ${height * 0.9}
  `;

  return (
    <>
      <g transform={`rotate(90 ${width / 2} ${height / 2})`}>
        <path
          d={outline}
          fill="rgba(255,255,255,0.7)"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={xorLead}
          fill="none"
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </g>
    </>
  );
}

export function ControlUnitComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin, clocked } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.activeFrame : tone.frame;
  const strokeWidth = props.active ? '3.4' : '2';

  if (skin === 'textbook-xor') {
    const gateStroke = props.active ? tone.activeFrame : 'rgba(34, 42, 50, 0.9)';

    return (
      <DatapathShell {...props}>
        <TextbookXorGate width={width} height={height} stroke={gateStroke} />
        <DatapathPorts component={props.component} />
      </DatapathShell>
    );
  }

  if (skin === 'textbook-control' || skin === 'textbook-decoder') {
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
        rx="22"
        fill={tone.fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
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
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
