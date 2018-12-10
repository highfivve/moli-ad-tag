import * as preact from 'preact';

import { classList } from '../util/stringUtils';

type TagVariant = 'green' | 'red' | 'yellow';

export const Tag = (props: { children: JSX.Element | string, variant?: TagVariant }): JSX.Element =>  {
  return <div class={classList('MoliDebug-tag', [ !!props.variant, `MoliDebug-tag--${props.variant}` ])}>{props.children}</div>;
};
