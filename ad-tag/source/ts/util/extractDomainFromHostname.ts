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
    // check if apex domain only consists of characters/numbers/hyphens and has a top-level domain
    return apexDomain;
  } else {
    return;
  }
};
