import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

interface NotchedShapeOptions {
  rightInset: number;
  notchDepth: number;
  notchTop: number;
  notchBottom: number;
}

function buildTextbookNotchedShape(width: number, height: number, options: NotchedShapeOptions): string {
  return [
    `0,0`,
    `${width},${options.rightInset}`,
    `${width},${height - options.rightInset}`,
    `0,${height}`,
    `0,${height * options.notchBottom}`,
    `${options.notchDepth},${height / 2}`,
    `0,${height * options.notchTop}`,
  ].join(' ');
}

export function ALUComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.activeFrame : tone.frame;
  const strokeWidth = props.active ? '3.4' : '2';

  if (skin === 'textbook-alu' || skin === 'textbook-adder') {
    const outerShape = skin === 'textbook-adder'
      ? buildTextbookNotchedShape(width, height, {
          rightInset: 28,
          notchDepth: 20,
          notchTop: 0.43,
          notchBottom: 0.57,
        })
      : buildTextbookNotchedShape(width, height, {
          rightInset: 46,
          notchDepth: 32,
          notchTop: 0.43,
          notchBottom: 0.57,
        });

    const innerShape = skin === 'textbook-adder'
      ? buildTextbookNotchedShape(width - 10, height - 12, {
          rightInset: 24,
          notchDepth: 15,
          notchTop: 0.43,
          notchBottom: 0.57,
        })
      : buildTextbookNotchedShape(width - 14, height - 16, {
          rightInset: 38,
          notchDepth: 24,
          notchTop: 0.43,
          notchBottom: 0.57,
        });

    return (
      <DatapathShell {...props}>
        <polygon
          points={outerShape}
          fill={tone.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={innerShape
            .split(' ')
            .map((point) => {
              const [x, y] = point.split(',').map(Number);
              return `${x + (skin === 'textbook-adder' ? 4 : 6)},${y + (skin === 'textbook-adder' ? 6 : 8)}`;
            })
            .join(' ')}
          fill={tone.fillSoft}
          opacity="0.38"
        />
        <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
        <DatapathPorts component={props.component} />
      </DatapathShell>
    );
  }

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
        stroke={stroke}
        strokeWidth={strokeWidth}
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
      <DatapathHeaderText {...props} tone={tone} subtitle={props.subtitle} detail={props.detail} />
      <DatapathPorts component={props.component} />
    </DatapathShell>
  );
}
