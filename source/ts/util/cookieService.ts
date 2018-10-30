/**
 * Services to check and set cookies.
 *
 * Adapted from https://git.gutefrage.net/projects/GF/repos/application/browse/web/scripts/gfApp/lib/cookie.js
 */
export interface ICookieService {
  /**
   * Sets a cookie with the given name and value.
   *
   * @param name              cookie name
   * @param value             cookie value
   * @param expiresInMinutes    cookie validity in minutes (optional)
   */
  set(name: string, value: any, expiresInMinutes?: number): void;

  /**
   * Returns the value of the given cookie or null if it hasn't been set yet.
   *
   * @param name    cookie name
   */
  get(name: string): string | null;

  /**
   * Returns whether the given cookie has been set.
   *
   * @param name    cookie name
   */
  exists(name: string): boolean;

  /**
   * Removes a cookie.
   *
   * @param name    cookie name
   */
  delete(name: string): void;
}

export class CookieService implements ICookieService {

  public set(name: string, value: any, expiresInMinutes?: number): void {

    // Create expires string
    let expires;
    if (expiresInMinutes) {
      expires = this.getExpireString(expiresInMinutes);
    }

    window.document.cookie = `${name}=${value};${expires};path=/`;
  }

  public get(name: string): string | null {
    let cookieName = `${name}=`;
    let cookie = window.document.cookie.split(/;\s*/)
      .filter(cookie => cookie.indexOf(cookieName) === 0);

    if (cookie.length !== 0) {
      return cookie[0].substring(cookieName.length);
    } else {
      return null;
    }
  }

  public exists(name: string): boolean {
    return this.get(name) !== null;
  }

  public delete(name: string): void {
    // Create expired expire string
    const expires = this.getExpireString(-60);

    window.document.cookie = `${name}=false;${expires}`;
  }

  /**
   * Returns a date string from now on plus the given number of minutes.
   * The string goes like 'expires={DATE};'
   * @param minutes How long should the cookie last in minutes from now?
   */
  private getExpireString(minutes: number): string {
    const d = new Date();
    d.setTime(d.getTime() + (minutes * 60 * 1000));
    return minutes ? `expires=${d.toUTCString()};` : '';
  }
}

export const cookieService = new CookieService();
