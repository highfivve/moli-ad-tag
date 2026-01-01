/**
 * # Custom Module
 *
 * Injects inline JavaScript from config into the window object during init.
 *
 * @module
 */
import { IModule } from 'ad-tag/types/module';
import { AdPipelineContext, mkInitStep } from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

const name = 'custom';

/**
 * A script may only be injected if consent is given.
 * GDPR is used for consent checks.
 */
const hasConsent = (
  context: AdPipelineContext,
  scriptConfig: modules.custom.CustomScriptConfig
): boolean => {
  // always assume consent in test mode or if no consent config is provided
  if (context.env__ === 'test' || !scriptConfig.consent) {
    return true;
  }
  switch (scriptConfig.consent.cmpApi) {
    case 'tcf':
      return (
        !context.tcData__.gdprApplies ||
        context.tcData__.vendor.consents[scriptConfig.consent.vendorId]
      );
    // GPP or other APIs can be added here in the future
  }
};

export const customModule = (): IModule => {
  let customConfig: modules.custom.CustomModuleConfig | null = null;

  // Injects inline JS into window object
  const injectInlineJs = (
    context: AdPipelineContext,
    config: modules.custom.CustomModuleConfig
  ): Promise<void> => {
    if (config.inlineJs && config.inlineJs.code) {
      try {
        // Option 1: Create a script element
        const script = context.window__.document.createElement('script');
        script.type = 'text/javascript';
        script.innerHTML = config.inlineJs.code;
        context.window__.document.head.appendChild(script);
        context.logger__?.info(name, 'Injected inline JS');
      } catch (e) {
        context.logger__?.error(name, 'Failed to inject inline JS', e);
      }
    }

    if (config.scripts) {
      config.scripts
        .filter(
          scriptConfig =>
            context.labelConfigService__.filterSlot(scriptConfig) &&
            hasConsent(context, scriptConfig)
        )
        .forEach(scriptConfig => {
          try {
            const script = context.window__.document.createElement('script');
            script.type = 'text/javascript';
            script.src = scriptConfig.src;
            if (scriptConfig.attributes) {
              Object.entries(scriptConfig.attributes).forEach(([key, value]) => {
                script.setAttribute(key, value);
              });
            }
            context.window__.document.head.appendChild(script);
            context.logger__?.info(name, `Injected script from URL: ${scriptConfig.src}`);
          } catch (e) {
            context.logger__?.error(name, 'Failed to inject script from config', scriptConfig, e);
          }
        });
    }

    return Promise.resolve();
  };

  return {
    name,
    description: 'Injects custom inline JavaScript code',
    moduleType: 'custom',
    config__: () => null,
    configure__: (moduleConfig?: modules.ModulesConfig) => {
      if (moduleConfig?.custom?.enabled) {
        customConfig = moduleConfig.custom;
      }
    },
    initSteps__: () => {
      const config = customConfig;
      // Only add init step if enabled is true
      return config ? [mkInitStep('custom-init', ctx => injectInlineJs(ctx, config))] : [];
    },
    configureSteps__: () => [],
    prepareRequestAdsSteps__: () => []
  };
};
