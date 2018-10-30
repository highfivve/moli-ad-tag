import test, { GenericTestContext } from 'ava';

import { bidderSettings } from './bidderSettings';
import { prebidjs } from '../../types/prebidjs';

test('prebid result should return string of fixed precision', (t: GenericTestContext<any>) => {

  t.plan(21);

  // Standard Setting
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 0.00123456789} as prebidjs.IBidResponse), '0.00');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 0.0123456789} as prebidjs.IBidResponse), '0.01');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 0.1234567890} as prebidjs.IBidResponse), '0.12');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 1.234567890} as prebidjs.IBidResponse), '1.23');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 12.34567890} as prebidjs.IBidResponse), '12.34');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 123.4567890} as prebidjs.IBidResponse), '45.50');
  });

  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 21.499} as prebidjs.IBidResponse), '21.49');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 21.50} as prebidjs.IBidResponse), '21.50');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 21.501} as prebidjs.IBidResponse), '21.50');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 21.999} as prebidjs.IBidResponse), '21.50');
  });

  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 32.251} as prebidjs.IBidResponse), '32.00');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 32.501} as prebidjs.IBidResponse), '32.50');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 32.751} as prebidjs.IBidResponse), '32.50');
  });

  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 43.499} as prebidjs.IBidResponse), '43.00');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 45.50} as prebidjs.IBidResponse), '45.50');
  });
  bidderSettings.standard.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 45.501} as prebidjs.IBidResponse), '45.50');
  });


  // Smart Setting
  bidderSettings.smartadserver.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 0.00123456789} as prebidjs.IBidResponse), '0.00');
  });
  bidderSettings.smartadserver.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 1.234567890} as prebidjs.IBidResponse), '1.23');
  });
  bidderSettings.smartadserver.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 12.34567890} as prebidjs.IBidResponse), '12.34');
  });
  bidderSettings.smartadserver.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 21.999} as prebidjs.IBidResponse), '21.99');
  });
  bidderSettings.smartadserver.adserverTargeting.filter(targeting =>
    targeting.key.includes('hb_pb')).map(targeting => {
    t.is(targeting.val({cpm: 45.501} as prebidjs.IBidResponse), '45.50');
  });
});
