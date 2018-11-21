import { Moli } from 'moli-ad-tag/source/ts/types/moli';

export const consoleLogReporter: Moli.reporting.Reporter = (metric: Moli.reporting.Metric) => {

  switch (metric.type) {
    case 'dfpLoad': {
      console.groupCollapsed('DFP Load Time');
      console.log('startTime', Math.round(metric.measurement.startTime));
      console.log('duration', metric.measurement.duration);
      console.groupEnd();
      break;
    }
    case 'prebidLoad': {
      console.groupCollapsed('Prebid Load Time');
      console.log('name', metric.measurement.name);
      console.log('startTime', Math.round(metric.measurement.startTime));
      console.log('duration', Math.round(metric.measurement.duration));
      console.groupEnd();
      break;
    }
    case 'ttfa': {
      console.groupCollapsed('Time to first Ad');
      console.log('visible at', Math.round(metric.measurement.startTime + metric.measurement.duration));
      console.log('startTime', Math.round(metric.measurement.startTime));
      console.log('duration', Math.round(metric.measurement.duration));
      console.groupEnd();
      break;
    }
    case 'ttfr': {
      console.groupCollapsed('Time to first Render');
      console.log('rendered at', Math.round(metric.measurement.startTime + metric.measurement.duration));
      console.log('startTime', Math.round(metric.measurement.startTime));
      console.log('duration', Math.round(metric.measurement.duration));
      console.groupEnd();
      break;
    }
    case 'adSlots': {
      console.groupCollapsed('AdSlot metrics');
      console.log('number of slots', metric.numberAdSlots);
      console.log('number of empty slots', metric.numberEmptyAdSlots);
      console.groupEnd();
      break;
    }
    case 'adSlot': {
      console.groupCollapsed(`AdSlot: ${metric.adUnitName}`);
      console.log('advertiser id', metric.advertiserId);
      console.log('order id', metric.campaignId);
      console.log('line item id', metric.lineItemId);
      console.log('render start at', Math.round(metric.rendered.startTime));
      console.log('rendering duration', Math.round(metric.rendering.duration));
      console.log('loaded at', Math.round(metric.loaded.startTime + metric.loaded.duration));
      console.groupEnd();
      break;
    }
  }

};