/**
 * Helper function to extract the (apex)domain from a website's hostname.
 *
 * @param hostname the site's hostname.
 *
 * @return string|undefined domain
 */

export const extractDomainFromHostname = (hostname: string | undefined): string | undefined => {
  if (hostname) {
    const apexDomain = hostname.substring(
      hostname.lastIndexOf('.', hostname.lastIndexOf('.') - 1) + 1
    );
    return apexDomain;
  } else {
    return;
  }
};
