import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { withRetry, supabaseRetryOptions } from './utils/retryUtils'

// 使用环境变量配置，移除硬编码的备用地址
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// 单例模式：确保只有一个 Supabase 客户端实例
let supabaseInstance: SupabaseClient | null = null;
let supabaseServiceRoleInstance: SupabaseClient | null = null;

// 调试信息
console.log('🔧 Supabase配置信息:', {
  supabaseUrl,
  protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
  environment: '生产环境',
  envUrl: import.meta.env.VITE_SUPABASE_URL,
  realtimeEnabled: true // 代理服务器支持WebSocket，启用realtime
})

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

// 创建匿名用户客户端（用于基础操作）- 使用单例模式
function createSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('🔧 创建 Supabase 匿名客户端实例');
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        debug: false,
        storage: {
          getItem: (key) => {
            try {
              return localStorage.getItem(`supabase-auth-${key}`)
            } catch {
              return null
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(`supabase-auth-${key}`, value)
            } catch {
              // 忽略存储错误
            }
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(`supabase-auth-${key}`)
            } catch {
              // 忽略存储错误
            }
          }
        }
      },
      // 启用realtime配置，处理混合内容问题
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        // 添加重连和错误处理配置
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
        // 添加调试配置
        log_level: 'info'
      },
      global: {
        headers: {
          'X-Client-Info': 'crm-web-aliyun',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'crm-web/1.0.0'
        }
      },
      db: {
        schema: 'public'
      }
    });
  }
  return supabaseInstance;
}

export const supabase = createSupabaseClient();

// 创建服务角色客户端（用于审批操作，绕过RLS策略）- 使用单例模式
function createSupabaseServiceRoleClient(): SupabaseClient {
  if (!supabaseServiceRoleInstance) {
    console.log('🔧 创建 Supabase 服务角色客户端实例');
    supabaseServiceRoleInstance = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
      // 服务角色客户端不需要 auth 和 realtime 配置
      global: {
        headers: {
          'X-Client-Info': 'crm-web-aliyun-service-role',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'crm-web/1.0.0'
        }
      },
      db: {
        schema: 'public'
      }
    });
  }
  return supabaseServiceRoleInstance;
}

export const supabaseServiceRole = createSupabaseServiceRoleClient();

// 实例检查函数 - 用于调试
export function checkSupabaseInstances() {
  console.log('🔍 Supabase 实例检查:', {
    supabaseInstance: !!supabaseInstance,
    supabaseServiceRoleInstance: !!supabaseServiceRoleInstance,
    totalInstances: (supabaseInstance ? 1 : 0) + (supabaseServiceRoleInstance ? 1 : 0)
  });
}

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
