import React, { PropsWithChildren } from 'react';
import { classList } from '../util/stringUtils';

/**
 * Shared daisyUI based building blocks for the debug console.
 */

export type SectionColor =
  | 'moli'
  | 'slots'
  | 'targeting'
  | 'sizeConfig'
  | 'prebid'
  | 'a9'
  | 'consent'
  | 'supplyChain'
  | 'adDensity'
  | 'validation';

const sectionAccent: Record<SectionColor, string> = {
  moli: 'border-l-[#998fc7]',
  slots: 'border-l-[#506684]',
  targeting: 'border-l-[#998fc7]',
  sizeConfig: 'border-l-[#d4c2fc]',
  prebid: 'border-l-[#76949f]',
  a9: 'border-l-[#ea9445]',
  consent: 'border-l-[#d9f4c7]',
  supplyChain: 'border-l-[#82dad8]',
  adDensity: 'border-l-[#f176af]',
  validation: 'border-l-[#f4ef88]'
};

type SectionProps = {
  readonly title: React.ReactNode;
  readonly color: SectionColor;
  readonly expanded: boolean;
  readonly onToggle: () => void;
};

/**
 * Collapsible sidebar section with a colored left border indicating the topic.
 */
export const Section: React.FC<PropsWithChildren<SectionProps>> = ({
  title,
  color,
  expanded,
  onToggle,
  children
}) => (
  <section
    className={classList(
      'd-collapse d-collapse-arrow mb-2 rounded-none border-l-4 bg-base-100',
      sectionAccent[color]
    )}
  >
    <input type="checkbox" checked={expanded} onChange={onToggle} aria-label={`toggle ${color}`} />
    <div className="d-collapse-title min-h-0 py-2 pl-3 text-base font-semibold">{title}</div>
    <div className="d-collapse-content pl-3 text-sm">{children}</div>
  </section>
);

type TagContainerProps = {
  readonly subEntry?: boolean;
};

/**
 * A row holding a TagLabel and one or more Tags.
 */
export const TagContainer: React.FC<PropsWithChildren<TagContainerProps>> = ({
  subEntry,
  children
}) => (
  <div
    className={classList('mt-2 flex flex-wrap items-center gap-y-1', [
      !!subEntry,
      "ml-2.5 before:mr-1 before:content-['↳']"
    ])}
  >
    {children}
  </div>
);

type BtnVariant = 'neutral' | 'green' | 'yellow' | 'blue' | 'red';

const btnVariantClasses: Record<BtnVariant, string> = {
  neutral: '',
  green: 'd-btn-primary',
  yellow: 'd-btn-warning',
  blue: 'd-btn-outline d-btn-primary',
  red: 'd-btn-error text-white'
};

type BtnProps = {
  readonly variant?: BtnVariant;
  readonly title?: string;
  readonly disabled?: boolean;
  readonly type?: 'button' | 'submit';
  readonly active?: boolean;
  readonly onClick?: () => void;
};

export const Btn: React.FC<PropsWithChildren<BtnProps>> = ({
  variant,
  title,
  disabled,
  type,
  active,
  onClick,
  children
}) => (
  <button
    className={classList(
      'd-btn d-btn-xs ml-1 font-normal normal-case',
      btnVariantClasses[variant ?? 'neutral'],
      [!!active, 'd-btn-active']
    )}
    title={title}
    disabled={disabled}
    type={type ?? 'button'}
    onClick={onClick}
  >
    {children}
  </button>
);

type PanelVariant = 'grey' | 'red' | 'blue';

const panelVariantClasses: Record<PanelVariant, string> = {
  grey: 'bg-base-200 text-base-content',
  red: 'bg-[#e9898b] text-black',
  blue: 'bg-[#edf6fc] text-black'
};

type PanelProps = {
  readonly variant?: PanelVariant;
  readonly collapsible?: boolean;
};

export const Panel: React.FC<PropsWithChildren<PanelProps>> = ({
  variant,
  collapsible,
  children
}) => (
  <div
    className={classList(
      'mb-2 max-w-md rounded-md p-2 text-sm [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
      panelVariantClasses[variant ?? 'grey'],
      [!!collapsible, 'shadow-md']
    )}
  >
    {children}
  </div>
);

/**
 * Section sub headline, e.g. "User sync" inside the prebid section.
 */
export const SubHeadline: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <h5 className="mb-1 mt-3 text-sm font-bold">{children}</h5>
);

type TextInputProps = {
  readonly type?: 'text' | 'number';
  readonly placeholder?: string;
  readonly name?: string;
  readonly id?: string;
  readonly value?: string | number;
  readonly list?: string;
  readonly disabled?: boolean;
  readonly onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const TextInput: React.FC<TextInputProps> = props => (
  <input
    className="d-input d-input-bordered d-input-xs mx-1 w-44 bg-base-100"
    type={props.type ?? 'text'}
    {...props}
  />
);
