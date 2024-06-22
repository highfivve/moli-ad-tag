import MoliLogger = MoliRuntime.MoliLogger;
import { MoliRuntime } from '../../../types/moliRuntime';
import { GoogleAdManagerKeyValueMap } from '../../../types/moliConfig';
export type MappingDefinition = MappingDefinitionToAdexString | MappingDefinitionToAdexNumber | MappingDefinitionToAdexMap | MappingDefinitionToAdexList;
type AdexListObject = {
    [key: string]: 1;
};
export type AdexList = {
    [key: string]: AdexListObject;
};
export type AdexKeyValuePair = {
    [key: string]: string | number;
};
export type AdexKeyValueMap = {
    [key: string]: AdexKeyValuePair;
};
export type AdexKeyValues = AdexKeyValuePair | AdexKeyValueMap | AdexList;
interface ToAdexMapping {
    readonly key: string;
    readonly attribute: string;
}
interface MappingDefinitionToAdexList extends ToAdexMapping {
    readonly adexValueType: 'list';
    readonly defaultValue?: Array<string>;
}
interface MappingDefinitionToAdexMap extends ToAdexMapping {
    readonly adexValueType: 'map';
    readonly valueKey: string;
    readonly valueType: 'number' | 'string';
    readonly defaultValue?: number | string;
}
interface MappingDefinitionToAdexNumber extends ToAdexMapping {
    readonly adexValueType: 'number';
    readonly defaultValue?: number;
}
interface MappingDefinitionToAdexString extends ToAdexMapping {
    readonly adexValueType: 'string';
    readonly defaultValue?: string;
}
export declare const toAdexMapType: (keyValueMap: GoogleAdManagerKeyValueMap, mappingDefinition: MappingDefinitionToAdexMap, logger: MoliLogger) => AdexKeyValueMap | undefined;
export declare const toAdexStringOrNumberType: (keyValueMap: GoogleAdManagerKeyValueMap, mappingDefinition: MappingDefinitionToAdexString | MappingDefinitionToAdexNumber, logger: MoliLogger) => AdexKeyValuePair | undefined;
export declare const toAdexListType: (keyValueMap: GoogleAdManagerKeyValueMap, mappingDefinition: MappingDefinitionToAdexList, logger: MoliLogger) => AdexList | undefined;
export {};
