import { parseQueryString } from './query';
import { Moli } from '..';

/**
 * Get the parameter `moliDebug`. If set to true all logs will be written to the console.
 *
 */
function getMoliDebugParameter(): boolean {
  const key = 'moliDebug';
  const params = parseQueryString(window.location.search);
  const param = params.get(key);

  return param ? param.toLowerCase() === 'true' : false;
}

/**
 * The noop logger that only writes error to the console.
 */
function getNoopLogger(): Moli.MoliLogger {
  const noop = () => {
    return;
  };
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: console.error
  };
}

/**
 * The default logger that writes everything to the console with labels.
 */
export function getDefaultLogger(): Moli.MoliLogger {

  const formatting = 'background:#49a0cc; color:#FFF; padding:5px; border-radius:5px; line-height: 15px;';

  return {
    debug(message?: any, ...optionalParams: any[]): void {
      window.console.debug(`%c[DEBUG]%c ${message}`, formatting, '', ...optionalParams);
    },
    info(message?: any, ...optionalParams: any[]): void {
      window.console.info(`%c[INFO]%c ${message}`, formatting, '', ...optionalParams);
    },
    warn(message?: any, ...optionalParams: any[]): void {
      window.console.warn(`%c[WARN]%c ${message}`, formatting, '', ...optionalParams);
    },
    error(message?: any, ...optionalParams: any[]): void {
      window.console.error(`%c[ERROR]%c ${message}`, formatting, '', ...optionalParams);
    }
  };
}

/**
 *  Logging:
 *
 *  - log to console if the `moliDebug` parameter is set
 *  - log to custom logger if logger is set by publisher
 *  - log errors to console if no logger is configured
 *
 * @param config
 */
export function getLogger(config: Moli.MoliConfig): Moli.MoliLogger {

  if (getMoliDebugParameter()) {
    return getDefaultLogger();

  } else if (config.logger) {
    return config.logger;

  } else {
    return getNoopLogger();
  }
}
