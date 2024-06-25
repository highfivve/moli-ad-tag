import React from 'react';
import type { SizeConfigEntry } from '../../types/moliConfig';
type ISizeConfigProps = {
    sizeConfig: Array<SizeConfigEntry>;
    supportedLabels: Array<string>;
};
export declare const SizeConfigDebug: React.FC<ISizeConfigProps>;
export {};
