export function getLiteralDateString(dateString) {
  if (!dateString) return '';
  // Extract strictly the YYYY-MM-DD portion, dropping any T or time/timezone components
  return dateString.split(/T|\s/)[0];
}

export function formatLiteralDate(dateString) {
  const literal = getLiteralDateString(dateString);
  if (!literal) return '-';
  
  // Parse as UTC midnight
  const date = new Date(`${literal}T00:00:00.000Z`);
  
  // Format strictly in UTC so it never shifts based on the browser's local timezone
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Calendar picks are stored as bare YYYY-MM-DD so they compare correctly against
// the literal date strings coming out of order_date. Storing a full ISO timestamp
// here breaks the string comparison and silently drops the start day's orders.
export function toDateOnly(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse a bare YYYY-MM-DD back into a local-midnight Date for the picker/display.
export function fromDateOnly(value) {
  if (!value) return undefined;
  const [y, m, d] = getLiteralDateString(value).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

// Utility to get exactly N days ago as a literal YYYY-MM-DD string
export function getPastDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
