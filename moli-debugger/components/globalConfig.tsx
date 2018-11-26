import * as preact from 'preact';

import { classList } from '../util/stringUtils';
import { AdSlotConfig } from './adSlotConfig';

import { Moli } from 'moli-ad-tag/source/ts/types/moli';

import MoliConfig = Moli.MoliConfig;
import DfpSlotSize = Moli.DfpSlotSize;

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
    const classes = classList('MoliDebug-sidebar', [this.state.sidebarHidden, 'is-hidden']);
    const config = props.config;
    return <div class={classes} data-ref={debugSidebarSelector}>
      <button class="MoliDebug-sidebar-closeHandle" title={`${state.sidebarHidden ? 'Show' : 'Hide'} moli global config panel`} onClick={this.toggleSidebar}>
        {state.sidebarHidden && <span>&#11013;</span>}
        {!state.sidebarHidden && <span>&times;</span>}
      </button>
      {config && <div>
        <h4>Slots</h4>
        {config.slots.map(slot =>
          <div class="MoliDebug-sidebarSection">
            Slot with DOM ID <strong>{slot.domId}</strong>
            <AdSlotConfig slot={slot}/>
          </div>
        )}
        <h4>Targeting</h4>
        <div class="MoliDebug-sidebarSection">
          {config.targeting && <div>
            <h5>Key/value pairs</h5>
            {this.keyValues(config.targeting.keyValues)}
            {this.labels(config.targeting.labels)}
          </div>}
          {!config.targeting && <span>No targeting config present.</span>}
        </div>
        <h4>Size config</h4>
        <div class="MoliDebug-sidebarSection">
          {(config.sizeConfig && config.sizeConfig.length > 0) && this.sizeConfig(config.sizeConfig)}
          {(!config.sizeConfig || config.sizeConfig.length === 0) && <span>No size config present.</span>}
        </div>
        <pre>
          {JSON.stringify(config, undefined, 2)}
        </pre>
      </div>}
    </div>;
  }

  private keyValues = (keyValues: Moli.DfpKeyValueMap): JSX.Element => {
    const properties = Object.keys(keyValues);

    return properties.length > 0 ? <table class="MoliDebug-keyValueTable">
        <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
        </thead>
        <tbody>
        {properties.map((key: string) =>
          <tr>
            <td>{key}</td>
            <td>{keyValues[key]}</td>
          </tr>
        )}
        </tbody>
      </table> :
      <span>No key/values config present.</span>;
  };

  private labels = (labels: string[] | undefined): JSX.Element => {
    return <div class="MoliDebug-tagContainer">
      <span class="MoliDebug-tagLabel">Labels</span>
      {labels && labels.map(this.tagFromString)}
      {(!labels || labels.length === 0) && <span>No labels config present.</span>}
    </div>;
  };

  private sizeConfig = (sizeConfig: Moli.SizeConfigEntry[]): JSX.Element => {
    return <div>
      {sizeConfig.map(sizeConfigEntry =>
        <div>
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Media query</span>
            <div class="MoliDebug-tag MoliDebug-tag--green">{sizeConfigEntry.mediaQuery}</div>
          </div>
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Supported slot sizes</span>
            {sizeConfigEntry.sizesSupported.map(this.tagFromSlotSize)}
          </div>
          <div class="MoliDebug-tagContainer">
            <span class="MoliDebug-tagLabel">Labels</span>
            {sizeConfigEntry.labels.map(this.tagFromString)}
          </div>
        </div>
      )}
    </div>;
  };

  private tagFromSlotSize = (slotSize: DfpSlotSize): JSX.Element => {
    return this.tagFromString(
      slotSize === 'fluid' ? slotSize : `${slotSize[0]}x${slotSize[1]}`
    );
  };

  private tagFromString = (content: string): JSX.Element => {
    return <div class="MoliDebug-tag">{content}</div>;
  };

  private toggleSidebar = (): void => {
    this.setState({ sidebarHidden: !this.state.sidebarHidden });
  };
}
