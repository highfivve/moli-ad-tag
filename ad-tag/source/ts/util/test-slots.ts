import { AdPipelineContext } from '../ads/adPipeline';
import { SizeConfigService } from '../ads/sizeConfigService';
import { Moli } from '../types/moli';
import { isNotNull } from './arrayUtils';
import { BrowserStorageKeys } from './browserStorageKeys';
import {
  getBrowserStorageValue,
  removeBrowserStorageValue,
  setBrowserStorageValue
} from './localStorage';

/**
 * When starting in test environment, all ads are replaced by fake "test slots". These contain debugging functionality.
 *
 * - The available ad sizes are listed inside the slot and can be previewed by clicking on them.
 * - The last manually selected ad size is stored in local storage and applied on future page loads.
 * - A slot can be hidden with a "hide" button.
 */

export type TestSlot = {
  slot: Moli.SlotDefinition;
  /**
   * The visual representation of the test slot.
   */
  container: HTMLElement;
};

/**
 * width, height. Compatible with Moli.DfpSlotSize.
 */
type Size = [number, number];
type TestSlotSize = Size | 'hidden';

/**
 * Typeguard used to assert local storage value.
 */
const isTestSlotSize = (size: any): size is TestSlotSize =>
  size === 'hidden' ||
  (Array.isArray(size) &&
    size.length === 2 &&
    typeof size[0] === 'number' &&
    typeof size[1] === 'number');

const testSlotContainerId = (moliSlotDomId: string) => `${moliSlotDomId}__container`;

/**
 * Fills the given slots with test slots.
 */
export const createTestSlots = (
  context: AdPipelineContext,
  slots: Moli.SlotDefinition[]
): TestSlot[] => {
  const testSlots = createBlankTestSlots(context, slots);
  testSlots.forEach(({ slot, container }) => {
    container.appendChild(testSlotContent(slot));
  });
  return testSlots;
};

/**
 * Removes the given slot's saved sizes from local storage.
 */
export const removeTestSlotSizeFromLocalStorage = (slot: Moli.AdSlot) =>
  removeBrowserStorageValue(BrowserStorageKeys.testSlotSize(slot.domId));

/**
 * Sets a blank div as the content of every given slot, which can later be altered.
 * @returns the created DOM elements along with their respective slots.
 */
const createBlankTestSlots = (
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
const queryTestSlots = (slots: Moli.SlotDefinition[]): TestSlot[] =>
  slots
    .map(slot => {
      const container = document.getElementById(testSlotContainerId(slot.moliSlot.domId));
      return container ? { slot, container } : undefined;
    })
    .filter(isNotNull);

/**
 * Fills the empty test slot elements with visual debugging tools.
 */
const testSlotContent = (slot: Moli.SlotDefinition): HTMLElement => {
  const sizes = getSizesForSlot(slot);
  const activeSize = pickTestSlotSize(slot.moliSlot, sizes);

  if (activeSize === 'hidden') {
    return document.createElement('div');
  } else {
    const content = document.createElement('div');
    const [width, height] = activeSize;

    content.style.cssText = `
      position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
      width: ${width}px; height: ${height}px; padding: 6px; border: 2px dotted gray; background-color: #fff;
      background-image: linear-gradient(90deg, transparent 79px, #abced4 79px, #abced4 81px, transparent 81px), linear-gradient(#eee .1em, transparent .1em);
      background-size: 100% 1.2em;
    `;

    // Description
    const description = document.createElement('h4');
    description.innerHTML = `<strong>${slot.moliSlot.domId}</strong>`;
    content.appendChild(description);

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
    content.appendChild(buttonContainer);

    const updateSize = (size: TestSlotSize, button: HTMLButtonElement) => {
      if (size === 'hidden') {
        content.style.display = 'none';
      } else {
        const [width, height] = size;
        content.style.width = `${width}px`;
        content.style.height = `${height}px`;
        updateSizeDescription(size);
        markButtonAsActive(button);
      }

      saveSizeInLocalStorage(slot.moliSlot, size);
    };

    const defaultButtonBorder = '1px dotted white';
    const activeButtonBorder = '1px solid black';

    const hideButton = document.createElement('button');
    hideButton.innerText = 'hide';
    hideButton.title =
      'Once hidden, it can only be restored using the moli console (or by clearing local storage manually)';
    hideButton.style.cssText = `font-size: 10px; background: #656565; color: white; border: ${defaultButtonBorder};`;
    hideButton.addEventListener('click', () => updateSize('hidden', hideButton));

    const buttons = [
      ...sizes.map(buttonSize => {
        const [width, height] = buttonSize;
        const isActiveSize = equalsSize(activeSize, buttonSize);
        const button = document.createElement('button');

        button.innerText = `${width}x${height}`;
        button.style.cssText = `font-size: 10px; background: #00a4a6; color: white; border: ${
          isActiveSize ? activeButtonBorder : defaultButtonBorder
        };`;
        button.addEventListener('click', () => updateSize(buttonSize, button));

        return button;
      }),
      hideButton
    ];

    buttons.forEach(button => buttonContainer.appendChild(button));

    const markButtonAsActive = (button: HTMLButtonElement) => {
      buttons.forEach(button => (button.style.border = defaultButtonBorder)); // reset other buttons
      button.style.border = activeButtonBorder;
    };

    return content;
  }
};

/**
 * Returns all sizes, except fixed and 1x1 sizes.
 */
const getSizesForSlot = (slot: Moli.SlotDefinition): Array<Size> => {
  return slot
    .filterSupportedSizes(slot.moliSlot.sizes)
    .filter(SizeConfigService.isFixedSize)
    .filter(([width, height]) => width > 1 && height > 1);
};

/**
 * The last manually activated size, which is saved in local storage, is preferred.
 * Otherwise a random one is picked.
 */
const pickTestSlotSize = (slot: Moli.AdSlot, sizes: Array<Size>): TestSlotSize => {
  const sizeFromLocalStorage = getSizeFromLocalStorage(slot);

  if (
    sizeFromLocalStorage &&
    (sizeFromLocalStorage === 'hidden' || includesSize(sizes, sizeFromLocalStorage))
  ) {
    return sizeFromLocalStorage;
  } else {
    const randomIndex = Math.floor(Math.random() * sizes.length);

    // there is room for improvement. We should differentiate between only fluid, only 1x1
    return sizes.length === 0 ? [300, 250] : sizes[randomIndex];
  }
};

const saveSizeInLocalStorage = (slot: Moli.AdSlot, size: TestSlotSize) =>
  setBrowserStorageValue(BrowserStorageKeys.testSlotSize(slot.domId), JSON.stringify(size));

const getSizeFromLocalStorage = (slot: Moli.AdSlot): TestSlotSize | undefined => {
  const localStorageValue = getBrowserStorageValue(BrowserStorageKeys.testSlotSize(slot.domId));

  if (!localStorageValue) {
    return undefined;
  }

  try {
    const size = JSON.parse(localStorageValue);
    return isTestSlotSize(size) ? size : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Whether two sizes are equal.
 */
const equalsSize = (a: Size, b: Size) => {
  const [widthA, heightA] = a;
  const [widthB, heightB] = b;
  return widthA === widthB && heightA === heightB;
};

/**
 * Needed to check whether a size from local storage still matches one of the available slot sizes.
 */
const includesSize = (validSizes: Size[], size: Size): boolean =>
  validSizes.some(validSize => equalsSize(validSize, size));
