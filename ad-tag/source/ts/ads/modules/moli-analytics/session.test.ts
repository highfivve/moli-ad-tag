import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSession } from 'ad-tag/ads/modules/moli-analytics/session';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { BrowserStorageKeys } from 'ad-tag/util/browserStorageKeys';

use(sinonChai);

describe('Analytics session', () => {
  const sandbox = sinon.createSandbox();
  const storageKey = BrowserStorageKeys.molyAnalyticsSession;
  let { jsDomWindow, dom } = createDomAndWindow();
  const defaultContext = adPipelineContext(jsDomWindow);

  beforeEach(() => {
    sandbox.useFakeTimers({ now: 1000 });
  });

  afterEach(() => {
    sandbox.restore();
    defaultContext.window__.localStorage.removeItem(storageKey);
  });

  it('should create session', () => {
    const session = createSession(defaultContext.window__, 30);
    expect(session).an('object');
    expect(session).have.property('getId');
    expect(session.getId).a('function');

    const id = session.getId();
    expect(id).a('string').and.not.empty;

    const storageValue = defaultContext.window__.localStorage.getItem(storageKey);
    expect(storageValue).a('string').and.not.empty;

    const decoded = JSON.parse(storageValue!);
    expect(decoded).an('object').and.have.property('id', id);

    expect(session.getId()).eq(id);
  });

  it('should recreate session from storage', () => {
    const id = 'test-id';
    const storageValue = JSON.stringify({ id, createdAt: Date.now(), lastActivityAt: Date.now() });
    defaultContext.window__.localStorage.setItem(storageKey, storageValue);
    const session = createSession(defaultContext.window__, 1);
    expect(session.getId()).eq(id);
  });

  it('should not recreate session from storage if expired', () => {
    const id = 'test-id';
    const storageValue = JSON.stringify({
      id,
      createdAt: Date.now(),
      lastActivityAt: Date.now() - 60_001
    });
    defaultContext.window__.localStorage.setItem(storageKey, storageValue);
    const session = createSession(defaultContext.window__, 1);
    expect(session.getId()).not.eq(id);
  });

  it('should not recreate session from storage if invalid', () => {
    const id = 'test-id';
    const storageValue = JSON.stringify({ id, lastActivityAt: Date.now() });
    defaultContext.window__.localStorage.setItem(storageKey, storageValue);
    const session = createSession(defaultContext.window__, 1);
    expect(session.getId()).not.eq(id);
  });

  it('should update last activity time', () => {
    createSession(defaultContext.window__, 1);
    const now = Date.now();
    sandbox.clock.tick(11_000);
    jsDomWindow.dispatchEvent(new dom.window.CustomEvent('scroll'));

    const storageValue = defaultContext.window__.localStorage.getItem(storageKey);
    const decoded = JSON.parse(storageValue!);

    expect(decoded.lastActivityAt).gt(now);
  });
});
