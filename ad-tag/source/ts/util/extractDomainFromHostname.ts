/**
 * Helper function to extract the (apex)domain from a website's hostname.
 *
 * @param hostname the site's hostname.
 *
 * @return string|undefined domain
 */
export const extractDomainFromHostname = (hostname: string | undefined): string | undefined => {
  if (hostname) {
    const [tld, sub1, sub2] = hostname.split('.').reverse();

    switch (`${sub1}.${tld}`) {
      // special country code TLDs
      case 'co.uk':
      case 'com.br':
        return `${sub2}.${sub1}.${tld}`;
      default:
        return sub1 ? `${sub1}.${tld}` : tld;
    }
  } else {
    return;
  }
};
