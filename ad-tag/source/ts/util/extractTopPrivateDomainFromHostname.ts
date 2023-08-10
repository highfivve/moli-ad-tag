/**
 * Helper function to extract the top private domain (as named by Google Guava library) from a website's hostname.
 *
 * NOTE: This method does neither use the public_suffix_list.dat . It contains a minimal subset of domains that we
 *       deem required. If a publisher has a domain that is not supported yet, the publisher can always add the top private
 *       domain label and the domain ad unit path variables manually, until we added this here.
 *
 * NOTE: In the future we may make this configurable in general via the ad tag config, so we can
 *       1. give publisher control over the domain in use
 *       2. parse domain on the server side, when delivering the ad tag
 *
 * @param hostname the site's hostname.
 *
 * @return string|undefined top private domain, which is "string" + "public suffix"
 * @see https://www.npmjs.com/package/parse-domain npm package for root domain parsing
 * @see https://publicsuffix.org/list/public_suffix_list.dat a list of all public suffixes
 * @see https://github.com/google/guava/wiki/InternetDomainNameExplained detailed explanation for TLD, public suffix and registry suffix
 */
export const extractTopPrivateDomainFromHostname = (
  hostname: string | undefined
): string | undefined => {
  if (hostname) {
    const [tld, sub1, sub2] = hostname.split('.').reverse();

    switch (`${sub1}.${tld}`) {
      // special country code TLDs
      case 'co.uk':
      case 'com.br':
      case 'com.mx':
      case 'com.au':
        return `${sub2}.${sub1}.${tld}`;
      default:
        return sub1 ? `${sub1}.${tld}` : tld;
    }
  } else {
    return;
  }
};
