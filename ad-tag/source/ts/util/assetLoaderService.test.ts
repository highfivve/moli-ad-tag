import { expect } from 'chai';
import * as sinon from 'sinon';

import { IPerformanceMeasurementService } from './performanceService';
import { AssetLoaderService, AssetLoadMethod, ILoadAssetParams } from './assetLoaderService';

describe('AssetLoaderService', () => {
  let windowStub: any;
  let performanceServiceStub: sinon.SinonStubbedInstance<IPerformanceMeasurementService>;
  let assetLoaderService: AssetLoaderService;

  const scriptElementStub = {
    type: '',
    src: '',
    async: false,
    setAttribute: sinon.stub()
  };

  beforeEach(() => {
    windowStub = {
      document: {
        createElement: sinon.stub()
      }
    };
    assetLoaderService = new AssetLoaderService(performanceServiceStub, windowStub);
  });

  describe('scriptTag', () => {
    it('should create a script tag with type "module" if config.type is "module"', () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.mjs',
        loadMethod: AssetLoadMethod.TAG,
        type: 'module'
      };

      windowStub.document.createElement.returns(scriptElementStub);

      (assetLoaderService as any).scriptTag(config);

      expect(windowStub.document.createElement.calledWith('script')).to.be.true;
      expect(scriptElementStub.type).to.equal('module');
      expect(scriptElementStub.src).to.equal(config.assetUrl);
      expect(scriptElementStub.async).to.be.true;
    });

    it('should create a script tag with type "text/javascript" and set nomodule attribute if config.type is "nomodule"', () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.js',
        loadMethod: AssetLoadMethod.TAG,
        type: 'nomodule'
      };

      windowStub.document.createElement.returns(scriptElementStub);

      (assetLoaderService as any).scriptTag(config);

      expect(windowStub.document.createElement.calledWith('script')).to.be.true;
      expect(scriptElementStub.type).to.equal('text/javascript');
      expect(scriptElementStub.src).to.equal(config.assetUrl);
      expect(scriptElementStub.async).to.be.true;
      expect(scriptElementStub.setAttribute.calledWithExactly('nomodule', ''));
    });

    it('should create a script tag with type "module" for .mjs file if type is not specified', () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.mjs',
        loadMethod: AssetLoadMethod.TAG
      };

      windowStub.document.createElement.returns(scriptElementStub);
      (assetLoaderService as any).scriptTag(config);

      expect(windowStub.document.createElement.calledWith('script')).to.be.true;
      expect(scriptElementStub.type).to.equal('module');
      expect(scriptElementStub.src).to.equal(config.assetUrl);
      expect(scriptElementStub.async).to.be.true;
    });

    it('should create a script tag with type "text/javascript" for .js file if type is not specified', () => {
      const config: ILoadAssetParams = {
        name: 'testScript',
        assetUrl: 'https://example.com/script.js',
        loadMethod: AssetLoadMethod.TAG
      };

      windowStub.document.createElement.returns(scriptElementStub);

      (assetLoaderService as any).scriptTag(config);

      expect(windowStub.document.createElement.calledWith('script')).to.be.true;
      expect(scriptElementStub.type).to.equal('text/javascript');
      expect(scriptElementStub.src).to.equal(config.assetUrl);
      expect(scriptElementStub.async).to.be.true;
    });
  });
});
