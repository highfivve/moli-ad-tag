import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import { resolveOverrides } from './resolveOverrides';
import { QueryParameters } from './queryParameters';
import { BrowserStorageKeys } from './browserStorageKeys';

// setup sinon-chai
use(sinonChai);

describe('resolveOverrides', () => {
  const dom = createDom();
  const jsWindow = dom.window as unknown as Window;

  const predicate = (value: string): value is 'test' => value === 'test';

  beforeEach(() => {
    dom.reconfigure({ url: 'https://example.com' });
    dom.window.localStorage.clear();
    dom.window.sessionStorage.clear();
  });

  describe('query param override', () => {
    it('should return null if no query param is set', () => {
      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return null if the predicate does not match', () => {
      dom.reconfigure({ url: 'https://example.com?moliEnv=wrong' });

      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return the query param value', () => {
      dom.reconfigure({ url: 'https://example.com?moliEnv=test' });

      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([{ source: 'queryParam', value: 'test' }]);
    });
  });

  describe('localStorage override', () => {
    it('should return null if no localStorage value is set', () => {
      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return null if the predicate does not match', () => {
      dom.window.localStorage.setItem(BrowserStorageKeys.moliEnv, 'wrong');
      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return the localStorage value', () => {
      dom.window.localStorage.setItem(BrowserStorageKeys.moliEnv, 'test');

      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([{ source: 'localStorage', value: 'test' }]);
    });
  });

  describe('sessionStorage override', () => {
    it('should return null if no sessionStorage value is set', () => {
      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return null if the predicate does not match', () => {
      dom.window.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'wrong');
      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([]);
    });

    it('should return the sessionStorage value', () => {
      dom.window.sessionStorage.setItem(BrowserStorageKeys.moliEnv, 'test');

      const result = resolveOverrides(
        jsWindow,
        QueryParameters.moliEnv,
        BrowserStorageKeys.moliEnv,
        predicate
      );
      expect(result).to.deep.equals([{ source: 'sessionStorage', value: 'test' }]);
    });
  });
});
