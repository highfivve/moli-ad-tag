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
  | 'modules'
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
  modules: 'border-l-[#8a7de0]',
  prebid: 'border-l-[#76949f]',
  a9: 'border-l-[#ea9445]',
  consent: 'border-l-[#d9f4c7]',
  supplyChain: 'border-l-[#82dad8]',
  adDensity: 'border-l-[#f176af]',
  validation: 'border-l-[#f4ef88]'
};

type BlockProps = {
  readonly title: React.ReactNode;
  readonly color: SectionColor;
};

/**
 * Titled content block with a colored left border indicating the topic.
 */
export const Block: React.FC<PropsWithChildren<BlockProps>> = ({ title, color, children }) => (
  <section className={classList('mb-4 border-l-4 bg-base-100 pl-3', sectionAccent[color])}>
    <h4 className="mb-1 text-base font-semibold">{title}</h4>
    <div className="pb-1 text-sm">{children}</div>
  </section>
);

type TabsProps<T extends string> = {
  readonly tabs: ReadonlyArray<{ readonly id: T; readonly label: React.ReactNode }>;
  readonly active: T;
  readonly onSelect: (id: T) => void;
  readonly className?: string;
};

/**
 * Tab navigation, e.g. between the console pages or within a slot card.
 */
export const Tabs = <T extends string>({
  tabs,
  active,
  onSelect,
  className
}: TabsProps<T>): React.ReactElement => (
  <div role="tablist" className={classList('d-tabs d-tabs-bordered w-full', className ?? '')}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={tab.id === active}
        // border/background resets needed because preflight is disabled and the
        // browser default button styles would leak into the daisyUI tab look
        className={classList('d-tab border-x-0 border-t-0 bg-transparent font-semibold', [
          tab.id === active,
          'd-tab-active'
        ])}
        onClick={() => onSelect(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

type ToggleProps = {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onChange: (checked: boolean) => void;
};

/**
 * On/off switch. Border set explicitly because preflight is disabled.
 */
export const Toggle: React.FC<ToggleProps> = ({ checked, disabled, title, onChange }) => (
  <input
    type="checkbox"
    className="d-toggle d-toggle-secondary d-toggle-sm border border-solid border-primary"
    checked={checked}
    disabled={disabled}
    title={title}
    onChange={e => onChange((e.target as HTMLInputElement).checked)}
  />
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
