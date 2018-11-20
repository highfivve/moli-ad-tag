import { Moli } from '../types/moli';
import { DfpService } from './dfpService';
import { assetLoaderService, AssetLoadMethod } from '../util/assetLoaderService';
import { cookieService } from '../util/cookieService';
import IStateMachine = Moli.state.IStateMachine;
import IFinished = Moli.state.IFinished;
import IError = Moli.state.IError;
import IConfigurable = Moli.state.IConfigurable;

const dfpService = new DfpService(assetLoaderService, cookieService);

const getLogger = (logger: Moli.MoliLogger | undefined): Moli.MoliLogger => {
  return logger ? logger : {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
};

export const createMoliTag = (): Moli.MoliTag => {

  /**
   * Initial state is configurable
   */
  let state: IStateMachine = {
    state: 'configurable',
    initialize: false,
    keyValues: {},
    labels: []
  };

  function setTargeting(key: string, value: string | string[]): void {
    switch (state.state) {
      case 'configurable': {
        state.keyValues[key] = value;
        break;
      }
      case 'configured': {
        if (state.config.targeting) {
          state.config.targeting.keyValues[ key ] = value;
        } else {
          state.config = {
            ...state.config,
            targeting: {
              keyValues: {
                [ key ]: value
              }
            }
          };
        }
        break;
      }
      default: {
        getLogger(state.config.logger).error(`Setting key-value after configuration: ${key} : ${value}`);
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
              keyValues: {},
              labels: [label]
            }
          };
        }
        break;
      }
      default: {
        getLogger(state.config.logger).error(`Adding label after configure: ${label}`);
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
              keyValues: { ...state.keyValues },
              labels: [
                ...(config.targeting && config.targeting.labels ? config.targeting.labels : []),
                ...state.labels
              ]
            },
            logger: state.logger || config.logger
          }
        };
        if (shouldInitialize) {
          requestAds();
        }
        break;
      }
      case 'configured': {
        getLogger(state.config.logger).error('Trying to configure moli tag twice. Already configured.', state.config);
        break;
      }
      case 'requestAds': {
        getLogger(state.config.logger).error('Trying to configure moli tag twice. Already requesting ads.');
        break;
      }
      case 'finished': {
        getLogger(state.config.logger).error('Trying to configure moli tag twice. Already finished.');
        break;
      }
      case 'error': {
        getLogger(state.config.logger).error('Trying to configure moli tag twice. Already finished, but with an error.', state.error);
        break;
      }
    }
  }

  function requestAds(): Promise<IConfigurable | IFinished | IError> {
    switch (state.state) {
      case 'configurable': {
        state.initialize = true;
        return Promise.resolve(state);
      }
      case 'configured': {
        const config = state.config;
        state = {
          state: 'requestAds',
          config: config
        };
        return dfpService.initialize(config).then(() => {
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
      case 'requestAds': {
        getLogger(state.config.logger).error('Trying to requestAds twice. Already requesting ads.');
        return Promise.reject();
      }
      case 'finished': {
        getLogger(state.config.logger).error('Trying to requestAds twice. Already finished.');
        return Promise.reject();
      }
      case 'error': {
        getLogger(state.config.logger).error('Trying to requestAds twice. Already finished, but with an error.', state.error);
        return Promise.reject();
      }
    }
  }

  function getState(): Moli.state.States {
    return state.state;
  }

  function openConsole(): void {
    switch (state.state) {
      case 'configurable': {
        break;
      }
      default: {
        assetLoaderService.loadScript({
          assetUrl: 'moli-debug.min.js', // TODO: make asset path configurable
          loadMethod: AssetLoadMethod.TAG,
          name: 'moli-debugger'
        });
      }
    }
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
    getConfig: getConfig,
    configure: configure,
    requestAds: requestAds,
    getState: getState,
    openConsole: openConsole
  };
};

// =============================
// ====== Initialization =======
// =============================

const queueCommands = window.moli ? [...window.moli.que as Moli.MoliCommand[]] || [] : [];

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = createMoliTag();
window.moli = moli;

queueCommands.forEach(cmd => cmd(moli));
