import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Router, Route, Link } from 'react-router-dom';
import { createBrowserHistory, History } from 'history';

import Home from './Home';
import StaticContent from './StaticContent';
import DynamicContent from './DynamicContent';

// make typescript happy for this demo
declare const window: Window & {
  moli: any;
};

/**
 * # App
 *
 * Putting everything together
 *
 */
class App extends React.Component<{}, {}> {
  private readonly browserHistory = createBrowserHistory();

  render(): React.ReactNode {
    return (
      <Router history={this.browserHistory}>
        <nav className="nav">
          <Link className="nav-link" to="/">
            Home
          </Link>
          <Link className="nav-link" to="/content">
            Content Page
          </Link>
          <Link className="nav-link" to="/delayed-content">
            Content Delayed
          </Link>
        </nav>

        <Route path="/" exact component={Home} />
        <Route path="/content" exact component={StaticContent} />
        <Route path="/delayed-content" exact component={DynamicContent} />
      </Router>
    );
  }

  componentDidMount() {
    console.log('component did mount!!!');
    this.browserHistory.listen(event => this.requestAds());
    this.requestAds();
  }

  private requestAds = () => {
    console.log('request ads');
    // initialize ad tag queue
    window.moli = window.moli || { que: [] };

    // initial ad tag configuration
    window.moli.que.push((moliAdTag: any) => {
      // set targetings
      moliAdTag.setTargeting('key', 'value');

      // first requestAds() call
      moliAdTag.requestAds();
    });
  };
}

ReactDOM.render(<App />, document.getElementById('root'));
