import { ArrayElement } from './array';
export declare const allThemes: readonly ["light", "dark"];
export type Theme = ArrayElement<typeof allThemes>;
export type ThemeConfig = Theme | 'system';
export declare class ThemingService {
    private rootElement?;
    constructor(rootElement?: Element | undefined);
    setRootElement: (rootElement: Element) => void;
    currentTheme: () => Theme;
    applyTheme: (themeConfig?: ThemeConfig) => void;
    enableSystemThemeListener: () => void;
    private updateThemeCssClass;
    private static currentSystemTheme;
}
