import * as React from 'react';
import { Ad } from './Ad';

interface IDynamicContentState {
    /**
     * true - means that the component is still loading the content and the ad slot is not rendered to the DOM
     */
    isLoading: boolean;

    /**
     * The async loaded content
     */
    text: string;
}

export default class DynamicContent extends React.Component<{}, IDynamicContentState> {

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
            <Ad domId="ad-sidebar-1" />
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
}
