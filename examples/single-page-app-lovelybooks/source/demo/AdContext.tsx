import * as React from 'react';
import { History } from 'history';

declare const window: Window & {
    moli: any;
};

export interface IRequestAdsContext {
    /**
     * true if the requestAds() call has finished all event listeners are in place.
     * react components should now fire all the necessary trigger events.
     *
     * Note that components should make sure that they only fire the trigger events once!
     * This flag will stay true until the next navigation change.
     */
    requestAdsFinished: boolean;
}

export const RequestAdsContext = React.createContext<IRequestAdsContext>({
    requestAdsFinished: false
});

export interface IRequestAdsProps {
    /**
     * The RequestAds component requires access to the history to be able to react
     * to navigation changes and configure the RequestAdsContext and trigger the
     * `requestAds()` method.
     */
    readonly history: History;
}

interface IRequestAdsState {
    /**
     * Internal state that is propagated through the RequestAdsContext
     */
    readonly requestAdsFinished: boolean;

    /**
     * Store the previous pathname to make sure that `requestAds()` is only called
     * once per location.
     */
    readonly prevPathname: string;
}

/**
 * # RequestAds Component
 *
 * Provides the `RequestAdsContext` react context for all components that render ad slots.
 * There are different scenarios for this context to be used.
 *
 * ## Static Component
 *
 * A static component is a component that doesn't do any external data fetching or anything
 * that defers changes the output of the `render` method.
 *
 * An example is the [[StaticContent]] component.
 *
 * ## Dynamic Component
 *
 * A dynamic component is a component that has different outputs for the `render` method,
 * depending on the current internal state. A component may have a `loading` state, where
 * it displays only a loading indicator. The trigger events for the ad slots should only
 * be fired if the actual DOM element is available.
 *
 * An example is the [[DynamicContent]] component.
 *
 * @see {@link https://reactjs.org/docs/context.html}
 */
export default class RequestAds extends React.Component<IRequestAdsProps, IRequestAdsState> {

    constructor(props: IRequestAdsProps) {
        super(props);

        // configuration has not been finished yet
        this.state = {
            requestAdsFinished: false,
            prevPathname: window.location.pathname
        };

        // initialize ad tag queue
        window.moli = window.moli || { que: [] };

        // initial ad tag configuration
        window.moli.que.push((moliAdTag: any) => {

            // change this components state and thus the context for the application
            moliAdTag.afterRequestAds(() => {
                this.setState({ requestAdsFinished: true });
            });

            // first requestAds() call
            moliAdTag.requestAds();
        });

        // react on navigation changes
        props.history.listen((location) => {
            // trigger events only when the path has changed
            if (this.state.prevPathname !== location.pathname) {
                window.moli.que.push((moliAdTag: any) => {
                    this.setState({
                        requestAdsFinished: false,
                        prevPathname: location.pathname
                    });
                    // configure ads for this page
                    moliAdTag.requestAds();
                });
            }
        });
    }

    // wrap the children components with the RequestAdsContext
    render(): React.ReactNode {
        return <RequestAdsContext.Provider children={this.props.children}
            value={{ requestAdsFinished: this.state.requestAdsFinished }} />;
    }
}
