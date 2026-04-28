import { memo } from 'react';
import type { DatapathAnnotationConfig, SignalType } from '../../types';
import { getSignalTone } from './shared';

interface DatapathAnnotationsProps {
  annotations: readonly DatapathAnnotationConfig[];
}

const ROLE_TEXT_FILL: Record<NonNullable<DatapathAnnotationConfig['role']>, string> = {
  'stage-title': '#c7683d',
  field: '#7d3f22',
  signal: '#4d5b66',
  note: '#61734f',
  'component-label': '#0d3a3f',
};

function textFill(annotation: DatapathAnnotationConfig): string {
  if (annotation.signalType) {
    return getSignalTone(annotation.signalType);
  }

  return ROLE_TEXT_FILL[annotation.role ?? 'note'];
}

function textFamily(signalType?: SignalType): string {
  return signalType === 'control'
    ? 'Iowan Old Style, Palatino Linotype, serif'
    : 'Consolas, SFMono-Regular, monospace';
}

function AnnotationNode({ annotation }: { annotation: DatapathAnnotationConfig }) {
  const { position, size } = annotation;
  const lines = annotation.text.split('\n');
  const lineGap = annotation.lineGap ?? ((annotation.fontSize ?? 13) * 1.18);
  const fontSize = annotation.fontSize ?? (annotation.role === 'stage-title' ? 15 : annotation.role === 'signal' ? 12 : 13);
  const box = annotation.box ?? (annotation.role === 'field' ? 'field' : 'none');
  const textX = size ? position.x + size.width / 2 : position.x;
  const textY = size
    ? position.y + size.height / 2 - ((lines.length - 1) * lineGap) / 2 + fontSize * 0.35
    : position.y - ((lines.length - 1) * lineGap) / 2;
  const fill = textFill(annotation);

  return (
    <g
      transform={annotation.rotate ? `rotate(${annotation.rotate} ${textX} ${textY})` : undefined}
      aria-label={`annotation ${annotation.id}`}
    >
      {size && box !== 'none' ? (
        <rect
          x={position.x}
          y={position.y}
          width={size.width}
          height={size.height}
          rx={box === 'field' ? 5 : 4}
          fill={box === 'field' ? 'rgba(255, 240, 230, 0.46)' : 'rgba(248, 246, 242, 0.42)'}
          stroke={box === 'field' ? 'rgba(199, 104, 61, 0.92)' : 'rgba(97, 115, 79, 0.32)'}
          strokeWidth={box === 'field' ? 1.5 : 1}
        />
      ) : null}
      <text
        x={textX}
        y={textY}
        textAnchor={annotation.textAnchor ?? 'middle'}
        fontFamily={textFamily(annotation.signalType)}
        fontSize={fontSize}
        fontStyle={annotation.fontStyle ?? (annotation.signalType === 'control' ? 'italic' : 'normal')}
        fontWeight={annotation.fontWeight ?? (annotation.role === 'signal' ? 650 : 700)}
        fill={fill}
        stroke={annotation.role === 'signal' ? 'rgba(248, 246, 242, 0.9)' : undefined}
        strokeWidth={annotation.role === 'signal' ? 3 : undefined}
        paintOrder={annotation.role === 'signal' ? 'stroke' : undefined}
      >
        {lines.map((line, index) => (
          <tspan key={`${annotation.id}-${index}`} x={textX} y={textY + index * lineGap}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export const DatapathAnnotations = memo(function DatapathAnnotations({ annotations }: DatapathAnnotationsProps) {
  if (annotations.length === 0) {
    return null;
  }

  return (
    <g className="datapath-annotations">
      {annotations.map((annotation) => (
        <AnnotationNode key={annotation.id} annotation={annotation} />
      ))}
    </g>
  );
});
