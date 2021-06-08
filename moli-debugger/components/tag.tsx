import React from 'react';
import { classList } from '../util/stringUtils';

type TagVariant = 'green' | 'red' | 'yellow' | 'blue' | 'grey' | 'transparent';
type TagSpacing = 'medium';

export const Tag = (props: {
  children: JSX.Element | string | string[];
  variant?: TagVariant;
  title?: string;
  spacing?: TagSpacing;
  key?: string | number;
}): JSX.Element => (
  <div
    className={classList(
      'MoliDebug-tag',
      [!!props.variant, `MoliDebug-tag--${props.variant}`],
      [!!props.spacing, `MoliDebug-tag--${props.spacing}Spacing`]
    )}
    title={props.title}
  >
    {props.children}
  </div>
);

export const TagLabel = (props: { children: JSX.Element | string | string[] }): JSX.Element => (
  <span className="MoliDebug-tagLabel">{props.children}</span>
);
