/**
 * Utility class for getting device specific information, such as the viewport.
 * Can be extended if we need more info - see NMMS implementation.
 */
export class UserAgent {

  static get isMobile(): boolean {
    return matchMedia('only screen and (max-width: 767px)').matches;
  }
}
