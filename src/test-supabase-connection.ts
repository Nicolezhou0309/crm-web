import { supabase, checkConnection } from './supaClient';

// 测试Supabase连接
async function testSupabaseConnection() {
  console.log('🔍 测试Supabase连接...');
  
  try {
    // 测试基本连接
    const connectionResult = await checkConnection();
    console.log('✅ 连接状态:', connectionResult);
    
    // 测试数据库查询
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(5);
    
    if (error) {
      console.error('❌ 数据库查询失败:', error);
    } else {
      console.log('✅ 数据库查询成功，找到表:', data);
    }
    
    // 测试RPC函数
    try {
      const enumResult = await supabase.rpc('get_query', {
        enum_name: 'community'
      });
      console.log('✅ RPC函数调用成功:', enumResult);
    } catch (rpcError) {
      console.error('❌ RPC函数调用失败:', rpcError);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 如果直接运行此文件
if (typeof window !== 'undefined') {
  // 在浏览器环境中
  window.testSupabaseConnection = testSupabaseConnection;
  console.log('🌐 Supabase连接测试函数已加载到全局作用域');
  console.log('💡 在浏览器控制台中运行: testSupabaseConnection()');
}

export { testSupabaseConnection };
