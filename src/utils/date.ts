export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDisplayDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return isoDate;
  }
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  const dayName = DAYS[dateObj.getDay()];
  return `${d} ${MONTHS[m - 1]} ${y} (${dayName})`;
}
