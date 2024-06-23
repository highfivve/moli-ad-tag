import { Device } from '../types/moliConfig';
export declare const removeChildId: (adUnitPath: string) => string;
export type AdUnitPathVariables = {
    [key: string]: string;
};
export declare const resolveAdUnitPath: (adUnitPath: string, adUnitPathVariables?: AdUnitPathVariables) => string;
export declare const withDepth: (adUnitPath: string, depth: number) => string;
export declare const generateAdUnitPathVariables: (hostname: string, device: Device, varsFromConfig?: AdUnitPathVariables, domainFromConfig?: string) => AdUnitPathVariables;
