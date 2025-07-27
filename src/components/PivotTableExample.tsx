import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Spin } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';
import { loadPivotComponent } from '../utils/pivotWrapper';

interface PivotTableExampleProps {
  dataSource?: any[];
  onDataChange?: (data: any[]) => void;
}

const PivotTableExample: React.FC<PivotTableExampleProps> = ({ 
  dataSource, 
  onDataChange 
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [Pivot, setPivot] = useState<any>(null);

  // 获取示例数据
  const fetchSampleData = async () => {
    setLoading(true);
    try {
      const { data: followupsData, error } = await supabase.rpc('filter_followups', {
        p_created_at_start: null,
        p_created_at_end: null,
        p_source_filter: null,
        p_leadtype_filter: null,
        p_followupstage_filter: null,
        p_viewresult_filter: null,
        p_community_filter: null,
        p_limit: 1000,
        p_offset: 0
      });

      if (error) {
        message.error('获取数据失败: ' + error.message);
        return;
      }

      const processedData = (followupsData || []).map((item: any, index: number) => ({
        id: index,
        source: item.source || '未知',
        leadtype: item.leadtype || '未知',
        followupstage: item.followupstage || '未知',
        viewresult: item.viewresult || '未知',
        community: item.community || '未知',
        created_at: item.created_at ? new Date(item.created_at).toLocaleDateString() : '未知',
        value: 1, // 用于计数
        // 可以添加更多数值字段用于聚合
      }));

      setData(processedData);
      onDataChange?.(processedData);
      message.success(`成功获取 ${processedData.length} 条数据`);
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataSource) {
      setData(dataSource);
    } else {
      fetchSampleData();
    }
    
    // 加载Pivot组件
    loadPivotComponent().then(setPivot);
  }, [dataSource]);

  // 导出数据
  const exportData = (format: 'csv' | 'json') => {
    if (!data.length) {
      message.warning('没有可导出的数据');
      return;
    }

    if (format === 'csv') {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(','));
      const csvContent = [headers, ...rows].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pivot_data_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pivot_data_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    }

    message.success(`${format.toUpperCase()} 导出成功`);
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载数据中...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="数据透视表示例"
      extra={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchSampleData}
            loading={loading}
          >
            刷新数据
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={() => exportData('csv')}
            disabled={!data.length}
          >
            导出CSV
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={() => exportData('json')}
            disabled={!data.length}
          >
            导出JSON
          </Button>
        </Space>
      }
    >
      {data.length > 0 && Pivot ? (
        <div style={{ minHeight: '400px' }}>
          <Pivot
            data={data}
            rows={['source', 'leadtype']}
            cols={['followupstage', 'viewresult']}
            aggregatorName="Count"
            vals={['value']}
            rendererName="Table"
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>暂无数据</p>
          <Button type="primary" onClick={fetchSampleData}>
            加载数据
          </Button>
        </div>
      )}
    </Card>
  );
};

export default PivotTableExample; 