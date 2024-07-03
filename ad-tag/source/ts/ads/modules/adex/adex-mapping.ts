import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { GoogleAdManagerKeyValueMap, modules } from 'ad-tag/types/moliConfig';

/**
 * Extract Adex map data objects from targeting key/values.
 */
export const toAdexMapType = (
  keyValueMap: GoogleAdManagerKeyValueMap,
  mappingDefinition: modules.adex.MappingDefinitionToAdexMap,
  logger: MoliRuntime.MoliLogger
): modules.adex.AdexKeyValueMap | undefined => {
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
  keyValueMap: GoogleAdManagerKeyValueMap,
  mappingDefinition:
    | modules.adex.MappingDefinitionToAdexString
    | modules.adex.MappingDefinitionToAdexNumber,
  logger: MoliRuntime.MoliLogger
): modules.adex.AdexKeyValuePair | undefined => {
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

/**
 * Extract Adex list objects from targeting key/values.
 */
export const toAdexListType = (
  keyValueMap: GoogleAdManagerKeyValueMap,
  mappingDefinition: modules.adex.MappingDefinitionToAdexList,
  logger: MoliRuntime.MoliLogger
): modules.adex.AdexList | undefined => {
  const value = extractStringOrNumber(keyValueMap, 'string', mappingDefinition.key);

  if (
    // adex `value` is empty and no default value specified
    (value === undefined &&
      (mappingDefinition.defaultValue === undefined ||
        mappingDefinition.defaultValue.length === 0)) ||
    typeof value === 'number'
  ) {
    logger.warn(
      'Adex DMP',
      `value for key "${mappingDefinition.key}" was empty or number. Value:`,
      value
    );
    return undefined;
  }

  const adexTargetValue = convertToAdexListValue(value, mappingDefinition, logger);

  return {
    [mappingDefinition.attribute]: adexTargetValue!
  };
};

const sortAndToListObject = (arr: Array<string>): modules.adex.AdexListObject =>
  Object.fromEntries(arr.sort().map(listValue => [listValue, 1]));

const sortAndJoin = (arr: Array<string>) => arr.sort().join(',');

const extractStringOrNumber = (
  keyValueMap: GoogleAdManagerKeyValueMap,
  valueType: 'number' | 'string',
  keyToExtract: string
) => (valueType === 'number' ? Number(keyValueMap[keyToExtract]) : keyValueMap[keyToExtract]);

const convertToAdexTargetValue = (
  value: string | number | Array<string> | undefined,
  mappingDefinition: Exclude<
    modules.adex.MappingDefinition,
    modules.adex.MappingDefinitionToAdexList
  >,
  logger: MoliRuntime.MoliLogger
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
      (logAndUseDefaultValue(mappingDefinition, logger) as string | number | undefined);

const convertToAdexListValue = (
  value: string | Array<string> | undefined,
  mappingDefinition: modules.adex.MappingDefinitionToAdexList,
  logger: MoliRuntime.MoliLogger
): modules.adex.AdexListObject | undefined => {
  if (value === undefined) {
    // if the value is falsy, use the default as fallback.
    return logAndUseDefaultValue(mappingDefinition, logger) as
      | modules.adex.AdexListObject
      | undefined;
  }

  // if the value is truthy, ...
  // check if it's an array
  return Array.isArray(value)
    ? // if it is, construct the "list" object
      sortAndToListObject(value)
    : // else, just use the value itself as key and the literal 1 as value.
      { [value]: 1 };
};

const logAndUseDefaultValue = (
  mappingDefinition: modules.adex.MappingDefinition,
  logger: MoliRuntime.MoliLogger
) => {
  logger.warn(
    'Adex DMP',
    'using defaultValue',
    mappingDefinition.defaultValue,
    'as fallback for key',
    mappingDefinition.key
  );
  return mappingDefinition.adexValueType === 'list'
    ? mappingDefinition.defaultValue
      ? sortAndToListObject(mappingDefinition.defaultValue)
      : undefined
    : mappingDefinition.defaultValue;
};
