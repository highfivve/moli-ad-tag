import { Moli } from '../types/moli';
import { DfpService } from './dfpService';
import { assetLoaderService } from '../util/assetLoaderService';
import { cookieService } from '../util/cookieService';

const dfpService = new DfpService(assetLoaderService, cookieService);


/**
 *
 * # State transitions
 *
 * TODO: allowed state transitions
 * TODO: document various que ordering examples
 *
 */
interface IState {
  readonly state: 'configurable' | 'configured' | 'requestAds' | 'finished' | 'error';
}

interface IConfigurable extends IState {
  readonly state: 'configurable';


  // changeable configuration options

  /**
   * If set to true, initializes the ad tag as soon as the ad configuration has been set.
   * If set to false, nothing will initialize until moli.initialize is called
   */
  initialize: boolean;

  /**
   * Additional key-values. Insert with
   *
   * @example
   * window.moli.que.push(function(moli) => {
   *   moli.setTargeting(key, value);
   * });
   *
   */
  keyValues: Moli.DfpKeyValueMap;

}

/**
 * The ad configuration has been set
 */
interface IConfigured extends IState {
  readonly state: 'configured';

  /**
   * Changeable configuration if other settings have been pushed into the que.
   */
  config: Moli.MoliConfig;
}

/**
 * Moli should be initialized. This can only be done from the "configured" state.
 *
 * If moli is in the "configurable" state, the `initialize` flag will be set to true
 * and moli is initialized once it's configured.
 */
interface IRequestAds extends IState {
  readonly state: 'requestAds';

  /**
   * Configuration is now immutable
   */
  readonly config: Moli.MoliConfig;
}

/**
 * Moli has finished loading.
 */
interface IFinished extends IState {
  readonly state: 'finished';

  /**
   * Configuration is now immutable
   */
  readonly config: Moli.MoliConfig;
}

/**
 * Moli has finished loading.
 */
interface IError extends IState {
  readonly state: 'error';

  /**
   * Configuration is now immutable
   */
  readonly config: Moli.MoliConfig;

  /**
   * the error. Should  be readable for a key accounter and a techi.
   */
  readonly error: any;
}

/**
 * All valid states
 */
type IStateMachine = IConfigurable | IConfigured | IRequestAds | IFinished | IError;


const logger = (logger: Moli.MoliLogger | undefined): Moli.MoliLogger => {
  return logger ? logger : {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
};

const moliGlobal = (): Moli.MoliTag => {

  /**
   * Initial state is configurable
   */
  let state: IStateMachine = {
    state: 'configurable',
    initialize: false,
    keyValues: {}
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
        logger(state.config.logger).error(`Setting key-value after configuration: ${key} : ${value}`);
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
              keyValues: { ...state.keyValues }
            }
          }
        };
        if (shouldInitialize) {
          requestAds();
        }
        break;
      }
      case 'configured': {
        logger(state.config.logger).error('Trying to configure moli tag twice. Already configured.', state.config);
        break;
      }
      case 'requestAds': {
        logger(state.config.logger).error('Trying to configure moli tag twice. Already requesting ads.');
        break;
      }
      case 'finished': {
        logger(state.config.logger).error('Trying to configure moli tag twice. Already finished.');
        break;
      }
      case 'error': {
        logger(state.config.logger).error('Trying to configure moli tag twice. Already finished, but with an error.', state.error);
        break;
      }
    }
  }

  function requestAds(): void {
    switch (state.state) {
      case 'configurable': {
        state.initialize = true;
        break;
      }
      case 'configured': {
        const config = state.config;
        dfpService.initialize(config).then(() => {
          state = {
            state: 'finished',
            config: config
          };
        }).catch((error) => {
           state = {
             state: 'error',
             config: config,
             error: error
           };
        });
        break;
      }
      case 'requestAds': {
        logger(state.config.logger).error('Trying to requestAds twice. Already requesting ads.');
        break;
      }
      case 'finished': {
        logger(state.config.logger).error('Trying to requestAds twice. Already finished.');
        break;
      }
      case 'error': {
        logger(state.config.logger).error('Trying to requestAds twice. Already finished, but with an error.', state.error);
        break;
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
    getConfig: getConfig,
    configure: configure,
    requestAds: requestAds
  };
};


const queueCommands = window.moli ? [...window.moli.que as Moli.MoliCommand[]] || [] : [];

/**
 * Only export the public API and hide properties and methods in the DFP Service
 */
export const moli: Moli.MoliTag = moliGlobal();
window.moli = moli;

queueCommands.forEach(cmd => cmd(moli));
