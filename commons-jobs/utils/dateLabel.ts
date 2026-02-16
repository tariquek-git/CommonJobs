const DAY_MS = 24 * 60 * 60 * 1000;

const getDiffMs = (postedDate: string, now: Date): number | null => {
  const posted = new Date(postedDate).getTime();
  if (Number.isNaN(posted)) return null;
  return Math.max(0, now.getTime() - posted);
};

export const getPostedAgeDays = (postedDate: string, now = new Date()): number | null => {
  const diffMs = getDiffMs(postedDate, now);
  if (diffMs === null) return null;
  return Math.floor(diffMs / DAY_MS);
};

export const getPostedDateLabel = (postedDate: string, now = new Date()): string => {
  const diffMs = getDiffMs(postedDate, now);
  if (diffMs === null) return '';
  if (diffMs < DAY_MS) return 'Today';
  if (diffMs < 2 * DAY_MS) return 'Yesterday';

  const days = Math.floor(diffMs / DAY_MS);
  return `${days} days ago`;
};
