export declare namespace tcfapi {
    interface TCFApiWindow {
        __tcfapi?: TCFApi;
    }
    type TCFApiVersion = 2 | undefined | null;
    interface BooleanVector {
        [id: string]: boolean;
    }
    interface TCFApi {
        (command: 'ping', version: TCFApiVersion, callback: (pingReturn: responses.Ping) => void): void;
        (command: 'addEventListener', version: TCFApiVersion, callback: (tcData: responses.TCData, success: boolean) => void): void;
        (command: 'removeEventListener', version: TCFApiVersion, callback: (success: boolean) => void, listenerId: number): void;
    }
    namespace responses {
        interface Response {
            readonly cmpId: number;
            readonly cmpVersion: number;
            readonly cmpStatus: status.CmpStatus;
            readonly gdprApplies: boolean | undefined;
            readonly tcfPolicyVersion: number | undefined;
        }
        interface Ping extends Response {
            readonly displayStatus: status.DisplayStatus;
            readonly cmpLoaded: boolean;
        }
        type TCData = TCDataWithGDPR | TCDataNoGDPR;
        enum TCPurpose {
            STORE_INFORMATION_ON_DEVICE = 1,
            SELECT_BASIC_ADS = 2,
            CREATE_PERSONALISED_ADS_PROFILE = 3,
            SELECT_PERSONALISED_ADS = 4,
            CREATE_PERSONALISED_CONTENT_PROFILE = 5,
            SELECT_PERSONALISED_CONTENT = 6,
            MEASURE_AD_PERFORMANCE = 7,
            MEASURE_CONTENT_PERFORMANCE = 8,
            APPLY_MARKET_RESEARCH = 9,
            DEVELOP_IMPROVE_PRODUCTS = 10
        }
        type PurposeVector = {
            [purpose in TCPurpose]: boolean;
        };
        interface TCDataWithGDPR extends Response {
            readonly gdprApplies: true;
            readonly tcString: string;
            readonly listenerId: number | undefined | null;
            readonly eventStatus: status.EventStatus;
            readonly isServiceSpecific: boolean;
            readonly useNonStandardStacks: boolean;
            readonly publisherCC: string;
            readonly purposeOneTreatment: boolean;
            readonly purpose: {
                readonly consents: PurposeVector;
                readonly legitimateInterests: BooleanVector;
            };
            readonly vendor: {
                readonly consents: BooleanVector;
                readonly legitimateInterests: BooleanVector;
            };
            readonly specialFeatureOptins: BooleanVector;
            readonly publisher: {
                consents: BooleanVector;
                legitimateInterests: BooleanVector;
                customPurpose: {
                    consents: BooleanVector;
                    legitimateInterests: BooleanVector;
                };
                restrictions: {
                    [purposeId: string]: {
                        [vendorId: string]: RestrictionType;
                    };
                };
            };
        }
        interface TCDataNoGDPR extends Response {
            readonly gdprApplies: false | undefined;
            readonly listenerId: number | undefined | null;
            readonly eventStatus: status.EventStatus;
            readonly tcfPolicyVersion: undefined;
        }
        enum RestrictionType {
            NOT_ALLOWED = 0,
            REQUIRE_CONSENT = 1,
            REQUIRE_LI = 2
        }
    }
    namespace status {
        enum DisplayStatus {
            VISIBLE = "visible",
            HIDDEN = "hidden",
            DISABLED = "disabled"
        }
        enum CmpStatus {
            STUB = "stub",
            LOADING = "loading",
            LOADED = "loaded",
            ERROR = "error"
        }
        enum EventStatus {
            TC_LOADED = "tcloaded",
            CMP_UI_SHOWN = "cmpuishown",
            USER_ACTION_COMPLETE = "useractioncomplete"
        }
    }
}
