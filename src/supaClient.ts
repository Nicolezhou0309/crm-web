import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 获取枚举值通用方法
export async function fetchEnumValues(enumName: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: enumName });
  if (error) {
    console.error('获取枚举失败:', error);
    return [];
  }
  return data || [];
}

// 生成并发安全的leadid
export async function generateLeadId(): Promise<string> {
  const { data, error } = await supabase.rpc('gen_leadid');
  if (error) {
    console.error('生成leadid失败:', error);
    throw new Error('生成leadid失败: ' + error.message);
  }
  return data;
}
