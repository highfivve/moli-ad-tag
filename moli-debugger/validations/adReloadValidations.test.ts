import { expect } from 'chai';
import { checkAdReloadConfig } from './adReloadValidations';
import { ModuleMeta } from '@highfivve/ad-tag';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { prebidjs } from '@highfivve/ad-tag/source/ts/types/prebidjs';
import video = prebidjs.video;
import { Message } from '../components/globalConfig';
import { AdReloadModuleConfig } from '@highfivve/module-moli-ad-reload';

describe('AdReload Validations', () => {
  const dspxBid: prebidjs.IDSPXBid = { bidder: prebidjs.DSPX, params: { placement: 'placebo' } };

  const gumGum: prebidjs.IGumGumBid = {
    bidder: prebidjs.GumGum,
    params: { zone: 'magic' }
  };

  const criteo: prebidjs.ICriteoBid = { bidder: prebidjs.Criteo, params: { networkId: 123 } };

  const createAdSlot = (
    adUnitPath: string,
    sizes: Moli.GoogleAdManagerSlotSize[],
    bids: prebidjs.IBid[],
    isOutstream: boolean = false
  ): Moli.AdSlot => {
    return {
      position: 'in-page',
      domId: 'prebid-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: adUnitPath,
      sizes: sizes,
      prebid: [
        {
          adUnit: {
            mediaTypes: {
              ...(isOutstream
                ? {
                    video: {
                      context: 'outstream',
                      playerSize: [[640, 480]],
                      mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],
                      startdelay: 1,
                      minduration: 1,
                      maxduration: 30,
                      playbackmethod: [video.PlaybackMethod.AutoPlaySoundOff],
                      placement: video.Placement.InBanner,
                      plcmt: video.Plcmt.NoContentStandalone,
                      api: [video.Api.VPAID_1],
                      protocols: [video.Protocol.VAST_1],
                      skip: video.Skip.YES
                    }
                  }
                : {})
            },
            bids: bids
          }
        }
      ],
      sizeConfig: []
    };
  };

  const labels = ['label1, label2'];
  const moduleConfig: AdReloadModuleConfig = {
    includeAdvertiserIds: [1],
    includeOrderIds: [1],
    excludeOrderIds: [2],
    includeYieldGroupIds: [3],
    excludeAdSlotDomIds: ['23'],
    optimizeClsScoreDomIds: ['22']
  };
  const adReloadModuleMeta: ModuleMeta = {
    moduleType: 'ad-reload',
    name: 'test ad reload module',
    description: 'test module',
    config: moduleConfig
  };

  describe('wallpaper validation', () => {
    it('should return an error when a wallpaper slot is detected by ad unit path is not excluded from ad reload ', () => {
      const messages: Message[] = [];
      const adSlot = createAdSlot('wallpaper', [[12, 12]], []);
      checkAdReloadConfig(messages, [adReloadModuleMeta], [adSlot], labels);
      expect(messages).to.have.length(1);
      expect(messages[0].kind).to.eq('error');
      expect(messages[0].text).to.eq(
        `Slot ${adSlot.domId} is a wallpaper ad unit and must be excluded from the ad reload`
      );
    });

    it('should return an error when a wallpaper slot is detected by bids config and is not excluded from ad reload', () => {
      const messages: Message[] = [];
      const adSlot = createAdSlot('path', [[12, 12]], [dspxBid, gumGum]);
      checkAdReloadConfig(messages, [adReloadModuleMeta], [adSlot], labels);
      expect(messages).to.have.length(1);
      expect(messages[0].kind).to.eq('error');
      expect(messages[0].text).to.eq(
        `Slot ${adSlot.domId} is a wallpaper ad unit and must be excluded from the ad reload`
      );
    });

    it('should return an error when a wallpaper slot is detected by sizes and is not excluded from ad reload', () => {
      const messages: Message[] = [];
      const adSlot = createAdSlot('path', [[1, 1]], []);
      checkAdReloadConfig(messages, [adReloadModuleMeta], [adSlot], labels);
      expect(messages).to.have.length(1);
      expect(messages[0].kind).to.eq('error');
      expect(messages[0].text).to.eq(
        `Slot ${adSlot.domId} is a wallpaper ad unit and must be excluded from the ad reload`
      );
    });

    it('should return no error if floor ad was accidentally detected', () => {
      const messages: Message[] = [];
      const adSlot = createAdSlot('floor', [[1, 1]], []);
      checkAdReloadConfig(messages, [adReloadModuleMeta], [adSlot], labels);
      expect(messages).to.have.length(
        0,
        'Got: ' + messages.map(error => `${error.kind}: ${error.text}`).join('\n')
      );
    });
  });

  describe('outstream validation', () => {
    it('should return an error when an oustream slot is detected by prebid media type and is not excluded from ad reload', () => {
      const messages: Message[] = [];
      const adSlot = createAdSlot('content_2', [[300, 250]], [criteo], true);
      checkAdReloadConfig(messages, [adReloadModuleMeta], [adSlot], labels);
      expect(messages).to.have.length(1);
      expect(messages[0].kind).to.eq('error');
      expect(messages[0].text).to.eq(
        `Slot ${adSlot.domId} is an outstream ad unit and must be excluded from the ad reload`
      );
    });
  });
});
