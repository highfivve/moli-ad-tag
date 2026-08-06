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
  // always assume consent in test mode or if no consent config is provided.
  // Consentmanager-blocked scripts (cmpBlocking) carry no `consent` block and are gated by the CMP itself, so they
  // fall through here and must be injected — the ad tag must not also filter them out.
  if (context.env__ === 'test' || !scriptConfig.consent) {
    return true;
  }
  switch (scriptConfig.consent.cmpApi) {
    case 'tcf':
      return Boolean(
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
            // Publisher attributes are applied first so the Consentmanager-blocked markup below cannot be
            // overwritten by a colliding attribute (e.g. `class`, `type`, `data-cmp-*`).
            if (scriptConfig.attributes) {
              Object.entries(scriptConfig.attributes).forEach(([key, value]) => {
                script.setAttribute(key, value);
              });
            }
            if (scriptConfig.cmpBlocking) {
              // Consentmanager-blocked: inject inert markup and let the CMP unblock it once consent is granted.
              // No `script.src` — the real URL lives in `data-cmp-src`.
              script.className = 'cmplazyload';
              script.type = 'text/plain';
              script.async = true;
              script.setAttribute('data-cmp-src', scriptConfig.src);
              script.setAttribute('data-cmp-vendor', scriptConfig.cmpBlocking.vendorId);
            } else {
              script.type = 'text/javascript';
              script.src = scriptConfig.src;
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
    configKey: 'custom',
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
