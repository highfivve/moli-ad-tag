import { AdexKeyValues } from './adex-mapping';

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
  advertisingId: string | string[],
  adexAttributes: Array<AdexKeyValues>,
  clientType: string | string[],
  consentString?: string
): void => {
  const ifaType = getAdvertisingIdIFAType(
    typeof clientType === 'string' ? clientType : clientType[0]
  );
  const keyValuesJSONString: string = adexAttributes.reduce(
    (accumulator, currentValue) => accumulator + JSON.stringify(currentValue),
    ''
  );
  const consentParameter = consentString ? `&gdpr_consent=${consentString}` : '';

  try {
    fetch(
      `https://api.theadex.com/collector/v1/ifa/c/${adexCustomerId}/t/${adexTagId}/request?&ifa=${advertisingId}&ifa_type=${ifaType}&kv=${keyValuesJSONString}${consentParameter}`
    );
  } catch (error) {
    console.error(error);
  }
};
