import { expect } from 'chai';
import { adVolumeToLabels } from './adVolume';

describe('adVolume', () => {
  describe('adVolumeToLabels', () => {
    it('returns an empty array for undefined', () => {
      expect(adVolumeToLabels(undefined)).to.deep.equal([]);
    });

    it('returns a single label for volume 1', () => {
      expect(adVolumeToLabels(1)).to.deep.equal(['av1']);
    });

    it('returns cumulative labels for volume 3', () => {
      expect(adVolumeToLabels(3)).to.deep.equal(['av1', 'av2', 'av3']);
    });

    it('returns 10 cumulative labels for volume 10', () => {
      expect(adVolumeToLabels(10)).to.deep.equal([
        'av1',
        'av2',
        'av3',
        'av4',
        'av5',
        'av6',
        'av7',
        'av8',
        'av9',
        'av10'
      ]);
    });
  });
});
