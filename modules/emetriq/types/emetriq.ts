/**
 * Configure additional identifiers
 *
 * @see https://doc.emetriq.de/#/profiling/identifiers
 */
export type EmetriqAdditionalIdentifier = {
  readonly id_id5?: string;
  readonly id_uid1?: string;

  readonly id_uid2?: string;

  readonly id_netid?: string;

  readonly id_liveramp?: string;

  readonly id_digitrust?: string;

  readonly id_zeotap?: string;

  readonly id_tmi?: string;

  readonly id_criteoid?: string;

  readonly id_sharedid?: string;

  readonly id_yocid?: string;

  readonly id_justid?: string;

  readonly id_amxid?: string;

  readonly id_panoramaid?: string;
};

/**
 * Configuration for the emetriq data collection script.
 * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
 */
export type EmetriqParams = EmetriqAdditionalIdentifier & {
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
};

export type EmetriqWindow = Window & {
  /**
   * Global parameters for the emetriq script
   * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
   */
  _enqAdpParam?: EmetriqParams;
};
