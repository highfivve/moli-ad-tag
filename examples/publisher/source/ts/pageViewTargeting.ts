const pageViewKey = '__pageViews';

export const getPageViewCount = (): string => {
  const pageViewsStr = window.sessionStorage.getItem(pageViewKey) || '0';
  const pageViews = Number.isInteger(pageViewsStr) ? Number.parseInt(pageViewsStr) : 0;
  const nextPageViews = pageViews + 1;
  window.sessionStorage.setItem(pageViewKey, nextPageViews.toString());
  return (nextPageViews >= 5 ? 5 : nextPageViews).toString();
};
