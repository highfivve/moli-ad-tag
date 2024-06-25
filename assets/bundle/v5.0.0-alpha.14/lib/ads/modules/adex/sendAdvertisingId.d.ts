import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { modules } from 'ad-tag/types/moliConfig';
import AdexKeyValues = modules.adex.AdexKeyValues;
export declare const sendAdvertisingID: (adexCustomerId: string, adexTagId: string, advertisingId: string, adexAttributes: Array<AdexKeyValues>, clientType: string | string[], fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>, logger: MoliRuntime.MoliLogger, consentString?: string) => void;
