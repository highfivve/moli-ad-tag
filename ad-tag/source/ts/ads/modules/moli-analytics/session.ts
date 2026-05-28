import { UserActivityService } from 'ad-tag/ads/modules/ad-reload/userActivityService';
import { BrowserStorageKeys } from 'ad-tag/util/browserStorageKeys';
import { uuidV4 } from 'ad-tag/util/uuid';
import type {
  AnalyticsSession,
  AnalyticsSessionStore
} from 'ad-tag/ads/modules/moli-analytics/types';

/**
 * Create analytics session.
 * @param window - Window object
 * @param ttl - Session timeout in minutes
 */
export const createSession = (window: Window, ttl: number): AnalyticsSession => {
  const userActivityService: UserActivityService = new UserActivityService(window, {
    level: 'strict'
  });
  const ttlMs: number = ttl * 60_000;

  const loadJSON = (k: string, d = null) => {
    try {
      return JSON.parse(window.localStorage.getItem(k) || '') ?? d;
    } catch {
      return d;
    }
  };

  const saveJSON = (k: string, v: AnalyticsSessionStore) =>
    window.localStorage.setItem(k, JSON.stringify(v));

  const getSession = (): AnalyticsSessionStore => {
    const now = Date.now();
    let session = loadJSON(BrowserStorageKeys.molyAnalyticsSession);
    if (!session || !session.id || !session.createdAt || !session.lastActivityAt) {
      session = createSession();
    } else {
      const idleMs = now - session.lastActivityAt;
      const isIdle = idleMs > ttlMs;
      if (isIdle) {
        session = createSession();
      }
    }
    return session;
  };

  const createSession = (): AnalyticsSessionStore => {
    const now = Date.now();
    const session = {
      id: `sess-${uuidV4(window)}`,
      createdAt: now,
      lastActivityAt: now
    };
    saveJSON(BrowserStorageKeys.molyAnalyticsSession, session);
    return session;
  };

  const touchSession = () => {
    const session = getSession();
    session.lastActivityAt = Date.now();
    saveJSON(BrowserStorageKeys.molyAnalyticsSession, session);
  };

  const getId = (): string => {
    return getSession().id;
  };

  // Listen for user activity changes
  userActivityService.addUserActivityChangedListener((isActive: boolean) => {
    if (isActive) {
      touchSession();
    }
  });

  // Initialize session on page load
  getSession();

  return {
    getId
  };
};
