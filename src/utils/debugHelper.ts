// 调试工具
export const debugAPI = {
  // 测试数据库连接
  testConnection: async () => {
    try {
      const { data, error } = await supabase
        .from('live_stream_schedules')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('数据库连接测试失败:', error);
        return { success: false, error };
      }
      
      console.log('数据库连接测试成功');
      return { success: true, data };
    } catch (error) {
      console.error('连接测试异常:', error);
      return { success: false, error };
    }
  },

  // 测试函数调用
  testFunction: async (functionName: string, params: any = {}) => {
    try {
      console.log(`测试函数 ${functionName}，参数:`, params);
      
      const { data, error } = await supabase
        .rpc(functionName, params);

      if (error) {
        console.error(`函数 ${functionName} 调用失败:`, error);
        return { success: false, error };
      }

      console.log(`函数 ${functionName} 调用成功:`, data);
      return { success: true, data };
    } catch (error) {
      console.error(`函数 ${functionName} 异常:`, error);
      return { success: false, error };
    }
  },

  // 检查函数是否存在
  checkFunction: async (functionName: string) => {
    try {
      const { data, error } = await supabase
        .rpc('pg_function_exists', { function_name: functionName });

      if (error) {
        console.error('检查函数存在性失败:', error);
        return false;
      }

      return data;
    } catch (error) {
      console.error('检查函数存在性异常:', error);
      return false;
    }
  },

  // 获取函数信息
  getFunctionInfo: async (functionName: string) => {
    try {
      const { data, error } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type, data_type')
        .eq('routine_name', functionName)
        .eq('routine_schema', 'public');

      if (error) {
        console.error('获取函数信息失败:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('获取函数信息异常:', error);
      return null;
    }
  }
};

// 导入supabase客户端
import { supabase } from '../supaClient'; 