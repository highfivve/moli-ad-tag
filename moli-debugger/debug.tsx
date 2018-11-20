import 'moli-ad-tag/source/ts/types/moli';
import preact = require('preact');

import { GlobalConfig } from './components/globalConfig';

import './debug.css';

const globalConfigElement = document.createElement('div');

preact.render(<GlobalConfig config={window.moli.getConfig()}/>, globalConfigElement);

document.body.appendChild(globalConfigElement);
