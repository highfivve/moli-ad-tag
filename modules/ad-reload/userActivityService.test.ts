import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import {
  UserActivityLevelControl,
  UserActivityParameters,
  userActivityParametersForLevel,
  UserActivityService
} from './userActivityService';
import { noopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';

use(sinonChai);

describe('UserActivityService', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;
  (jsDomWindow as any).id = Math.random();
  const logger = noopLogger;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    (jsDomWindow as any).id = Math.random();
    sandbox.reset();
  });

  new Map<UserActivityLevelControl['level'], UserActivityParameters>([
    ...Array.from(userActivityParametersForLevel),
    ['custom', { userActivityDuration: 4000, userBecomingInactiveDuration: 2000 }]
  ]).forEach(({ userActivityDuration, userBecomingInactiveDuration }, mode) => {
    it(`should check user activity after ${
      userBecomingInactiveDuration / 1000
    } seconds, mark inactive after ${userActivityDuration / 1000} seconds in ${mode} mode`, () => {
      sandbox.useFakeTimers();
      const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');
      const addEventListenerSpy = sandbox.spy(jsDomWindow, 'addEventListener');
      const userActivityListenerStub = sandbox.stub();

      const userActivityService = new UserActivityService(
        jsDomWindow,
        mode === 'custom'
          ? { level: mode, userActivityDuration, userBecomingInactiveDuration }
          : { level: mode },
        logger
      );
      userActivityService.addUserActivityChangedListener(userActivityListenerStub);

      expect(setTimeoutSpy).to.have.been.calledTwice;
      sandbox.clock.tick(userBecomingInactiveDuration);
      expect(addEventListenerSpy).to.have.callCount(4);
      sandbox.clock.tick(userActivityDuration);
      expect(userActivityListenerStub).to.have.been.calledOnceWithExactly(false);
    });
  });
});
