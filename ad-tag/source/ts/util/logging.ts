import { parseQueryString } from './query';
import { MoliRuntime } from '../types/moliRuntime';
import { MoliConfig } from '../types/moliConfig';

/**
 * Get the parameter `moliDebug`. If set to true all logs will be written to the console.
 *
 * The value can be set either
 *
 * - as a query parameter: `moliDebug=true`
 * - as a session storage key
 * - as a local storage key
 */
export function getMoliDebugParameter(window: Window): boolean {
  try {
    const key = 'moliDebug';
    const params = parseQueryString(window.location.search);
    return (
      !!params.get(key) ||
      !!window.sessionStorage.getItem(key) ||
      !!window.localStorage.getItem(key)
    );
  } catch (_) {
    return false;
  }
}

/**
 * The noop logger that only writes error to the console.
 */
function getNoopLogger(): MoliRuntime.MoliLogger {
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
  source:
    | 'AdPipeline'
    | 'GAM'
    | 'Prebid'
    | 'Faktor CMP'
    | 'MoliGlobal'
    | 'AdVisibilityService'
    | 'UserActivityService'
    | 'Adex DMP'
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
    case 'Prebid':
      return getLabelStyle('#4357AD');
    case 'AdVisibilityService':
      return getLabelStyle('#d5ba3c');
    case 'UserActivityService':
      return getLabelStyle('#19ad0e');
    case 'Adex DMP':
      return getLabelStyle('#003E74');
    default:
      return getLabelStyle('#052E53');
  }
}

/**
 * The default logger that writes everything to the console with labels.
 */
export function getDefaultLogger(): MoliRuntime.MoliLogger {
  return {
    debug(source?: any, message?: any, ...optionalParams: any[]): void {
      // eslint-disable-next-line
      console.debug(
        `%c[DEBUG]%c${source}%c${message}`,
        getLogStageLabelStyle('debug'),
        getSourceLabelStyle(source),
        '',
        ...optionalParams
      );
    },
    info(source?: any, message?: any, ...optionalParams: any[]): void {
      // eslint-disable-next-line
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
export function getLogger(config: MoliConfig | null, window: Window): MoliRuntime.MoliLogger {
  if (getMoliDebugParameter(window)) {
    return getDefaultLogger();
  } else if (config && config.logger) {
    return config.logger;
  } else {
    return getNoopLogger();
  }
}

/**
 * Allows to change the underlying logging during runtime.
 * @internal
 */
export class ProxyLogger implements MoliRuntime.MoliLogger {
  constructor(private logger: MoliRuntime.MoliLogger) {}

  setLogger = (newLogger: MoliRuntime.MoliLogger): void => {
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
