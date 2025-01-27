import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import { remainingTime, ResumeCallbackData } from './resume';

// setup sinon-chai
use(sinonChai);

describe('remainingTime', () => {
  it('should return 0 if the wait time has already passed', () => {
    const fixedNow = 10000;
    const data: ResumeCallbackData = { ts: 5000, wait: 3000 };

    const result = remainingTime(data, fixedNow);

    expect(result).to.equal(0);
  });

  it('should return the remaining time if the wait time has not yet passed', () => {
    const fixedNow = 7000;
    const data: ResumeCallbackData = { ts: 5000, wait: 5000 };

    const result = remainingTime(data, fixedNow);

    expect(result).to.equal(3000);
  });

  it('should return the full wait time if the timestamp is now', () => {
    const fixedNow = 5000;
    const data: ResumeCallbackData = { ts: 5000, wait: 5000 };

    const result = remainingTime(data, fixedNow);

    expect(result).to.equal(5000);
  });
});
