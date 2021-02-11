import { IReportingService } from '../ads/reportingService';

export const reportingServiceStub: () => IReportingService = () => {
  return {
    initialize: () => {
      return;
    },
    markRefreshed: () => {
      return;
    },
    markPrebidSlotsRequested: () => {
      return;
    },
    measureAndReportPrebidBidsBack: () => {
      return;
    },
    markA9fetchBids: () => {
      return;
    },
    measureAndReportA9BidsBack: () => {
      return;
    },
    markCmpInitialization: () => {
      return;
    },
    measureCmpLoadTime: () => {
      return;
    }
  };
};
