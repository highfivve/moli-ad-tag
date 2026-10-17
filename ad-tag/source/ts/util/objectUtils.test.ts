import { expect } from 'chai';
import { isPlainObject, mergeDeep } from './objectUtils';

describe('objectUtils', () => {
  describe('isPlainObject', () => {
    it('should return true for objects', () => {
      [{}, { a: 'b' }, { a: { b: 1 } }].forEach(obj => {
        expect(isPlainObject(obj)).to.be.true;
      });
    });

    it('should return false for none objects', () => {
      ['', 'string', 0, 1, [], [0], [1], [''], ['foo', 1], true, false, Object.is].forEach(
        something => {
          expect(isPlainObject(something)).to.be.false;
        }
      );
    });
  });

  describe('deepMerge', () => {
    it('should modify the target', () => {
      const target = {};
      const result = mergeDeep(target, { b: 2 });
      expect(result).to.deep.equals(target);
    });

    it('should merge if there are no intersections', () => {
      const result = mergeDeep({ a: 1 }, { b: 2 });
      expect(result).to.deep.equals({ a: 1, b: 2 });
    });

    it('should override with the source object values', () => {
      const result = mergeDeep({ a: 1 }, { a: 2 });
      expect(result).to.deep.equals({ a: 2 });
    });

    it('should override with the last source object values', () => {
      const result = mergeDeep({ a: 1 }, { a: 2 }, { a: 3 });
      expect(result).to.deep.equals({ a: 3 });
    });

    it('should merge arrays', () => {
      const result = mergeDeep({ a: [1] }, { a: [2] });
      expect(result).to.deep.equals({ a: [1, 2] });
    });

    it('should not alias a source array the target does not have', () => {
      const source = { a: [1] };
      const result = mergeDeep({}, source);
      result.a.push(2);
      expect(source.a).to.deep.equals([1]);
    });

    it('should not alias objects inside a source array', () => {
      const source = { a: [{ name: 'original' }] };
      const result = mergeDeep({}, source);
      result.a[0].name = 'changed';
      expect(source.a[0].name).to.equals('original');
    });

    it('should not alias a source array that is concatenated onto the target', () => {
      const source = { a: [{ name: 'original' }] };
      const result = mergeDeep({ a: [] }, source);
      result.a[0].name = 'changed';
      expect(source.a[0].name).to.equals('original');
    });

    it('should merge all primitive types', () => {
      const fn = Object.is;
      const result = mergeDeep({ a: 1, b: 'str' }, { c: false, d: fn });
      expect(result).to.deep.equals({ a: 1, b: 'str', c: false, d: fn });
    });
  });
});
