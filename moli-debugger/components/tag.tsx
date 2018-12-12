import * as preact from 'preact';

import { classList } from '../util/stringUtils';

type TagVariant = 'green' | 'red' | 'yellow';

export const Tag = (props: { children: JSX.Element | string | string[], variant?: TagVariant, title?: string }): JSX.Element =>  {
  return <div class={classList('MoliDebug-tag', [ !!props.variant, `MoliDebug-tag--${props.variant}` ])}
              title={props.title}>{props.children}</div>;
};
