export interface IPerformanceMeasurementService {

  /**
   * Create a performance mark with the given name
   *
   * @param name the name of the mark
   */
  mark(name: string): void;

  /**
   *
   * Create a performance measure from two marks.
   *
   * @param name the name of the measure
   * @param startMarkName the start mark
   * @param endMarkName the end mark
   */
  measure(name: string, startMarkName: string, endMarkName: string): void;

  /**
   * @param name the name of the measurement
   * @returns the first measurement taken or undefined
   */
  getMeasure(name: string): PerformanceMeasure | undefined;


  /**
   * @param name the name of the mark
   * @returns the first mark taken or undefined
   */
  getMark(name: string): PerformanceMark | undefined;
}


/**
 * == Performance Measurement Service ==
 *
 * Wraps the native browser "performance" API
 *
 */
class PerformanceMeasurementService implements IPerformanceMeasurementService {

  public mark(name: string): void {
    performance.mark(name);
  }

  /**
   * @param name name for the measure
   * @param startMarkName uses the start mark if it exists, otherwise creates it
   * @param endMarkName uses the end mark
   */
  public measure(name: string, startMarkName: string, endMarkName: string): void {
    if (!this.getMark(endMarkName)) {
      performance.mark(endMarkName);
    }
    performance.measure(name, startMarkName, endMarkName);
  }

  public getMeasure(name: string): PerformanceMeasure | undefined {
    const entries = performance.getEntriesByName(name, 'measure');
    return entries[0];
  }

  public getMark(name: string): PerformanceMark | undefined {
    const entries = performance.getEntriesByName(name, 'mark');
    return entries[0];
  }

}

/**
 * If the browser doesn't support the Web Performance API, we simply do nothing.
 */
class NullPerformanceMeasurementService implements IPerformanceMeasurementService {

  public mark(_name: string): void {
    // empty
  }

  public measure(_name: string, _startMarkName: string, _endMarkName?: string): void {
    // empty
  }


  public getMeasure(_name: string): PerformanceMeasure | undefined {
    return;
  }

  public getMark(name: string): PerformanceMark | undefined {
    return;
  }
}

export const createPerformanceService = (window: Window): IPerformanceMeasurementService => {
  // ensure that all methods we use exists in window.performance
  if (window && 'performance' in window && 'mark' in window.performance && 'measure' in window.performance && 'getEntriesByName' in window.performance) {
    return new PerformanceMeasurementService();
  } else {
    return new NullPerformanceMeasurementService();
  }
};
