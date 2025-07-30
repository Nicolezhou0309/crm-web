// 测试远程兑换功能
import { createClient } from '@supabase/supabase-js';

// 使用远程Supabase配置
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJleHAiOjE3NTExNzc5ODF9.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testExchangeFunctions() {
  try {
    console.log('🔍 测试获取兑换商品...');
    
    // 测试获取兑换商品
    const { data: goods, error: goodsError } = await supabase.rpc('get_exchange_goods', {
      p_category: null,
      p_user_id: 1
    });
    
    if (goodsError) {
      console.error('❌ 获取兑换商品失败:', goodsError);
      return;
    }
    
    console.log('✅ 获取兑换商品成功:', goods);
    
    if (goods && goods.length > 0) {
      const firstGoods = goods[0];
      console.log('🎯 测试兑换商品:', firstGoods.name);
      
      // 测试兑换商品
      const { data: exchangeResult, error: exchangeError } = await supabase.rpc('exchange_goods_item', {
        p_user_id: 1,
        p_goods_id: firstGoods.id,
        p_description: '测试兑换'
      });
      
      if (exchangeError) {
        console.error('❌ 兑换商品失败:', exchangeError);
        return;
      }
      
      console.log('✅ 兑换商品成功:', exchangeResult);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testExchangeFunctions(); 