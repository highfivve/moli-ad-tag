import { MoliRuntime } from '../types/moliRuntime';
import MoliRuntimeConfig = MoliRuntime.MoliRuntimeConfig;
export declare function getMoliDebugParameter(window: Window): boolean;
export declare function getDefaultLogger(): MoliRuntime.MoliLogger;
export declare function getLogger(config: MoliRuntimeConfig | null, window: Window): MoliRuntime.MoliLogger;
export declare class ProxyLogger implements MoliRuntime.MoliLogger {
    private logger;
    constructor(logger: MoliRuntime.MoliLogger);
    setLogger: (newLogger: MoliRuntime.MoliLogger) => void;
    debug(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
}
