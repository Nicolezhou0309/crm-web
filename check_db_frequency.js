import { createClient } from '@supabase/supabase-js';

// 使用正确的 Supabase 配置
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

console.log('=== 数据库连接和频率控制检查 ===');
console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFrequencyControl() {
  try {
    console.log('\n1. 检查频率控制表是否存在...');
    
    // 检查表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['operation_frequency_control', 'frequency_control_config', 'operation_logs']);
    
    if (tablesError) {
      console.error('检查表失败:', tablesError);
    } else {
      console.log('找到的表:', tables?.map(t => t.table_name) || []);
    }

    console.log('\n2. 检查频率控制配置...');
    
    // 检查配置
    const { data: config, error: configError } = await supabase
      .from('frequency_control_config')
      .select('*');
    
    if (configError) {
      console.error('获取配置失败:', configError);
    } else {
      console.log('频率控制配置:', config);
    }

    console.log('\n3. 检查最近的频率控制记录...');
    
    // 检查频率控制记录
    const { data: freqRecords, error: freqError } = await supabase
      .from('operation_frequency_control')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (freqError) {
      console.error('获取频率记录失败:', freqError);
    } else {
      console.log('最近的频率控制记录:', freqRecords);
    }

    console.log('\n4. 检查最近的操作日志...');
    
    // 检查操作日志
    const { data: logs, error: logsError } = await supabase
      .from('operation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (logsError) {
      console.error('获取操作日志失败:', logsError);
    } else {
      console.log('最近的操作日志:', logs);
    }

    console.log('\n5. 测试频率检查函数...');
    
    // 测试频率检查函数
    const { data: testResult, error: testError } = await supabase
      .rpc('check_operation_frequency', { p_user_id: 1, p_operation_type: 'followup' });
    
    if (testError) {
      console.error('测试频率检查函数失败:', testError);
    } else {
      console.log('频率检查测试结果:', testResult);
    }

    console.log('\n6. 测试记录操作函数...');
    
    // 测试记录操作函数
    const { data: recordResult, error: recordError } = await supabase
      .rpc('record_operation', { 
        p_user_id: 1, 
        p_operation_type: 'followup',
        p_record_id: 'test-record-123'
      });
    
    if (recordError) {
      console.error('测试记录操作函数失败:', recordError);
    } else {
      console.log('记录操作测试结果:', recordResult);
    }

  } catch (error) {
    console.error('检查过程中发生错误:', error);
  }
}

// 运行检查
checkFrequencyControl().then(() => {
  console.log('\n=== 检查完成 ===');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
}); 