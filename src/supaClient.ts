import { createClient } from '@supabase/supabase-js'
import { withRetry, supabaseRetryOptions } from './utils/retryUtils'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'crm-web'
    }
  }
})

// 获取枚举值通用方法
export async function fetchEnumValues(enumName: string): Promise<string[]> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_enum_values', { enum_name: enumName });
    if (error) {
      console.error('获取枚举失败:', error);
      throw error;
    }
    return data || [];
  }, supabaseRetryOptions);
}

// 获取地铁站数据
export async function fetchMetroStations(): Promise<{ line: string; name: string }[]> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('get_metrostations');
    if (error) {
      console.error('获取地铁站数据失败:', error);
      throw error;
    }
    return data || [];
  }, supabaseRetryOptions);
}

// 生成并发安全的leadid
export async function generateLeadId(): Promise<string> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('gen_leadid');
    if (error) {
      console.error('生成leadid失败:', error);
      throw new Error('生成leadid失败: ' + error.message);
    }
    return data;
  }, supabaseRetryOptions);
}
