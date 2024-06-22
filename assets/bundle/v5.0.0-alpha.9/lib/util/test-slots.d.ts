import { AdPipelineContext } from '../ads/adPipeline';
import { MoliRuntime } from '../types/moliRuntime';
import { AdSlot } from '../types/moliConfig';
export type TestSlot = {
    slot: MoliRuntime.SlotDefinition;
    container: HTMLElement;
};
export declare const createTestSlots: (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => TestSlot[];
export declare const removeTestSlotSizeFromLocalStorage: (slot: AdSlot) => void;
