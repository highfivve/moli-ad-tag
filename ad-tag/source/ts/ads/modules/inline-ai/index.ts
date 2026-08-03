/**
 * # [Inline AI](https://getinline.tech)
 *
 * Loads the InlineAI widget SDK on ad pipeline init and drives placement rendering via
 * InlineAI's own command queue (`window.InlineAI.cmd`), gated on TCF Purpose 1 consent.
 *
 * @see docs/adr/0010-inline-ai-placement-mode-scoping-via-labels.md
 *
 * ## Integration
 *
 * ```js
 * moli.registerModule(createInlineAi());
 * ```
 *
 * ```json
 * {
 *   "modules": {
 *     "inlineAi": {
 *       "enabled": true,
 *       "publisherId": "YOUR_PUBLISHER_ID",
 *       "mode": "auto"
 *     }
 *   }
 * }
 * ```
 *
 * @module
 */
import { IModule } from 'ad-tag/types/module';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import { AdPipelineContext, InitStep, mkInitStep } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

const name = 'inline-ai';
const defaultScriptUrl = 'https://getinline.tech/default/assets/index.js';

type InlineAiCommand = readonly [string, ...unknown[]];

declare global {
  /**
   * Extension to the Window interface for the InlineAI command queue.
   *
   * @see docs/inline/command-queue.md
   */
  interface Window {
    InlineAI?: {
      cmd: InlineAiCommand[];
    };
  }
}

export const createInlineAi = (): IModule => {
  let inlineAiConfig: modules.inlineAi.InlineAiModuleConfig | null = null;

  const config__ = (): Object | null => inlineAiConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.inlineAi?.enabled) {
      inlineAiConfig = moduleConfig.inlineAi;
    }
  };

  const hasConsent = (context: AdPipelineContext): boolean =>
    !context.tcData__.gdprApplies || !!context.tcData__.purpose.consents['1'];

  const pushCommand = (context: AdPipelineContext, command: InlineAiCommand): void => {
    context.window__.InlineAI = context.window__.InlineAI || { cmd: [] };
    context.window__.InlineAI.cmd = context.window__.InlineAI.cmd || [];
    context.window__.InlineAI.cmd.push(command);
  };

  const isPlacementActive = (
    context: AdPipelineContext,
    placement: modules.inlineAi.InlineAiPlacementConfig
  ): boolean =>
    !placement.labelCondition ||
    context.labelConfigService__.isLabelConditionMet(placement.labelCondition);

  const mountCommand = (placement: modules.inlineAi.InlineAiPlacementConfig): InlineAiCommand => {
    switch (placement.type) {
      case 'widget':
        return ['mount', placement.type];
      case 'search-fab':
        // body-level: no target slot, but `options` is the SDK's 3rd positional arg -
        // undefined keeps it aligned with mount(type, target, options).
        return placement.options
          ? ['mount', placement.type, undefined, placement.options]
          : ['mount', placement.type];
      case 'search-embed':
      case 'search-icon':
        return placement.options
          ? ['mount', placement.type, placement.target, placement.options]
          : ['mount', placement.type, placement.target];
      case 'key-takeaways':
      case 'single-question':
      case 'basic-embed':
        return ['mount', placement.type, placement.target];
    }
  };

  const mountPlacements = (
    context: AdPipelineContext,
    config: modules.inlineAi.InlineAiModuleConfig
  ): void => {
    (config.placements ?? [])
      .filter(placement => isPlacementActive(context, placement))
      .forEach(placement => pushCommand(context, mountCommand(placement)));
  };

  const applyMode = (
    context: AdPipelineContext,
    config: modules.inlineAi.InlineAiModuleConfig
  ): void => {
    switch (config.mode) {
      // auto: hard bypass - never reads placements, never touches the command queue.
      case 'auto':
        return;
      case 'programmatic':
        pushCommand(context, ['init', { publisherId: config.publisherId }]);
        context.labelConfigService__.addLabel(config.mode);
        mountPlacements(context, config);
        return;
      case 'hybrid':
        // never push init() here - that would flip the InlineAI SDK into programmatic mode
        // and disable its dashboard auto-rendering.
        context.labelConfigService__.addLabel(config.mode);
        mountPlacements(context, config);
        return;
    }
  };

  const loadInlineAi = (
    context: AdPipelineContext,
    config: modules.inlineAi.InlineAiModuleConfig
  ): Promise<void> => {
    // test environment doesn't require InlineAI
    if (context.env__ === 'test') {
      return Promise.resolve();
    }

    if (!hasConsent(context)) {
      context.logger__.warn(name, 'no gdpr consent, InlineAI will not be loaded');
      return Promise.resolve();
    }

    applyMode(context, config);

    const scriptUrl = config.scriptUrl ?? defaultScriptUrl;
    context.assetLoaderService__
      .loadScript({
        name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `${scriptUrl}?key=${config.publisherId}`,
        type: 'module'
      })
      .catch(error => context.logger__.error(name, 'failed to load InlineAI script', error));
    return Promise.resolve();
  };

  const initSteps__ = (): InitStep[] => {
    const config = inlineAiConfig;
    return config ? [mkInitStep('inline-ai-init', ctx => loadInlineAi(ctx, config))] : [];
  };

  return {
    name,
    configKey: 'inlineAi',
    description: 'loads the InlineAI SDK and drives placement rendering',
    moduleType: 'engagement',
    config__,
    configure__,
    initSteps__,
    configureSteps__: () => [],
    prepareRequestAdsSteps__: () => []
  };
};
