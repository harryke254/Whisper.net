export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'Just now';
  }

  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(diff / 86400000);
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days}d ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getExpiryCountdown(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) {
    return 'Expired';
  }

  const mins = Math.floor(diff / 60000);
  if (mins < 60) {
    return `${mins}m left`;
  }

  const hours = Math.floor(diff / 3600000);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m left`;
}
