import { Moli } from '../types/moli';
import { parseQueryString } from '../util/query';
import { DfpService } from './dfpService';
import { assetLoaderService, AssetLoadMethod } from '../util/assetLoaderService';
import { cookieService } from '../util/cookieService';
import IStateMachine = Moli.state.IStateMachine;
import IFinished = Moli.state.IFinished;
import IError = Moli.state.IError;
import IConfigurable = Moli.state.IConfigurable;
import ISinglePageApp = Moli.state.ISinglePageApp;
import { getLogger } from '../util/logging';

export const createMoliTag = (): Moli.MoliTag => {

  // Creating the actual tag requires exactly one DfpService instance
  const dfpService = new DfpService(assetLoaderService, cookieService);

  /**
   * Initial state is configurable
   */
  let state: IStateMachine = {
    state: 'configurable',
    initialize: false,
    isSinglePageApp: false,
    keyValues: {},
    labels: [],
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
      default: {
        getLogger(state.config).error('MoliGlobal', `Setting key-value after configuration: ${key} : ${value}`);
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
      default: {
        getLogger(state.config).error('MoliGlobal', `Adding label after configure: ${label}`);
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
        getLogger(state.config).error('MoliGlobal', 'Trying to setSampleRate. Already configured.', state.config);
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
        getLogger(state.config).error('MoliGlobal', 'Trying to setSampleRate. Already configured.', state.config);
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
        getLogger(state.config).error('MoliGlobal', 'Trying to add a hook beforeRequestAds. Already configured.', state.config);
        break;
      }
    }
  }

  function getConfig(): Moli.MoliConfig | undefined {
    switch (state.state) {
      case 'configurable': {
        return undefined;
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

  function configure(config: Moli.MoliConfig): void {
    switch (state.state) {
      case 'configurable': {
        const shouldInitialize = state.initialize;
        state = {
          state: 'configured',
          config: {
            ...config,
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
        getLogger(state.config).error('MoliGlobal', 'Trying to configure moli tag twice. Already configured.', state.config);
        break;
      }
      case 'requestAds': {
        getLogger(state.config).error('MoliGlobal', 'Trying to configure moli tag twice. Already requesting ads.');
        break;
      }
      case 'finished': {
        getLogger(state.config).error('MoliGlobal', 'Trying to configure moli tag twice. Already finished.');
        break;
      }
      case 'error': {
        getLogger(state.config).error('MoliGlobal', 'Trying to configure moli tag twice. Already finished, but with an error.', state.error);
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
        getLogger(state.config).error('MoliGlobal', 'Trying enable single page app. Already configured.', state.config);
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
        // handle single page application case
        if (state.isSinglePageApp) {
          // initialize first and then make the initial requestAds() call
          const initialized = dfpService.initialize(config).then(() => config);
          const currentState: ISinglePageApp = {
            state: 'spa',
            config: config,
            refreshAds: dfpService.requestAds,
            destroyAdSlots: dfpService.destroyAdSlots,
            initialized
          };
          state = currentState;

          return initialized
            .then(() => dfpService.requestAds(config))
            .then(() => currentState);

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
              return Promise.resolve(state);
            }).catch((error) => {
              state = {
                state: 'error',
                config: config,
                error: error
              };
              return Promise.resolve(state);
            });
        }
      }
      // in the single page application state we first need to destroy the current setup
      case 'spa': {
        const { initialized, refreshAds, destroyAdSlots } = state;
        return initialized
          .then(config => destroyAdSlots(config))
          .then(config => {
            refreshAds(config);
            return config;
          })
          .then((config) => {
            state = {
              state: 'spa',
              refreshAds,
              destroyAdSlots,
              config,
              initialized
            };
            return state;
          });
      }
      case 'requestAds': {
        getLogger(state.config).error('MoliGlobal', 'Trying to requestAds twice. Already requesting ads.');
        return Promise.reject();
      }
      case 'finished': {
        getLogger(state.config).error('MoliGlobal', 'Trying to requestAds twice. Already finished.');
        return Promise.reject();
      }
      case 'error': {
        getLogger(state.config).error('MoliGlobal', 'Trying to requestAds twice. Already finished, but with an error.', state.error);
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
    getConfig: getConfig,
    configure: configure,
    enableSinglePageApp: enableSinglePageApp,
    requestAds: requestAds,
    getState: getState,
    openConsole: openConsole
  };
};

// =============================
// ====== Initialization =======
// =============================

const queueCommands = window.moli ? [ ...window.moli.que as Moli.MoliCommand[] ] || [] : [];

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = createMoliTag();
window.moli = moli;

queueCommands.forEach(cmd => cmd(moli));
