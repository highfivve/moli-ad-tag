import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { RenderEventResult } from './renderResult';
import { intersectionObserverFadeOutCallback } from './fadeOutCallback';
import * as process from 'node:process';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { googletag } from 'ad-tag/types/googletag';

// setup sinon-chai
use(sinonChai);

describe('intersection observer fadeOut callback', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  const fadeOutClassName = 'fade-out';
  const adRenderResultEmpty: Promise<RenderEventResult> = Promise.resolve('empty');
  const adRenderResultStandard: Promise<RenderEventResult> = Promise.resolve('standard');
  const adRenderResultDisallowed: Promise<RenderEventResult> = Promise.resolve('disallowed');

  /**
   * in order to wait  for the ad render result promise to resolve inside the callback, we need to wait until all
   * promises are finished
   *
   * @see https://stackoverflow.com/questions/44741102/how-to-make-jest-wait-for-all-asynchronous-code-to-finish-execution-before-expec
   */
  const waitForPromises = () => new Promise(process.nextTick);

  const createDiv = (id: string): HTMLDivElement => {
    const div = jsDomWindow.document.createElement('div');
    div.id = id;
    jsDomWindow.document.body.appendChild(div);
    return div;
  };

  let container = createDiv('container');
  let target = createDiv('target');

  const containerIntersectionEntry = (
    target: Element,
    isIntersecting: boolean,
    y: number
  ): IntersectionObserverEntry =>
    ({
      target,
      isIntersecting,
      boundingClientRect: {
        y
      } as any
    }) as any;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    container = createDiv(`container-${Math.floor(Math.random() * 10000)}`);
    target = createDiv('target');

    sandbox.reset();
    sandbox.resetHistory();
  });

  it('should do nothing if intersection entries are empty', () => {
    intersectionObserverFadeOutCallback(
      container,
      null,
      adRenderResultEmpty,
      null,
      null,
      fadeOutClassName
    )([], null as any);

    expect(container.classList.contains(fadeOutClassName)).to.be.false;
  });

  it('should do nothing if target is null', () => {
    intersectionObserverFadeOutCallback(
      container,
      null,
      adRenderResultEmpty,
      null,
      null,
      fadeOutClassName
    )([containerIntersectionEntry(container, true, 10)], null as any);

    expect(container.classList.contains(fadeOutClassName)).to.be.false;
  });

  it('should do nothing if target is different', async () => {
    intersectionObserverFadeOutCallback(
      container,
      createDiv('target'),
      adRenderResultEmpty,
      null,
      null,
      fadeOutClassName
    )([containerIntersectionEntry(container, true, 10)], null as any);
    await waitForPromises();

    expect(container.classList.contains(fadeOutClassName)).to.be.false;
  });

  describe('none sticky navbar behaviour', () => {
    [
      {
        name: 'ad is empty',
        adRenderResult: adRenderResultEmpty,
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, false, 20)
      },
      {
        name: 'advertiser is disallowed',
        adRenderResult: adRenderResultDisallowed,
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, false, 20)
      },
      {
        name: 'is intersecting',
        adRenderResult: adRenderResultStandard,
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, true, 20)
      },
      {
        name: 'is not intersecting, but below the element',
        adRenderResult: adRenderResultStandard,
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, false, -10)
      }
    ].forEach(({ name, adRenderResult, entryWith }) => {
      it(`should add fadeOutClassName if ${name}`, async () => {
        intersectionObserverFadeOutCallback(
          container,
          target,
          adRenderResult,
          null,
          null,
          fadeOutClassName
        )([entryWith(target)], null as any);
        await waitForPromises();

        expect(container.classList.contains(fadeOutClassName)).to.be.true;
      });
    });

    it('should remove fadeOutClassName if is visible', async () => {
      container.classList.add(fadeOutClassName);
      intersectionObserverFadeOutCallback(
        container,
        target,
        adRenderResultStandard,
        null,
        null,
        fadeOutClassName
      )([containerIntersectionEntry(target, false, 10)], null as any);
      await waitForPromises();

      expect(container.classList.contains(fadeOutClassName)).to.be.false;
    });
  });

  describe('sticky navbar behaviour', () => {
    const navbar = createDiv('navbar');
    const navbarHiddenClass = 'navbar-hidden';

    [
      {
        name: 'navbar is intersecting',
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, false, 20)
      },
      {
        name: 'navbar is not intersecting',
        entryWith: (entryTarget: Element) => containerIntersectionEntry(entryTarget, false, 20)
      }
    ].forEach(({ name, entryWith }) => {
      it(`should add ${navbarHiddenClass} if ${name}`, () => {
        intersectionObserverFadeOutCallback(
          container,
          target,
          adRenderResultStandard,
          navbar,
          navbarHiddenClass,
          fadeOutClassName
        )([entryWith(navbar)], null as any);

        expect(container.classList.contains(navbarHiddenClass)).to.be.true;
      });
    });

    it('should remove navbarHiddenClass if navbar is intersecting', () => {
      container.classList.add(navbarHiddenClass);
      intersectionObserverFadeOutCallback(
        container,
        target,
        adRenderResultStandard,
        navbar,
        navbarHiddenClass,
        fadeOutClassName
      )([containerIntersectionEntry(navbar, true, 20)], null as any);

      expect(container.classList.contains(navbarHiddenClass)).to.be.false;
    });
  });
});
