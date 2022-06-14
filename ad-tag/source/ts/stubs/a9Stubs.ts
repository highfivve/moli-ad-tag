import { Moli } from '../types/moli';
import { apstag } from '../types/apstag';

export const a9ConfigStub: Moli.headerbidding.A9Config = {
  pubID: '123',
  timeout: 666,
  cmpTimeout: 246,
  schainNode: {
    asi: 'highfivve.com',
    sid: '3569',
    hp: 1
  }
};

export const apstagStub: apstag.IApsTag = {
  _Q: [],
  init: (_config: apstag.IInitConfig): void => {
    return;
  },
  fetchBids: (_config: apstag.IBidConfig, callback: (bids: Object[]) => void): void => {
    callback([]);
  },
  setDisplayBids: () => {
    return;
  },
  targetingKeys: () => {
    return;
  },
  rpa() {
    return;
  },
  upa() {
    return;
  },
  dpa() {
    return;
  }
};
