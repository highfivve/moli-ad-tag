import * as React from 'react';
import { RequestAdsContext } from './AdContext';

export interface IAdProps {
  readonly domId: string;

  readonly trigger: 'event' | 'manual';
}

type Moli = {
  readonly que: MoliCommand[];

  refreshAdSlot(domId: string): void;
};
type MoliCommand = (moli: Moli) => void;

declare const window: Window & {
  moli: { que: MoliCommand[] };
};

/**
 * # Ad Component
 *
 * Takes care of rendering the correct div container and fireing the
 * corresponding event to trigger the ad.
 */
export class Ad extends React.Component<IAdProps, {}> {
  static contextType = RequestAdsContext;
  context!: React.ContextType<typeof RequestAdsContext>;

  render(): React.ReactNode {
    return <div id={this.props.domId}></div>;
  }

  /**
   * Called when the internal state changes or the RequestAdsContext.
   */
  componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<{}>, snapshot?: any): void {
    this.dispatchAdTriggerEvent();
  }

  /**
   * Called when the component is mounted. This may happen after the `requestAds()` call
   * has already finished. Hence the `this.context.requestAdsFinished` is already true
   * and `componentDidUpdate` may not be triggered.
   */
  componentDidMount(): void {
    if (this.props.trigger === 'manual') {
      // refreshAds based ad reload
      window.moli = window.moli || { que: [] };
      window.moli.que.push(moli => {
        moli.refreshAdSlot(this.props.domId);
      });
    }

    // event based ad reload
    this.dispatchAdTriggerEvent();
  }

  private dispatchAdTriggerEvent(): void {
    // only trigger the ad slot when requestAdsFinished is true and this component hasn't already fired the trigger event
    if (this.props.trigger === 'event' && this.context.requestAdsFinished) {
      // the event type is part of the ad tag configuration and is documented on the demo page
      window.dispatchEvent(new CustomEvent(`ads.${this.props.domId}`));
    }
  }
}
