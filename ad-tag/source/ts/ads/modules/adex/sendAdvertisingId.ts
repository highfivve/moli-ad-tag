import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { modules } from 'ad-tag/types/moliConfig';

type ValueOf<T> = T[keyof T];
type AdexKeyValueObject = {
  [key: string]: ValueOf<modules.adex.AdexKeyValues>;
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
  appName: string,
  advertisingId: string,
  adexAttributes: Array<modules.adex.AdexKeyValues>,
  clientType: string | string[],
  fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  logger: MoliRuntime.MoliLogger,
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
    `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=${ifaType}${keyValuesParameter}${consentParameter}&appName=${appName}`
  ).catch(error => logger.error(error));
};
