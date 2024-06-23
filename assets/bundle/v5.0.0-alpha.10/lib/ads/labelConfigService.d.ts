import { Device, LabelSizeConfigEntry } from '../types/moliConfig';
export interface ILabelledSlot {
    readonly labelAny?: string[];
    readonly labelAll?: string[];
}
export declare class LabelConfigService {
    private readonly labelSizeConfig;
    private readonly extraLabels;
    private readonly window;
    private readonly supportedLabels;
    private readonly isValid;
    private readonly possibleDevices;
    constructor(labelSizeConfig: LabelSizeConfigEntry[], extraLabels: string[], window: Window);
    filterSlot(slot: ILabelledSlot): boolean;
    getSupportedLabels(): string[];
    getDeviceLabel(): Device;
}
