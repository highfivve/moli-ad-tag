import * as React from 'react';
import { Ad } from './Ad';


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
export default class StaticContent extends React.Component<{}, IContentState> {

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
            {this.state.someVariable ? <hr /> : <br />}
            <Ad domId="h5v_content_rezi_1" />
            {content2.map((item, index) => {
                return [
                    <h3 key={`2_item_title_${index}`}>{item.title}</h3>,
                    <p key={`2_item_text_${index}`}>{item.text}</p>
                ];
            })}
        </div>;
    }
}
