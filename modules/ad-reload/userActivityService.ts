import { Moli } from '@highfivve/ad-tag/source/ts/types/moli';
import { getDefaultLogger } from '@highfivve/ad-tag/source/ts/util/logging';

/**
 * Listener for user activity state changes.
 *
 * This is called for every transition from true to false and vice versa exactly once.
 */
export type UserActivityListener = (userActivity: boolean) => void;

/**
 * Tracks user activity the most cautious, i.e. browser event efficient, way.
 *
 * User activities are: mouse, touch, scroll, keyboard press. The lack of one of these events causes the user to enter
 * an inactive state. Hiding the browser/switching the tab also causes the user to instantly become inactive.
 */
export class UserActivityService {
  /**
   * Events that are tracked to determine user activity.
   */
  static readonly observedEvents = ['mousemove', 'touchstart', 'scroll', 'keypress'];

  /**
   * The duration the page is considered to be "actively used" after the last user action. Changes to page visibility
   * always directly set the state to inactive.
   */
  static readonly userActivityDuration = 10 * 1000;

  /**
   * The duration after that we start listening for new user actions to keep the "active" state. This was introduced
   * such that we don't keep up expensive listeners on all user actions all the time.
   *
   * Must be smaller than userActivityDuration.
   */
  static readonly userBecomingInactiveDuration = 5 * 1000;

  private isActive: boolean = true;

  private userInactiveTimer: number | undefined;
  private userBecomingIdleTimer: number | undefined;

  private listener: UserActivityListener[];

  constructor(private readonly window: Window, private readonly logger?: Moli.MoliLogger) {
    if (!logger) {
      this.logger = getDefaultLogger();
    }

    this.listener = [];
    this.window.document.addEventListener('visibilitychange', this.handlePageVisibilityChanged);

    this.logger?.debug('UserActivityService', 'initialized');

    // set the initial value to "active"
    this.userActive();
  }

  addUserActivityChangedListener(listener: UserActivityListener): void {
    this.listener.push(listener);
  }

  /**
   * User has become active.
   *
   * We disable all event listeners at this point since we're good citizens and don't want to
   * burn the users' CPU completely wastefully. This is what we have our advertisers for.
   */
  private userActive(): void {
    // don't send the change event two times in a row.
    if (!this.isActive) {
      this.isActive = true;

      this.listener.forEach(listener => listener(this.isActive));
      this.logger?.debug('UserActivityService', 'user has become active');
    }

    UserActivityService.observedEvents.forEach(event =>
      this.window.removeEventListener(event, this.handleUserInteraction)
    );

    if (this.userInactiveTimer) {
      this.window.clearTimeout(this.userInactiveTimer);
    }
    if (this.userBecomingIdleTimer) {
      this.window.clearTimeout(this.userBecomingIdleTimer);
    }

    this.userInactiveTimer = this.window.setTimeout(
      this.handleUserIdle,
      UserActivityService.userActivityDuration
    );
    this.userBecomingIdleTimer = this.window.setTimeout(
      this.handleUserBecomingIdle,
      UserActivityService.userBecomingInactiveDuration
    );
  }

  /**
   * User has become inactive.
   *
   * We enable all observed event listeners again.
   */
  private userInactive(): void {
    this.isActive = false;

    UserActivityService.observedEvents.forEach(event =>
      this.window.addEventListener(event, this.handleUserInteraction)
    );

    this.listener.forEach(listener => listener(this.isActive));
    this.logger?.debug('UserActivityService', 'user has become inactive');
  }

  /**
   * Enables listeners to all observed event types before the user is considered inactive. This allows us to refresh
   * the active state before it is disabled.
   */
  private userBecomingInactive(): void {
    UserActivityService.observedEvents.forEach(event =>
      this.window.addEventListener(event, this.handleUserInteraction)
    );

    this.logger?.debug('UserActivityService', 'user will shortly become inactive');
  }

  private handleUserInteraction = () => this.userActive();
  private handleUserIdle = () => this.userInactive();
  private handleUserBecomingIdle = () => this.userBecomingInactive();

  /**
   * Handle page visibility change.
   *
   * When the page is hidden (e.g. browser tab has been changed) we instantly set the user inactive. On the contrary
   * we consider opening the page as a user action.
   */
  private handlePageVisibilityChanged = (): void => {
    if (this.window.document.hidden) {
      this.userInactive();
    } else {
      this.userActive();
    }
  };
}
