import { ArrayElement } from './array';

export const allThemes = ['light', 'dark'] as const;
export type Theme = ArrayElement<typeof allThemes>;
export type ThemeConfig = Theme | 'system';

/**
 * Manages the debugger theme.
 */
export class ThemingService {
  constructor(private rootElement: Element) {}

  currentTheme = (): Theme => (this.rootElement.classList.contains('dark') ? 'dark' : 'light');

  /**
   * Applies the given theme. Defaults to system.
   */
  applyTheme = (themeConfig: ThemeConfig = 'system'): void => {
    const theme = themeConfig === 'system' ? ThemingService.currentSystemTheme() : themeConfig;
    this.updateThemeCssClass(theme);
  };

  enableSystemThemeListener = (): void =>
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (e.matches) {
        this.applyTheme('dark');
      } else {
        this.applyTheme('light');
      }
    });

  private updateThemeCssClass = (theme: Theme) => {
    if (theme !== 'light') {
      this.rootElement.classList.add(theme);
    } else {
      this.rootElement.classList.remove('dark');
    }
  };

  private static currentSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
