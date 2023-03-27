/**
 * Configuration for the emetriq data collection script.
 * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
 */
export type EmetriqParams = {
  /**
   * Account ID provided by emetriq.
   */
  readonly sid: number;

  readonly gender?: string;
  readonly agerange?: string;
  readonly yob?: string;
  readonly zip?: string;

  /**
   * It is also possible to use any number of custom-parameters, to transfer specific data.
   *
   * @example `custom1`
   */
  readonly [key: `custom${number}`]: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_id5?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_uid1?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_uid2?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_netid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_liveramp?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_digitrust?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_zeotap?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_tmi?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_criteoid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_sharedid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_yocid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_justid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_amxid?: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly id_panoramaid?: string;
};

export type EmetriqWindow = Window & {
  /**
   * Global parameters for the emetriq script
   * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
   */
  _enqAdpParam?: EmetriqParams;
};
