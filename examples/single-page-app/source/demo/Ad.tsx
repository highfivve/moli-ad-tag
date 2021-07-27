import * as React from 'react';

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
  render(): React.ReactNode {
    return <div id={this.props.domId}></div>;
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
  }
}
