import { createDom } from '../stubs/browserEnvSetup';
import { expect } from 'chai';
import {
  addMoliLabelToStorage,
  clearMoliLabelsFromStorage,
  getMoliLabelsFromQueryParam,
  getMoliLabelsFromStorage,
  removeMoliLabelFromStorage
} from './debugLabels';
import { BrowserStorageKeys } from './browserStorageKeys';

describe('debugLabels', () => {
  const dom = createDom();
  const jsWindow = dom.window as unknown as Window;

  beforeEach(() => {
    dom.reconfigure({ url: 'https://example.com' });
    dom.window.localStorage.clear();
  });

  describe('getMoliLabelsFromQueryParam', () => {
    it('should return an empty array if the query param is not set', () => {
      expect(getMoliLabelsFromQueryParam(jsWindow)).to.deep.equal([]);
    });

    it('should parse a comma-separated list of labels', () => {
      dom.reconfigure({ url: 'https://example.com?moliLabels=foo,bar' });
      expect(getMoliLabelsFromQueryParam(jsWindow)).to.deep.equal(['foo', 'bar']);
    });

    it('should trim tokens and drop empty ones', () => {
      dom.reconfigure({ url: 'https://example.com?moliLabels=%20foo%20,,bar%20,' });
      expect(getMoliLabelsFromQueryParam(jsWindow)).to.deep.equal(['foo', 'bar']);
    });

    it('should return an empty array instead of throwing if window.location access throws', () => {
      const throwingWindow = {
        get location(): never {
          throw new Error('SecurityError: access denied');
        }
      } as unknown as Window;
      expect(getMoliLabelsFromQueryParam(throwingWindow)).to.deep.equal([]);
    });
  });

  describe('getMoliLabelsFromStorage', () => {
    it('should return an empty array if nothing is stored', () => {
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal([]);
    });

    it('should parse a stored JSON string array', () => {
      jsWindow.localStorage.setItem(BrowserStorageKeys.moliLabels, JSON.stringify(['foo', 'bar']));
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal(['foo', 'bar']);
    });

    it('should return an empty array for malformed JSON', () => {
      jsWindow.localStorage.setItem(BrowserStorageKeys.moliLabels, '{not json');
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal([]);
    });

    it('should return an empty array if the stored value is not a string array', () => {
      jsWindow.localStorage.setItem(BrowserStorageKeys.moliLabels, JSON.stringify({ foo: 'bar' }));
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal([]);

      jsWindow.localStorage.setItem(BrowserStorageKeys.moliLabels, JSON.stringify(['foo', 1]));
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal([]);
    });

    it('should return an empty array instead of throwing if window.localStorage access throws', () => {
      const throwingWindow = {
        get localStorage(): never {
          throw new Error('SecurityError: access denied');
        }
      } as unknown as Window;
      expect(getMoliLabelsFromStorage(throwingWindow)).to.deep.equal([]);
    });
  });

  describe('addMoliLabelToStorage', () => {
    it('should append a label to an empty store', () => {
      addMoliLabelToStorage(jsWindow, 'foo');
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal(['foo']);
    });

    it('should append without deduping or normalizing case', () => {
      addMoliLabelToStorage(jsWindow, 'foo');
      addMoliLabelToStorage(jsWindow, 'foo');
      addMoliLabelToStorage(jsWindow, 'Foo');
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal(['foo', 'foo', 'Foo']);
    });
  });

  describe('removeMoliLabelFromStorage', () => {
    it('should remove all occurrences of the exact string', () => {
      addMoliLabelToStorage(jsWindow, 'foo');
      addMoliLabelToStorage(jsWindow, 'bar');
      addMoliLabelToStorage(jsWindow, 'foo');
      removeMoliLabelFromStorage(jsWindow, 'foo');
      expect(getMoliLabelsFromStorage(jsWindow)).to.deep.equal(['bar']);
    });
  });

  describe('clearMoliLabelsFromStorage', () => {
    it('should remove the storage key entirely', () => {
      addMoliLabelToStorage(jsWindow, 'foo');
      clearMoliLabelsFromStorage(jsWindow);
      expect(jsWindow.localStorage.getItem(BrowserStorageKeys.moliLabels)).to.be.null;
    });
  });
});
