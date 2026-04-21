import {
  DatapathHeaderText,
  DatapathPorts,
  DatapathShell,
  getComponentTone,
  getPortPlacementFromAbsoluteCoordinates,
  type DatapathComponentProps,
} from './shared';

function buildSelectorArrowPath(x: number, y: number, direction: 'up' | 'down'): string {
  if (direction === 'up') {
    return `M ${x - 5} ${y + 10} L ${x} ${y} L ${x + 5} ${y + 10}`;
  }

  return `M ${x - 5} ${y - 10} L ${x} ${y} L ${x + 5} ${y - 10}`;
}

export function MuxComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin, choiceLabels, ports } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.frameStrong : tone.frame;
  const strokeWidth = props.active ? '3' : '2';

  if (skin === 'textbook-mux') {
    const selectorPort = ports.find((port) => port.signalType === 'control' && port.position === 'bottom');
    const selectorPlacement = selectorPort
      ? getPortPlacementFromAbsoluteCoordinates(selectorPort, props.component)
      : null;
    const selectorArrowDirection = selectorPlacement && selectorPlacement.y > height / 2 ? 'up' : 'down';
    const labels = choiceLabels ?? [];

    return (
      <DatapathShell {...props}>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={width / 2}
          fill={tone.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <rect
          x="5"
          y="6"
          width={width - 10}
          height={height - 12}
          rx={(width - 10) / 2}
          fill={tone.fillSoft}
          opacity="0.38"
        />
        {labels.map((label, index) => {
          const y = ((index + 0.5) / labels.length) * height + 5;

          return (
            <text
              key={`${props.component.id}-choice-${label}-${index}`}
              x={width / 2}
              y={y}
              textAnchor="middle"
              fontFamily="Iowan Old Style, Palatino Linotype, serif"
              fontSize={Math.min(18, Math.max(12, width * 0.48))}
              fontWeight="700"
              fill={tone.label}
            >
              {label}
            </text>
          );
        })}
        {selectorPlacement ? (
          <path
            d={buildSelectorArrowPath(selectorPlacement.x, selectorPlacement.y, selectorArrowDirection)}
            fill="none"
            stroke="#1b6b72"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
        <DatapathPorts component={props.component} />
      </DatapathShell>
    );
  }

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
        stroke={stroke}
        strokeWidth={strokeWidth}
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
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
