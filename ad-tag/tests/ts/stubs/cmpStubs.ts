/**
 *
 * @param returnValue the returnValue passed into the callback function
 */
export const cmpFunction = (returnValue: any) => (
  cmd: string,
  params: any,
  callback: Function
): void => {
  callback(returnValue);
};
