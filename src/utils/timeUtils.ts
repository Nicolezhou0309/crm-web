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

/**
 * 获取当前北京时间
 */
export function getCurrentBeijingTime(): dayjs.Dayjs {
  return dayjs().tz('Asia/Shanghai');
}

/**
 * 将任意时间转换为北京时间
 */
export function toBeijingTime(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  if (!input) return dayjs().tz('Asia/Shanghai');
  return dayjs(input).tz('Asia/Shanghai');
}

/**
 * 将时间转换为北京时间的日期字符串（YYYY-MM-DD）
 */
export function toBeijingDateStr(input: string | Date | dayjs.Dayjs): string {
  return toBeijingTime(input).format('YYYY-MM-DD');
}

/**
 * 将时间转换为北京时间的日期时间字符串（YYYY-MM-DD HH:mm:ss）
 */
export function toBeijingDateTimeStr(input: string | Date | dayjs.Dayjs): string {
  return toBeijingTime(input).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 获取一天的开始时间（北京时间）
 */
export function getDayStart(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).startOf('day');
}

/**
 * 获取一天的结束时间（北京时间）
 */
export function getDayEnd(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).endOf('day');
}

/**
 * 获取一周的开始时间（北京时间，周一为开始）
 */
export function getWeekStart(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).startOf('week');
}

/**
 * 获取一周的结束时间（北京时间，周日为结束）
 */
export function getWeekEnd(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).endOf('week');
}

/**
 * 获取一月的开始时间（北京时间）
 */
export function getMonthStart(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).startOf('month');
}

/**
 * 获取一月的结束时间（北京时间）
 */
export function getMonthEnd(input: string | Date | dayjs.Dayjs): dayjs.Dayjs {
  return toBeijingTime(input).endOf('month');
}

/**
 * 将北京时间转换为ISO字符串（用于API调用）
 */
export function toISOString(input: string | Date | dayjs.Dayjs): string {
  return toBeijingTime(input).toISOString();
}

/**
 * 格式化相对时间（如：3分钟前）
 */
export function fromNow(input: string | Date | dayjs.Dayjs): string {
  return toBeijingTime(input).fromNow();
}

/**
 * 检查两个时间是否在同一天（北京时间）
 */
export function isSameDay(a: string | Date | dayjs.Dayjs, b: string | Date | dayjs.Dayjs): boolean {
  return toBeijingTime(a).isSame(toBeijingTime(b), 'day');
}

/**
 * 检查时间是否在指定范围内（北京时间）
 */
export function isBetween(
  time: string | Date | dayjs.Dayjs,
  start: string | Date | dayjs.Dayjs,
  end: string | Date | dayjs.Dayjs,
  unit: dayjs.OpUnitType = 'day',
  inclusivity: '()' | '[]' | '(]' | '[)' = '[]'
): boolean {
  return toBeijingTime(time).isBetween(toBeijingTime(start), toBeijingTime(end), unit, inclusivity);
} 