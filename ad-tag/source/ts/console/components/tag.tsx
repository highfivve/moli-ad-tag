import React, { PropsWithChildren } from 'react';
import { classList } from '../util/stringUtils';

type TagVariant = 'green' | 'red' | 'yellow' | 'blue' | 'grey' | 'transparent';
type TagSpacing = 'medium';

type TagProps = {
  readonly variant?: TagVariant;
  readonly title?: string;
  readonly spacing?: TagSpacing;
};

export const Tag: React.FC<PropsWithChildren<TagProps>> = ({
  children,
  variant,
  title,
  spacing
}): React.ReactElement => (
  <div
    className={classList(
      'MoliDebug-tag',
      [!!variant, `MoliDebug-tag--${variant}`],
      [!!spacing, `MoliDebug-tag--${spacing}Spacing`]
    )}
    title={title}
  >
    {children}
  </div>
);

export const TagLabel: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <span className="MoliDebug-tagLabel">{children}</span>
);
