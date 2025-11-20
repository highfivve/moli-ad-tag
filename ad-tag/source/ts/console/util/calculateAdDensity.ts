type AdAreaPerSlot = { adSlot: string; adArea: number } | undefined;
export type AdDensity = {
  totalAdDensity: number | undefined;
  totalAdArea: number;
  adAreaPerSlot: AdAreaPerSlot[];
};

export function calculateAdDensity(
  contentSelector: string,
  adSelectorOverride: string | undefined
): AdDensity {
  const adSelector = adSelectorOverride ?? 'div[id^="google_ads_iframe_"]';
  const contentNode = document.querySelector(contentSelector);
  if (!contentNode) {
    console.warn('Content node not found');
    return { totalAdDensity: 0, totalAdArea: 0, adAreaPerSlot: [] };
  }

  const adNodes = Array.from(document.querySelectorAll(adSelector));
  if (adNodes.length === 0) {
    return { totalAdDensity: 0, totalAdArea: 0, adAreaPerSlot: [] };
  }

  // Collect log messages
  let logMessages: string[] = [];

  const adAreaPerSlot: AdAreaPerSlot[] = [];

  // Calculate total area of ads and log ad sizes
  let totalAdArea = 0;
  adNodes.forEach(ad => {
    const rect = ad.getBoundingClientRect();
    const width = Math.max(0, rect.width);
    const height = Math.max(0, rect.height);
    const area = width * height;
    totalAdArea += area;
    if (area > 0) {
      adAreaPerSlot.push({ adSlot: ad.id, adArea: area });
      logMessages.push(`Ad #${ad.id}: width=${width}px, height=${height}px, area=${area}px²`);
    }
  });

  // Calculate total area of the page (content container)
  const contentRect = contentNode.getBoundingClientRect();
  const pageArea = Math.max(0, contentRect.width) * Math.max(0, contentRect.height);

  if (pageArea === 0) {
    console.warn('Content area is zero');
    return { totalAdDensity: 0, totalAdArea: 0, adAreaPerSlot: [] };
  }

  // Calculate ad density as a percentage
  const totalAdDensity = Math.round((totalAdArea / pageArea) * 100);
  logMessages.push(
    `Total ad area: ${totalAdArea}px², Page area: ${pageArea}px², Ad density: ${totalAdDensity.toFixed(2)}%`
  );

  // Print all logs at once
  console.log(logMessages.join('\n'));

  return { totalAdDensity, totalAdArea, adAreaPerSlot };
}
