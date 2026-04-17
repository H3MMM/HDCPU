import type { ReactNode } from 'react';
import type { ComponentConfig } from '../../types';
import { ALUComponent } from './ALUComponent';
import { ControlUnitComponent } from './ControlUnitComponent';
import { MemoryComponent } from './MemoryComponent';
import { MuxComponent } from './MuxComponent';
import { RegisterComponent } from './RegisterComponent';

interface FactoryComponentProps {
  component: ComponentConfig;
  active: boolean;
  detail: string;
  onSelect: (componentId: string) => void;
}

type ComponentRenderer = (props: FactoryComponentProps) => ReactNode;

const COMPONENT_RENDERERS: Partial<Record<ComponentConfig['type'], ComponentRenderer>> = {
  register: renderRegisterNode,
  'register-file': renderRegisterNode,
  memory: renderMemoryNode,
  mux: renderMuxNode,
  control: renderControlNode,
  alu: renderALUNode,
  adder: renderALUNode,
  'imm-gen': renderRegisterNode,
  'sign-extend': renderRegisterNode,
  'branch-logic': renderControlNode,
  constant: renderRegisterNode,
};

export function getComponentSubtitle(component: ComponentConfig): string {
  switch (component.type) {
    case 'register':
    case 'register-file':
      return 'State Register';
    case 'memory':
      return 'Memory Bank';
    case 'mux':
      return 'Selector';
    case 'control':
    case 'branch-logic':
      return 'Finite Control';
    case 'alu':
    case 'adder':
      return 'Arithmetic Logic';
    case 'imm-gen':
    case 'sign-extend':
      return 'Immediate Logic';
    case 'constant':
      return 'Constant Source';
    default:
      return component.type;
  }
}

export function createDatapathComponentNode({ component, active, detail, onSelect }: FactoryComponentProps) {
  const renderer = COMPONENT_RENDERERS[component.type] ?? renderALUNode;
  return renderer({ component, active, detail, onSelect });
}

function buildCommonProps({ component, active, detail, onSelect }: FactoryComponentProps) {
  return {
    component,
    active,
    subtitle: getComponentSubtitle(component),
    detail,
    onClick: () => onSelect(component.id),
  };
}

function wrapComponent(component: ComponentConfig, child: ReactNode) {
  return (
    <g key={component.id} transform={`translate(${component.position.x} ${component.position.y})`}>
      {child}
    </g>
  );
}

function renderRegisterNode(props: FactoryComponentProps) {
  return wrapComponent(props.component, <RegisterComponent {...buildCommonProps(props)} />);
}

function renderMemoryNode(props: FactoryComponentProps) {
  return wrapComponent(props.component, <MemoryComponent {...buildCommonProps(props)} />);
}

function renderMuxNode(props: FactoryComponentProps) {
  return wrapComponent(props.component, <MuxComponent {...buildCommonProps(props)} />);
}

function renderControlNode(props: FactoryComponentProps) {
  return wrapComponent(props.component, <ControlUnitComponent {...buildCommonProps(props)} />);
}

function renderALUNode(props: FactoryComponentProps) {
  return wrapComponent(props.component, <ALUComponent {...buildCommonProps(props)} />);
}
