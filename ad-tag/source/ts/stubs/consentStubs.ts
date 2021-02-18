import { tcfapi } from '../types/tcfapi';

/**
 *
 * @param returnValue the returnValue passed into the callback function
 */
export const tcfapiFunction = (returnValue: any) => (
  cmd: string,
  version: 2,
  callback: Function,
  params?: any
): void => {
  callback(returnValue, true);
};

export const fullConsent = (vendorConsents: tcfapi.BooleanVector = {}): tcfapi.responses.TCData => {
  return {
    cmpId: 6,
    cmpVersion: 1,
    gdprApplies: true,
    tcfPolicyVersion: 2,
    eventStatus: tcfapi.status.EventStatus.TC_LOADED,
    cmpStatus: tcfapi.status.CmpStatus.LOADED,
    tcString:
      'CO7_aP6O7_aP6AGABCENA9CgAP_AAH_AAAYgGhtf_X9fb2_j-_5999t0eY1f9_63v-wzjgeNs-8NyZ_X_L4XtmMyvB34pq4KmR4Eu3LBAQdlHGHcTQmQwIkVqTLsak2Mr7NKJ7JEilMbO2dYGH9vn8XT_ZKY70_____7_3-_____77YAAIGXgEGAAKAAACCAAIEChEIAAIQxIAAAAAihEAgEkACRQADK4CKQACABAYgIQIAQAgoQYBAAIAAEkAQAgBQIBAARAIAAQACAEAACAAEFgBICAAACAEhAARABCBAQRAAQchgQEQBBACgAgJjICwAFAAVAA1ACGAEwALgAjgBlgDUgH2AfgBGACOAFLAK2AbwBMQCbAFogLYAYEAw8BkQiA4ACoAGoAVgAuACGAGQAMsAagA2QB-AEAAIwAUsAp4BrAD5AIbAQ6Ai8BIgCbAE7AKRAXIAwIBhIDDwGTiQAIADgkEgABAAC4AKAAqABkADgAHgAQAAiABUADCAGgAagA8gCGAIgATIAqgCsAFgALgAbwA5gB6AENAIgAiQBLACaAFKAMMAZAAy4BqAGqANkAd4A9gB8QD7AP0AgABGACOAFLAKeAX4AwgBigDWAG0ANwAbwA9AB8gENgIdARUAi8BIgCYgEygJsATsAocBSICxQFsALkAXeAwIBgwDCQGGgMPAZEAyQBk4DLgoAEAYQQAGAM0BeQDIw0B8AFQAVgAuACGAGQAMsAagA2QB-AEAAIKARgApYBT4C0ALSAawA3gB8gENgIdAReAkQBNgCdgFIgLkAYEAwkBh4DGAGThwAIADhUBcACgAKgAhgBMAC4AI4AZYA1AB-AEYAI4AUuAtAC0gG8ASCAmIBNgCmwFsALkAYEAw8BkQ6CiAAuACgAKgAZAA4ACAAEQAKoAYABjADQANQAeAA-gCGAIgATIAqgCsAFgALgAYgAzABvADmAHoAQwAiABLACYAE0AKUAWIAwwBkADKAGiANQAbIA3wB3gD2gH2AfoBFgCMAEcAJSAU8AsUBaAFpALmAXkAvwBhADFAG0ANxAdMB1AD0AIbAQ6AiIBF4CQQEiAJsATsAocBTQCrAFiwLYAtkBcAC5AF2gLvAYSAw0Bh4DEgGMAMeAZIAycBlQDLh4AEBFQ4AMAA4AC4AzQCMgF1APkQgYAALAAoABkAEQAKgAYgBDACYAFUALgAYgAzABvAD0AI4AWIAygBqADfAHfAPsA_ACBgEYAI4ASkAoYBT4C0ALSAX4AwgBigDaAHUAPQAkEBIgCbAFNALFAWjAtgC2gFwALkAXaAw8BiQDIgGTkAAIBGSUCkABAACwAKAAZAA4ACKAGAAYgA8ACIAEwAKoAXAAxABmADaAIaARABEgClAGEAMoAaoA2QB3gD8AIwARwAp8BaAFpAMUAbgA6gCHQEXgJEATYAsUBbAC7QGHgMiAZOTAAgIqJAAwALgEZAJ8UgfAALgAoACoAGQAOAAgABEACqAGAAYwA0ADUAHkAQwBEACYAFIAKoAWAAuABiADMAHMAQwAiABSgCxAGUANEAaoA2QB3wD7AP0AiwBGACOAEpAKGAVsAuYBeQDCAG0ANwAegBDoCLwEiAJsATsAocBTQCtgFigLYAXAAuQBdoDDQGHgMSAYwAyIBkgDJwGXFAAQAFwCRAA.YAAAAAAAAAAA',
    isServiceSpecific: true,
    listenerId: null,
    useNonStandardStacks: false,
    purposeOneTreatment: false,
    publisherCC: 'DE',
    purpose: {
      consents: {
        '1': true,
        '2': true,
        '3': true,
        '4': true,
        '5': true,
        '6': true,
        '7': true,
        '8': true,
        '9': true,
        '10': true
      },
      legitimateInterests: {
        '1': false,
        '2': true,
        '3': true,
        '4': true,
        '5': true,
        '6': true,
        '7': true,
        '8': true,
        '9': true,
        '10': true
      }
    },
    vendor: {
      consents: vendorConsents,
      legitimateInterests: {}
    },
    specialFeatureOptins: {},
    publisher: {
      consents: {},
      legitimateInterests: {},
      customPurpose: { consents: {}, legitimateInterests: {} },
      restrictions: {}
    }
  };
};

export const tcData: tcfapi.responses.TCData = fullConsent();
