import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFunctions() {
  console.log('🔍 开始调试函数问题...\n');

  try {
    // 1. 检查函数是否真的被更新了
    console.log('1️⃣ 检查函数状态...');
    
    // 尝试调用函数，看看具体的错误信息
    console.log('   尝试调用Dijkstra函数...');
    
    const { data: dijkstraData, error: dijkstraError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '莘庄',
        p_end_station: '外环路'
      });
    
    if (dijkstraError) {
      console.log('❌ Dijkstra函数错误详情:');
      console.log('   错误代码:', dijkstraError.code);
      console.log('   错误消息:', dijkstraError.message);
      console.log('   错误详情:', dijkstraError.details);
      console.log('   错误提示:', dijkstraError.hint);
      
      // 分析错误类型
      if (dijkstraError.code === '42702') {
        console.log('\n🔍 错误分析:');
        console.log('   这是列引用歧义错误 (42702)');
        console.log('   说明函数体内的SQL查询仍然存在列引用歧义');
        console.log('   可能的原因:');
        console.log('   1. 函数没有被完全更新');
        console.log('   2. 还有其他地方存在列引用歧义');
        console.log('   3. PostgreSQL缓存了旧的函数定义');
      }
    } else {
      console.log('✅ Dijkstra函数工作正常！');
    }

    // 2. 检查基础视图是否正常
    console.log('\n2️⃣ 检查基础视图...');
    
    const { data: viewData, error: viewError } = await supabase
      .from('metro_complete_adjacency')
      .select('*')
      .limit(3);
    
    if (viewError) {
      console.log('❌ 视图错误:', viewError.message);
    } else {
      console.log('✅ 视图正常，数据:', viewData);
    }

    // 3. 提供解决建议
    console.log('\n📋 解决建议:');
    console.log('1. 在Supabase Studio中检查函数定义');
    console.log('2. 确认是否使用了正确的表别名');
    console.log('3. 可能需要强制删除并重新创建函数');
    console.log('4. 检查是否有其他依赖对象引用旧函数');

  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  }
}

// 运行调试
debugFunctions();
