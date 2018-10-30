import {prebidjs} from '../../../../types/prebidjs';

import INanoInteractiveBid = prebidjs.INanoInteractiveBid;
import NanoInteractive = prebidjs.NanoInteractive;

/*
 * == NanoInteractive Configuration ==
 *
 * NanoInteractive supports multi sizes per placement.
 *
 * Request are made to `audiencemanager.de/hb`
 *
 */
const securityCode = '58af616fa737cc270bf418b8fef4ced9';
const dataPartnerId = '58cc0ccfeb0a1910dd199502';

// === Mobile POS1 ===
export const nanoInteractivePrebidConfigPos1Mobile = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5a81c3ab0ae8997c2d437d62',
      nq: tags,
      category: tier1
    }
  };
};

// === Mobile Sticky Ad ===
export const nanoInteractivePrebidConfigStickyAd = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5a96bcd40ae899294e4b2472',
      nq: tags,
      category: tier1
    }
  };
};

// === Mobile Presenter ===
export const nanoInteractivePrebidConfigPresenterMobile = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5a96bca10ae899287973bd72',
      nq: tags,
      category: tier1
    }
  };
};

// === Header Area ===
export const nanoInteractivePrebidConfigHeaderAreaDesktop = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5aa6a3eb0ae8994fa033b2c2',
      nq: tags,
      category: tier1
    }
  };
};

// === Skyscraper ===
export const nanoInteractivePrebidConfigSkyscraperDesktop = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5aa6a4250ae8994f985925d2',
      nq: tags,
      category: tier1
    }
  };
};

// === Sidebar 1 ===
export const nanoInteractivePrebidConfigSidebar1Desktop = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5aa6a4540ae8994fed09a682',
      nq: tags,
      category: tier1
    }
  };
};

// === Sidebar 2 ===
export const nanoInteractivePrebidConfigSidebar2Desktop = (tags: string, tier1: string): INanoInteractiveBid => {
  return {
    bidder: NanoInteractive,
    params: {
      sec: securityCode,
      dpid: dataPartnerId,
      pid: '5aa6a4800ae8994fed09a683',
      nq: tags,
      category: tier1
    }
  };
};

