import { DatapathHeaderText, DatapathPorts, DatapathShell, getComponentTone, type DatapathComponentProps } from './shared';

function buildTextbookALUPoints(width: number, height: number): string {
  return [
    `0,0`,
    `${width - 28},0`,
    `${width},${height / 2}`,
    `${width - 28},${height}`,
    `0,${height}`,
    `${width * 0.2},${height / 2}`,
  ].join(' ');
}

function buildTextbookAdderPoints(width: number, height: number): string {
  return [
    `0,0`,
    `${width - 18},${height * 0.14}`,
    `${width},${height / 2}`,
    `${width - 18},${height * 0.86}`,
    `0,${height}`,
  ].join(' ');
}

export function ALUComponent(props: DatapathComponentProps) {
  const tone = getComponentTone(props.component.type);
  const { skin } = props.component;
  const { width, height } = props.component.size;
  const stroke = props.active ? tone.frameStrong : tone.frame;
  const strokeWidth = props.active ? '3' : '2';

  if (skin === 'textbook-alu' || skin === 'textbook-adder') {
    const points = skin === 'textbook-adder'
      ? buildTextbookAdderPoints(width, height)
      : buildTextbookALUPoints(width, height);

    return (
      <DatapathShell {...props}>
        <polygon
          points={points}
          fill={tone.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={
            skin === 'textbook-adder'
              ? buildTextbookAdderPoints(width - 12, height - 14)
                  .split(' ')
                  .map((point) => {
                    const [x, y] = point.split(',').map(Number);
                    return `${x + 4},${y + 7}`;
                  })
                  .join(' ')
              : buildTextbookALUPoints(width - 14, height - 16)
                  .split(' ')
                  .map((point) => {
                    const [x, y] = point.split(',').map(Number);
                    return `${x + 6},${y + 8}`;
                  })
                  .join(' ')
          }
          fill={tone.fillSoft}
          opacity="0.42"
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
