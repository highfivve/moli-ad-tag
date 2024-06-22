import { Message } from '../components/globalConfig';
import type { bucket, AdSlot } from '../../types/moliConfig';
import { ModuleMeta } from '../../types/module';
export declare const checkBucketConfig: (messages: Message[], bucket: bucket.GlobalBucketConfig, slots: AdSlot[]) => void;
export declare const checkSkinConfig: (messages: Message[], modules: ReadonlyArray<ModuleMeta>, slots: AdSlot[]) => void;
