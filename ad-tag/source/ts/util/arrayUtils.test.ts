import { flatten, uniquePrimitiveFilter } from './arrayUtils';
import { expect } from 'chai';

describe('flatten', () => {
  it('should flatten a 2-dimensional number array', () => {
    const flatArray = flatten([[200, 50], [300], [70]]);

    expect(new Set(flatArray)).to.deep.equal(new Set([50, 70, 200, 300]));
  });

  it('should flatten a 2-dimensional mixed array', () => {
    const flatArray = flatten<number | string>([[200, 50], ['whoa'], [70]]);

    expect(new Set(flatArray)).to.deep.equal(new Set([50, 70, 200, 'whoa']));
  });

  it('should reduce a 3-dimensional array to 2 dimensions', () => {
    const flatArray = flatten([[[200, 50]], [[350, 200]]]);

    expect(new Set(flatArray)).to.deep.equal(
      new Set([
        [200, 50],
        [350, 200]
      ])
    );
  });
});

describe('uniquePrimitiveFilter', () => {
  it('should be able to filter an array of numbers', () => {
    const uniqueArray = [20, 20, 30.05, 30.05, 5, 7, 19, 1337, 20].filter(uniquePrimitiveFilter);

    expect(uniqueArray).to.deep.equal([20, 30.05, 5, 7, 19, 1337]);
  });

  it('should be able to filter an array of strings', () => {
    const uniqueArray = ['same', 'same', 'but', 'different', 'but', 'still', 'the', 'same'].filter(
      uniquePrimitiveFilter
    );

    expect(uniqueArray).to.deep.equal(['same', 'but', 'different', 'still', 'the']);
  });

  it('should *not* be able to filter an array of a complex data type', () => {
    const uniqueArray = [
      { someNum: 20 },
      { someNum: 20 },
      { someNum: 5 },
      { someNum: 7 },
      { someNum: 19 },
      { someNum: 1337 },
      { someNum: 20 }
    ].filter(uniquePrimitiveFilter);

    expect(uniqueArray).to.not.deep.equal([
      { someNum: 20 },
      { someNum: 5 },
      { someNum: 7 },
      { someNum: 19 },
      { someNum: 1337 }
    ]);

    expect(uniqueArray).to.deep.equal([
      { someNum: 20 },
      { someNum: 20 },
      { someNum: 5 },
      { someNum: 7 },
      { someNum: 19 },
      { someNum: 1337 },
      { someNum: 20 }
    ]);
  });
});
