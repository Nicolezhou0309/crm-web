import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 兼容 +00 结尾的时间字符串，全部替换为 Z
 */
export function normalizeUtcString(str: string): string {
  return str.replace(/\+00$/, 'Z');
}

/**
 * 将后端返回的UTC时间（如 2025-07-18T10:29:30.233575+00:00 或 2025-07-18 10:29:30.233575+00）
 * 或Date对象，统一转换为北京时间字符串（YYYY-MM-DD HH:mm:ss）
 */
export function toBeijingTimeStr(input: string | Date): string {
  if (!input) return '';
  let str = typeof input === 'string' ? input : input.toString();
  str = normalizeUtcString(str);
  const d = dayjs(str);
  return d.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
} 