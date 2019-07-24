import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Router, Route, Link } from 'react-router-dom';
import { createBrowserHistory, History } from 'history';

// make typescript happy for this demo
declare const window: Window & {
  moli: any;
};


// == React Context ==

interface IRequestAdsContext {
  /**
   * true if the requestAds() call has finished all event listeners are in place.
   * react components should now fire all the necessary trigger events.
   *
   * Note that components should make sure that they only fire the trigger events once!
   * This flag will stay true until the next navigation change.
   */
  requestAdsFinished: boolean;
}

const RequestAdsContext = React.createContext<IRequestAdsContext>({
  requestAdsFinished: false
});

interface IRequestAdsProps {
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
class RequestAds extends React.Component<IRequestAdsProps, IRequestAdsState> {

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
                                       value={{ requestAdsFinished: this.state.requestAdsFinished }}/>;
  }

}

// ----- Static Content

interface IContentState {
  // so we can trigger re-renderings
  someVariable: boolean;
}

/**
 * # Static Content
 *
 * The output of the `render` method always renders the ad slot container.
 *
 */
class StaticContent extends React.Component<{}, IContentState> {

  // context boilerplate for typescript
  static contextType = RequestAdsContext;
  context!: React.ContextType<typeof RequestAdsContext>;

  constructor(props: {}) {
    super(props);

    this.state = {
      someVariable: false
    };
  }

  render(): React.ReactNode {

    // no external dependencies. The content is rendered directly
    const content1 = [
      {
        title: 'Title 1',
        text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est'
      },
      {
        title: 'Title 2',
        text: 'sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.'
      }
    ];

    const content2 = [
      {
        title: 'Title 3',
        text: 'erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At '
      },
      {
        title: 'Title 4',
        text: 'ore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no se'
      }
    ];

    return <div>
      {content1.map((item, index) => {
        return [
          <h3 key={`1_item_title_${index}`}>{item.title}</h3>,
          <p key={`1_item_text_${index}`}>{item.text}</p>
        ];
      })}
      {this.state.someVariable ? <hr/> : <br/>}
      <div id="spa-prebid-adslot"/>
      {content2.map((item, index) => {
        return [
          <h3 key={`2_item_title_${index}`}>{item.title}</h3>,
          <p key={`2_item_text_${index}`}>{item.text}</p>
        ];
      })}
    </div>;
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
    this.dispatchAdTriggerEvent();
  }

  private dispatchAdTriggerEvent(): void {
    // only trigger the ad slot when requestAdsFinished is true and this component hasn't already fired the trigger event
    if (this.context.requestAdsFinished) {
      // the event type is part of the ad tag configuration and is documented on the demo page
      window.dispatchEvent(new CustomEvent('ads.prebid.adslot'));
    }
  }
}

// ----- Dynamic Content

interface IContentDelayState {
  /**
   * true - means that the component is still loading the content and the ad slot is not rendered to the DOM
   */
  isLoading: boolean;

  /**
   * The async loaded content
   */
  text: string;
}

class ContentDelayed extends React.Component<{}, IContentDelayState> {

  static contextType = RequestAdsContext;
  context!: React.ContextType<typeof RequestAdsContext>;

  private shouldRequestAds: boolean = true;

  constructor(props: {}) {
    super(props);
    this.state = {
      isLoading: true,
      text: ''
    };
  }

  render(): React.ReactNode {
    const { isLoading, text } = this.state;

    // the ad slot is not part here
    if (isLoading) {
      return <div>...loading</div>;
    }

    return <div>
      <h2>Dynamic Content</h2>
      <p>{text}</p>
      <h2>Ad Sidebar 1</h2>
      <div id="ad-sidebar-1"></div>
    </div>;
  }

  componentWillMount(): void {
    setTimeout(() => {
      this.setState({
        isLoading: false,
        text: 'external call was done!'
      });
    }, 1000);
  }

  componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<IContentDelayState>, snapshot?: any): void {
    this.dispatchAdTriggerEvent();
  }

  /**
   * Called when the component is mounted. This may happen after the `requestAds()` call
   * has already finished.. Hence the `this.context.requestAdsFinished` is already true
   * and `componentDidUpdate` may not be triggered.
   *
   * This case only applies when the external call is so fast that the state is immediately
   * set in the `componentWillMount`. Otherwise the `componentDidUpdate` will handle the
   * trigger event dispatchting.
   */
  componentDidMount(): void {
    this.dispatchAdTriggerEvent();
  }


  private dispatchAdTriggerEvent(): void {
    // only trigger the ad slot when requestAdsFinished is true and this component hasn't already fired the trigger event
    if (this.context.requestAdsFinished && !this.state.isLoading) {
      // the event type is part of the ad tag configuration and is documented on the demo page
      window.dispatchEvent(new CustomEvent('ads.sidebar1'));
    }
  }

}


// ----- Static Content

/**
 * # Home
 *
 * Conceptually the same as the [[StaticComponent]].
 */
class Home extends React.Component<{}, {}> {

  static contextType = RequestAdsContext;
  context!: React.ContextType<typeof RequestAdsContext>;

  render(): React.ReactNode {
    return <div>
      <h1>Home. One Ad here</h1>
      <p>Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et
        dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet
        clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet,
        consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed
        diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
        takimata sanctus est Lorem ipsum dolor sit amet.</p>

      <h3>spa a9 adslot</h3>
      <div id="spa-a9-adslot"/>
    </div>;
  }

  componentDidMount(): void {
    this.dispatchAdTriggerEvent();
  }

  componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<{}>, snapshot?: any): void {
    this.dispatchAdTriggerEvent();
  }

  private dispatchAdTriggerEvent(): void {
    if (this.context.requestAdsFinished) {
      // the event type is part of the ad tag configuration and is documented on the demo page
      window.dispatchEvent(new CustomEvent('ads.a9.adslot'));
    }
  }


}


/**
 * # App
 *
 * Putting everything together
 *
 */
class App extends React.Component<{}, {}> {

  private readonly browserHistory = createBrowserHistory();

  render(): React.ReactNode {
    return <Router history={this.browserHistory}>
      <nav className="nav">
        <Link className="nav-link" to="/">Home</Link>
        <Link className="nav-link" to="/content">Content Page</Link>
        <Link className="nav-link" to="/delayed-content">Content Delayed</Link>
      </nav>

      <RequestAds history={this.browserHistory}>
        <Route path="/" exact component={Home}/>
        <Route path="/content" exact component={StaticContent}/>
        <Route path="/delayed-content" exact component={ContentDelayed}/>
      </RequestAds>
    </Router>;
  }
}

ReactDOM.render(
  <App/>,
  document.getElementById('root')
);
