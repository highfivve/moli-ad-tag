import * as React from 'react';
import { Ad } from './Ad';

/**
 * # Home
 *
 * Conceptually the same as the [[StaticComponent]].
 */
export default class Home extends React.Component<{}, {}> {
  render(): React.ReactNode {
    return (
      <div>
        <h1>Home. One Ad here</h1>
        <p>
          Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
          invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et
          accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata
          sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing
          elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed
          diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd
          gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.
        </p>

        <h3>spa a9 adslot</h3>
        <Ad domId="spa-a9-adslot" trigger="manual" />

        <br />
        <br />
        <br />
        <hr />
        <div className="row">
          <div className="col-md">
            <h1>Lazy Loading AdSlot-2</h1>
            <div id="lazy-loading-adslot-1" style={{ height: '500px' }}></div>
          </div>
        </div>
      </div>
    );
  }
}
