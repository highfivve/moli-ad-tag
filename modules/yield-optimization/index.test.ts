import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { createAssetLoaderService, Moli, prebidjs } from '@highfivve/ad-tag';
import { newNoopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { pbjsTestConfig } from '@highfivve/ad-tag/tests/ts/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';

import YieldOptimization  from './index';
import IBidResponsesMap = prebidjs.IBidResponsesMap;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('Yield Optimization module', () => {


});
// tslint:enable
