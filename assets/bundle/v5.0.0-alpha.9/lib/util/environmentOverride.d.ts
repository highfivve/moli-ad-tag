import { Environment } from '../types/moliConfig';
import { OverrideValue } from './resolveOverrides';
export declare const getActiveEnvironmentOverride: (window: Window) => OverrideValue<Environment>;
export declare const setEnvironmentOverrideInStorage: (value: Environment, storage: Storage) => void;
export declare const resetEnvironmentOverrides: (window: Window) => void;
