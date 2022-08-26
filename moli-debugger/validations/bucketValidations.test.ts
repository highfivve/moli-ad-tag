import { expect } from 'chai';
import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { Message } from '../components/globalConfig';
import { checkBucketConfig } from './bucketValidations';

const mockedSlots = (bucket?: string) => {
  const slots: Moli.AdSlot[] = [
    {
      domId: 'id1',
      adUnitPath: '',
      sizes: [],
      position: 'in-page',
      behaviour: {
        ...(bucket && { bucket: bucket }),
        loaded: 'eager'
      },
      sizeConfig: []
    },
    {
      domId: 'id2',
      adUnitPath: '',
      sizes: [],
      position: 'in-page',
      behaviour: {
        loaded: 'eager'
      },
      sizeConfig: []
    }
  ];
  return slots;
};

describe('Buckets Validations', () => {
  it('should return the optimization message: "Buckets are disabled!" when bucket config is disabled, and there are no slots with defined buckets', () => {
    const messages: Message[] = [];
    const slots = mockedSlots();
    const buckets: Moli.bucket.GlobalBucketConfig = { enabled: false };
    checkBucketConfig(messages, buckets, slots);

    expect(messages).to.deep.include({
      kind: 'optimization',
      text: 'Buckets are disabled!'
    });
  });

  it('should return the error message: "Buckets are configured for ad slots, but buckets are disabled in the config!" when bucket config is disabled, and there is at least a slot with a defined bucket', () => {
    const messages: Message[] = [];
    const slots = mockedSlots('some bucket');
    const buckets: Moli.bucket.GlobalBucketConfig = { enabled: false };
    checkBucketConfig(messages, buckets, slots);

    expect(messages).to.deep.include({
      kind: 'error',
      text: 'Buckets are configured for ad slots, but buckets are disabled in the config!'
    });
  });
});

it('should return the error message: "Buckets are enabled in the config, but there are no ad units that have a bucket defined!", but there are no ad units that have a bucket defined', () => {
  const messages: Message[] = [];
  const slots = mockedSlots();
  const buckets: Moli.bucket.GlobalBucketConfig = { enabled: true };
  checkBucketConfig(messages, buckets, slots);

  expect(messages).to.deep.include({
    kind: 'error',
    text: 'Buckets are enabled in the config, but there are no ad units that have a bucket defined!'
  });
});

it('should show a warning about the slots that require defined buckets', () => {
  const messages: Message[] = [];
  const slots = mockedSlots('some bucket');
  const buckets: Moli.bucket.GlobalBucketConfig = { enabled: true };
  checkBucketConfig(messages, buckets, slots);

  expect(messages[0].kind).to.equal('warning');
});
