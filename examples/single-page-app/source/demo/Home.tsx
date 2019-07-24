import * as React from 'react';
import { Ad } from './Ad';

/**
 * # Home
 *
 * Conceptually the same as the [[StaticComponent]].
 */
export default class Home extends React.Component<{}, {}> {

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
            <Ad domId="spa-a9-adslot" />
            <div id="spa-a9-adslot" />
        </div>;
    }
}
