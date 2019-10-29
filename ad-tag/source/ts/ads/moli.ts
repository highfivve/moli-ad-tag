import { Moli } from '../types/moli';
import { parseQueryString } from '../util/query';
import { DfpService } from './dfpService';
import { createAssetLoaderService, AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { cookieService } from '../util/cookieService';
import { getLogger } from '../util/logging';
import IStateMachine = Moli.state.IStateMachine;
import IFinished = Moli.state.IFinished;
import IError = Moli.state.IError;
import IConfigurable = Moli.state.IConfigurable;
import ISinglePageApp = Moli.state.ISinglePageApp;
import { IModule } from '../types/module';

export const createMoliTag = (window: Window): Moli.MoliTag => {

  // Creating the actual tag requires exactly one DfpService instance
  const assetLoaderService = createAssetLoaderService(window);
  const dfpService = new DfpService(assetLoaderService, cookieService, window);

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
    reporting: {
      reporters: []
    }
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
              }
            }
          };
        }
        break;
      }
      case 'spa': {
        state.keyValues = {
          [key]: value,
          ...state.keyValues
        };
        break;
      }
      default: {
        getLogger(state.config, window).error('MoliGlobal', `Setting key-value after configuration: ${key} : ${value}`);
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
        if (state.config.targeting && state.config.targeting.labels) {
          state.config.targeting.labels.push(label);
        } else {
          state.config = {
            ...state.config,
            targeting: {
              keyValues: (state.config.targeting ? state.config.targeting.keyValues : {}),
              labels: [ label ]
            }
          };
        }
        break;
      }
      case 'spa': {
        state.labels.push(label);
        break;
      }
      default: {
        getLogger(state.config, window).error('MoliGlobal', `Adding label after configure: ${label}`);
        break;
      }
    }
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
      default : {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to setSampleRate. Already configured.', state.config);
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
            reporters: [ ...(state.config.reporting ? state.config.reporting.reporters : []), reporter ]
          }
        };
        break;
      }
      default : {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to setSampleRate. Already configured.', state.config);
        break;
      }
    }
  }

  function beforeRequestAds(callback: (config: Moli.MoliConfig) => void): void {
    switch (state.state) {
      case 'configurable': {
        state.hooks = {
          ...state.hooks,
          beforeRequestAds: callback
        };
        break;
      }
      case 'configured': {
        state.hooks = {
          ...state.hooks,
          beforeRequestAds: callback
        };
        break;
      }
      default : {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to add a hook beforeRequestAds. Already configured.', state.config);
        break;
      }
    }
  }
  function afterRequestAds(callback: (state: Moli.state.AfterRequestAdsStates) => void): void {
    switch (state.state) {
      case 'configurable': {
        state.hooks = {
          ...state.hooks,
          afterRequestAds: callback
        };
        break;
      }
      case 'configured': {
        state.hooks = {
          ...state.hooks,
          afterRequestAds: callback
        };
        break;
      }
      default : {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to add a hook afterRequestAds. Already configured.', state.config);
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
      case 'spa': {
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
        return;
      }
      default: {
        getLogger(state.config, window).error('Registering a module is only allowed within the ad tag before the ad tag is configured');
      }
    }
  }

  function configure(config: Moli.MoliConfig): void {
    switch (state.state) {
      case 'configurable': {
        const shouldInitialize = state.initialize;
        const envOverride = getEnvironmentOverride();
        const modules = state.modules;

        // initialize modules with the config from the ad tag. There is no external configuration support for modules.
        // the config will be altered by this call
        modules.forEach(module => {
          const log = getLogger(config, window);
          log.debug('MoliGlobal', `initialize ${module.moduleType} module ${module.name}`, module.config());
          module.init(config, assetLoaderService);
        });


        state = {
          state: 'configured',
          configFromAdTag: config,
          config: {
            ...config,
            ...envOverride,
            targeting: {
              keyValues: {
                ...(config.targeting && config.targeting.keyValues ? config.targeting.keyValues : {}),
                ...state.keyValues
              },
              labels: [
                ...(config.targeting && config.targeting.labels ? config.targeting.labels : []),
                ...state.labels
              ]
            },
            reporting: {
              ...config.reporting,
              sampleRate: state.reporting.sampleRate ? state.reporting.sampleRate : (config.reporting && config.reporting.sampleRate) ? config.reporting.sampleRate : 0,
              reporters: [ ...(config.reporting ? config.reporting.reporters : []), ...state.reporting.reporters ]
            },
            logger: state.logger || config.logger
          },
          hooks: state.hooks,
          isSinglePageApp: state.isSinglePageApp
        };

        if (shouldInitialize) {
          requestAds();
        }
        break;
      }
      case 'configured': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to configure moli tag twice. Already configured.', state.config);
        break;
      }
      case 'requestAds': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to configure moli tag twice. Already requesting ads.');
        break;
      }
      case 'finished': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to configure moli tag twice. Already finished.');
        break;
      }
      case 'error': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to configure moli tag twice. Already finished, but with an error.', state.error);
        break;
      }
    }
  }

  function enableSinglePageApp(): void {
    switch (state.state) {
      case 'configurable': {
        state.isSinglePageApp = true;
        break;
      }
      case 'configured': {
        state.isSinglePageApp = true;
        break;

      }
      default : {
        getLogger(state.config, window).error('MoliGlobal', 'Trying enable single page app. Already configured.', state.config);
        break;
      }
    }
  }

  function requestAds(): Promise<IConfigurable | ISinglePageApp | IFinished | IError> {
    switch (state.state) {
      case 'configurable': {
        state.initialize = true;
        setABtestTargeting();
        return Promise.resolve(state);
      }
      case 'configured': {
        setABtestTargeting();
        const config = state.config;

        // call the configured hooks
        if (state.hooks && state.hooks.beforeRequestAds) {
          state.hooks.beforeRequestAds(config);
        }

        const afterRequestAds =  state.hooks && state.hooks.afterRequestAds ? state.hooks.afterRequestAds : () => { return; };

        // handle single page application case
        if (state.isSinglePageApp) {
          // initialize first and then make the initial requestAds() call
          const initialized = dfpService.initialize(config).then(() => config);
          const currentState: ISinglePageApp = {
            state: 'spa',
            configFromAdTag: state.configFromAdTag,
            config: config,
            refreshAds: (moliConfig: Moli.MoliConfig) => dfpService.requestAds(moliConfig).then(() => { return; }),
            destroyAdSlots: dfpService.destroyAdSlots,
            resetTargeting: dfpService.resetTargeting,
            initialized,
            href: window.location.href,
            // initialize targeting values for next refreshAds call
            labels: [],
            keyValues: {},
            hooks: state.hooks
          };
          state = currentState;

          return initialized
            .then(() => dfpService.requestAds(config))
            .then(() => {
              afterRequestAds(currentState.state);
              return currentState;
            });

        } else {
          state = {
            state: 'requestAds',
            config: config
          };
          return dfpService.initialize(config)
            .then(config => dfpService.requestAds(config))
            .then(() => {
              state = {
                state: 'finished',
                config: config
              };
              afterRequestAds(state.state);
              return Promise.resolve(state);
            }).catch((error) => {
              state = {
                state: 'error',
                config: config,
                error: error
              };
              afterRequestAds(state.state);
              return Promise.resolve(state);
            });
        }
      }
      // in the single page application state we first need to destroy the current setup
      case 'spa': {
        // create new ABTest values
        setABtestTargeting();

        const hooks = state.hooks;
        const afterRequestAds =  hooks && hooks.afterRequestAds ? hooks.afterRequestAds : () => { return; };

        const { initialized, refreshAds, destroyAdSlots, resetTargeting, href, keyValues, labels, configFromAdTag } = state;
        return initialized
          .then((config) => {
            // don't use the config from the initialized method as we need to alter the config
            // here to allow different key-values for multiple pages
            if (href === window.location.href) {
              return Promise.reject('You are trying to refresh ads on the same page, which is not allowed.');
            }
            return Promise.resolve(config);
          })
          .then(config => destroyAdSlots(config))

          .then(config => {

            // we insert the fixed targeting values from the `configFromAdTag` and discard all others that have
            // been set via the moli API (e.g. setTargeting or addLabel)
            return {
              ...config,
              targeting: {
                keyValues: {
                  ...(configFromAdTag.targeting && configFromAdTag.targeting.keyValues ? configFromAdTag.targeting.keyValues : {}),
                  ...keyValues
                },
                labels: [
                  ...(configFromAdTag.targeting && configFromAdTag.targeting.labels ? configFromAdTag.targeting.labels : []),
                  ...labels
                ]
              }
            };
          })
          .then(configWithTargeting => {
            resetTargeting(configWithTargeting);
            return refreshAds(configWithTargeting).then(() => configWithTargeting);
          })
          .then((configWithTargeting) => {
            state = {
              state: 'spa',
              refreshAds: refreshAds,
              destroyAdSlots: destroyAdSlots,
              resetTargeting: resetTargeting,
              configFromAdTag: configFromAdTag,
              config: configWithTargeting,
              initialized: initialized,
              href: window.location.href,
              hooks: hooks,
              // reset targeting after successful refreshAds()
              labels: [],
              keyValues: {}
            };
            afterRequestAds(state.state);
            return state;
          });
      }
      case 'requestAds': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to requestAds twice. Already requesting ads.');
        return Promise.reject();
      }
      case 'finished': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to requestAds twice. Already finished.');
        return Promise.reject();
      }
      case 'error': {
        getLogger(state.config, window).error('MoliGlobal', 'Trying to requestAds twice. Already finished, but with an error.', state.error);
        return Promise.reject();
      }
    }
  }

  function getState(): Moli.state.States {
    return state.state;
  }

  function openConsole(path?: string): void {
    switch (state.state) {
      case 'configurable': {
        break;
      }
      default: {
        assetLoaderService.loadScript({
          assetUrl: path || 'https://ad-tag-console.h5v.eu/moli-debug.min.js',
          loadMethod: AssetLoadMethod.TAG,
          name: 'moli-debugger'
        });
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

  /**
   * Overrides the environment configuration. This allows us to either force
   * a production or test environment, which eases the integration for the publisher.
   *
   * query parameter: moliEnv
   * allowed values: test | production
   *
   * Example:
   * {@link https://local.h5v.eu:9000/?moliEnv=test}
   *
   */
  function getEnvironmentOverride(): Pick<Moli.MoliConfig, 'environment'> {
    const key = 'moliEnv';
    const params = parseQueryString(window.location.search);
    const param = params.get(key);

    switch (param && param.toLowerCase()) {
      case 'test':
        return { environment: 'test' };
      case 'production':
        return { environment: 'production' };
      default:
        return {};
    }
  }

  function getAssetLoaderService(): IAssetLoaderService {
    return assetLoaderService;
  }

  const que = {
    push(cmd: Moli.MoliCommand): void {
      cmd(window.moli);
    }
  };

  return {
    que: que,
    setTargeting: setTargeting,
    addLabel: addLabel,
    setLogger: setLogger,
    setSampleRate: setSampleRate,
    addReporter: addReporter,
    beforeRequestAds: beforeRequestAds,
    afterRequestAds: afterRequestAds,
    getConfig: getConfig,
    registerModule: registerModule,
    configure: configure,
    enableSinglePageApp: enableSinglePageApp,
    requestAds: requestAds,
    getState: getState,
    openConsole: openConsole,
    getAssetLoaderService: getAssetLoaderService
  };
};
