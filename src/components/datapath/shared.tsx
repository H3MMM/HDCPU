import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ComponentConfig, PortConfig, SignalType } from '../../types';

export interface DatapathTone {
  frame: string;
  frameStrong: string;
  activeFrame: string;
  activeFilterId: string;
  fill: string;
  fillSoft: string;
  label: string;
  detail: string;
}

export interface DatapathComponentProps {
  component: ComponentConfig;
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

const LONG_SIDE_PORT_LABEL_LENGTH = 7;
const SIDE_PORT_LABEL_GAP = 14;
const TOP_INSIDE_PORT_LABEL_GAP = 16;
const BOTTOM_INSIDE_PORT_LABEL_GAP = 8;

const SIGNAL_TONES: Record<SignalType, string> = {
  data: '#be5d34',
  control: '#1b6b72',
  address: '#61734f',
};

const ACTIVE_ORANGE = '#c7683d';
const ACTIVE_ORANGE_FILTER_ID = 'datapath-active-glow-orange';
const ACTIVE_TEAL = '#14747c';
const ACTIVE_TEAL_FILTER_ID = 'datapath-active-glow-teal';

const COMPONENT_TONES: Record<ComponentConfig['type'] | 'default', DatapathTone> = {
  register: {
    frame: '#be5d34',
    frameStrong: '#8f4320',
    activeFrame: ACTIVE_TEAL,
    activeFilterId: ACTIVE_TEAL_FILTER_ID,
    fill: '#fff0e6',
    fillSoft: '#ffd6bf',
    label: '#5e2910',
    detail: '#8b563e',
  },
  'register-file': {
    frame: '#be5d34',
    frameStrong: '#8f4320',
    activeFrame: ACTIVE_TEAL,
    activeFilterId: ACTIVE_TEAL_FILTER_ID,
    fill: '#fff0e6',
    fillSoft: '#ffd6bf',
    label: '#5e2910',
    detail: '#8b563e',
  },
  memory: {
    frame: '#1b6b72',
    frameStrong: '#124c51',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#e8fbfa',
    fillSoft: '#c3ece8',
    label: '#0d3a3f',
    detail: '#477176',
  },
  alu: {
    frame: '#61734f',
    frameStrong: '#435038',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f0f3e7',
    fillSoft: '#dbe3c6',
    label: '#303a25',
    detail: '#657457',
  },
  mux: {
    frame: '#9e7b2f',
    frameStrong: '#6b531d',
    activeFrame: ACTIVE_TEAL,
    activeFilterId: ACTIVE_TEAL_FILTER_ID,
    fill: '#fef5d9',
    fillSoft: '#f4e3a6',
    label: '#533f10',
    detail: '#866b30',
  },
  control: {
    frame: '#365a73',
    frameStrong: '#203a4c',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#ebf4fb',
    fillSoft: '#cfe4f2',
    label: '#173041',
    detail: '#4c697b',
  },
  default: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'imm-gen': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  adder: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'sign-extend': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  'branch-logic': {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
    fill: '#f5f6f8',
    fillSoft: '#e0e5ea',
    label: '#1d2730',
    detail: '#5d6a74',
  },
  constant: {
    frame: '#4d5b66',
    frameStrong: '#2d3942',
    activeFrame: ACTIVE_ORANGE,
    activeFilterId: ACTIVE_ORANGE_FILTER_ID,
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

function getPortLabel(port: PortConfig): string {
  return port.label ?? port.name;
}

function shouldInsetSidePortLabel(
  side: PortConfig['position'],
  label: string,
  component: Pick<ComponentConfig, 'portStyle' | 'skin'>
): boolean {
  if (side !== 'left' && side !== 'right') {
    return false;
  }

  if (label.length < LONG_SIDE_PORT_LABEL_LENGTH) {
    return false;
  }

  return component.portStyle === 'minimal' || component.skin?.startsWith('textbook') === true;
}

function getPortLabelPlacementMode(
  side: PortConfig['position'],
  label: string,
  component: Pick<ComponentConfig, 'portStyle' | 'skin' | 'portLabelPlacement'>
): 'inside' | 'outside' {
  if (component.portLabelPlacement === 'inside') {
    return 'inside';
  }

  if (component.portLabelPlacement === 'outside') {
    return 'outside';
  }

  return shouldInsetSidePortLabel(side, label, component) ? 'inside' : 'outside';
}

export function getPortPlacement(port: PortConfig, ports: readonly PortConfig[], size: ComponentConfig['size']): PortPlacement {
  if (port.anchor) {
    const { x, y } = port.anchor;

    if (port.position === 'left') {
      return {
        x,
        y,
        labelX: x - 12,
        labelY: y + 4,
        textAnchor: port.textAnchor ?? 'end',
      };
    }

    if (port.position === 'right') {
      return {
        x,
        y,
        labelX: x + 12,
        labelY: y + 4,
        textAnchor: port.textAnchor ?? 'start',
      };
    }

    if (port.position === 'top') {
      return {
        x,
        y,
        labelX: x,
        labelY: y - 12,
        textAnchor: port.textAnchor ?? 'middle',
      };
    }

    return {
      x,
      y,
      labelX: x,
      labelY: y + 18,
      textAnchor: port.textAnchor ?? 'middle',
    };
  }

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
      textAnchor: port.textAnchor ?? 'end',
    };
  }

  if (port.position === 'right') {
    return {
      x: size.width,
      y: size.height * ratio,
      labelX: size.width + 12,
      labelY: size.height * ratio + 4,
      textAnchor: port.textAnchor ?? 'start',
    };
  }

  if (port.position === 'top') {
    return {
      x: size.width * ratio,
      y: 0,
      labelX: size.width * ratio,
      labelY: -12,
      textAnchor: port.textAnchor ?? 'middle',
    };
  }

  return {
    x: size.width * ratio,
    y: size.height,
    labelX: size.width * ratio,
    labelY: size.height + 18,
    textAnchor: port.textAnchor ?? 'middle',
  };
}

export function DatapathActiveGlowFilters() {
  return (
    <>
      <filter
        id={ACTIVE_TEAL_FILTER_ID}
        x="-180"
        y="-180"
        width="1800"
        height="1800"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feDropShadow in="SourceAlpha" dx="0" dy="0" stdDeviation="8" floodColor={ACTIVE_TEAL} floodOpacity="0.48" result="glow" />
        <feDropShadow in="SourceAlpha" dx="0" dy="7" stdDeviation="7" floodColor="#141f26" floodOpacity="0.13" result="shadow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter
        id={ACTIVE_ORANGE_FILTER_ID}
        x="-180"
        y="-180"
        width="1800"
        height="1800"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feDropShadow in="SourceAlpha" dx="0" dy="0" stdDeviation="8" floodColor={ACTIVE_ORANGE} floodOpacity="0.5" result="glow" />
        <feDropShadow in="SourceAlpha" dx="0" dy="7" stdDeviation="7" floodColor="#141f26" floodOpacity="0.13" result="shadow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </>
  );
}

export function createDatapathShadow(_active: boolean, clickable: boolean): CSSProperties {
  return {
    cursor: clickable ? 'pointer' : 'default',
  };
}

interface ShellProps extends DatapathComponentProps {
  children: ReactNode;
}

export function DatapathShell({ component, active = false, onClick, children }: ShellProps) {
  const clickable = typeof onClick === 'function';
  const tone = getComponentTone(component.type);

  return (
    <motion.g
      role={clickable ? 'button' : undefined}
      aria-label={`${component.label} ${component.type}`}
      tabIndex={clickable ? 0 : undefined}
      filter={active ? `url(#${tone.activeFilterId})` : undefined}
      style={createDatapathShadow(active, clickable)}
      initial={false}
      animate={{
        opacity: active ? 1 : 0.82,
      }}
      transition={{
        duration: 0.36,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={clickable ? {
        opacity: 1,
      } : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onClick) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </motion.g>
  );
}

interface HeaderTextProps extends DatapathComponentProps {
  tone: DatapathTone;
}

function getComponentLabelFill(component: ComponentConfig, tone: DatapathTone): string {
  return component.labelSignalType ? getSignalTone(component.labelSignalType) : tone.label;
}

function renderMultilineLabel(component: ComponentConfig, tone: DatapathTone) {
  if (component.hideLabel) {
    return null;
  }

  const labelLines = component.labelLines ?? component.label.split('\n');
  if (labelLines.length === 0 || labelLines.every((line) => line.trim().length === 0)) {
    return null;
  }

  const x = component.size.width / 2 + (component.labelOffset?.x ?? 0);
  const y = component.size.height / 2 + (component.labelOffset?.y ?? 0);
  const lineGap = component.labelLineGap ?? 18;
  const fontSize = component.labelFontSize ?? 16;
  const startY = y - ((labelLines.length - 1) * lineGap) / 2;
  const labelFill = getComponentLabelFill(component, tone);

  return (
    <g transform={component.labelRotate ? `rotate(${component.labelRotate} ${x} ${y})` : undefined}>
      {labelLines.map((line, index) => (
        <text
          key={`${component.id}-label-${index}`}
          x={x}
          y={startY + index * lineGap}
          textAnchor="middle"
          fontFamily="Iowan Old Style, Palatino Linotype, serif"
          fontSize={fontSize}
          fontStyle={component.labelFontStyle ?? 'normal'}
          fontWeight="700"
          fill={labelFill}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export function DatapathHeaderText({ component, tone, subtitle, detail }: HeaderTextProps) {
  const labelFill = getComponentLabelFill(component, tone);
  const hasCustomLabelLayout =
    Boolean(component.skin && component.skin !== 'default') ||
    Boolean(component.labelLines) ||
    Boolean(component.labelRotate) ||
    Boolean(component.labelOffset) ||
    Boolean(component.hideLabel);

  if (hasCustomLabelLayout) {
    return (
      <>
        {renderMultilineLabel(component, tone)}
        {subtitle && !component.hideSubtitle ? (
          <text
            x={component.size.width / 2}
            y={component.size.height - 22}
            textAnchor="middle"
            fontFamily="Aptos, Segoe UI, sans-serif"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.1"
            fill={tone.detail}
          >
            {subtitle}
          </text>
        ) : null}
        {detail && !component.hideDetail ? (
          <text
            x={component.size.width / 2}
            y={component.size.height - 10}
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

  return (
    <>
      <text
        x={component.size.width / 2}
        y={component.size.height / 2 - 6}
        textAnchor="middle"
        fontFamily="Iowan Old Style, Palatino Linotype, serif"
        fontSize="16"
        fontStyle={component.labelFontStyle ?? 'normal'}
        fontWeight="700"
        fill={labelFill}
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
          letterSpacing="1.2"
          fill={tone.detail}
        >
          {subtitle}
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

function renderPortMarker(
  style: NonNullable<ComponentConfig['portStyle']>,
  placement: PortPlacement,
  signalTone: string
) {
  if (style === 'hidden') {
    return null;
  }

  if (style === 'minimal') {
    return <circle cx={placement.x} cy={placement.y} r={2.4} fill={signalTone} />;
  }

  return (
    <>
      <circle
        cx={placement.x}
        cy={placement.y}
        r={5.5}
        fill="#fffaf6"
        stroke={signalTone}
        strokeWidth="2.2"
      />
      <circle cx={placement.x} cy={placement.y} r={2.2} fill={signalTone} />
    </>
  );
}

export function DatapathPorts({ component }: Pick<DatapathComponentProps, 'component'>) {
  const portStyle = component.portStyle ?? (component.skin && component.skin !== 'default' ? 'minimal' : 'outlined');

  if (portStyle === 'hidden') {
    return null;
  }

  return (
    <g>
      {component.ports.map((port) => {
        if (port.hidden) {
          return null;
        }

        const placement = getPortPlacementFromAbsoluteCoordinates(port, component);
        if (!placement) {
          return null;
        }

        const signalTone = getSignalTone(port.signalType);
        const label = getPortLabel(port);

        return (
          <g key={port.id ?? port.name}>
            {renderPortMarker(portStyle, placement, signalTone)}
            {label ? (
              <text
                x={placement.labelX + (port.labelOffset?.x ?? 0)}
                y={placement.labelY + (port.labelOffset?.y ?? 0)}
                textAnchor={port.textAnchor ?? placement.textAnchor}
                fontFamily="Consolas, SFMono-Regular, monospace"
                fontSize={portStyle === 'minimal' ? '15' : '14'}
                fontWeight="700"
                stroke="rgba(248, 246, 242, 0.96)"
                strokeWidth="3"
                paintOrder="stroke"
                fill={signalTone}
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

export function getPortPlacementFromAbsoluteCoordinates(
  port: PortConfig,
  component: ComponentConfig
): PortPlacement | null {
  if (typeof port.x !== 'number' || !Number.isFinite(port.x)) {
    return null;
  }

  if (typeof port.y !== 'number' || !Number.isFinite(port.y)) {
    return null;
  }

  const localX = port.x - component.position.x;
  const localY = port.y - component.position.y;
  const side = port.side ?? port.position;
  const label = getPortLabel(port);
  const portLabelPlacement = getPortLabelPlacementMode(side, label, component);
  const placeLabelInside = portLabelPlacement === 'inside';

  if (side === 'left') {
    return {
      x: localX,
      y: localY,
      labelX: placeLabelInside ? localX + SIDE_PORT_LABEL_GAP : localX - 12,
      labelY: localY + 4,
      textAnchor: port.textAnchor ?? (placeLabelInside ? 'start' : 'end'),
    };
  }

  if (side === 'right') {
    return {
      x: localX,
      y: localY,
      labelX: placeLabelInside ? localX - SIDE_PORT_LABEL_GAP : localX + 12,
      labelY: localY + 4,
      textAnchor: port.textAnchor ?? (placeLabelInside ? 'end' : 'start'),
    };
  }

  if (side === 'top') {
    return {
      x: localX,
      y: localY,
      labelX: localX,
      labelY: placeLabelInside ? localY + TOP_INSIDE_PORT_LABEL_GAP : localY - 12,
      textAnchor: port.textAnchor ?? 'middle',
    };
  }

  return {
    x: localX,
    y: localY,
    labelX: localX,
    labelY: placeLabelInside ? localY - BOTTOM_INSIDE_PORT_LABEL_GAP : localY + 18,
    textAnchor: port.textAnchor ?? 'middle',
  };
}
