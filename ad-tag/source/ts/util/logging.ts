import { parseQueryString } from './query';
import { Moli } from '../types/moli';

/**
 * Get the parameter `moliDebug`. If set to true all logs will be written to the console.
 *
 */
function getMoliDebugParameter(window: Window): boolean {
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
 * returns the style for a label
 *
 * @param background the color of label
 */
function getLabelStyle(background: string): string {
  return `background:${background}; color:#FFF; padding:3px; margin:3px; border-radius:5px; line-height: 15px;`;
}

/**
 * defines the style for the log stage label at the beginning of the log message.
 *
 * @param logStage
 */
function getLogStageLabelStyle(logStage: 'debug' | 'info' | 'warn' | 'error'): string {
  switch (logStage) {
    case 'debug':
      return getLabelStyle('#49A0CC');
    case 'info':
      return getLabelStyle('#61A172');
    case 'warn':
      return getLabelStyle('#FFC300');
    case 'error':
      return getLabelStyle('#C70039');
  }
}

/**
 * defines the style for the label source label, that tells where the log came from.
 *
 * @param source
 */
function getSourceLabelStyle(
  source: 'AdPipeline' | 'GAM' | 'Prebid' | 'Faktor CMP' | 'MoliGlobal' | 'SlotEventService'
): string {
  switch (source) {
    case 'AdPipeline':
      return getLabelStyle('#74ABC6');
    case 'GAM':
      return getLabelStyle('#BA0E5F');
    case 'Faktor CMP':
      return getLabelStyle('#9374C6');
    case 'MoliGlobal':
      return getLabelStyle('#403073');
    case 'SlotEventService':
      return getLabelStyle('#4357AD');
    case 'Prebid':
      return getLabelStyle('#4357AD');
    default:
      return getLabelStyle('#052E53');
  }
}

/**
 * The default logger that writes everything to the console with labels.
 */
export function getDefaultLogger(): Moli.MoliLogger {
  return {
    debug(source?: any, message?: any, ...optionalParams: any[]): void {
      console.debug(
        `%c[DEBUG]%c${source}%c${message}`,
        getLogStageLabelStyle('debug'),
        getSourceLabelStyle(source),
        '',
        ...optionalParams
      );
    },
    info(source?: any, message?: any, ...optionalParams: any[]): void {
      console.info(
        `%c[INFO]%c${source}%c${message}`,
        getLogStageLabelStyle('info'),
        getSourceLabelStyle(source),
        '',
        ...optionalParams
      );
    },
    warn(source?: any, message?: any, ...optionalParams: any[]): void {
      console.warn(
        `%c[WARN]%c${source}%c${message}`,
        getLogStageLabelStyle('warn'),
        getSourceLabelStyle(source),
        '',
        ...optionalParams
      );
    },
    error(source?: any, message?: any, ...optionalParams: any[]): void {
      console.error(
        `%c[ERROR]%c${source}%c${message}`,
        getLogStageLabelStyle('error'),
        getSourceLabelStyle(source),
        '',
        ...optionalParams
      );
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
 * @param window the global window object
 */
export function getLogger(config: Moli.MoliConfig | null, window: Window): Moli.MoliLogger {
  if (getMoliDebugParameter(window)) {
    return getDefaultLogger();
  } else if (config?.logger) {
    return config.logger;
  } else {
    return getNoopLogger();
  }
}

/**
 * Allows to change the underlying logging during runtime.
 */
export class ProxyLogger implements Moli.MoliLogger {
  constructor(private logger: Moli.MoliLogger) {}

  setLogger = (newLogger: Moli.MoliLogger): void => {
    this.logger = newLogger;
  };

  debug(message?: any, ...optionalParams: any[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.logger.error(message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.logger.info(message, ...optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.logger.warn(message, ...optionalParams);
  }
}
