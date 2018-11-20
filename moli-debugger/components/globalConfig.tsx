import * as preact from 'preact';

import { classList } from '../util/stringUtils';
import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import MoliConfig = Moli.MoliConfig;

type IGlobalConfigProps = {
  config?: MoliConfig
};
type IGlobalConfigState = {
  sidebarHidden: boolean;
};

const debugSidebarSelector = 'moli-debug-sidebar';

export class GlobalConfig extends preact.Component<IGlobalConfigProps, IGlobalConfigState> {

  constructor() {
    super();
    this.state = {
      sidebarHidden: false
    };
  }

  render(props: IGlobalConfigProps, state: IGlobalConfigState): JSX.Element {
    const classes = classList('MoliDebug-sidebar', [ this.state.sidebarHidden, 'is-hidden' ]);
    return <div class={classes} data-ref={debugSidebarSelector}>
      <button class="MoliDebug-sidebar-closeHandle" onClick={this.toggleSidebar}>
        {state.sidebarHidden && <span>&#11013;</span>}
        {!state.sidebarHidden && <span>&times;</span>}
      </button>
      <pre>
        {JSON.stringify(props.config, undefined, 2)}
      </pre>
    </div>;
  }

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
  };
}
