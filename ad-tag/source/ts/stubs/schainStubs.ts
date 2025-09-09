import { SupplyChainObject } from '../types/supplyChainObject';
import { schain } from '../types/moliConfig';

export const dummySupplyChainNode: SupplyChainObject.ISupplyChainNode = {
  asi: 'example.com',
  sid: '42',
  hp: 1
};

export const dummySchainConfig: schain.SupplyChainConfig = {
  supplyChainStartNode: dummySupplyChainNode
};
