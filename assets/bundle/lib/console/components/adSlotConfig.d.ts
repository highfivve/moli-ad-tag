import React from 'react';
import { AdSlot } from '../../types/moliConfig';
import { LabelConfigService } from '../../ads/labelConfigService';
type IAdSlotConfigProps = {
    parentElement?: HTMLElement;
    slot: AdSlot;
    labelConfigService: LabelConfigService;
};
type IAdSlotConfigState = {
    dimensions?: {
        width: number;
        height: number;
    };
    showA9: boolean;
    showPrebid: boolean;
    showGeneral: boolean;
    showSizeConfig: boolean;
};
export declare class AdSlotConfig extends React.Component<IAdSlotConfigProps, IAdSlotConfigState> {
    constructor(props: IAdSlotConfigProps);
    render(): React.ReactNode;
    private prebidConfig;
    private a9Config;
    private toggleGeneral;
    private toggleA9;
    private togglePrebid;
    private toggleSizeConfig;
    private isVisiblePrebid;
    private isVisibleA9;
    private isSingleVideoSize;
    private validateSlotSizes;
    private tagFromValidatedSlotSize;
    private static isFixedSize;
    private labelConfig;
}
export {};
