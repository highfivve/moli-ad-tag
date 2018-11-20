import * as preact from 'preact';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import AdSlot = Moli.AdSlot;
import { classList } from '../util/stringUtils';

type IAdSlotConfigProps = {
  parentElement: HTMLElement;
  slot: AdSlot;
};
type IAdSlotConfigState = {
  dimensions: { width: number, height: number };
  showA9: boolean;
  showPrebid: boolean;
  showGeneral: boolean;
};

const defaultPanelState: Pick<IAdSlotConfigState, 'showA9' | 'showPrebid' | 'showGeneral'> = {
  showA9: false,
  showPrebid: false,
  showGeneral: false
};

export class AdSlotConfig extends preact.Component<IAdSlotConfigProps, IAdSlotConfigState> {

  constructor(props: IAdSlotConfigProps) {
    super();

    props.parentElement.classList.add('MoliDebug-posRelative');

    const { width, height } = props.parentElement.getBoundingClientRect();
    this.state = {
      dimensions: { width, height },
      ...defaultPanelState
    };
  }

  render(props: IAdSlotConfigProps, state: IAdSlotConfigState): JSX.Element {
    return <div class="MoliDebug-adSlot" style={state.dimensions}>
      <div class="MoliDebug-adSlot-buttons">
        <button title="Show general slot info" class={classList('MoliDebug-adSlot-button', [state.showGeneral, 'is-active'])} onClick={this.toggleGeneral}>&#8505;</button>
        {props.slot.a9 && <button title="Show A9 config" class={classList('MoliDebug-adSlot-button', [state.showA9, 'is-active'])} onClick={this.toggleA9}>A9</button>}
        {props.slot.prebid && <button title="Show Prebid config" class={classList('MoliDebug-adSlot-button', [state.showPrebid, 'is-active'])} onClick={this.togglePrebid}>pb</button>}
      </div>
      {state.showGeneral && <pre>
        {JSON.stringify(props.slot, undefined, 2)}
      </pre>}
      {state.showA9 && <pre>
        {JSON.stringify(props.slot.a9, undefined, 2)}
      </pre>}
      {state.showPrebid && <pre>
        {JSON.stringify(props.slot.prebid, undefined, 2)}
      </pre>}
    </div>;
  }

  private toggleGeneral = (): void => {
    this.setState({ ...defaultPanelState, showGeneral: !this.state.showGeneral });
  };

  private toggleA9 = (): void => {
    this.setState({ ...defaultPanelState, showA9: !this.state.showA9 });
  };

  private togglePrebid = (): void => {
    this.setState({ ...defaultPanelState, showPrebid: !this.state.showPrebid });
  };
}
