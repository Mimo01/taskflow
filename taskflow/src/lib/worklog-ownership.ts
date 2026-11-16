/**
 * Worklog ownership helpers. Fail closed: with missing data nothing is "mine".
 * displayName is never used (not unique).
 */

interface Me {
  username: string | null;
  userKey: string | null;
}

export function isOwnWorklog(author: { name?: string; key?: string } | undefined, me: Me): boolean {
  if (!author) return false;
  if (me.userKey && author.key && author.key === me.userKey) return true;
  if (me.username && author.name && author.name.toLowerCase() === me.username.toLowerCase()) {
    return true;
  }
  return false;
}

export function isMeUsername(username: string | null, me: { username: string | null }): boolean {
  if (!username || !me.username) return false;
  return username.toLowerCase() === me.username.toLowerCase();
}
