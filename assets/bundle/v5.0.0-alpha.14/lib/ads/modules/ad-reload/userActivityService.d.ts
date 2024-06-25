import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { modules } from 'ad-tag/types/moliConfig';
import UserActivityLevelControl = modules.adreload.UserActivityLevelControl;
import UserActivityParameters = modules.adreload.UserActivityParameters;
export declare const userActivityParametersForLevel: Map<"strict" | "moderate" | "lax", UserActivityParameters>;
export type UserActivityListener = (userActivity: boolean) => void;
export declare class UserActivityService implements UserActivityParameters {
    private readonly window;
    private readonly userActivityLevelControl;
    private readonly logger?;
    static readonly observedEvents: string[];
    readonly userActivityDuration: number;
    readonly userBecomingInactiveDuration: number;
    private isActive;
    private userInactiveTimer;
    private userBecomingIdleTimer;
    private listener;
    constructor(window: Window, userActivityLevelControl?: UserActivityLevelControl, logger?: MoliRuntime.MoliLogger | undefined);
    addUserActivityChangedListener(listener: UserActivityListener): void;
    private userActive;
    private userInactive;
    private userBecomingInactive;
    private handleUserInteraction;
    private handleUserIdle;
    private handleUserBecomingIdle;
    private handlePageVisibilityChanged;
}
