import * as preact from 'preact';
import { JSX } from 'preact';

import { classList } from '../util/stringUtils';

type TagVariant = 'green' | 'red' | 'yellow' | 'blue' | 'grey';
type TagSpacing = 'medium';

export const Tag = (props: {
  children: JSX.Element | string | string[];
  variant?: TagVariant;
  title?: string;
  spacing?: TagSpacing;
}): JSX.Element => {
  return (
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
};
