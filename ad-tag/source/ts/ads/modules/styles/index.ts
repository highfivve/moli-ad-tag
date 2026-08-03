/**
 * # Styles Loader
 *
 * Injects a publisher's stylesheet via a `<link rel="stylesheet">` prepended as the first
 * child of `<head>`. Prepending - rather than appending, as `assetLoaderService` does for
 * `<script>` tags - makes the injected stylesheet a base layer: any CSS already in `<head>`
 * wins ties on equal specificity, since later DOM position wins.
 *
 * @see docs/adr/0009-styles-loader-prepends-stylesheet-as-base-layer.md
 *
 * ## Integration
 *
 * ```js
 * moli.registerModule(createStylesLoader());
 * ```
 *
 * ```json
 * {
 *   "modules": {
 *     "styles": {
 *       "enabled": true,
 *       "href": "https://example.com/publisher.css"
 *     }
 *   }
 * }
 * ```
 *
 * @module
 */
import { IModule } from 'ad-tag/types/module';
import { AdPipelineContext, InitStep, mkInitStep } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

const name = 'styles loader';

export const createStylesLoader = (): IModule => {
  let stylesConfig: modules.styles.StylesConfig | null = null;

  const config__ = (): Object | null => stylesConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.styles?.enabled) {
      stylesConfig = moduleConfig.styles;
    }
  };

  const loadStylesheet = (
    context: AdPipelineContext,
    config: modules.styles.StylesConfig
  ): Promise<void> => {
    const link = context.window__.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = config.href;
    link.addEventListener('error', () =>
      context.logger__.error(name, `failed to load stylesheet ${config.href}`)
    );
    context.window__.document.head.prepend(link);
    return Promise.resolve();
  };

  const initSteps__ = (): InitStep[] => {
    const config = stylesConfig;
    return config ? [mkInitStep('styles-init', ctx => loadStylesheet(ctx, config))] : [];
  };

  return {
    name,
    configKey: 'styles',
    description: "injects the publisher's stylesheet as a base layer in <head>",
    moduleType: 'creatives',
    config__,
    configure__,
    initSteps__,
    configureSteps__: () => [],
    prepareRequestAdsSteps__: () => []
  };
};
