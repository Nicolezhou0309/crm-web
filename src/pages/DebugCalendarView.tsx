import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Divider } from 'antd';
import { supabase } from '../supaClient';

const DebugCalendarView: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (title: string, success: boolean, data?: any, error?: any) => {
    setTestResults(prev => [...prev, {
      title,
      success,
      data,
      error,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // 测试1: 环境变量
  const testEnvironment = () => {
    const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
    const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    const url = import.meta.env.VITE_SUPABASE_URL?.substring(0, 20) + '...';
    
    addResult('环境变量检查', hasUrl && hasKey, { hasUrl, hasKey, url });
  };

  // 测试2: 用户认证
  const testAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      addResult('用户认证检查', !error, { user: !!user }, error);
    } catch (error) {
      addResult('用户认证检查', false, null, error);
    }
  };

  // 测试3: 基本连接
  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select('count')
        .limit(1);
      
      addResult('基本连接测试', !error, data, error);
    } catch (error) {
      addResult('基本连接测试', false, null, error);
    }
  };

  // 测试4: 简单查询
  const testSimpleQuery = async () => {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select('id, leadid, moveintime, followupstage')
        .limit(5);
      
      addResult('简单查询测试', !error, data, error);
    } catch (error) {
      addResult('简单查询测试', false, null, error);
    }
  };

  // 测试5: 带条件的查询
  const testConditionalQuery = async () => {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select('id, leadid, moveintime, followupstage')
        .not('moveintime', 'is', null)
        .limit(5);
      
      addResult('条件查询测试', !error, data, error);
    } catch (error) {
      addResult('条件查询测试', false, null, error);
    }
  };

  // 测试6: 日期范围查询
  const testDateRangeQuery = async () => {
    try {
      const startDate = '2025-01-01 00:00:00';
      const endDate = '2025-01-31 23:59:59';
      
      const { data, error } = await supabase
        .from('followups')
        .select('id, leadid, moveintime, followupstage')
        .not('moveintime', 'is', null)
        .gte('moveintime', startDate)
        .lte('moveintime', endDate);
      
      addResult('日期范围查询测试', !error, { data, startDate, endDate }, error);
    } catch (error) {
      addResult('日期范围查询测试', false, null, error);
    }
  };

  // 测试7: 完整查询（模拟日历视图）
  const testFullQuery = async () => {
    try {
      const { data, error } = await supabase
        .from('followups')
        .select(`
          id,
          leadid,
          followupstage,
          customerprofile,
          worklocation,
          userbudget,
          moveintime,
          userrating,
          scheduledcommunity,
          interviewsales_user_id,
          users_profile!followups_interviewsales_user_id_fkey(nickname)
        `)
        .not('moveintime', 'is', null)
        .limit(10);
      
      addResult('完整查询测试', !error, data, error);
    } catch (error) {
      addResult('完整查询测试', false, null, error);
    }
  };

  // 运行所有测试
  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    // 按顺序运行测试
    testEnvironment();
    await testAuth();
    await testConnection();
    await testSimpleQuery();
    await testConditionalQuery();
    await testDateRangeQuery();
    await testFullQuery();
    
    setLoading(false);
    message.success('所有测试完成');
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="日历视图调试工具" extra={
        <Space>
          <Button onClick={clearResults}>清空结果</Button>
          <Button type="primary" onClick={runAllTests} loading={loading}>
            运行所有测试
          </Button>
        </Space>
      }>
        <Space wrap style={{ marginBottom: 16 }}>
          <Button onClick={testEnvironment}>环境变量</Button>
          <Button onClick={testAuth}>用户认证</Button>
          <Button onClick={testConnection}>基本连接</Button>
          <Button onClick={testSimpleQuery}>简单查询</Button>
          <Button onClick={testConditionalQuery}>条件查询</Button>
          <Button onClick={testDateRangeQuery}>日期范围</Button>
          <Button onClick={testFullQuery}>完整查询</Button>
        </Space>
        
        <Divider />
        
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {testResults.map((result, index) => (
            <Card 
              key={index} 
              size="small" 
              style={{ marginBottom: 8 }}
              title={
                <span style={{ color: result.success ? '#52c41a' : '#ff4d4f' }}>
                  {result.success ? '✅' : '❌'} {result.title} ({result.timestamp})
                </span>
              }
            >
              {result.error && (
                <div style={{ marginBottom: 8 }}>
                  <strong>错误信息:</strong>
                  <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                </div>
              )}
              {result.data && (
                <div>
                  <strong>数据:</strong>
                  <pre style={{ background: '#f0f8ff', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DebugCalendarView; 