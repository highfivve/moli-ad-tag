import React, { Fragment, PropsWithChildren } from 'react';

import { Tag, TagLabel } from './tag';
import { SubHeadline, TagContainer } from './ui';
import { modules } from '../../types/moliConfig';

/**
 * Concise, hand crafted views for each module configuration.
 *
 * Every module gets its own component that surfaces the values that matter for
 * debugging instead of the former generic key/value dump. Unknown or future
 * modules fall back to the generic renderer.
 */

/** boolean rendered as a yes/no tag */
const BoolTag: React.FC<{
  value: boolean | undefined;
  trueLabel?: string;
  falseLabel?: string;
}> = ({ value, trueLabel, falseLabel }) => (
  <Tag variant={value ? 'green' : 'grey'}>
    {value ? (trueLabel ?? 'yes') : (falseLabel ?? 'no')}
  </Tag>
);

/** label + values in one row; renders nothing when value is undefined */
const Row: React.FC<PropsWithChildren<{ label: string; subEntry?: boolean }>> = ({
  label,
  subEntry,
  children
}) => (
  <TagContainer subEntry={subEntry}>
    <TagLabel>{label}</TagLabel>
    {children}
  </TagContainer>
);

/** list of primitive values as tags, or a "none" hint */
const ListTags: React.FC<{
  values: ReadonlyArray<string | number> | undefined;
  variant?: 'blue' | 'green' | 'grey';
}> = ({ values, variant }) =>
  values && values.length > 0 ? (
    <>
      {values.map((value, index) => (
        <Tag key={index} variant={variant ?? 'blue'}>
          {value}
        </Tag>
      ))}
    </>
  ) : (
    <i>none</i>
  );

const AdexModule: React.FC<{ config: modules.adex.AdexConfig }> = ({ config }) => (
  <>
    <Row label="Customer / Tag ID">
      <Tag>{config.adexCustomerId}</Tag>
      <Tag>{config.adexTagId}</Tag>
    </Row>
    <Row label="App name">
      <Tag>{config.appName}</Tag>
    </Row>
    <Row label="SPA mode">
      <BoolTag value={config.spaMode} />
    </Row>
    <Row label="Mappings">
      {config.mappingDefinitions.length === 0 ? (
        <i>none</i>
      ) : (
        config.mappingDefinitions.map((mapping, index) => (
          <Tag key={index} variant="grey">
            {mapping.key} → {mapping.attribute} ({mapping.adexValueType})
          </Tag>
        ))
      )}
    </Row>
    {config.enabledPartners && (
      <Row label="Cookie matching partners">
        <ListTags values={config.enabledPartners} />
      </Row>
    )}
    {config.appConfig && (
      <Row label="App config keys">
        <Tag variant="grey">clientType: {config.appConfig.clientTypeKey}</Tag>
        <Tag variant="grey">advertiserId: {config.appConfig.advertiserIdKey}</Tag>
        {config.appConfig.adexMobileTagId && (
          <Tag variant="grey">mobileTagId: {config.appConfig.adexMobileTagId}</Tag>
        )}
      </Row>
    )}
  </>
);

const AdReloadModule: React.FC<{ config: modules.adreload.AdReloadModuleConfig }> = ({
  config
}) => (
  <>
    <Row label="Refresh interval">
      <Tag>
        {config.refreshIntervalMs !== undefined ? `${config.refreshIntervalMs}ms` : 'default'}
      </Tag>
    </Row>
    <Row label="User activity level">
      <Tag variant="grey">{config.userActivityLevelControl?.level ?? 'default'}</Tag>
    </Row>
    <Row label="Visibility checks">
      <BoolTag
        value={!config.disableAdVisibilityChecks}
        trueLabel="enabled"
        falseLabel="disabled"
      />
    </Row>
    <Row label="Excluded slots">
      <ListTags values={config.excludeAdSlotDomIds} variant="grey" />
    </Row>
    <Row label="CLS optimized slots">
      <ListTags values={config.optimizeClsScoreDomIds} variant="grey" />
    </Row>
    <Row label="Advertisers (include)">
      <ListTags values={config.includeAdvertiserIds} variant="green" />
    </Row>
    <Row label="Yield groups (include)">
      <ListTags values={config.includeYieldGroupIds} variant="green" />
    </Row>
    <Row label="Orders (include)">
      <ListTags values={config.includeOrderIds} variant="green" />
    </Row>
    <Row label="Orders (exclude)">
      <ListTags values={config.excludeOrderIds} variant="grey" />
    </Row>
    {config.refreshIntervalMsOverrides &&
      Object.keys(config.refreshIntervalMsOverrides).length > 0 && (
        <>
          <SubHeadline>Refresh interval overrides</SubHeadline>
          {Object.entries(config.refreshIntervalMsOverrides).map(([domId, override]) => (
            <Row key={domId} label={domId} subEntry>
              {typeof override === 'number' ? (
                <Tag>{override}ms</Tag>
              ) : (
                <>
                  {override.default !== undefined && <Tag>default {override.default}ms</Tag>}
                  {override.bidders &&
                    Object.entries(override.bidders).map(([bidder, interval]) => (
                      <Tag key={bidder} variant="grey">
                        {bidder}: {interval}ms
                      </Tag>
                    ))}
                </>
              )}
            </Row>
          ))}
        </>
      )}
    {config.viewabilityOverrides && Object.keys(config.viewabilityOverrides).length > 0 && (
      <>
        <SubHeadline>Viewability overrides</SubHeadline>
        {Object.entries(config.viewabilityOverrides).map(([domId, override]) => (
          <Row key={domId} label={domId} subEntry>
            {override?.variant === 'css' && <Tag variant="grey">css: {override.cssSelector}</Tag>}
            {override?.variant === 'disabled' && <Tag variant="yellow">checks disabled</Tag>}
            {override?.refreshBucket && <Tag variant="yellow">refreshes bucket</Tag>}
          </Row>
        ))}
      </>
    )}
  </>
);

const BlocklistModule: React.FC<{
  config:
    | modules.blocklist.BlocklistUrlsBlockingConfig
    | modules.blocklist.BlocklistUrlsKeyValueConfig;
}> = ({ config }) => (
  <>
    <Row label="Mode">
      <Tag variant={config.mode === 'block' ? 'red' : 'yellow'}>{config.mode}</Tag>
    </Row>
    <Row label="Provider">
      <Tag variant="grey">{config.blocklist.provider}</Tag>
      {config.blocklist.provider === 'dynamic' && <Tag>{config.blocklist.endpoint}</Tag>}
    </Row>
    {config.blocklist.provider === 'static' && (
      <>
        <Row label="Blocked URL patterns">
          <ListTags
            values={config.blocklist.blocklist.urls.map(
              entry => `${entry.matchType}: ${entry.pattern}`
            )}
            variant="grey"
          />
        </Row>
        {config.blocklist.blocklist.labels && config.blocklist.blocklist.labels.length > 0 && (
          <Row label="Dynamic labels">
            <ListTags
              values={config.blocklist.blocklist.labels.map(
                entry =>
                  `${entry.label} (${entry.matchType}${entry.reverseMatch ? ', reversed' : ''})`
              )}
              variant="grey"
            />
          </Row>
        )}
      </>
    )}
    {config.mode === 'key-value' && (
      <Row label="Key value">
        <Tag>
          {config.key} = {config.isBlocklistedValue ?? 'true'}
        </Tag>
      </Row>
    )}
  </>
);

const CleanupModule: React.FC<{ config: modules.cleanup.CleanupModuleConfig }> = ({ config }) => (
  <>
    {config.configs.length === 0 && <i>No cleanup configs</i>}
    {config.configs.map((cleanupConfig, index) => (
      <Row key={index} label={cleanupConfig.domId}>
        <Tag variant="blue">{cleanupConfig.bidder}</Tag>
        {'cssSelectors' in cleanupConfig.deleteMethod ? (
          <Tag variant="grey">css: {cleanupConfig.deleteMethod.cssSelectors.join(', ')}</Tag>
        ) : (
          <Tag variant="yellow">JS snippet ({cleanupConfig.deleteMethod.jsAsString.length})</Tag>
        )}
      </Row>
    ))}
  </>
);

const CustomModule: React.FC<{ config: modules.custom.CustomModuleConfig }> = ({ config }) => (
  <>
    <Row label="Inline JS">
      {config.inlineJs ? (
        <Tag variant="yellow">{config.inlineJs.code.length} chars</Tag>
      ) : (
        <i>none</i>
      )}
    </Row>
    {(config.scripts ?? []).map((script, index) => (
      <Row key={index} label={`Script #${index + 1}`}>
        <Tag>{script.src}</Tag>
        {script.consent && <Tag variant="green">GVL vendor {script.consent.vendorId}</Tag>}
        {script.labelAll && <Tag variant="grey">labelAll: {script.labelAll.join(', ')}</Tag>}
        {script.labelAny && <Tag variant="grey">labelAny: {script.labelAny.join(', ')}</Tag>}
      </Row>
    ))}
  </>
);

const ConfiantModule: React.FC<{ config: modules.confiant.ConfiantConfig }> = ({ config }) => (
  <>
    <Row label="Asset URL">
      <Tag>{config.assetUrl}</Tag>
    </Row>
    <Row label="GVLID check">
      <BoolTag value={config.checkGVLID} trueLabel="enabled" falseLabel="disabled" />
    </Row>
  </>
);

const EmetriqModule: React.FC<{ config: modules.emetriq.EmetriqModuleConfig }> = ({ config }) => (
  <>
    <Row label="Platform">
      <Tag variant="blue">{config.os}</Tag>
    </Row>
    {config.os === 'web' ? (
      <Row label="SID">
        <Tag>{config._enqAdpParam.sid}</Tag>
      </Row>
    ) : (
      <>
        <Row label="SID / App ID">
          <Tag>{config.sid}</Tag>
          <Tag>{config.appId}</Tag>
        </Row>
        <Row label="Advertiser ID key">
          <Tag variant="grey">{config.advertiserIdKey}</Tag>
        </Row>
      </>
    )}
    <Row label="Sync delay">
      <Tag variant="grey">
        {config.syncDelay === undefined
          ? 'none'
          : config.syncDelay === 'pbjs'
            ? 'prebid auctionEnd'
            : `${config.syncDelay}ms`}
      </Tag>
    </Row>
    {config.customMappingDefinition && config.customMappingDefinition.length > 0 && (
      <Row label="Custom mappings">
        <ListTags
          values={config.customMappingDefinition.map(
            mapping => `${mapping.key} → ${mapping.param}`
          )}
          variant="grey"
        />
      </Row>
    )}
    {config.login && (
      <Row label="Login events">
        <Tag variant="green">partner: {config.login.partner}</Tag>
        {config.login.guid && <Tag variant="grey">guid set</Tag>}
      </Row>
    )}
  </>
);

const GeoEdgeModule: React.FC<{ config: modules.geoedge.GeoEdgeModuleConfig }> = ({ config }) => (
  <>
    <Row label="Publisher key">
      <Tag>{config.key}</Tag>
    </Row>
    <Row label="GVLID check">
      <BoolTag value={config.checkGVLID} trueLabel="enabled" falseLabel="disabled" />
    </Row>
    {config.cfg?.advs && (
      <Row label="Advertiser filter">
        <ListTags values={Object.keys(config.cfg.advs)} variant="grey" />
      </Row>
    )}
    {config.cfg?.pubIds && (
      <Row label="AdX/AdSense filter">
        <ListTags values={Object.keys(config.cfg.pubIds)} variant="grey" />
      </Row>
    )}
  </>
);

const IdentityLinkModule: React.FC<{ config: modules.identitylink.IdentityLinkModuleConfig }> = ({
  config
}) => (
  <>
    <Row label="LaunchPad ID">
      <Tag>{config.launchPadId}</Tag>
    </Row>
    <Row label="Email hashes">
      <Tag variant={config.hashedEmailAddresses.length > 0 ? 'green' : 'grey'}>
        {config.hashedEmailAddresses.length} provided
      </Tag>
    </Row>
  </>
);

const PubstackModule: React.FC<{ config: modules.pubstack.PubstackConfig }> = ({ config }) => (
  <Row label="Tag ID">
    <Tag>{config.tagId}</Tag>
  </Row>
);

const SkinModule: React.FC<{ config: modules.skin.SkinModuleConfig }> = ({ config }) => (
  <>
    {config.configs.map((skinConfig, index) => (
      <Fragment key={index}>
        {config.configs.length > 1 && <SubHeadline>Config #{index + 1}</SubHeadline>}
        <Row label="Skin slot">
          <Tag>{skinConfig.skinAdSlotDomId}</Tag>
          {skinConfig.hideSkinAdSlot && <Tag variant="yellow">hidden</Tag>}
          {skinConfig.destroySkinSlot && <Tag variant="yellow">destroyed</Tag>}
        </Row>
        <Row label="Blocked slots">
          <ListTags values={skinConfig.blockedAdSlotDomIds} variant="grey" />
        </Row>
        <Row label="Format filters">
          <ListTags
            values={skinConfig.formatFilter.map(filter =>
              'auid' in filter && filter.auid !== undefined
                ? `${filter.bidder} (auid ${filter.auid})`
                : filter.bidder
            )}
          />
        </Row>
        <Row label="CPM comparison">
          <BoolTag
            value={skinConfig.enableCpmComparison}
            trueLabel="enforcing"
            falseLabel="logging only"
          />
        </Row>
        {skinConfig.targeting && (
          <Row label="Targeting">
            <Tag variant="grey">
              {skinConfig.targeting.key} = {skinConfig.targeting.value ?? '1'}
            </Tag>
          </Row>
        )}
      </Fragment>
    ))}
  </>
);

const StickyHeaderAdModule: React.FC<{ config: modules.stickyHeaderAd.StickyHeaderAdConfig }> = ({
  config
}) => (
  <>
    <Row label="Header slot">
      <Tag>{config.headerAdDomId}</Tag>
      {config.destroySlot && <Tag variant="yellow">destroys slot</Tag>}
    </Row>
    <Row label="Fade out">
      {config.fadeOutTrigger === false ? (
        <Tag variant="grey">always visible</Tag>
      ) : (
        <Tag variant="grey">on {config.fadeOutTrigger.selector}</Tag>
      )}
      <Tag variant="grey">class: {config.fadeOutClassName}</Tag>
    </Row>
    {config.minVisibleDurationMs !== undefined && (
      <Row label="Min visible duration">
        <Tag>{config.minVisibleDurationMs}ms</Tag>
      </Row>
    )}
    {config.navbarConfig && (
      <Row label="Navbar">
        <Tag variant="grey">{config.navbarConfig.selector}</Tag>
      </Row>
    )}
    <Row label="Disallowed advertisers">
      <ListTags values={config.disallowedAdvertiserIds} variant="grey" />
    </Row>
  </>
);

const StickyFooterAdModule: React.FC<{ config: modules.stickyFooterAd.StickyFooterAdConfig }> = ({
  config
}) => (
  <>
    <Row label="Mobile sticky slot">
      {config.mobileStickyDomId ? <Tag>{config.mobileStickyDomId}</Tag> : <i>none</i>}
      {config.initiallyHidden && <Tag variant="grey">initially hidden</Tag>}
    </Row>
    <Row label="Desktop floor ad slot">
      {config.desktopFloorAdDomId ? <Tag>{config.desktopFloorAdDomId}</Tag> : <i>none</i>}
    </Row>
    <Row label="Disallowed advertisers">
      <ListTags values={config.disallowedAdvertiserIds} variant="grey" />
    </Row>
  </>
);

const StickyFooterAdV2Module: React.FC<{
  config: modules.stickyFooterAdV2.StickyFooterAdConfig;
}> = ({ config }) => (
  <>
    <Row label="Footer slots">
      {Object.entries(config.stickyFooterDomIds).length === 0 ? (
        <i>none</i>
      ) : (
        Object.entries(config.stickyFooterDomIds).map(([device, domId]) => (
          <Tag key={device} variant="blue">
            {device}: {domId}
          </Tag>
        ))
      )}
    </Row>
    {config.closingButtonText && (
      <Row label="Close button text">
        <Tag variant="grey">{config.closingButtonText}</Tag>
      </Row>
    )}
    <Row label="Disallowed advertisers">
      <ListTags values={config.disallowedAdvertiserIds} variant="grey" />
    </Row>
  </>
);

const UtiqModule: React.FC<{ config: modules.utiq.UtiqConfig }> = ({ config }) => (
  <>
    <Row label="Asset URL">{config.assetUrl ? <Tag>{config.assetUrl}</Tag> : <i>default</i>}</Row>
    <Row label="Delay">
      {config.delay?.enabled ? (
        <Tag variant="yellow">after {config.delay.minAdRequests ?? 0} ad requests</Tag>
      ) : (
        <Tag variant="grey">none</Tag>
      )}
    </Row>
    {config.options?.CMP === 'none' && (
      <Row label="CMP pop-up">
        <Tag variant="yellow">suppressed</Tag>
      </Row>
    )}
    {config.userIdConfig?.emetriq && (
      <Row label="Emetriq integration">
        <Tag>sid: {config.userIdConfig.emetriq.sid}</Tag>
      </Row>
    )}
  </>
);

const PrebidFirstPartyDataModule: React.FC<{
  config: modules.prebid_first_party_data.PrebidFirstPartyDataModuleConfig;
}> = ({ config }) => (
  <>
    <Row label="IAB data provider">
      {config.iabDataProviderName ? <Tag>{config.iabDataProviderName}</Tag> : <i>not set</i>}
    </Row>
    <Row label="Static first party data">
      <BoolTag value={!!config.staticPrebidFirstPartyData} trueLabel="provided" falseLabel="none" />
    </Row>
    {config.gptTargetingMappings && (
      <Row label="GPT targeting mappings">
        <ListTags
          values={Object.entries(config.gptTargetingMappings).map(
            ([property, key]) => `${key} → ${property}`
          )}
          variant="grey"
        />
      </Row>
    )}
  </>
);

const YieldOptimizationModule: React.FC<{
  config: modules.yield_optimization.YieldOptimizationConfig;
}> = ({ config }) => (
  <>
    <Row label="Provider">
      <Tag variant={config.provider === 'none' ? 'grey' : 'blue'}>{config.provider}</Tag>
    </Row>
    {config.provider === 'static' && (
      <Row label="Price rules">
        <Tag>{Object.keys(config.config.rules).length} ad units</Tag>
      </Row>
    )}
    {config.provider === 'dynamic' && (
      <>
        <Row label="Endpoint">
          <Tag>{config.configEndpoint}</Tag>
        </Row>
        <Row label="Excluded ad units">
          <ListTags values={config.excludedAdUnitPaths} variant="grey" />
        </Row>
        {config.dynamicFloorPrices && (
          <Row label="Dynamic floors">
            <Tag variant="grey">strategy: {config.dynamicFloorPrices.strategy}</Tag>
            <Tag variant="grey">
              rounding: {config.dynamicFloorPrices.roundingStepsInCents} cent steps
            </Tag>
          </Row>
        )}
      </>
    )}
  </>
);

const LazyLoadModule: React.FC<{ config: modules.lazyload.LazyLoadModuleConfig }> = ({
  config
}) => {
  const optionTags = (options: {
    rootId?: string;
    rootMargin?: string;
    threshold?: number;
  }): React.ReactElement => (
    <>
      {options.rootId && <Tag variant="grey">root: {options.rootId}</Tag>}
      {options.rootMargin && <Tag variant="grey">margin: {options.rootMargin}</Tag>}
      {options.threshold !== undefined && <Tag variant="grey">threshold: {options.threshold}</Tag>}
    </>
  );
  return (
    <>
      {config.slots.map((slotConfig, index) => (
        <Row key={index} label="Slots">
          <ListTags values={slotConfig.domIds} />
          {optionTags(slotConfig.options)}
        </Row>
      ))}
      {config.buckets.map((bucketConfig, index) => (
        <Row key={index} label="Bucket">
          <Tag variant="blue">{bucketConfig.bucket}</Tag>
          <Tag variant="grey">observes: {bucketConfig.observedDomId}</Tag>
          {optionTags(bucketConfig.options)}
        </Row>
      ))}
      {(config.infiniteSlots ?? []).map((infiniteConfig, index) => (
        <Row key={index} label="Infinite slots">
          <Tag variant="blue">{infiniteConfig.selector}</Tag>
          {optionTags(infiniteConfig.options)}
        </Row>
      ))}
    </>
  );
};

const ZeotapModule: React.FC<{ config: modules.zeotap.ZeotapModuleConfig }> = ({ config }) => (
  <>
    <Row label="Asset URL">
      <Tag>{config.assetUrl}</Tag>
    </Row>
    <Row label="Mode">
      <Tag variant="blue">{config.mode}</Tag>
      {config.countryCode && <Tag variant="grey">{config.countryCode}</Tag>}
    </Row>
    <Row label="ID+ (hashed email)">
      <BoolTag value={!!config.hashedEmailAddress} trueLabel="active" falseLabel="inactive" />
    </Row>
    <Row label="Data key values">
      <ListTags
        values={config.dataKeyValues.map(pair => `${pair.keyValueKey} → ${pair.parameterKey}`)}
        variant="grey"
      />
    </Row>
    <Row label="Exclusions">
      <ListTags
        values={config.exclusionKeyValues.map(pair => `${pair.keyValueKey}=${pair.disableOnValue}`)}
        variant="grey"
      />
    </Row>
  </>
);

const InterstitialModule: React.FC<{ config: modules.interstitial.InterstitialModuleConfig }> = ({
  config
}) => (
  <>
    <Row label="Interstitial slot">
      <Tag>{config.interstitialDomId}</Tag>
    </Row>
    <Row label="Auto close">
      {config.closeAutomaticallyAfterMs !== undefined ? (
        <Tag>{config.closeAutomaticallyAfterMs}ms</Tag>
      ) : (
        <i>never</i>
      )}
    </Row>
    <Row label="Disallowed advertisers">
      <ListTags values={config.disallowedAdvertiserIds} variant="grey" />
    </Row>
  </>
);

const MoliAnalyticsModule: React.FC<{ config: modules.moliAnalytics.MoliAnalyticsConfig }> = ({
  config
}) => (
  <>
    <Row label="Publisher">
      <Tag>{config.publisher}</Tag>
    </Row>
    <Row label="Collection URL">
      <Tag>{config.url}</Tag>
    </Row>
    <Row label="Batching">
      <Tag variant="grey">size: {config.batchSize ?? 1}</Tag>
      <Tag variant="grey">delay: {config.batchDelay ?? 100}ms</Tag>
    </Row>
  </>
);

/** generic key/value dump used for modules without a dedicated component */
const GenericModule: React.FC<{ config: object; subEntry?: boolean }> = ({ config, subEntry }) => (
  <>
    {Object.entries(config)
      .filter(([key]) => key !== 'enabled')
      .map(([key, value]) => (
        <TagContainer key={key} subEntry={subEntry}>
          <TagLabel>{key}</TagLabel>
          {value === undefined || value === null ? (
            <i>not set</i>
          ) : Array.isArray(value) ? (
            value.length === 0 ? (
              <i>none</i>
            ) : (
              value.map((entry, index) =>
                typeof entry === 'object' && entry !== null ? (
                  <GenericModule key={index} config={entry} subEntry />
                ) : (
                  <Tag key={index} variant="grey">
                    {String(entry)}
                  </Tag>
                )
              )
            )
          ) : typeof value === 'object' ? (
            <GenericModule config={value} subEntry />
          ) : (
            <Tag variant="grey">{String(value)}</Tag>
          )}
        </TagContainer>
      ))}
  </>
);

const moduleComponents: {
  [K in keyof Required<modules.ModulesConfig>]: React.FC<{
    config: Required<modules.ModulesConfig>[K];
  }>;
} = {
  adex: AdexModule,
  adReload: AdReloadModule,
  blocklist: BlocklistModule,
  cleanup: CleanupModule,
  custom: CustomModule,
  confiant: ConfiantModule,
  emetriq: EmetriqModule,
  geoedge: GeoEdgeModule,
  identitylink: IdentityLinkModule,
  pubstack: PubstackModule,
  skin: SkinModule,
  stickyHeaderAd: StickyHeaderAdModule,
  utiq: UtiqModule,
  prebidFirstPartyData: PrebidFirstPartyDataModule,
  yieldOptimization: YieldOptimizationModule,
  stickyFooterAd: StickyFooterAdModule,
  stickyFooterAdV2: StickyFooterAdV2Module,
  lazyload: LazyLoadModule,
  zeotap: ZeotapModule,
  interstitial: InterstitialModule,
  moliAnalytics: MoliAnalyticsModule
};

type ModuleConfigCardProps = {
  readonly name: string;
  readonly config: modules.IModuleConfig;
};

/**
 * Collapsible card for a single module. Shows the module name with an
 * enabled/disabled badge and renders the module specific view when expanded.
 */
const ModuleConfigCard: React.FC<ModuleConfigCardProps> = ({ name, config }) => {
  const ModuleComponent = moduleComponents[name as keyof modules.ModulesConfig] as
    | React.FC<{ config: modules.IModuleConfig }>
    | undefined;

  return (
    <div className="d-collapse d-collapse-arrow mb-2 rounded-md bg-base-200">
      <input type="checkbox" aria-label={`toggle module ${name}`} />
      <div className="d-collapse-title min-h-0 py-2 text-sm font-semibold">
        {name}{' '}
        <Tag variant={config.enabled ? 'green' : 'grey'}>
          {config.enabled ? 'enabled' : 'disabled'}
        </Tag>
      </div>
      <div className="d-collapse-content text-sm">
        {ModuleComponent ? <ModuleComponent config={config} /> : <GenericModule config={config} />}
      </div>
    </div>
  );
};

type ModuleConfigsProps = {
  readonly modules: modules.ModulesConfig;
};

/**
 * All configured modules as collapsible cards.
 */
export const ModuleConfigs: React.FC<ModuleConfigsProps> = ({ modules: modulesConfig }) => {
  const entries = Object.entries(modulesConfig);
  return entries.length === 0 ? (
    <span>No modules configured.</span>
  ) : (
    <>
      {entries.map(([name, config]) => (
        <ModuleConfigCard key={name} name={name} config={config as modules.IModuleConfig} />
      ))}
    </>
  );
};
