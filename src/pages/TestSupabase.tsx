import React, { useEffect, useState } from 'react';
import { Card, Button, message, Typography } from 'antd';
import { supabase } from '../supaClient';

const { Title, Text } = Typography;

const TestSupabase: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [tableCount, setTableCount] = useState<number | null>(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      // 测试基本连接
      const { data, error } = await supabase
        .from('leads')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('连接测试失败:', error);
        setIsConnected(false);
        message.error('Supabase连接失败: ' + error.message);
      } else {
        setIsConnected(true);
        setTableCount(data?.length || 0);
        message.success('Supabase连接成功！');
      }
    } catch (error) {
      console.error('连接测试异常:', error);
      setIsConnected(false);
      message.error('连接测试异常');
    }
  };

  const testInsert = async () => {
    try {
      const testData = {
        leadid: 'TEST-' + Date.now(),
        phone: '13800138000',
        wechat: 'test_wechat',
        source: '测试',
        leadstatus: '新建',
      };

      const { error } = await supabase
        .from('leads')
        .insert([testData])
        .select();

      if (error) {
        message.error('插入测试失败: ' + error.message);
      } else {
        message.success('插入测试成功！');
        testConnection(); // 刷新数据
      }
    } catch (error) {
      message.error('插入测试异常');
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)',
      padding: 32,
      minHeight: 500,
    }}>
      <Title level={4} style={{ marginBottom: 24, fontWeight: 700, color: '#222' }}>
        Supabase连接测试
      </Title>
      
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>连接状态: </Text>
          {isConnected === null && <Text>测试中...</Text>}
          {isConnected === true && <Text style={{ color: 'green' }}>✅ 已连接</Text>}
          {isConnected === false && <Text style={{ color: 'red' }}>❌ 连接失败</Text>}
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>leads表记录数: </Text>
          {tableCount !== null ? tableCount : '未知'}
        </div>
        
        <Button onClick={testConnection} style={{ marginRight: 8 }}>
          重新测试连接
        </Button>
        <Button type="primary" onClick={testInsert}>
          测试插入数据
        </Button>
      </Card>
      
      <Card>
        <Title level={5}>配置信息</Title>
        <div style={{ marginBottom: 8 }}>
          <Text strong>URL: </Text>
          <Text code>https://wteqgprgiylmxzszcnws.supabase.co</Text>
        </div>
        <div>
          <Text strong>环境变量: </Text>
          <Text code>VITE_SUPABASE_URL</Text> 和 <Text code>VITE_SUPABASE_ANON_KEY</Text>
        </div>
      </Card>
    </div>
  );
};

export default TestSupabase; 