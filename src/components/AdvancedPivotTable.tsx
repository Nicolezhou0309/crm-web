import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  message, 
  Spin, 
  Row, 
  Col, 
  Select, 
  Typography,
  Divider,
  Tag
} from 'antd';
import { 
  DownloadOutlined, 
  ReloadOutlined
} from '@ant-design/icons';
import { supabase } from '../supaClient';
import { loadPivotComponent } from '../utils/pivotWrapper';

const { Text } = Typography;
const { Option } = Select;

interface AdvancedPivotTableProps {
  dataSource?: any[];
  onDataChange?: (data: any[]) => void;
}

interface PivotConfig {
  rows: string[];
  cols: string[];
  aggregatorName: string;
  vals: string[];
  rendererName: string;
}

const AdvancedPivotTable: React.FC<AdvancedPivotTableProps> = ({ 
  dataSource, 
  onDataChange 
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [Pivot, setPivot] = useState<any>(null);
  const [config, setConfig] = useState<PivotConfig>({
    rows: ['source'],
    cols: ['followupstage'],
    aggregatorName: 'Count',
    vals: ['value'],
    rendererName: 'Table'
  });

  // 可用的聚合函数
  const aggregators = [
    { label: '计数', value: 'Count' },
    { label: '求和', value: 'Sum' },
    { label: '平均值', value: 'Average' },
    { label: '最大值', value: 'Max' },
    { label: '最小值', value: 'Min' }
  ];

  // 可用的渲染器
  const renderers = [
    { label: '表格', value: 'Table' },
    { label: '热力图', value: 'Heatmap' },
    { label: '条形图', value: 'Bar Chart' }
  ];

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

  // 可用的字段
  const availableFields = useMemo(() => {
    if (!data.length) return [];
    
    const fields = Object.keys(data[0]).filter(key => key !== 'id');
    return fields.map(field => ({
      label: field,
      value: field
    }));
  }, [data]);

  // 添加行维度
  const addRowField = (field: string) => {
    if (!config.rows.includes(field)) {
      setConfig(prev => ({
        ...prev,
        rows: [...prev.rows, field]
      }));
    }
  };

  // 添加列维度
  const addColField = (field: string) => {
    if (!config.cols.includes(field)) {
      setConfig(prev => ({
        ...prev,
        cols: [...prev.cols, field]
      }));
    }
  };

  // 移除行维度
  const removeRowField = (field: string) => {
    setConfig(prev => ({
      ...prev,
      rows: prev.rows.filter(f => f !== field)
    }));
  };

  // 移除列维度
  const removeColField = (field: string) => {
    setConfig(prev => ({
      ...prev,
      cols: prev.cols.filter(f => f !== field)
    }));
  };

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
    <div>
      <Card
        title="高级数据透视表"
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
        <Row gutter={16}>
          {/* 左侧配置面板 */}
          <Col span={6}>
            <Card title="透视表配置" size="small">
              {/* 聚合函数选择 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>聚合函数：</Text>
                <Select
                  value={config.aggregatorName}
                  onChange={(value) => setConfig(prev => ({ ...prev, aggregatorName: value }))}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {aggregators.map(agg => (
                    <Option key={agg.value} value={agg.value}>
                      {agg.label}
                    </Option>
                  ))}
                </Select>
              </div>

              {/* 渲染器选择 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>渲染器：</Text>
                <Select
                  value={config.rendererName}
                  onChange={(value) => setConfig(prev => ({ ...prev, rendererName: value }))}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {renderers.map(renderer => (
                    <Option key={renderer.value} value={renderer.value}>
                      {renderer.label}
                    </Option>
                  ))}
                </Select>
              </div>

              <Divider />

              {/* 行维度配置 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>行维度：</Text>
                <div style={{ marginTop: 8 }}>
                  {config.rows.map(field => (
                    <Tag 
                      key={field} 
                      closable 
                      onClose={() => removeRowField(field)}
                      style={{ margin: '2px' }}
                    >
                      {field}
                    </Tag>
                  ))}
                </div>
                <Select
                  placeholder="添加行维度"
                  style={{ width: '100%', marginTop: 8 }}
                  onChange={addRowField}
                  value={undefined}
                >
                  {availableFields
                    .filter(field => !config.rows.includes(field.value))
                    .map(field => (
                      <Option key={field.value} value={field.value}>
                        {field.label}
                      </Option>
                    ))}
                </Select>
              </div>

              {/* 列维度配置 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>列维度：</Text>
                <div style={{ marginTop: 8 }}>
                  {config.cols.map(field => (
                    <Tag 
                      key={field} 
                      closable 
                      onClose={() => removeColField(field)}
                      style={{ margin: '2px' }}
                    >
                      {field}
                    </Tag>
                  ))}
                </div>
                <Select
                  placeholder="添加列维度"
                  style={{ width: '100%', marginTop: 8 }}
                  onChange={addColField}
                  value={undefined}
                >
                  {availableFields
                    .filter(field => !config.cols.includes(field.value))
                    .map(field => (
                      <Option key={field.value} value={field.value}>
                        {field.label}
                      </Option>
                    ))}
                </Select>
              </div>

              {/* 值字段配置 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>值字段：</Text>
                <div style={{ marginTop: 8 }}>
                  {config.vals.map(field => (
                    <Tag key={field} style={{ margin: '2px' }}>
                      {field}
                    </Tag>
                  ))}
                </div>
              </div>
            </Card>
          </Col>

          {/* 右侧透视表展示 */}
          <Col span={18}>
            <Card title="透视表结果" size="small">
              {data.length > 0 && Pivot ? (
                <div style={{ minHeight: '400px' }}>
                  <Pivot
                    data={data}
                    rows={config.rows}
                    cols={config.cols}
                    aggregatorName={config.aggregatorName}
                    vals={config.vals}
                    rendererName={config.rendererName}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">暂无数据</Text>
                  <br />
                  <Button type="primary" onClick={fetchSampleData} style={{ marginTop: 16 }}>
                    加载数据
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AdvancedPivotTable; 