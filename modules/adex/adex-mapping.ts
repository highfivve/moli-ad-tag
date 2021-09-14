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
  const mapValue = extractStringOrNumber(
    keyValueMap,
    mappingDefinition.valueType,
    mappingDefinition.valueKey
  );

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

  const adexTargetValue = convertToAdexTargetValue(mapValue, mappingDefinition, logger);

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
  const value = extractStringOrNumber(
    keyValueMap,
    mappingDefinition.adexValueType,
    mappingDefinition.key
  );

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

  const adexTargetValue = convertToAdexTargetValue(value, mappingDefinition, logger);

  return {
    [mappingDefinition.attribute]: adexTargetValue!
  };
};

const sortAndJoin = (arr: Array<string>) => arr.sort().join(',');

const extractStringOrNumber = (
  keyValueMap: Moli.DfpKeyValueMap,
  valueType: 'number' | 'string',
  keyToExtract: string
): number | string | string[] | undefined =>
  valueType === 'number' ? Number(keyValueMap[keyToExtract]) : keyValueMap[keyToExtract];

const convertToAdexTargetValue = (
  value: string | number | Array<string> | undefined,
  mappingDefinition: MappingDefinition,
  logger: MoliLogger
) =>
  // if the value is truthy, ...
  value !== undefined && !Number.isNaN(value)
    ? // check if it's an array
      Array.isArray(value)
      ? // if it is, join it together
        sortAndJoin(value)
      : // else, just use the value itself.
        value
    : // if the value is falsy, use the default as fallback.
      logAndUseDefaultValue(mappingDefinition, logger);

const logAndUseDefaultValue = (mappingDefinition: MappingDefinition, logger: MoliLogger) => {
  logger.warn('Adex DMP', 'using defaultValue as fallback for key', mappingDefinition.key);
  return mappingDefinition.defaultValue;
};
