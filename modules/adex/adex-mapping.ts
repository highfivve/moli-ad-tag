import { Moli } from '@highfivve/ad-tag';
import DfpKeyValueMap = Moli.DfpKeyValueMap;
import MoliLogger = Moli.MoliLogger;

export type MappingDefinition =
  | MappingDefinitionToAdexString
  | MappingDefinitionToAdexNumber
  | MappingDefinitionToAdexMap;

export type AdexKeyValuePair = {
  [key: string]: string | number;
};
export type AdexKeyValueMap = {
  [key: string]: AdexKeyValuePair;
};
export type AdexKeyValues = AdexKeyValuePair | AdexKeyValueMap;

interface ToAdexMapping {
  readonly key: string;
  readonly attribute: string;
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

/**
 * Extract Adex map data objects from targeting key/values.
 */
export const toAdexMapType = (
  keyValueMap: DfpKeyValueMap,
  mappingDefinition: MappingDefinitionToAdexMap,
  logger: MoliLogger
): AdexKeyValueMap | undefined => {
  const mapKey = keyValueMap[mappingDefinition.key];
  const mapValue =
    mappingDefinition.valueType === 'number'
      ? Number(keyValueMap[mappingDefinition.valueKey])
      : keyValueMap[mappingDefinition.valueKey];

  if (
    // map `key` field not found
    !mapKey ||
    // map `key` is present but an array
    Array.isArray(mapKey) ||
    // map `value` not found and no default value specified
    (mapValue === undefined && mappingDefinition.defaultValue === undefined) ||
    // number type specified for `value` but input value is not a number and no default value specified
    (mappingDefinition.valueType === 'number' &&
      Number.isNaN(mapValue) &&
      mappingDefinition.defaultValue === undefined)
  ) {
    logger.warn(
      'Adex DMP',
      `values for key ${mappingDefinition.key}/valueKey ${mappingDefinition.valueKey} were empty or key was an array. Key/Value:`,
      mapKey,
      mapValue
    );
    return undefined;
  }

  const adexTargetValue =
    mapValue !== undefined && !Number.isNaN(mapValue)
      ? Array.isArray(mapValue)
        ? sortAndJoin(mapValue)
        : mapValue
      : mappingDefinition.defaultValue;

  return {
    [mappingDefinition.attribute]: {
      [mapKey]: adexTargetValue!
    }
  };
};

/**
 * Extract Adex string or number data objects from targeting key/values.
 */
export const toAdexStringOrNumberType = (
  keyValueMap: DfpKeyValueMap,
  mappingDefinition: MappingDefinitionToAdexString | MappingDefinitionToAdexNumber,
  logger: MoliLogger
): AdexKeyValuePair | undefined => {
  const value =
    mappingDefinition.adexValueType === 'number'
      ? Number(keyValueMap[mappingDefinition.key])
      : keyValueMap[mappingDefinition.key];

  if (
    // adex `value` is empty and no default value specified
    (value === undefined && mappingDefinition.defaultValue === undefined) ||
    // number type specified for `value`...
    // - but input value is not a number and no default value specified OR
    // - `value` is an array
    (mappingDefinition.adexValueType === 'number' &&
      ((Number.isNaN(value) && mappingDefinition.defaultValue === undefined) ||
        Array.isArray(value)))
  ) {
    logger.warn(
      'Adex DMP',
      `value for key ${mappingDefinition.key} was empty or key was an array. Value:`,
      value
    );
    return undefined;
  }

  const adexTargetValue =
    value !== undefined && !Number.isNaN(value)
      ? Array.isArray(value)
        ? sortAndJoin(value)
        : value
      : mappingDefinition.defaultValue;

  return {
    [mappingDefinition.attribute]: adexTargetValue!
  };
};

const sortAndJoin = (arr: Array<string>) => arr.sort().join(',');
