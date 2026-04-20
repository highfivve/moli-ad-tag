export type GeoResult = {
  readonly country: string | undefined;
  readonly continent: string | undefined;
};

const TIMEZONE_TO_COUNTRY: Readonly<Record<string, string>> = {
  // United Kingdom
  'Europe/London': 'GB',
  // Germany
  'Europe/Berlin': 'DE',
  // France
  'Europe/Paris': 'FR',
  // Italy
  'Europe/Rome': 'IT',
  // Spain
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  // Netherlands
  'Europe/Amsterdam': 'NL',
  // Belgium
  'Europe/Brussels': 'BE',
  // Austria
  'Europe/Vienna': 'AT',
  // Switzerland
  'Europe/Zurich': 'CH',
  // Sweden
  'Europe/Stockholm': 'SE',
  // Norway
  'Europe/Oslo': 'NO',
  // Denmark
  'Europe/Copenhagen': 'DK',
  // Finland
  'Europe/Helsinki': 'FI',
  // Poland
  'Europe/Warsaw': 'PL',
  // Portugal
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  // Romania
  'Europe/Bucharest': 'RO',
  // USA
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'America/Adak': 'US',
  'America/Juneau': 'US',
  'America/Nome': 'US',
  'America/Sitka': 'US',
  'America/Yakutat': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Indiana/Knox': 'US',
  'America/Indiana/Marengo': 'US',
  'America/Indiana/Petersburg': 'US',
  'America/Indiana/Tell_City': 'US',
  'America/Indiana/Vevay': 'US',
  'America/Indiana/Vincennes': 'US',
  'America/Indiana/Winamac': 'US',
  'America/Kentucky/Louisville': 'US',
  'America/Kentucky/Monticello': 'US',
  'America/North_Dakota/Beulah': 'US',
  'America/North_Dakota/Center': 'US',
  'America/North_Dakota/New_Salem': 'US',
  'America/Detroit': 'US',
  'America/Menominee': 'US',
  'Pacific/Honolulu': 'US',
  // Mexico
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Mazatlan': 'MX',
  'America/Chihuahua': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Tijuana': 'MX',
  'America/Hermosillo': 'MX',
  'America/Matamoros': 'MX',
  'America/Ojinaga': 'MX',
  'America/Bahia_Banderas': 'MX'
};

const continentFromTimezone = (timezone: string): string | undefined => {
  const prefix = timezone.split('/')[0];
  return prefix !== timezone ? prefix.toLowerCase() : undefined;
};

export const detectGeoFromTimezone = (timezone: string): GeoResult => {
  const country = TIMEZONE_TO_COUNTRY[timezone];
  return { country, continent: continentFromTimezone(timezone) };
};
