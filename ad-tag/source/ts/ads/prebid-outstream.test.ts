import { expect } from 'chai';
import Sinon from 'sinon';
import { dom } from '../stubs/browserEnvSetup';
import {
  PrebidOutstreamConfiguration,
  prebidOutstreamRenderer,
  PrebidOutstreamBid,
  renderPrebidOutstream
} from './prebid-outstream';

global.window = dom.window as any;

const domId = 'some-ad';
const config: PrebidOutstreamConfiguration = {};
const bid: PrebidOutstreamBid = {
  renderer: { push: (callback: () => void) => callback() }
};

const outstreamPlayerMock = Sinon.mock();
dom.window.outstreamPlayer = outstreamPlayerMock;

beforeEach(() => {
  Sinon.resetHistory();
});

describe('prebidOutstreamRenderer', () => {
  it('the returned render function should invoke window.outstreamPlayer', () => {
    prebidOutstreamRenderer(domId, 'https://localhost:8080', config).render(bid);
    expect(outstreamPlayerMock).calledWithExactly(bid, domId, config);
  });
});

describe('renderPrebidOutstream', () => {
  it('should invoke window.outstreamPlayer', () => {
    renderPrebidOutstream(bid, domId, config);
    expect(outstreamPlayerMock).calledWithExactly(bid, domId, config);
  });
});
