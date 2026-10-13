export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs <= 0) return 'now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  const YEAR_SECS = 365 * 86_400;
  if (diffSecs >= YEAR_SECS) {
    const years = Math.floor(diffSecs / YEAR_SECS);
    const remainingDays = Math.floor((diffSecs % YEAR_SECS) / 86_400);
    const yearLabel = years === 1 ? '1 year' : `${years} years`;
    return remainingDays === 0
      ? `${yearLabel} ago`
      : `${yearLabel} ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
  }
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}
