import { AdexKeyValues } from './adex-mapping';
import { MoliRuntime } from '../../../types/moliRuntime';
export declare const sendAdvertisingID: (adexCustomerId: string, adexTagId: string, advertisingId: string, adexAttributes: Array<AdexKeyValues>, clientType: string | string[], fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>, logger: MoliRuntime.MoliLogger, consentString?: string) => void;
