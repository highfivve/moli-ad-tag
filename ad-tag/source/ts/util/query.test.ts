import { expect } from 'chai';
import { parseQueryString } from "./query";

describe('query parameter utility', () => {
  describe('parseQueryString', () => {

    it('should parse an empty string to an empty map', () => {
      const result = parseQueryString('');
      expect(result).to.be.deep.equals(new Map());
    });

    it('should parse a single parameter', () => {
      const result = parseQueryString('?foo=bar');
      expect(result).to.have.length(1);
      expect(result.get('foo')).to.be.equals('bar');
    });

    it('should parse a multiple parameters', () => {
      const result = parseQueryString('?foo=bar&lost=found');
      expect(result).to.have.length(2);
      expect(result.get('foo')).to.be.equals('bar');
      expect(result.get('lost')).to.be.equals('found');
    });

    it('should use last value for repeating key', () => {
      const result = parseQueryString('?foo=bar&foo=baz');
      expect(result).to.have.length(1);
      expect(result.get('foo')).to.be.equals('baz');
    });

    it('should parse a uri encoded parameters', () => {
      const result = parseQueryString('?utm_source=verm%C3%B6genmagazin');
      expect(result).to.have.length(1);
      expect(result.get('utm_source')).to.be.equals('vermögenmagazin');
    });

    it('should return empty map if URI is unparsable', () => {
      const result = parseQueryString('?utm_source=verm%f6gensmagazin&utm_medium=redirect');
      expect(result).to.be.deep.equals(new Map());
    });

  });
});
