import { createClient } from '@supabase/supabase-js'
import { withRetry, supabaseRetryOptions } from './utils/retryUtils'

// 使用环境变量配置，移除硬编码的备用地址
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`
    Missing Supabase environment variables. Please check your .env file.
    
    Required variables:
    - VITE_SUPABASE_URL (e.g., https://your-project.supabase.co)
    - VITE_SUPABASE_ANON_KEY
    
    Current values:
    - VITE_SUPABASE_URL: ${supabaseUrl || 'NOT SET'}
    - VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'NOT SET'}
    
    Please create a .env file in your project root with the correct values.
  `)
}

// 创建匿名用户客户端（用于普通操作）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    debug: false,
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          // 忽略存储错误
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // 忽略存储错误
        }
      }
    }
  },
  // realtime: {  // 暂时禁用 realtime 功能
  //   params: {
  //     eventsPerSecond: 10
  //   }
  // },
  global: {
    headers: {
      'X-Client-Info': 'crm-web-aliyun',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'User-Agent': 'crm-web/1.0.0'
    }
  },
  db: {
    schema: 'public'
  }
})

// 创建服务角色客户端（用于审批操作，绕过RLS策略）
export const supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    flowType: 'pkce',
    debug: false
  },
  global: {
    headers: {
      'X-Client-Info': 'crm-web-aliyun-service-role',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'User-Agent': 'crm-web/1.0.0'
    }
  },
  db: {
    schema: 'public'
  }
})

// 使用重试机制的枚举值获取
export async function fetchEnumValues(enumName: string): Promise<string[]> {
  return withRetry(async () => {
    // 使用新的 get_enum_values 函数
    const { data, error } = await supabase.rpc('get_enum_values', {
      enum_name: enumName
    });

    if (error) {
      console.error(`❌ [错误] 调用 get_enum_values 失败:`, error);
      throw error;
    }

    // 确保返回的是数组
    if (!Array.isArray(data)) {
      console.error(`❌ [错误] get_enum_values 返回的不是数组:`, data);
      return [];
    }

    return data;
  }, supabaseRetryOptions)
}

// 获取地铁站信息
export async function fetchMetroStations(): Promise<{ line: string; name: string }[]> {
  return withRetry(async () => {
    // 使用数据库函数 get_metrostations，确保站点按照地理顺序排列
    const { data, error } = await supabase.rpc('get_metrostations');

    if (error) {
      console.error('❌ [错误] 获取地铁站数据失败:', error);
      throw error;
    }
    
    return data || []
  }, supabaseRetryOptions)
}



// Supabase配置信息
export const supabaseConfig = {
  url: supabaseUrl,
  isAliyun: false,
  projectRef: 'local-instance'
}

// 导出配置信息用于调试
export function getSupabaseInfo() {
  return {
    url: supabaseUrl,
    isAliyun: false,
    projectRef: supabaseConfig.projectRef
  }
}

// 测试连接状态
export async function checkConnection() {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)
    
    if (error) {
      return { connected: false, error: error.message }
    }
    
    return { connected: true, data: data }
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
