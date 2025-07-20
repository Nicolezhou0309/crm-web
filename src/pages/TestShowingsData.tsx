import React, { useState } from 'react';
import { Card, Button, message } from 'antd';
import { supabase } from '../supaClient';

const TestShowingsData: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testShowingsData = async () => {
    setLoading(true);
    try {
      console.log('测试获取带看记录数据...');
      
      const { data: showingsData, error } = await supabase.rpc('filter_showings', {
        p_limit: 5,
        p_offset: 0
      });
      
      if (error) {
        console.error('获取数据失败:', error);
        message.error('获取数据失败: ' + error.message);
        return;
      }
      
      console.log('获取到的数据:', JSON.stringify(showingsData, null, 2));
      setData(showingsData || []);
      
      if (showingsData && showingsData.length > 0) {
        const firstRecord = showingsData[0];
        console.log('第一条记录的字段:', Object.keys(firstRecord));
        console.log('约访销售ID:', firstRecord.interviewsales_user_id);
        console.log('约访销售昵称:', firstRecord.interviewsales_nickname);
        console.log('带看销售ID:', firstRecord.showingsales);
        console.log('带看销售昵称:', firstRecord.showingsales_nickname);
        
        message.success('数据获取成功，请查看控制台');
      }
      
    } catch (error) {
      console.error('测试失败:', error);
      message.error('测试失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="测试带看记录数据">
        <Button onClick={testShowingsData} loading={loading}>
          测试获取数据
        </Button>
        
        {data.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3>获取到的数据字段:</h3>
            <pre>{JSON.stringify(Object.keys(data[0]), null, 2)}</pre>
            
            <h3>第一条记录:</h3>
            <pre>{JSON.stringify(data[0], null, 2)}</pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TestShowingsData; 