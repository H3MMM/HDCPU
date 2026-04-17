import type { CSSProperties, ReactNode } from 'react';
import type { ComponentConfig, PortConfig, SignalType } from '../../types';

export interface DatapathTone {
  frame: string;
  frameStrong: string;
  fill: string;
  fillSoft: string;
  label: string;
  detail: string;
}

export interface DatapathComponentProps {
  component: Pick<ComponentConfig, 'id' | 'label' | 'size' | 'ports' | 'type'>;
  active?: boolean;
  subtitle?: string;
  detail?: string;
  onClick?: () => void;
}

export interface PortPlacement {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'middle' | 'end';
}

const SIGNAL_TONES: Record<SignalType, string> = {
  data: '#be5d34',
  control: '#1b6b72',
  address: '#61734f',
};

const COMPONENT_TONES: Record<ComponentConfig['type'] | 'default', DatapathTone> = {
  register: {
    frame: '#be5d34',
    frameStrong: '#8f4320',
    fill: '#fff0e6',
    fillSoft: '#ffd6bf',
    label: '#5e2910',
    detail: '#8b563e',
  },
  'register-file': {
    frame: '#be5d34',
    frameStrong: '#8f4320',
    fill: '#fff0e6',
    fillSoft: '#ffd6bf',
    label: '#5e2910',
    detail: '#8b563e',
  },
  memory: {
    frame: '#1b6b72',
    frameStrong: '#124c51',
    fill: '#e8fbfa',
    fillSoft: '#c3ece8',
    label: '#0d3a3f',
    detail: '#477176',
  },
  alu: {
    frame: '#61734f',
    frameStrong: '#435038',
    fill: '#f0f3e7',
    fillSoft: '#dbe3c6',
    label: '#303a25',
    detail: '#657457',
  },
  mux: {
    frame: '#9e7b2f',
    frameStrong: '#6b531d',
    fill: '#fef5d9',
    fillSoft: '#f4e3a6',
    label: '#533f10',
    detail: '#866b30',
  },
  control: {
    frame: '#365a73',
    frameStrong: '#203a4c',
    fill: '#ebf4fb',
    fillSoft: '#cfe4f2',
    label: '#173041',
    detail: '#4c697b',
  },
  default: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'imm-gen': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  adder: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'sign-extend': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'branch-logic': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  constant: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
};

export function getComponentTone(type: ComponentConfig['type']): DatapathTone {
  return COMPONENT_TONES[type] ?? COMPONENT_TONES.default;
}

export function getSignalTone(signalType: SignalType): string {
  return SIGNAL_TONES[signalType];
}

export function getPortPlacement(port: PortConfig, ports: readonly PortConfig[], size: ComponentConfig['size']): PortPlacement {
  const siblingPorts = ports.filter((candidate) => candidate.position === port.position);
  const siblingIndex = siblingPorts.findIndex((candidate) => candidate.name === port.name);
  const ratio = typeof port.offset === 'number'
    ? Math.min(Math.max(port.offset, 0), 1)
    : (siblingIndex + 1) / (siblingPorts.length + 1);

  if (port.position === 'left') {
    return {
      x: 0,
      y: size.height * ratio,
      labelX: -12,
      labelY: size.height * ratio + 4,
      textAnchor: 'end',
    };
  }

  if (port.position === 'right') {
    return {
      x: size.width,
      y: size.height * ratio,
      labelX: size.width + 12,
      labelY: size.height * ratio + 4,
      textAnchor: 'start',
    };
  }

  if (port.position === 'top') {
    return {
      x: size.width * ratio,
      y: 0,
      labelX: size.width * ratio,
      labelY: -12,
      textAnchor: 'middle',
    };
  }

  return {
    x: size.width * ratio,
    y: size.height,
    labelX: size.width * ratio,
    labelY: size.height + 18,
    textAnchor: 'middle',
  };
}

export function createDatapathShadow(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    filter: active
      ? 'drop-shadow(0 16px 24px rgba(20, 31, 38, 0.22))'
      : 'drop-shadow(0 8px 16px rgba(20, 31, 38, 0.12))',
  };
}

interface ShellProps extends DatapathComponentProps {
  children: ReactNode;
}

export function DatapathShell({ component, active = false, onClick, children }: ShellProps) {
  return (
    <g
      role="button"
      aria-label={`${component.label} ${component.type}`}
      tabIndex={0}
      style={createDatapathShadow(active)}
      onClick={onClick}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onClick) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </g>
  );
}

interface HeaderTextProps extends DatapathComponentProps {
  tone: DatapathTone;
}

export function DatapathHeaderText({ component, tone, subtitle, detail }: HeaderTextProps) {
  return (
    <>
      <text
        x={component.size.width / 2}
        y={component.size.height / 2 - 6}
        textAnchor="middle"
        fontFamily="Iowan Old Style, Palatino Linotype, serif"
        fontSize="16"
        fontWeight="700"
        fill={tone.label}
      >
        {component.label}
      </text>
      {subtitle ? (
        <text
          x={component.size.width / 2}
          y={component.size.height / 2 + 14}
          textAnchor="middle"
          fontFamily="Aptos, Segoe UI, sans-serif"
          fontSize="10"
          fontWeight="700"
          letterSpacing="1.6"
          fill={tone.detail}
        >
          {subtitle.toUpperCase()}
        </text>
      ) : null}
      {detail ? (
        <text
          x={component.size.width / 2}
          y={component.size.height - 12}
          textAnchor="middle"
          fontFamily="Consolas, SFMono-Regular, monospace"
          fontSize="10"
          fill={tone.detail}
        >
          {detail}
        </text>
      ) : null}
    </>
  );
}

export function DatapathPorts({ component }: Pick<DatapathComponentProps, 'component'>) {
  return (
    <g>
      {component.ports.map((port) => {
        const placement = getPortPlacement(port, component.ports, component.size);
        const signalTone = getSignalTone(port.signalType);

        return (
          <g key={port.name}>
            <circle
              cx={placement.x}
              cy={placement.y}
              r={5.5}
              fill="#fffaf6"
              stroke={signalTone}
              strokeWidth="2.2"
            />
            <circle cx={placement.x} cy={placement.y} r={2.2} fill={signalTone} />
            <text
              x={placement.labelX}
              y={placement.labelY}
              textAnchor={placement.textAnchor}
              fontFamily="Consolas, SFMono-Regular, monospace"
              fontSize="9"
              fill={signalTone}
            >
              {port.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
