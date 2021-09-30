import { expect } from 'chai';
import { checkAdReloadConfig } from './adReloadValidations';
import { googletag, ModuleMeta, prebidOutstreamRenderer } from '@highfivve/ad-tag';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import video = prebidjs.video;
import { Message } from '../components/globalConfig';
import { AdReload } from '@highfivve/module-moli-ad-reload';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';

const unrulyBid = (siteId: number, targetingUUID: string): prebidjs.IUnrulyBid => {
  return {
    bidder: prebidjs.Unruly,
    params: {
      siteId,
      targetingUUID
    },
    labelAll: [prebidjs.Unruly, 'purpose-1']
  };
};

const dspxBid = (placement: string): prebidjs.IDSPXBid => {
  return {
    bidder: prebidjs.DSPX,
    params: {
      placement,
      devMode: true
    },
    labelAll: [prebidjs.DSPX, 'purpose-1']
  };
};

const justPremium = (placement: string): any => {
  return {
    bidder: prebidjs.JustPremium,
    params: {
      placement,
      devMode: true
    },
    labelAll: [prebidjs.DSPX, 'purpose-1']
  };
};

const mockData = (adUnitPath: string, sizes: Moli.DfpSlotSize[], bids: prebidjs.IBid[]) => {
  const slots: Moli.AdSlot[] = [
    {
      position: 'in-page',
      domId: 'prebid-adslot',
      behaviour: { loaded: 'eager', bucket: 'ONE' },
      adUnitPath: adUnitPath,
      passbackSupport: true,
      sizes: sizes,
      prebid: [
        {
          adUnit: {
            code: 'prebid-adslot',
            pubstack: {
              adUnitPath: '/55155651/outstream_test'
            },
            mediaTypes: {
              banner: {
                sizes: [[300, 50]]
              },
              video: {
                context: 'outstream',
                playerSize: [[605, 340]],
                mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],
                startdelay: 1,
                minduration: 1,
                maxduration: 30,
                playbackmethod: [video?.PlaybackMethod.AutoPlaySoundOff],
                placement: video?.Placement.InBanner,
                api: [video?.Api.VPAID_1],
                protocols: [video?.Protocol.VAST_1],
                skip: video?.Skip.YES,
                // Use Moli's outstream player
                renderer: { ...prebidOutstreamRenderer('prebid-adslot'), backupOnly: false }
              }
            },
            bids: bids
          }
        }
      ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [
            [605, 165],
            [1, 1]
          ]
        },
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [[640, 480]],
          labelAll: [prebidjs.AppNexusAst]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: [[1, 1]]
        }
      ]
    }
  ];
  return slots;
};

const labels = ['label1, label2'];
const messages: Message[] = [];
const dom = createDom();
const jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
  dom.window as any;
const adReloadModule: ModuleMeta = new AdReload(
  {
    includeAdvertiserIds: [1],
    includeOrderIds: [1],
    excludeOrderIds: [2],
    excludeAdSlotDomIds: ['23'],
    optimizeClsScoreDomIds: ['22']
  },
  jsDomWindow
);

describe('AdReload Validations', () => {
  it('Should return "Is an outstream slot that should be excluded from reloading" when the slot is an outstream and AdReload is enabled and it contains wallpaper path', () => {
    const result = checkAdReloadConfig(
      messages,
      [adReloadModule],
      mockData('wallpaper', [[12, 12]], [unrulyBid(1, 'bla')]),
      labels
    );
    expect(result).to.deep.contain({
      id: 'prebid-adslot',
      reasons: ['Is an outstream slot that should be excluded from reloading']
    });
  });

  it('Should also return "Is an outstream slot that should be excluded from reloading" when the slot is an outstream and AdReload is enabled and it has only PDSX and/or JustPremium bids', () => {
    const result = checkAdReloadConfig(
      messages,
      [adReloadModule],
      mockData('path', [[12, 12]], [dspxBid('bla'), justPremium('bla')]),
      labels
    );
    expect(result).to.deep.contain({
      id: 'prebid-adslot',
      reasons: ['Is an outstream slot that should be excluded from reloading']
    });
  });

  it('Should also return "Is an outstream slot that should be excluded from reloading" when the slot is an outstream and AdReload is enabled and it has only wallpaper sizes', () => {
    const result = checkAdReloadConfig(
      messages,
      [adReloadModule],
      mockData('path', [[1, 1]], [unrulyBid(1, 'bla')]),
      labels
    );
    expect(result).to.deep.contain({
      id: 'prebid-adslot',
      reasons: ['Is an outstream slot that should be excluded from reloading']
    });
  });

  it('Should not return "Is an outstream slot that should be excluded from reloading" when the slot is an outstream and AdReload is enabled and it has only wallpaper sizes but with floor path', () => {
    const result = checkAdReloadConfig(
      messages,
      [adReloadModule],
      mockData('floor', [[1, 1]], [unrulyBid(1, 'bla')]),
      labels
    );
    expect(result).to.not.deep.contain({
      id: 'prebid-adslot',
      reasons: ['Is an outstream slot that should be excluded from reloading']
    });
  });

  it('Should return "Is a wallpaper pixel slot that should be excluded from reloading" when the slot is a wallpaper pixel and AdReload is enabled', () => {
    const result = checkAdReloadConfig(
      messages,
      [adReloadModule],
      mockData('wallpaper_pixel', [[12, 12]], [unrulyBid(1, 'bla')]),
      labels
    );
    expect(result).to.not.deep.contain({
      id: 'prebid-adslot',
      reasons: ['Is a wallpaper pixel slot that should be excluded from reloading']
    });
  });
});
