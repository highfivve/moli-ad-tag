import React, { PropsWithChildren } from 'react';
import { classList } from '../util/stringUtils';

type TagVariant = 'secondary' | 'green' | 'red' | 'yellow' | 'blue' | 'grey' | 'transparent';
type TagSpacing = 'medium';

type TagProps = {
  readonly variant?: TagVariant;
  readonly title?: string;
  readonly spacing?: TagSpacing;
};

const variantClasses: Record<TagVariant, string> = {
  secondary: 'd-badge-secondary',
  green: 'd-badge-success text-white',
  red: 'd-badge-error text-white',
  yellow: 'd-badge-warning',
  blue: 'd-badge-outline d-badge-primary',
  grey: 'd-badge-neutral',
  transparent: 'd-badge-ghost'
};

export const Tag: React.FC<PropsWithChildren<TagProps>> = ({
  children,
  variant,
  title,
  spacing
}): React.ReactElement => (
  <div
    className={classList(
      'd-badge d-badge-sm ml-1 h-auto min-h-5 whitespace-normal break-all text-left',
      variantClasses[variant ?? 'blue'],
      [spacing === 'medium', 'mb-1']
    )}
    title={title}
  >
    {children}
  </div>
);

export const TagLabel: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <span className="inline-block min-w-36 max-w-96 pr-1 align-middle font-medium">{children}</span>
);
