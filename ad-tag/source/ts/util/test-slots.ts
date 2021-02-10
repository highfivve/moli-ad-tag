import { AdPipelineContext } from '../ads/adPipeline';
import { SizeConfigService } from '../ads/sizeConfigService';
import { Moli } from '../types/moli';
import { isNotNull } from './arrayUtils';
import { BrowserStorageKeys } from './browserStorageKeys';
import { getBrowserStorageValue, setBrowserStorageValue } from './localStorage';

export type TestSlot = {
  slot: Moli.SlotDefinition;
  container: HTMLElement;
};

type Size = [number, number];

/**
 * Typeguard used to assert local storage value.
 */
const isSize = (size: any): size is Size =>
  Array.isArray(size) &&
  size.length === 2 &&
  typeof size[0] === 'number' &&
  typeof size[1] === 'number';

const testSlotContainerId = (moliSlotDomId: string) => `${moliSlotDomId}__container`;

/**
 * Sets a div as the content of every given slot, which can be manipulated for debugging.
 * @returns the created DOM elements along with their respective slots.
 */
export const createBlankTestSlots = (
  context: AdPipelineContext,
  slots: Moli.SlotDefinition[]
): TestSlot[] => {
  slots.forEach(slot => {
    const { adSlot, moliSlot } = slot;

    const containerId = testSlotContainerId(moliSlot.domId);
    const div = document.createElement('div');
    div.id = containerId;

    context.window.googletag.content().setContent(adSlot, div.outerHTML);
    context.logger.debug(
      'GAM',
      `Set content for slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`
    );
  });

  return queryTestSlots(slots);
};

/**
 * Assuming that createTestSlots() was called before, this returns the HTML element for each slot.
 */
export const queryTestSlots = (slots: Moli.SlotDefinition[]): TestSlot[] =>
  slots
    .map(slot => {
      const container = document.getElementById(testSlotContainerId(slot.moliSlot.domId));
      return container ? { slot, container } : undefined;
    })
    .filter(isNotNull);

/**
 * Fills the empty test slot elements with visual debugging tools.
 */
export const fillTestSlots = (slots: TestSlot[]): void => {
  slots.forEach(({ slot, container }) => {
    const sizes = getTestSlotSizes(slot);
    const [width, height] = pickTestSlotSize(slot, sizes);

    container.style.cssText = `
      position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
      width: ${width}px; height: ${height}px; padding: 6px; border: 2px dotted gray; background-color: #fff;
      background-image: linear-gradient(90deg, transparent 79px, #abced4 79px, #abced4 81px, transparent 81px), linear-gradient(#eee .1em, transparent .1em);
      background-size: 100% 1.2em;
    `;

    // Description
    const description = document.createElement('h4');
    description.innerHTML = `<strong>${slot.moliSlot.domId}</strong>`;
    container.appendChild(description);

    // Size description
    const sizeDescription = document.createElement('span');
    sizeDescription.style.color = '#656565';

    const updateSizeDescription = ([width, height]: Size) =>
      (sizeDescription.innerText = `(${width}x${height})`);

    updateSizeDescription([width, height]);
    description.appendChild(sizeDescription);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `position: absolute; top: 5px; left: 5px`;
    container.appendChild(buttonContainer);

    const updateSize = (size: Size | 'hidden') => {
      if (size === 'hidden') {
        container.style.display = 'none';
      } else {
        const [width, height] = size;
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        updateSizeDescription(size);
        saveSizeInLocalStorage(slot, size);
      }
    };

    const hideButton = document.createElement('button');
    hideButton.innerText = 'hide';
    hideButton.style.cssText = `font-size: 10px; background: #656565; color: white; border: 1px dotted white;`;
    hideButton.addEventListener('click', () => updateSize('hidden'));

    const buttons = [
      ...sizes.map(([width, height]) => {
        const button = document.createElement('button');
        button.innerText = `${width}x${height}`;
        button.style.cssText = `font-size: 10px; background: #00a4a6; color: white; border: 1px dotted white;`;
        button.addEventListener('click', () => updateSize([width, height]));
        return button;
      }),
      hideButton
    ];

    buttons.forEach(button => buttonContainer.appendChild(button));
  });
};

/**
 * Returns all sizes, except fixed and 1x1 sizes.
 */
const getTestSlotSizes = (slot: Moli.SlotDefinition): Array<[number, number]> => {
  return slot
    .filterSupportedSizes(slot.moliSlot.sizes)
    .filter(SizeConfigService.isFixedSize)
    .filter(([width, height]) => width > 1 && height > 1);
};

/**
 * The last manually activated size, which is saved in local storage, is preferred.
 * Otherwise a random one is picked.
 */
const pickTestSlotSize = (
  slot: Moli.SlotDefinition,
  sizes: Array<[number, number]>
): [number, number] => {
  const sizeFromLocalStorage = getSizeFromLocalStorage(slot);

  if (sizeFromLocalStorage && includesSize(sizes, sizeFromLocalStorage)) {
    return sizeFromLocalStorage;
  } else {
    const randomIndex = Math.floor(Math.random() * sizes.length);

    // there is room for improvement. We should differentiate between only fluid, only 1x1
    return sizes.length === 0 ? [300, 250] : sizes[randomIndex];
  }
};

const saveSizeInLocalStorage = (slot: Moli.SlotDefinition, size: [number, number]) =>
  setBrowserStorageValue(
    BrowserStorageKeys.testSlotSize(slot.moliSlot.domId),
    JSON.stringify(size)
  );

const getSizeFromLocalStorage = (slot: Moli.SlotDefinition): Size | undefined => {
  const localStorageValue = getBrowserStorageValue(
    BrowserStorageKeys.testSlotSize(slot.moliSlot.domId)
  );

  if (!localStorageValue) {
    return undefined;
  }

  try {
    const size = JSON.parse(localStorageValue);
    return isSize(size) ? size : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Needed to check whether a size from local storage still matches one of the available slot sizes.
 */
const includesSize = (validSizes: Size[], size: Size): boolean =>
  validSizes.some(([validWidth, validHeight]) => {
    const [width, height] = size;
    return validWidth === width && validHeight === height;
  });
