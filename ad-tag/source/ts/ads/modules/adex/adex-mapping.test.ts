import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import { toAdexListType, toAdexMapType, toAdexStringOrNumberType } from './adex-mapping';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import sinonChai from 'sinon-chai';
import { GoogleAdManagerKeyValueMap, modules } from 'ad-tag/types/moliConfig';

use(sinonChai);

describe('toAdexMapType', () => {
  it('should produce an AdexKeyValueMap with string value out of a DfpKeyValueMap', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannel: 'Pregnancy'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannel',
        valueType: 'string',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValueMap = { iab_cat: { Medical: 'Pregnancy' } };
    expect(result).to.deep.equal(expectedResult);
  });

  it('should produce an AdexKeyValueMap with number value out of a DfpKeyValueMap', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannelVersion: '1'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannelVersion',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValueMap = { iab_cat: { Medical: 1 } };
    expect(result).to.deep.equal(expectedResult);
  });

  it('should correctly treat zero values in number mode', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannelVersion: '0'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannelVersion',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValueMap = { iab_cat: { Medical: 0 } };
    expect(result).to.deep.equal(expectedResult);
  });

  it('should sort and join mapped values into a comma separated string', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannel: ['Pregnancy', 'ChildHealth']
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannel',
        valueType: 'string',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValueMap = {
      iab_cat: { Medical: 'ChildHealth,Pregnancy' }
    };
    expect(result).to.deep.equal(expectedResult);
  });

  it("shouldn't produce anything if the valueKey property is undefined", () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannelVersion',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it("shouldn't produce anything if value is not a number", () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannel: 'Pregnancy'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannel',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it('should use default if valueKey is not a number', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannel: 'Pregnancy'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannel',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat',
        defaultValue: 1337
      },
      { ...noopLogger, warn: warnSpy }
    );
    const expectedResult: modules.adex.AdexKeyValueMap = { iab_cat: { Medical: 1337 } };
    expect(result).to.deep.equal(expectedResult);
    // should warn about default value usage
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      'using defaultValue',
      1337,
      'as fallback for key',
      'channel'
    );
  });

  it('should set the defaultValue if value is undefined', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical'
    };
    const result = toAdexMapType(
      keyValues,
      {
        key: 'channel',
        valueKey: 'subChannelVersion',
        valueType: 'number',
        adexValueType: 'map',
        attribute: 'iab_cat',
        defaultValue: 1337
      },
      { ...noopLogger, warn: warnSpy }
    );
    const expectedResult: modules.adex.AdexKeyValueMap = { iab_cat: { Medical: 1337 } };
    expect(result).to.deep.equal(expectedResult);
    // should warn about default value usage
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      'using defaultValue',
      1337,
      'as fallback for key',
      'channel'
    );
  });
});

describe('toAdexStringOrNumberType', () => {
  it('should produce an AdexKeyValuePair with string value out of a GoogleAdManagerKeyValueMap', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannel: 'Pregnancy'
    };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'string',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: 'Medical' };
    expect(result).to.deep.equal(expectedResult);
  });

  it('should produce an AdexKeyValuePair with number value out of a GoogleAdManagerKeyValueMap', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannelVersion: '1'
    };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'subChannelVersion',
        adexValueType: 'number',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: 1 };
    expect(result).to.deep.equal(expectedResult);
  });

  it('should correctly treat zero values in number mode', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: 'Medical',
      subChannelVersion: '0'
    };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'subChannelVersion',
        adexValueType: 'number',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: 0 };
    expect(result).to.deep.equal(expectedResult);
  });

  it("shouldn't produce anything if the value property is undefined", () => {
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'string',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it("shouldn't produce anything if the value property is not a number but attributeType is number", () => {
    const keyValues: GoogleAdManagerKeyValueMap = { channel: 'Medical' };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'number',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it("shouldn't produce anything if the value should be a number but input is an array", () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: ['Pregnancy', 'Medical']
    };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'number',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it('should set the defaultValue if number value is undefined', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'number',
        attribute: 'iab_cat',
        defaultValue: 1337
      },
      { ...noopLogger, warn: warnSpy }
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: 1337 };
    expect(result).to.deep.equal(expectedResult);
    // should warn about default value usage
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      'using defaultValue',
      1337,
      'as fallback for key',
      'channel'
    );
  });

  it('should set the defaultValue if string value is undefined', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'string',
        attribute: 'iab_cat',
        defaultValue: '1337'
      },
      { ...noopLogger, warn: warnSpy }
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: '1337' };
    expect(result).to.deep.equal(expectedResult);
    // should warn about default value usage
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      'using defaultValue',
      '1337',
      'as fallback for key',
      'channel'
    );
  });

  it('should sort and join array values into a comma separated string', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channel: ['Pregnancy', 'Medical']
    };
    const result = toAdexStringOrNumberType(
      keyValues,
      {
        key: 'channel',
        adexValueType: 'string',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexKeyValuePair = { iab_cat: 'Medical,Pregnancy' };
    expect(result).to.deep.equal(expectedResult);
  });
});

describe('toAdexListType', () => {
  it('should produce an AdexList with string values out of a GoogleAdManagerKeyValueMap', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channels: ['Medical', 'Pregnancy']
    };
    const result = toAdexListType(
      keyValues,
      {
        key: 'channels',
        adexValueType: 'list',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexList = { iab_cat: { Medical: 1, Pregnancy: 1 } };
    expect(result).to.deep.equal(expectedResult);
  });

  it("shouldn't produce anything if the value property is undefined", () => {
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexListType(
      keyValues,
      {
        key: 'channels',
        adexValueType: 'list',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    expect(result).to.be.undefined;
  });

  it('should set the defaultValue if value is undefined', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexListType(
      keyValues,
      {
        key: 'channels',
        adexValueType: 'list',
        attribute: 'iab_cat',
        defaultValue: ['1337']
      },
      { ...noopLogger, warn: warnSpy }
    );
    const expectedResult: modules.adex.AdexList = { iab_cat: { '1337': 1 } };
    expect(result).to.deep.equal(expectedResult);
    // should warn about default value usage
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      'using defaultValue',
      ['1337'],
      'as fallback for key',
      'channels'
    );
  });

  it('should yield undefined if the value is empty and defaultValue is an empty array', () => {
    const warnSpy = Sinon.stub();
    const keyValues: GoogleAdManagerKeyValueMap = {};
    const result = toAdexListType(
      keyValues,
      {
        key: 'channels',
        adexValueType: 'list',
        attribute: 'iab_cat',
        defaultValue: []
      },
      { ...noopLogger, warn: warnSpy }
    );
    expect(result).to.be.undefined;
    // should warn about empty value
    expect(warnSpy).to.have.been.calledOnceWithExactly(
      'Adex DMP',
      `value for key "channels" was empty or number. Value:`,
      undefined
    );
  });

  it('should sort and join array values into an Adex list object', () => {
    const keyValues: GoogleAdManagerKeyValueMap = {
      channels: ['Pregnancy', 'Medical']
    };
    const result = toAdexListType(
      keyValues,
      {
        key: 'channels',
        adexValueType: 'list',
        attribute: 'iab_cat'
      },
      noopLogger
    );
    const expectedResult: modules.adex.AdexList = { iab_cat: { Medical: 1, Pregnancy: 1 } };
    expect(result).to.deep.equal(expectedResult);
  });
});
