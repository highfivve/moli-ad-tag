import { AdexKeyValues } from './adex-mapping';
import { Moli } from '@highfivve/ad-tag';

type ValueOf<T> = T[keyof T];
type AdexKeyValueObject = {
  [key: string]: ValueOf<AdexKeyValues>;
};

const getAdvertisingIdIFAType = (clientType: string | undefined): 'aaid' | 'idfa' | undefined => {
  if (clientType === 'android') {
    return 'aaid';
  } else if (clientType === 'ios') {
    return 'idfa';
  } else {
    return;
  }
};

export const sendAdvertisingID = (
  adexCustomerId: string,
  adexTagId: string,
  advertisingId: string,
  adexAttributes: Array<AdexKeyValues>,
  clientType: string | string[],
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  logger: Moli.MoliLogger,
  consentString?: string
): void => {
  const ifaType = getAdvertisingIdIFAType(
    typeof clientType === 'string' ? clientType : clientType[0]
  );
  const keyValuesMap = adexAttributes.reduce<AdexKeyValueObject>((acc, currentValue) => {
    return { ...acc, ...currentValue };
  }, {});

  const keyValuesParameter = !!adexAttributes.length ? `&kv=${JSON.stringify(keyValuesMap)}` : '';
  const consentParameter = consentString ? `&gdpr_consent=${consentString}` : '';

  fetch(
    `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=${ifaType}${keyValuesParameter}${consentParameter}`
  ).catch(error => logger.error(error));
};
