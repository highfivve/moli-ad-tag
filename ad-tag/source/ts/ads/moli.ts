import { Moli } from '../types/moli';
import { parseQueryString } from '../util/query';
import {
  createAssetLoaderService,
  AssetLoadMethod,
  IAssetLoaderService
} from '../util/assetLoaderService';
import { getLogger } from '../util/logging';
import { addNewInfiniteSlotToConfig } from '../util/addNewInfiniteSlotToConfig';
import IStateMachine = Moli.state.IStateMachine;
import IFinished = Moli.state.IFinished;
import IError = Moli.state.IError;
import IConfigurable = Moli.state.IConfigurable;
import ISinglePageApp = Moli.state.ISinglePageApp;
import RefreshAdSlotsOptions = Moli.RefreshAdSlotsOptions;
import { IModule, metaFromModule, ModuleMeta } from '../types/module';
import { AdService } from './adService';
import {
  getActiveEnvironmentOverride,
  setEnvironmentOverrideInStorage
} from '../util/environmentOverride';
import { packageJson } from '../gen/packageJson';
import * as adUnitPath from './adUnitPath';
import { extractTopPrivateDomainFromHostname } from '../util/extractTopPrivateDomainFromHostname';
import { LabelConfigService } from './labelConfigService';
import { allowRefreshAdSlot, allowRequestAds } from './spa';

export const createMoliTag = (window: Window): Moli.MoliTag => {
  // Creating the actual tag requires exactly one AdService instance
  const assetLoaderService = createAssetLoaderService(window);
  const adService = new AdService(assetLoaderService, window);
  const moliWindow = window as Moli.MoliWindow;

  /**
   * Initial state is configurable
   */
  let state: IStateMachine = {
    state: 'configurable',
    initialize: false,
    isSinglePageApp: false,
    keyValues: {},
    labels: [],
    modules: [],
    moduleMeta: [],
    reporting: {
      reporters: []
    },
    refreshSlots: [],
    refreshInfiniteSlots: [],
    hooks: {
      beforeRequestAds: [],
      afterRequestAds: []
    },
    adUnitPathVariables: {}
  };

  function setTargeting(key: string, value: string | string[]): void {
    switch (state.state) {
      case 'configurable': {
        state.keyValues[key] = value;
        break;
      }
      case 'configured': {
        if (state.config.targeting) {
          state.config.targeting.keyValues[key] = value;
        } else {
          state.config = {
            ...state.config,
            targeting: {
              keyValues: {
                [key]: value
              },
              adManagerExcludes: []
            }
          };
        }
        break;
      }
      case 'spa-finished':
      case 'spa-requestAds': {
        state.keyValues = {
          [key]: value,
          ...state.keyValues
        };
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `Setting key-value after configuration: ${key} : ${value}`
        );
        break;
      }
    }
  }

  function addLabel(label: string): void {
    switch (state.state) {
      case 'configurable': {
        state.labels.push(label);
        break;
      }
      case 'configured': {
        if (state.config.targeting?.labels) {
          state.config.targeting.labels.push(label);
        } else {
          state.config = {
            ...state.config,
            targeting: {
              keyValues: state.config.targeting ? state.config.targeting.keyValues : {},
              adManagerExcludes: state.config.targeting
                ? state.config.targeting.adManagerExcludes
                : [],
              labels: [label]
            }
          };
        }
        break;
      }
      // labels can be pushed in both spa states
      case 'spa-requestAds':
      case 'spa-finished': {
        state.labels.push(label);
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `Adding label after configure: ${label}`
        );
        break;
      }
    }
  }

  function setAdUnitPathVariables(variables: Moli.AdUnitPathVariables): void {
    switch (state.state) {
      case 'configurable': {
        state.adUnitPathVariables = variables;
        break;
      }
      case 'configured': {
        state.config = {
          ...state.config,
          targeting: {
            keyValues: state.config.targeting ? state.config.targeting.keyValues : {},
            labels: state.config.targeting?.labels ? state.config.targeting.labels : [],
            adUnitPathVariables: variables,
            adManagerExcludes: state.config.targeting
              ? state.config.targeting.adManagerExcludes
              : []
          }
        };
        break;
      }
      case 'spa-requestAds':
      case 'spa-finished': {
        state.adUnitPathVariables = variables;
        break;
      }

      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `Setting unit path variables after configuration: ${variables}`
        );
        break;
      }
    }
  }

  function getAdUnitPathVariables(): adUnitPath.AdUnitPathVariables | undefined {
    const domain = extractTopPrivateDomainFromHostname(window.location.hostname) || 'unknown';
    switch (state.state) {
      case 'configurable':
        return { ...state.adUnitPathVariables, domain: domain, device: 'unknown' };
      case 'configured':
      case 'requestAds':
      case 'spa-requestAds':
      case 'spa-finished':
      case 'finished':
      case 'error':
        // temporary label service to resolve the device label
        const labelService = new LabelConfigService(state.config.labelSizeConfig || [], [], window);
        return {
          ...state.config.targeting?.adUnitPathVariables,
          domain: state.config.domain || domain,
          device: labelService.getDeviceLabel()
        };
    }
  }

  function resolveAdUnitPath(
    adUnitPathParam: string,
    options?: Moli.ResolveAdUnitPathOptions
  ): string {
    const opts = options || {};
    const removeNetworkChildId: boolean = opts.removeNetworkChildId || false;
    const resolvedPath = adUnitPath.resolveAdUnitPath(adUnitPathParam, getAdUnitPathVariables());
    return removeNetworkChildId ? adUnitPath.removeChildId(resolvedPath) : resolvedPath;
  }

  function setLogger(logger: Moli.MoliLogger): void {
    switch (state.state) {
      case 'configurable': {
        state.logger = logger;
        break;
      }
      case 'configured': {
        state.config = {
          ...state.config,
          logger: logger
        };
        break;
      }
      default: {
        logger.error('Setting a custom logger is not allowed after configuration');
        break;
      }
    }
  }

  function setSampleRate(sampleRate: number): void {
    switch (state.state) {
      case 'configurable': {
        state.reporting.sampleRate = sampleRate;
        break;
      }
      case 'configured': {
        state.config = {
          ...state.config,
          reporting: {
            ...state.config.reporting,
            sampleRate: sampleRate,
            reporters: state.config.reporting ? state.config.reporting.reporters : []
          }
        };
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to setSampleRate. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function addReporter(reporter: Moli.reporting.Reporter): void {
    switch (state.state) {
      case 'configurable': {
        state.reporting.reporters.push(reporter);
        break;
      }
      case 'configured': {
        state.config = {
          ...state.config,
          reporting: {
            ...state.config.reporting,
            // a reporter is added without a sampling size being configured, we set the sampling rate to 0
            sampleRate: state.config.reporting ? state.config.reporting.sampleRate : 0,
            reporters: [
              ...(state.config.reporting ? state.config.reporting.reporters : []),
              reporter
            ]
          }
        };
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to setSampleRate. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function beforeRequestAds(callback: (config: Moli.MoliConfig) => void): void {
    switch (state.state) {
      case 'configurable': {
        state.hooks.beforeRequestAds.push(callback);
        break;
      }
      case 'configured': {
        state.hooks.beforeRequestAds.push(callback);
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to add a hook beforeRequestAds. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function afterRequestAds(callback: (state: Moli.state.AfterRequestAdsStates) => void): void {
    switch (state.state) {
      case 'configurable': {
        state.hooks.afterRequestAds.push(callback);
        break;
      }
      case 'configured': {
        state.hooks.afterRequestAds.push(callback);
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to add a hook afterRequestAds. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function getConfig(): Moli.MoliConfig | null {
    switch (state.state) {
      case 'configurable': {
        return null;
      }
      case 'configured': {
        return state.config;
      }
      case 'requestAds': {
        return state.config;
      }
      case 'spa-requestAds':
      case 'spa-finished': {
        return state.config;
      }
      case 'finished': {
        return state.config;
      }
      case 'error': {
        return state.config;
      }
    }
  }

  function registerModule(module: IModule): void {
    switch (state.state) {
      case 'configurable': {
        state.modules.push(module);
        state.moduleMeta.push(metaFromModule(module));
        return;
      }
      default: {
        getLogger(state.config, window).error(
          'Registering a module is only allowed within the ad tag before the ad tag is configured'
        );
      }
    }
  }

  function configure(config: Moli.MoliConfig): void {
    switch (state.state) {
      case 'configurable': {
        const shouldInitialize = state.initialize;
        const envOverride = getActiveEnvironmentOverride(window);
        const modules = state.modules;

        // If the query params contain an environment override, save it in the session storage,
        // so that the override remains even if the query param is gone. This is helpful on SPAs or
        // if the site filters out query params.
        if (envOverride?.source === 'queryParam') {
          setEnvironmentOverrideInStorage(envOverride.environment, window.sessionStorage);
        }

        // if there's a spa config, use the enabled flag. Note that this may collide with
        // `enableSinglePageApp`, which could override this configuration
        if (config.spa) {
          state.isSinglePageApp = config.spa.enabled;
        }

        state = {
          state: 'configured',
          configFromAdTag: config,
          config: {
            ...config,
            ...(envOverride && { environment: envOverride.environment }),
            targeting: {
              keyValues: {
                ...(config.targeting && config.targeting.keyValues
                  ? config.targeting.keyValues
                  : {}),
                ...state.keyValues
              },
              labels: [
                ...(config.targeting && config.targeting.labels ? config.targeting.labels : []),
                ...state.labels
              ],
              adUnitPathVariables: state.adUnitPathVariables,
              adManagerExcludes: config.targeting ? config.targeting.adManagerExcludes : []
            },
            reporting: {
              ...config.reporting,
              sampleRate: state.reporting.sampleRate
                ? state.reporting.sampleRate
                : config.reporting && config.reporting.sampleRate
                ? config.reporting.sampleRate
                : 0,
              reporters: [
                ...(config.reporting ? config.reporting.reporters : []),
                ...state.reporting.reporters
              ]
            },
            logger: state.logger || config.logger
          },
          modules: modules,
          moduleMeta: modules.map(metaFromModule),
          hooks: state.hooks,
          isSinglePageApp: state.isSinglePageApp,
          // create a new array as we must not share this mutable data structure
          refreshSlots: [...state.refreshSlots],
          refreshInfiniteSlots: [...state.refreshInfiniteSlots]
        };

        if (shouldInitialize) {
          requestAds();
        }
        break;
      }
      case 'configured': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already configured.',
          state.config
        );
        break;
      }
      case 'requestAds': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already requesting ads.'
        );
        break;
      }
      case 'finished': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already finished.'
        );
        break;
      }
      case 'error': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already finished, but with an error.',
          state.error
        );
        break;
      }
    }
  }

  function enableSinglePageApp(): void {
    switch (state.state) {
      case 'configurable': {
        getLogger(null, window).warn(
          'MoliGlobal',
          'enableSinglePageApp() is deprecated. Use spa config.'
        );
        state.isSinglePageApp = true;
        break;
      }
      case 'configured': {
        getLogger(state.config, window).warn(
          'MoliGlobal',
          'enableSinglePageApp() is deprecated. Use spa config.'
        );
        state.isSinglePageApp = true;
        break;
      }
      case 'spa-requestAds':
      case 'spa-finished': {
        // already in spa mode
        break;
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying enable single page app. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function requestAds(): Promise<IConfigurable | ISinglePageApp | IFinished | IError> {
    switch (state.state) {
      case 'configurable': {
        state.initialize = true;
        return Promise.resolve(state);
      }
      case 'configured': {
        setABtestTargeting();
        addDomainLabel(state.config.domain);
        const { moduleMeta, isSinglePageApp, refreshSlots, refreshInfiniteSlots } = state;
        let config = state.config;

        // if there are infinite adslots available in the refreshInfiniteSlots array, they need to be added to the config
        if (refreshInfiniteSlots.length > 0) {
          refreshInfiniteSlots.forEach(slot => {
            config = addNewInfiniteSlotToConfig(
              config,
              slot.idOfConfiguredSlot,
              slot.artificialDomId,
              window
            );
          });
        }

        // initialize modules with the config from the ad tag.
        // the config will be altered by this call
        const modules = state.modules;
        modules.forEach(module => {
          const log = getLogger(config, window);
          log.debug(
            'MoliGlobal',
            `initialize ${module.moduleType} module ${module.name}`,
            module.config()
          );
          module.init(config, assetLoaderService, adService.getAdPipeline);
        });

        // call the configured hooks
        if (state.hooks && state.hooks.beforeRequestAds) {
          state.hooks.beforeRequestAds.forEach(hook => {
            try {
              hook(config);
            } catch (e) {
              getLogger(config, window).error('MoliGlobal', 'beforeRequestAds hook failed', e);
            }
          });
        }

        const afterRequestAds = state.hooks.afterRequestAds;

        // handle single page application case
        if (isSinglePageApp) {
          // initialize first and then make the initial requestAds() call
          const initialized = adService.initialize(config, isSinglePageApp).then(() => config);
          const spaRequestAdsState: ISinglePageApp = {
            state: 'spa-requestAds',
            configFromAdTag: state.configFromAdTag,
            config: config,
            initialized,
            href: window.location.href,
            // initialize targeting values for next refreshAds call
            labels: [],
            keyValues: {},
            adUnitPathVariables: {},
            hooks: state.hooks,
            // reset refresh slots array
            refreshSlots: [],
            refreshInfiniteSlots: [],
            moduleMeta
          };
          state = spaRequestAdsState;

          return initialized
            .then(() => adService.requestAds(config, refreshSlots, refreshInfiniteSlots))
            .then(() => {
              // check if we are still on the same page and in the spa-requestAds state
              // if not the user has already navigated to another page, and we discard everything here
              if (state.state === 'spa-requestAds' && state.href === window.location.href) {
                adService.refreshAdSlots(state.refreshSlots, state.config);
                afterRequestAds.forEach(hook => hook('spa-finished'));
                const finishedState: ISinglePageApp = {
                  ...state,
                  state: 'spa-finished',
                  // reset refresh slots as they were already requested
                  refreshSlots: []
                };
                state = finishedState;
                return finishedState;
              } else if (state.state === 'spa-finished' || state.state === 'spa-requestAds') {
                // this means that a subsequent requestAds call has finished before the previous one.
                // nothing to do here
                getLogger(state.config, window).debug(
                  'MoliGlobal',
                  'A previous requestAds() was slower than the following requestAds() call'
                );
                return state;
              } else {
                return Promise.reject(`reached invalid state [${state.state}]`);
              }
            });
        } else {
          state = {
            state: 'requestAds',
            config: config,
            moduleMeta
          };
          return adService
            .initialize(config, isSinglePageApp)
            .then(config => adService.requestAds(config, refreshSlots, refreshInfiniteSlots))
            .then(() => {
              state = {
                state: 'finished',
                config: config,
                moduleMeta
              };
              afterRequestAds.forEach(hook => hook('finished'));
              return Promise.resolve(state);
            })
            .catch(error => {
              getLogger(config, window).error('MoliGlobal', error);
              state = {
                state: 'error',
                config: config,
                error: error,
                moduleMeta
              };
              afterRequestAds.forEach(hook => hook('error'));
              return Promise.resolve(state);
            });
        }
      }

      // requestAds is being called while the previous requestAds() hasn't finished yet
      case 'spa-requestAds':
      // in the single page application state we first need to destroy the current setup
      // eslint-disable-next-line no-fallthrough
      case 'spa-finished': {
        if (state.state === 'spa-requestAds') {
          getLogger(state.config, window).debug(
            'MoliGlobal',
            "requestAds is being called while the previous requestAds() hasn't finished yet"
          );
        }
        // create new ABTest values
        setABtestTargeting();
        addDomainLabel(state.config.domain);

        const { hooks, moduleMeta } = state;
        const afterRequestAds = state.hooks.afterRequestAds;
        const beforeRequestAds = state.hooks.beforeRequestAds;

        const currentState = state;
        const { initialized, href, keyValues, labels, configFromAdTag } = state;
        // we can only use the preexisting refreshSlots array if the previous requestAds call finished in time
        const refreshSlots = state.state === 'spa-finished' ? state.refreshSlots : [];
        const refreshInfiniteSlots =
          state.state === 'spa-finished' ? state.refreshInfiniteSlots : [];
        state = {
          ...currentState,
          state: 'spa-requestAds',
          // reset the refreshed slots as they are being batched from now on
          refreshSlots: []
        };

        return initialized
          .then(config => {
            // don't use the config from the initialized method as we need to alter the config
            // here to allow different key-values for multiple pages
            const validation = config.spa?.validateLocation ?? 'href';
            if (!allowRequestAds(validation, href, window.location)) {
              return Promise.reject(
                `You are trying to refresh ads on the same page, which is not allowed. Using ${validation} for validation.`
              );
            }
            return Promise.resolve(config);
          })
          .then(config => {
            // we insert the fixed targeting values from the `configFromAdTag` and discard all others that have
            // been set via the moli API (e.g. setTargeting or addLabel)
            return {
              ...config,
              targeting: {
                keyValues: {
                  ...(configFromAdTag.targeting && configFromAdTag.targeting.keyValues
                    ? configFromAdTag.targeting.keyValues
                    : {}),
                  ...keyValues
                },
                labels: [
                  ...(configFromAdTag.targeting && configFromAdTag.targeting.labels
                    ? configFromAdTag.targeting.labels
                    : []),
                  ...labels
                ],
                adUnitPathVariables: currentState.adUnitPathVariables,
                adManagerExcludes: configFromAdTag.targeting
                  ? configFromAdTag.targeting.adManagerExcludes
                  : []
              }
            };
          })
          .then(configWithTargeting => {
            // run hooks
            beforeRequestAds.forEach(hook => {
              try {
                hook(configWithTargeting);
              } catch (e) {
                getLogger(configWithTargeting, window).error(
                  'MoliGlobal',
                  'beforeRequestAds hook failed',
                  e
                );
              }
            });

            return adService
              .requestAds(configWithTargeting, refreshSlots, refreshInfiniteSlots)
              .then(() => configWithTargeting);
          })
          .then(configWithTargeting => {
            // type check to get access to refreshSlots
            if (state.state === 'spa-requestAds') {
              adService.refreshAdSlots(state.refreshSlots, configWithTargeting);
            }
            state = {
              state: 'spa-finished',
              configFromAdTag,
              config: configWithTargeting,
              initialized,
              href: window.location.href,
              hooks,
              // reset targeting after successful refreshAds()
              labels: [],
              keyValues: {},
              adUnitPathVariables: {},
              // reset refreshSlots
              refreshSlots: [],
              refreshInfiniteSlots: [],
              moduleMeta
            };
            afterRequestAds.forEach(hook => hook('spa-finished'));
            return state;
          });
      }
      case 'requestAds': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to requestAds twice. Already requesting ads.'
        );
        return Promise.reject();
      }
      case 'finished': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to requestAds twice. Already finished.'
        );
        return Promise.reject();
      }
      case 'error': {
        getLogger(state.config, window).error(
          'MoliGlobal',
          'Trying to requestAds twice. Already finished, but with an error.',
          state.error
        );
        return Promise.reject();
      }
    }
  }

  function refreshAdSlot(
    domId: string | string[],
    options?: RefreshAdSlotsOptions
  ): Promise<'queued' | 'refreshed'> {
    const domIds = typeof domId === 'string' ? [domId] : domId;
    switch (state.state) {
      case 'configurable': {
        state.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      }
      case 'configured': {
        state.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds':
        state.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      // If we arrive in the spa-finished state we refresh slots immediately and don't batch them
      // until the next requestAds() call arrives
      case 'spa-finished':
        const validateLocation = state.config.spa?.validateLocation ?? 'href';
        if (allowRefreshAdSlot(validateLocation, state.href, window.location)) {
          // user hasn't navigated yet, so we directly refresh the slot
          return adService.refreshAdSlots(domIds, state.config, options).then(() => 'refreshed');
        } else {
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.refreshSlots.push(...domIds);
          return Promise.resolve('queued');
        }
      // if the ad tag is currently requesting ads or already finished doesn't matter
      // slots can be refreshed immediately
      case 'finished':
      case 'requestAds': {
        return adService.refreshAdSlots(domIds, state.config, options).then(() => 'refreshed');
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `refreshAdSlot is not allowed in state ${state.state}`,
          state.config
        );
        return Promise.reject(`not allowed in state ${state.state}`);
      }
    }
  }

  function refreshInfiniteAdSlot(
    domId: string,
    idOfConfiguredSlot: string
  ): Promise<'queued' | 'refreshed'> {
    switch (state.state) {
      case 'configurable': {
        state.refreshInfiniteSlots.push({
          artificialDomId: domId,
          idOfConfiguredSlot: idOfConfiguredSlot
        });
        return Promise.resolve('queued');
      }
      case 'configured': {
        state.refreshInfiniteSlots.push({
          artificialDomId: domId,
          idOfConfiguredSlot: idOfConfiguredSlot
        });
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds':
        state.refreshInfiniteSlots.push({
          artificialDomId: domId,
          idOfConfiguredSlot: idOfConfiguredSlot
        });
        return Promise.resolve('queued');
      // If we arrive in the spa-finished state we refresh slots immediately and don't batch them
      // until the next requestAds() call arrives
      case 'spa-finished':
        // user hasn't navigated yet so we directly refresh the slot
        const validateLocation = state.config.spa?.validateLocation ?? 'href';
        if (allowRefreshAdSlot(validateLocation, state.href, window.location)) {
          state = {
            ...state,
            config: addNewInfiniteSlotToConfig(state.config, idOfConfiguredSlot, domId, window)
          };
          return adService.refreshAdSlots([domId], state.config).then(() => 'refreshed');
        } else {
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.refreshInfiniteSlots.push({
            artificialDomId: domId,
            idOfConfiguredSlot: idOfConfiguredSlot
          });
          return Promise.resolve('queued');
        }
      // if the ad tag is currently requesting ads or already finished doesn't matter
      // slots can be refreshed immediately
      case 'finished':
      case 'requestAds': {
        state = {
          ...state,
          config: addNewInfiniteSlotToConfig(state.config, idOfConfiguredSlot, domId, window)
        };
        return adService.refreshAdSlots([domId], state.config).then(() => 'refreshed');
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `refreshInfiniteAdSlot is not allowed in state ${state.state}`,
          state.config
        );
        return Promise.reject(`not allowed in state ${state.state}`);
      }
    }
  }

  function refreshBucket(bucket: string): Promise<'queued' | 'refreshed'> {
    // A helper function to retrieve domIds that belong to buckets.
    function getBucketDomIds(config: Moli.MoliConfig): string[] {
      const slotsInBucket = config.slots.filter(slot => slot.behaviour.bucket === bucket);
      return slotsInBucket?.map(slot => slot.domId);
    }

    switch (state.state) {
      case 'configurable': {
        const slotsInBucket = moliWindow.moli
          .getConfig()
          ?.slots.filter(slot => slot.behaviour.bucket === bucket);
        const domIds = slotsInBucket?.map(slot => slot.domId);
        if (domIds?.length) {
          state.refreshSlots.push(...domIds);
          return Promise.resolve('queued');
        }
        return Promise.reject('no configurable domIds for buckets');
      }
      case 'configured': {
        const domIds = getBucketDomIds(state.config);
        state.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds': {
        const domIds = getBucketDomIds(state.config);
        state.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      }
      // If we arrive in the spa-finished state we refresh slots immediately and don't batch them
      // until the next requestAds() call arrives
      case 'spa-finished': {
        if (state.href === window.location.href) {
          // user hasn't navigated yet, so we directly refresh the slot
          return adService.refreshBucket(bucket, state.config).then(() => 'refreshed');
        } else {
          const domIds = getBucketDomIds(state.config);
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.refreshSlots.push(...domIds);
          return Promise.resolve('queued');
        }
      }
      // if the ad tag is currently requesting ads or already finished doesn't matter
      // slots can be refreshed immediately
      case 'finished':
      case 'requestAds': {
        return adService.refreshBucket(bucket, state.config).then(() => 'refreshed');
      }
      default: {
        getLogger(state.config, window).error(
          'MoliGlobal',
          `refreshAdSlot is not allowed in state ${state.state}`,
          state.config
        );
        return Promise.reject(`not allowed in state ${state.state}`);
      }
    }

    return Promise.reject(`no slots in buckets found`);
  }

  function getState(): Moli.state.States {
    return state.state;
  }

  function getModuleMeta(): Array<ModuleMeta> {
    return state.moduleMeta;
  }

  function openConsole(path?: string): void {
    switch (state.state) {
      case 'configurable': {
        break;
      }
      default: {
        assetLoaderService
          .loadScript({
            assetUrl: path || 'https://highfivve.github.io/moli-ad-tag/assets/js/moli-debug.min.js',
            loadMethod: AssetLoadMethod.TAG,
            name: 'moli-debugger'
          })
          .catch(error => console.error('failed to load moli debugger', error));
      }
    }
  }

  /**
   * Set a fixed ABtest key-value to allow
   *
   * - floor price optimizations
   * - traffic shaping
   *
   * You can override the key-value with a query parameter `?ABtest=[1-100]`.
   *
   */
  function setABtestTargeting(): void {
    const key = 'ABtest';
    const params = parseQueryString(window.location.search);
    const param = params.get(key);
    const abTest = param ? Number(param) : Math.floor(Math.random() * 100) + 1;

    setTargeting(key, abTest.toString());
  }

  function addDomainLabel(domainFromConfig?: string): void {
    // make the apex domain available for every request. This allows for granular domain level targeting.
    // note that there's no fallback mechanism now, which leaves "translate" pages or iframe integrations unsupported
    const domain =
      domainFromConfig || extractTopPrivateDomainFromHostname(window.location.hostname);
    if (domain) {
      addLabel(domain);
    }
  }

  function getAssetLoaderService(): IAssetLoaderService {
    return assetLoaderService;
  }

  const que = {
    push(cmd: Moli.MoliCommand): void {
      cmd(moliWindow.moli);
    }
  };

  return {
    que: que,
    version: packageJson.version,
    setTargeting: setTargeting,
    addLabel: addLabel,
    setLogger: setLogger,
    setSampleRate: setSampleRate,
    setAdUnitPathVariables: setAdUnitPathVariables,
    resolveAdUnitPath: resolveAdUnitPath,
    addReporter: addReporter,
    beforeRequestAds: beforeRequestAds,
    afterRequestAds: afterRequestAds,
    getConfig: getConfig,
    registerModule: registerModule,
    configure: configure,
    enableSinglePageApp: enableSinglePageApp,
    requestAds: requestAds,
    refreshAdSlot: refreshAdSlot,
    refreshBucket: refreshBucket,
    refreshInfiniteAdSlot: refreshInfiniteAdSlot,
    getModuleMeta: getModuleMeta,
    getState: getState,
    openConsole: openConsole,
    getAssetLoaderService: getAssetLoaderService
  };
};
