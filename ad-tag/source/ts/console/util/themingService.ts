import { ArrayElement } from './array';
import { BrowserStorageKeys } from 'ad-tag/util/browserStorageKeys';
import { getBrowserStorageValue, setBrowserStorageValue } from 'ad-tag/util/localStorage';

export const allThemes = ['light', 'dark'] as const;
export type Theme = ArrayElement<typeof allThemes>;
export type ThemeConfig = Theme | 'system';

const isThemeConfig = (value: string): value is ThemeConfig =>
  value === 'system' || allThemes.some(theme => theme === value);

/**
 * Manages the debugger theme. The selected theme config (system/light/dark) is
 * persisted in localStorage; `system` follows the OS color scheme.
 */
export class ThemingService {
  constructor(private rootElement?: Element) {}

  setRootElement = (rootElement: Element): void => {
    this.rootElement = rootElement;
  };

  currentTheme = (): Theme => (this.rootElement?.classList.contains('dark') ? 'dark' : 'light');

  /**
   * The persisted theme selection. Defaults to `system`.
   */
  currentThemeConfig = (): ThemeConfig => {
    const stored = getBrowserStorageValue(BrowserStorageKeys.moliConsoleTheme, window.localStorage);
    return stored && isThemeConfig(stored) ? stored : 'system';
  };

  /**
   * Persists the theme selection and applies it.
   */
  setThemeConfig = (themeConfig: ThemeConfig): void => {
    setBrowserStorageValue(BrowserStorageKeys.moliConsoleTheme, themeConfig, window.localStorage);
    this.applyTheme(themeConfig);
  };

  /**
   * Applies the given theme. Defaults to the persisted selection.
   */
  applyTheme = (themeConfig: ThemeConfig = this.currentThemeConfig()): void => {
    const theme = themeConfig === 'system' ? ThemingService.currentSystemTheme() : themeConfig;
    this.updateThemeCssClass(theme);
  };

  enableSystemThemeListener = (): void =>
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      // re-applies the persisted selection; only `system` actually follows the OS
      this.applyTheme();
    });

  private updateThemeCssClass = (theme: Theme) => {
    if (theme !== 'light') {
      this.rootElement?.classList.add(theme);
    } else {
      this.rootElement?.classList.remove('dark');
    }
    // daisyUI selects its theme via the data-theme attribute, while the
    // tailwind `dark:` variant uses the .dark class - keep both in sync
    this.rootElement?.setAttribute('data-theme', theme);
  };

  private static currentSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
