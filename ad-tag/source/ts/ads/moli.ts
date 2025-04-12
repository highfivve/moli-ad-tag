import { MoliRuntime } from '../types/moliRuntime';
import { parseQueryString } from '../util/query';
import {
  AssetLoadMethod,
  createAssetLoaderService,
  IAssetLoaderService
} from '../util/assetLoaderService';
import { getLogger } from '../util/logging';
import { addNewInfiniteSlotToConfig } from '../util/addNewInfiniteSlotToConfig';
import { IModule, ModuleMeta } from '../types/module';
import { AdService } from './adService';
import { EventService } from './eventService';
import {
  getActiveEnvironmentOverride,
  setEnvironmentOverrideInStorage
} from '../util/environmentOverride';
import { packageJson } from '../gen/packageJson';
import * as adUnitPath from './adUnitPath';
import { extractTopPrivateDomainFromHostname } from '../util/extractTopPrivateDomainFromHostname';
import { LabelConfigService } from './labelConfigService';
import { allowRefreshAdSlot, allowRequestAds } from './spa';
import {
  AdUnitPathVariables,
  MoliConfig,
  ResolveAdUnitPathOptions,
  googleAdManager
} from '../types/moliConfig';

export const createMoliTag = (window: Window): MoliRuntime.MoliTag => {
  // Creating the actual tag requires exactly one AdService instance
  const assetLoaderService = createAssetLoaderService(window);
  const eventService = new EventService();
  const adService = new AdService(assetLoaderService, eventService, window);
  const moliWindow = window as MoliRuntime.MoliWindow;

  /**
   * Initial state is configurable
   */
  let state: MoliRuntime.state.IStateMachine = {
    state: 'configurable',
    initialize: false,
    runtimeConfig: newEmptyRuntimeConfig(),
    modules: []
  } as MoliRuntime.state.IConfigurable;

  function setTargeting(key: string, value: string | string[]): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.keyValues[key] = value;
        break;
      }

      case 'spa-finished':
      case 'spa-requestAds': {
        state.nextRuntimeConfig.keyValues[key] = value;
        break;
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          `Setting key-value after configuration: ${key} : ${value}`
        );
        break;
      }
    }
  }

  function addLabel(label: string): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.labels.push(label);
        break;
      }

      // labels can be pushed in both spa states
      case 'spa-requestAds':
      case 'spa-finished': {
        state.nextRuntimeConfig.labels.push(label);
        break;
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          `Adding label after configure: ${label}`
        );
        break;
      }
    }
  }

  function setAdUnitPathVariables(variables: AdUnitPathVariables): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.adUnitPathVariables = variables;
        break;
      }
      case 'spa-requestAds':
      case 'spa-finished': {
        state.nextRuntimeConfig.adUnitPathVariables = variables;
        break;
      }

      default: {
        getLogger(state.runtimeConfig, window).error(
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
        return { ...state.runtimeConfig.adUnitPathVariables, domain: domain, device: 'unknown' };
      case 'configured':
      case 'requestAds':
      case 'spa-requestAds':
      case 'spa-finished':
      case 'finished':
      case 'error':
        // temporary label service to resolve the device label
        const labelService = new LabelConfigService(state.config.labelSizeConfig || [], [], window);
        return {
          ...getPageTargeting().adUnitPathVariables,
          domain: state.config.domain || domain,
          device: labelService.getDeviceLabel()
        };
    }
  }

  function resolveAdUnitPath(adUnitPathParam: string, options?: ResolveAdUnitPathOptions): string {
    const opts = options || {};
    const removeNetworkChildId: boolean = opts.removeNetworkChildId || false;
    const resolvedPath = adUnitPath.resolveAdUnitPath(adUnitPathParam, getAdUnitPathVariables());
    return removeNetworkChildId ? adUnitPath.removeChildId(resolvedPath) : resolvedPath;
  }

  function setLogger(logger: MoliRuntime.MoliLogger): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.logger = logger;
        break;
      }
      default: {
        logger.error('Setting a custom logger is not allowed after configuration');
        break;
      }
    }
  }

  function beforeRequestAds(callback: (config: MoliConfig) => void): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.hooks.beforeRequestAds.push(callback);
        break;
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to add a hook beforeRequestAds. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function afterRequestAds(
    callback: (state: MoliRuntime.state.AfterRequestAdsStates) => void
  ): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.hooks.afterRequestAds.push(callback);
        break;
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to add a hook afterRequestAds. Already configured.',
          state.config
        );
        break;
      }
    }
  }

  function getConfig(): MoliConfig | null {
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

  function getRuntimeConfig(): MoliRuntime.MoliRuntimeConfig {
    return state.runtimeConfig;
  }

  function getPageTargeting(): Readonly<googleAdManager.Targeting> {
    return {
      keyValues: { ...state.config?.targeting?.keyValues, ...state.runtimeConfig.keyValues },
      labels: [...(state.config?.targeting?.labels ?? []), ...state.runtimeConfig.labels],
      adUnitPathVariables: {
        ...state.config?.targeting?.adUnitPathVariables,
        ...state.runtimeConfig.adUnitPathVariables
      }
    };
  }

  function registerModule(module: IModule): void {
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.modules.push(module);
        return;
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'Registering a module is only allowed within the ad tag before the ad tag is configured'
        );
      }
    }
  }

  function configure(config: MoliConfig): Promise<MoliRuntime.state.IStateMachine | null> {
    switch (state.state) {
      case 'configurable': {
        const shouldInitialize = state.initialize;
        const envOverride = getActiveEnvironmentOverride(window);
        const modules = state.modules;

        // if an override is available, update the environment in the runtime config
        if (envOverride) {
          state.runtimeConfig.environment = envOverride.value;
        }

        // If the query params contain an environment override, save it in the session storage,
        // so that the override remains even if the query param is gone. This is helpful on SPAs or
        // if the site filters out query params.
        if (envOverride?.source === 'queryParam') {
          setEnvironmentOverrideInStorage(envOverride.value, window.sessionStorage);
        }

        // configure modules
        const log = getLogger(state.runtimeConfig, window);
        log.debug('MoliGlobal', 'configure modules', config.modules ?? {});
        modules.forEach(module => {
          try {
            module.configure(config.modules ?? {});
            log.debug(
              'MoliGlobal',
              `configure ${module.moduleType} module ${module.name}`,
              module.config()
            );
            state.runtimeConfig.adPipelineConfig.initSteps.push(...module.initSteps());
            state.runtimeConfig.adPipelineConfig.configureSteps.push(...module.configureSteps());
            state.runtimeConfig.adPipelineConfig.prepareRequestAdsSteps.push(
              ...module.prepareRequestAdsSteps()
            );
            if (module.requestBidsSteps) {
              state.runtimeConfig.adPipelineConfig.requestBidsSteps.push(
                ...module.requestBidsSteps()
              );
            }
            if (module.prebidBidsBackHandler) {
              state.runtimeConfig.adPipelineConfig.prebidBidsBackHandler.push(
                ...module.prebidBidsBackHandler()
              );
            }
          } catch (e) {
            log.error(
              'MoliGlobal',
              `failed to configure ${module.moduleType} module ${module.name}`,
              e
            );
          }
        });

        state = {
          state: 'configured',
          config: config,
          runtimeConfig: state.runtimeConfig,
          modules: modules
        };

        if (shouldInitialize || config.requestAds === true) {
          return requestAds();
        }
        return Promise.resolve(state);
      }
      case 'configured': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already configured.',
          state.config
        );
        return Promise.resolve(state);
      }
      case 'requestAds': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already requesting ads.'
        );
        return Promise.resolve(state);
      }
      case 'finished': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already finished.'
        );
        return Promise.resolve(state);
      }
      case 'error': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to configure moli tag twice. Already finished, but with an error.',
          state.error
        );
        return Promise.resolve(state);
      }
    }
    return Promise.resolve(null);
  }

  function requestAds(): Promise<
    | MoliRuntime.state.IConfigurable
    | MoliRuntime.state.ISinglePageApp
    | MoliRuntime.state.IFinished
    | MoliRuntime.state.IError
  > {
    switch (state.state) {
      case 'configurable': {
        state.initialize = true;
        return Promise.resolve(state);
      }
      case 'configured': {
        setABtestTargeting();
        addDomainLabel(state.config.domain);
        const { refreshInfiniteSlots } = state.runtimeConfig;
        let config = state.config;

        // if there are infinite ad slots available in the refreshInfiniteSlots array, they need to be added to the config
        if (refreshInfiniteSlots.length > 0) {
          refreshInfiniteSlots.forEach(slot => {
            config = addNewInfiniteSlotToConfig(
              config,
              slot.idOfConfiguredSlot,
              slot.artificialDomId,
              getLogger(state.runtimeConfig, window)
            );
          });
        }

        const log = getLogger(state.runtimeConfig, window);

        // call the configured hooks
        if (state.runtimeConfig.hooks && state.runtimeConfig.hooks.beforeRequestAds) {
          state.runtimeConfig.hooks.beforeRequestAds.forEach(hook => {
            try {
              hook(config, state.runtimeConfig);
            } catch (e) {
              log.error('MoliGlobal', 'beforeRequestAds hook failed', e);
            }
          });
        }

        const afterRequestAds = state.runtimeConfig.hooks.afterRequestAds;
        const isSinglePageApp = config.spa?.enabled === true;
        // handle single page application case
        if (isSinglePageApp) {
          const requestAdsRuntimeConfig = state.runtimeConfig;
          // initialize first and then make the initial requestAds() call
          const initialized = adService.initialize(config, requestAdsRuntimeConfig);
          state = {
            state: 'spa-requestAds',
            config: config,
            initialized,
            // modules are initialized in the configure() call
            modules: state.modules,
            // store current state for all subsequent refreshAd calls in this requestAds cycle
            href: window.location.href,
            // reset the refreshed slots array as they are being batched until requestAds() is finished
            runtimeConfig: Object.freeze(
              newEmptyRuntimeConfig(state.runtimeConfig, { keepTargeting: true })
            ),
            // initialize targeting values for next refreshAds call
            nextRuntimeConfig: newEmptyRuntimeConfig(state.runtimeConfig)
          };

          return initialized
            .then(() => adService.requestAds(config, requestAdsRuntimeConfig))
            .then(() => {
              // check if we are still on the same page and in the spa-requestAds state
              // if not the user has already navigated to another page, and we discard everything here
              const validateLocation = config.spa?.validateLocation ?? 'href';
              if (
                state.state === 'spa-requestAds' &&
                allowRefreshAdSlot(validateLocation, state.href, window.location)
              ) {
                const { config, runtimeConfig } = state;
                if (state.runtimeConfig.refreshSlots.length > 0) {
                  adService.refreshAdSlots(runtimeConfig.refreshSlots, config, runtimeConfig);
                }

                if (state.runtimeConfig.refreshBuckets.length > 0) {
                  state.runtimeConfig.refreshBuckets.forEach(bucket => {
                    adService.refreshBucket(bucket.bucket, config, runtimeConfig, bucket.options);
                  });
                }
                afterRequestAds.forEach(hook => hook('spa-finished'));
                const finishedState: MoliRuntime.state.ISinglePageApp = {
                  ...state,
                  state: 'spa-finished',
                  // reset the runtime config for the next requestAds() call cycle
                  nextRuntimeConfig: newEmptyRuntimeConfig(state.runtimeConfig),
                  // keep the current runtime config and only reset the refreshSlots
                  runtimeConfig: newEmptyRuntimeConfig(state.runtimeConfig, { keepTargeting: true })
                };
                state = finishedState;
                return finishedState;
              } else if (state.state === 'spa-finished' || state.state === 'spa-requestAds') {
                // this means that a subsequent requestAds call has finished before the previous one.
                // nothing to do here
                getLogger(state.runtimeConfig, window).debug(
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
            modules: state.modules,
            runtimeConfig: Object.freeze(state.runtimeConfig)
          };
          return adService
            .initialize(config, state.runtimeConfig)
            .then(config => adService.requestAds(config, state.runtimeConfig))
            .then(() => {
              state = {
                state: 'finished',
                config: config,
                runtimeConfig: state.runtimeConfig,
                modules: state.modules
              };
              afterRequestAds.forEach(hook => hook('finished'));
              return Promise.resolve(state);
            })
            .catch(error => {
              getLogger(state.runtimeConfig, window).error('MoliGlobal', error);
              state = {
                state: 'error',
                config: config,
                runtimeConfig: state.runtimeConfig,
                error: error,
                modules: state.modules
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
          getLogger(state.runtimeConfig, window).debug(
            'MoliGlobal',
            "requestAds is being called while the previous requestAds() hasn't finished yet"
          );
        }
        // create new ABTest values
        setABtestTargeting();
        addDomainLabel(state.config.domain);

        const { modules } = state;
        const afterRequestAds = state.nextRuntimeConfig.hooks.afterRequestAds;
        const beforeRequestAds = state.nextRuntimeConfig.hooks.beforeRequestAds;

        const currentState = state;

        // call beforeRequestAds hooks to ensure side effects are being applied to the config first
        beforeRequestAds.forEach(hook => {
          try {
            hook(currentState.config, state.runtimeConfig);
          } catch (e) {
            getLogger(state.runtimeConfig, window).error(
              'MoliGlobal',
              'beforeRequestAds hook failed',
              e
            );
          }
        });

        // we can only use the preexisting refreshSlots array and refreshInfiniteSlots if the previous requestAds call finished in time
        const { initialized, href, nextRuntimeConfig } = state;

        // update the state to spa-requestAds and reset the runtime config. All changes will be queued until the next
        // requestAds call.
        state = {
          ...currentState,
          state: 'spa-requestAds',
          // reset the refreshed slots as they are being batched from now on
          runtimeConfig: newEmptyRuntimeConfig(state.nextRuntimeConfig, { keepTargeting: true }),
          nextRuntimeConfig: newEmptyRuntimeConfig(state.runtimeConfig)
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

            // For single page applications
            return adService.requestAds(config, nextRuntimeConfig).then(() => config);
          })
          .then(config => {
            const runtimeConfig = state.runtimeConfig;
            // if there are refreshAdSlot calls while the requestAds() call is still resolving, there might be new
            // refreshAdSlot calls being queued. Now we can refresh them
            if (state.runtimeConfig.refreshSlots.length > 0) {
              adService.refreshAdSlots(
                state.runtimeConfig.refreshSlots,
                config,
                state.runtimeConfig
              );
            }
            if (state.runtimeConfig.refreshBuckets.length > 0) {
              state.runtimeConfig.refreshBuckets.forEach(bucket => {
                adService.refreshBucket(bucket.bucket, config, runtimeConfig, bucket.options);
              });
            }

            // requesting ads has finished.
            state = {
              state: 'spa-finished',
              config: config,
              initialized,
              modules,
              href: window.location.href,
              runtimeConfig: state.runtimeConfig,
              nextRuntimeConfig: newEmptyRuntimeConfig(state.runtimeConfig)
            };
            afterRequestAds.forEach(hook => hook('spa-finished'));
            return state;
          });
      }
      case 'requestAds': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to requestAds twice. Already requesting ads.'
        );
        return Promise.reject();
      }
      case 'finished': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Trying to requestAds twice. Already finished.'
        );
        return Promise.reject();
      }
      case 'error': {
        getLogger(state.runtimeConfig, window).error(
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
    options?: MoliRuntime.RefreshAdSlotsOptions
  ): Promise<'queued' | 'refreshed'> {
    const domIds = typeof domId === 'string' ? [domId] : domId;
    switch (state.state) {
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds':
        state.runtimeConfig.refreshSlots.push(...domIds);
        return Promise.resolve('queued');
      // If we arrive in the spa-finished state we refresh slots immediately and don't batch them
      // until the next requestAds() call arrives
      case 'spa-finished':
        const validateLocation = state.config.spa?.validateLocation ?? 'href';
        if (allowRefreshAdSlot(validateLocation, state.href, window.location)) {
          // user hasn't navigated yet, so we directly refresh the slot
          return adService
            .refreshAdSlots(domIds, state.config, state.runtimeConfig, options)
            .then(() => 'refreshed');
        } else {
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.nextRuntimeConfig.refreshSlots.push(...domIds);
          return Promise.resolve('queued');
        }
      // if the ad tag is currently requesting ads or already finished doesn't matter
      // slots can be refreshed immediately
      case 'finished':
      case 'requestAds': {
        return adService
          .refreshAdSlots(domIds, state.config, state.runtimeConfig, options)
          .then(() => 'refreshed');
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
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
      case 'configurable':
      case 'configured': {
        state.runtimeConfig.refreshInfiniteSlots.push({
          artificialDomId: domId,
          idOfConfiguredSlot: idOfConfiguredSlot
        });
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds':
        state.runtimeConfig.refreshInfiniteSlots.push({
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
            config: addNewInfiniteSlotToConfig(
              state.config,
              idOfConfiguredSlot,
              domId,
              getLogger(state.runtimeConfig, window)
            )
          };
          return adService
            .refreshAdSlots([domId], state.config, state.runtimeConfig)
            .then(() => 'refreshed');
        } else {
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.runtimeConfig.refreshInfiniteSlots.push({
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
          config: addNewInfiniteSlotToConfig(
            state.config,
            idOfConfiguredSlot,
            domId,
            getLogger(state.runtimeConfig, window)
          )
        };
        return adService
          .refreshAdSlots([domId], state.config, state.runtimeConfig)
          .then(() => 'refreshed');
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          `refreshInfiniteAdSlot is not allowed in state ${state.state}`,
          state.config
        );
        return Promise.reject(`not allowed in state ${state.state}`);
      }
    }
  }

  function refreshBucket(
    bucket: string,
    options?: MoliRuntime.RefreshAdSlotsOptions
  ): Promise<'queued' | 'refreshed'> {
    switch (state.state) {
      case 'configurable': {
        state.runtimeConfig.refreshBuckets.push({ bucket, options });
        return Promise.resolve('queued');
      }
      case 'configured': {
        state.runtimeConfig.refreshBuckets.push({ bucket, options });
        return Promise.resolve('queued');
      }
      // if requestAds is currently called we batch the refreshAdSlot calls until
      // we hit the 'spa-finished' state
      case 'spa-requestAds': {
        state.runtimeConfig.refreshBuckets.push({ bucket, options });
        return Promise.resolve('queued');
      }
      // If we arrive in the spa-finished state we refresh slots immediately and don't batch them
      // until the next requestAds() call arrives
      case 'spa-finished': {
        // user hasn't navigated yet so we directly refresh the slot
        const validateLocation = state.config.spa?.validateLocation ?? 'href';
        if (allowRefreshAdSlot(validateLocation, state.href, window.location)) {
          // user hasn't navigated yet, so we directly refresh the slot
          return adService
            .refreshBucket(bucket, state.config, state.runtimeConfig, options)
            .then(() => 'refreshed');
        } else {
          // requestAds() hasn't been called yet, but some ad slot is already ready to be requested
          state.runtimeConfig.refreshBuckets.push({ bucket, options });
          return Promise.resolve('queued');
        }
      }
      // if the ad tag is currently requesting ads or already finished doesn't matter
      // slots can be refreshed immediately
      case 'finished':
      case 'requestAds': {
        return adService
          .refreshBucket(bucket, state.config, state.runtimeConfig, options)
          .then(() => 'refreshed');
      }
      default: {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          `refreshAdSlot is not allowed in state ${state.state}`,
          state.config
        );
        return Promise.reject(`not allowed in state ${state.state}`);
      }
    }
  }

  function getState(): MoliRuntime.state.States {
    return state.state;
  }

  function getModuleMeta(): ReadonlyArray<ModuleMeta> {
    return state.modules;
  }

  function openConsole(path?: string): void {
    switch (state.state) {
      case 'configurable': {
        getLogger(state.runtimeConfig, window).error(
          'MoliGlobal',
          'Cannot open console before configuration'
        );
        break;
      }
      default: {
        assetLoaderService
          .loadScript({
            assetUrl:
              path ??
              `https://highfivve.github.io/moli-ad-tag/assets/bundle/v${packageJson.version}/console.js`,
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

  /**
   * This functions creates a new runtime configuration from the previous one, if one exists.
   * It's important to note that some state is persistent across multiple requestAds() calls, because they are only set
   * once and use for the entire session time. This includes
   *
   * - hooks , because they are usually set once on the initial load and are not expected to change
   * - adUnitPathVariables , because domain & device do not chain during a session
   * - logger , configured once and not expected to change
   *
   * The following values are reset to an empty state:
   *
   * - labels , they are only valid for the current page
   * - keyValues , they are only valid for the current page
   * - refreshSlots , slots that have been refreshed, must be explicitly refreshed again
   * - refreshInfiniteSlots , slots that have been refreshed, must be explicitly refreshed again
   *
   * @param previous
   * @param options
   */
  function newEmptyRuntimeConfig(
    previous?: MoliRuntime.MoliRuntimeConfig,
    options?: {
      /** if true, the labels and keyValues are kept from the previous runtime config */
      keepTargeting: boolean;
    }
  ): MoliRuntime.MoliRuntimeConfig {
    return {
      environment: previous?.environment ?? 'production',
      // reusing the previous hooks as they are usually set once on the initial load
      hooks: {
        beforeRequestAds: previous?.hooks.beforeRequestAds ?? [],
        afterRequestAds: previous?.hooks.afterRequestAds ?? []
      },
      logger: previous?.logger ?? undefined,
      // all these values always depend on the current page and must be reset to an empty state
      adUnitPathVariables:
        options?.keepTargeting === true ? (previous?.adUnitPathVariables ?? {}) : {},
      labels: options?.keepTargeting === true ? (previous?.labels ?? []) : [],
      keyValues: options?.keepTargeting === true ? (previous?.keyValues ?? {}) : {},
      refreshSlots: [],
      refreshInfiniteSlots: [],
      refreshBuckets: [],
      // the pipeline is always reset to an empty state as they can be altered after the first requestAds() call.
      // stacking up pipeline steps would lead to unexpected behavior, when the same step is added multiple times.
      adPipelineConfig: {
        initSteps: [],
        configureSteps: [],
        prepareRequestAdsSteps: [],
        requestBidsSteps: [],
        prebidBidsBackHandler: []
      }
    };
  }

  const que = {
    push(cmd: MoliRuntime.MoliCommand): void {
      cmd(moliWindow.moli);
    }
  };

  return {
    que: que,
    version: packageJson.version,
    setTargeting: setTargeting,
    addLabel: addLabel,
    setLogger: setLogger,
    setAdUnitPathVariables: setAdUnitPathVariables,
    resolveAdUnitPath: resolveAdUnitPath,
    beforeRequestAds: beforeRequestAds,
    afterRequestAds: afterRequestAds,
    getConfig: getConfig,
    getRuntimeConfig: getRuntimeConfig,
    getPageTargeting: getPageTargeting,
    registerModule: registerModule,
    configure: configure,
    requestAds: requestAds,
    refreshAdSlot: refreshAdSlot,
    refreshBucket: refreshBucket,
    refreshInfiniteAdSlot: refreshInfiniteAdSlot,
    getModuleMeta: getModuleMeta,
    getState: getState,
    openConsole: openConsole,
    getAssetLoaderService: () => assetLoaderService,
    addEventListener: eventService.addEventListener,
    removeEventListener: eventService.removeEventListener
  };
};
