import { expect } from 'chai';
import { detectGeoFromTimezone } from './detectGeoFromTimezone';

describe('detectGeoFromTimezone', () => {
  describe('known country timezones', () => {
    it('should detect Germany', () => {
      expect(detectGeoFromTimezone('Europe/Berlin')).to.deep.equal({
        country: 'DE',
        continent: 'europe'
      });
    });

    it('should detect United Kingdom', () => {
      expect(detectGeoFromTimezone('Europe/London')).to.deep.equal({
        country: 'GB',
        continent: 'europe'
      });
    });

    it('should detect France', () => {
      expect(detectGeoFromTimezone('Europe/Paris')).to.deep.equal({
        country: 'FR',
        continent: 'europe'
      });
    });

    it('should detect Spain including Canary Islands', () => {
      expect(detectGeoFromTimezone('Europe/Madrid')).to.deep.equal({
        country: 'ES',
        continent: 'europe'
      });
      expect(detectGeoFromTimezone('Atlantic/Canary')).to.deep.equal({
        country: 'ES',
        continent: 'atlantic'
      });
    });

    it('should detect Portugal including island territories', () => {
      expect(detectGeoFromTimezone('Europe/Lisbon')).to.deep.equal({
        country: 'PT',
        continent: 'europe'
      });
      expect(detectGeoFromTimezone('Atlantic/Azores')).to.deep.equal({
        country: 'PT',
        continent: 'atlantic'
      });
      expect(detectGeoFromTimezone('Atlantic/Madeira')).to.deep.equal({
        country: 'PT',
        continent: 'atlantic'
      });
    });

    it('should detect USA across multiple timezones', () => {
      expect(detectGeoFromTimezone('America/New_York')).to.deep.equal({
        country: 'US',
        continent: 'america'
      });
      expect(detectGeoFromTimezone('America/Chicago')).to.deep.equal({
        country: 'US',
        continent: 'america'
      });
      expect(detectGeoFromTimezone('America/Los_Angeles')).to.deep.equal({
        country: 'US',
        continent: 'america'
      });
      expect(detectGeoFromTimezone('Pacific/Honolulu')).to.deep.equal({
        country: 'US',
        continent: 'pacific'
      });
    });

    it('should detect Mexico', () => {
      expect(detectGeoFromTimezone('America/Mexico_City')).to.deep.equal({
        country: 'MX',
        continent: 'america'
      });
      expect(detectGeoFromTimezone('America/Cancun')).to.deep.equal({
        country: 'MX',
        continent: 'america'
      });
      expect(detectGeoFromTimezone('America/Tijuana')).to.deep.equal({
        country: 'MX',
        continent: 'america'
      });
    });
  });

  describe('continent fallback', () => {
    it('should use africa prefix for African timezones', () => {
      expect(detectGeoFromTimezone('Africa/Cairo')).to.deep.equal({
        country: undefined,
        continent: 'africa'
      });
      expect(detectGeoFromTimezone('Africa/Lagos')).to.deep.equal({
        country: undefined,
        continent: 'africa'
      });
    });

    it('should use america prefix for unknown American timezones', () => {
      expect(detectGeoFromTimezone('America/Bogota')).to.deep.equal({
        country: undefined,
        continent: 'america'
      });
      expect(detectGeoFromTimezone('America/Sao_Paulo')).to.deep.equal({
        country: undefined,
        continent: 'america'
      });
    });

    it('should use europe prefix for unknown European timezones', () => {
      expect(detectGeoFromTimezone('Europe/Athens')).to.deep.equal({
        country: undefined,
        continent: 'europe'
      });
      expect(detectGeoFromTimezone('Europe/Istanbul')).to.deep.equal({
        country: undefined,
        continent: 'europe'
      });
    });

    it('should use asia prefix for Asian timezones', () => {
      expect(detectGeoFromTimezone('Asia/Tokyo')).to.deep.equal({
        country: undefined,
        continent: 'asia'
      });
      expect(detectGeoFromTimezone('Asia/Shanghai')).to.deep.equal({
        country: undefined,
        continent: 'asia'
      });
    });

    it('should use pacific prefix for Pacific timezones', () => {
      expect(detectGeoFromTimezone('Pacific/Auckland')).to.deep.equal({
        country: undefined,
        continent: 'pacific'
      });
    });

    it('should return undefined continent for timezones without a slash', () => {
      expect(detectGeoFromTimezone('UTC')).to.deep.equal({
        country: undefined,
        continent: undefined
      });
    });
  });
});
