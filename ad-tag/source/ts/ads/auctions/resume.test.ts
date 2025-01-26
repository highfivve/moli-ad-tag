import { expect, use } from 'chai';
import Sinon, { SinonSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import { resume, ResumeCallbackData } from './resume';
import { createDom } from '../../stubs/browserEnvSetup';

// setup sinon-chai
use(sinonChai);

describe('resume', () => {
  const dom = createDom();

  const jsDomWindow: Window = dom.window as any;
  const sandbox: SinonSandbox = Sinon.createSandbox();
  const setTimeoutSpy = sandbox.spy(jsDomWindow, 'setTimeout');
  let clock: Sinon.SinonFakeTimers = sandbox.useFakeTimers();

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.clock.restore();
  });

  it('should call the callback immediately if the wait time is exactly now', () => {
    const data: ResumeCallbackData = { ts: 100000, wait: 3000 };
    const callback = sandbox.spy();
    const now = data.ts + data.wait; // now is equal to waiting time

    resume(data, now, callback, jsDomWindow);

    expect(callback.calledOnce).to.be.true;
  });

  it('should call the callback immediately if the wait time has passed', () => {
    const data: ResumeCallbackData = { ts: 100000, wait: 3000 };
    const callback = sandbox.spy();
    const now = data.ts + data.wait + 1; // now has passed the waiting time

    resume(data, now, callback, jsDomWindow);

    expect(callback.calledOnce).to.be.true;
  });

  it('should schedule the callback if timestamp and now are identical', () => {
    const data: ResumeCallbackData = { ts: 100000, wait: 5000 };
    const callback = sandbox.spy();
    const now = data.ts; // now is the same as the timestamp

    resume(data, now, callback, jsDomWindow);

    expect(callback).to.have.not.been.called;
    expect(setTimeoutSpy).calledOnce;
    expect(setTimeoutSpy).calledOnceWithExactly(callback, data.wait);
  });

  it('should call the scheduled callback after the remaining wait time', () => {
    const data: ResumeCallbackData = { ts: 100000, wait: 5000 };
    const callback = sandbox.spy();
    const now = data.ts + 3000;

    resume(data, now, callback, jsDomWindow);

    clock.tick(3000);

    expect(callback).calledOnce;
  });
});
