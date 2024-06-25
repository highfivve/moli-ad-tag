import { GoogleAdManagerSlotSize, SizeConfigEntry } from '../types/moliConfig';
export interface ISizedSlot {
    readonly sizes?: GoogleAdManagerSlotSize[];
}
export declare class SizeConfigService {
    private readonly sizeConfig;
    private readonly supportedLabels;
    private readonly window;
    private readonly supportedSizes;
    private readonly isValid;
    static isFixedSize(size: GoogleAdManagerSlotSize): size is [number, number];
    constructor(sizeConfig: SizeConfigEntry[], supportedLabels: string[], window: Window);
    filterSlot(slot: ISizedSlot): boolean;
    filterSupportedSizes: (givenSizes: GoogleAdManagerSlotSize[]) => GoogleAdManagerSlotSize[];
    private areLabelsMatching;
}
