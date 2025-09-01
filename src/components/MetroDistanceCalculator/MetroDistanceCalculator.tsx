import React, { useState, useEffect } from 'react';
import { Button, Card, Tag, Space, Divider, Typography, Alert, message, Cascader } from 'antd';
import { SearchOutlined, ClockCircleOutlined, EnvironmentOutlined, InfoCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { supabase } from '../../supaClient';
import './MetroDistanceCalculator.css';


const { Title, Text } = Typography;

// 定义数据库返回的结果类型
interface MetroCommuteResult {
  success: boolean;
  start_station: string;
  end_station: string;
  total_time_minutes: number;
  total_time_formatted: string;
  stations_count: number;
  path: string[];
  transfers: Array<{
    station: string;
    from_line: string;
    to_line: string;
  }>;
  transfer_count: number;
  route_summary: string;
  error?: string;
}



// 定义级联选择器选项类型
interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

const MetroDistanceCalculator: React.FC = () => {
  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [commuteResult, setCommuteResult] = useState<MetroCommuteResult | null>(null);
  const [metroStationOptions, setMetroStationOptions] = useState<CascaderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    // 获取地铁站数据和系统统计信息
    loadMetroStationOptions();
    fetchSystemStats();
  }, []);

  // 加载地铁站数据并构建级联选择器选项
  const loadMetroStationOptions = async () => {
    try {
      // 使用数据库函数获取地铁站数据
      const { data, error } = await supabase.rpc('get_metrostations');
      
      if (error) throw error;
      
      if (data) {
        // 按线路分组，构建Cascader选项结构
        const lineGroups = data.reduce((acc: any, station: any) => {
          const line = station.line || '其他';
          if (!acc[line]) {
            acc[line] = [];
          }
          acc[line].push(station);
          return acc;
        }, {});

        // 构建Cascader选项结构，按线路数字顺序排列
        const options = Object.entries(lineGroups)
          .sort(([lineA], [lineB]) => {
            // 提取数字进行排序
            const getLineNumber = (line: string) => {
              const match = line.match(/^(\d+)号线$/);
              return match ? parseInt(match[1]) : 999999;
            };
            return getLineNumber(lineA) - getLineNumber(lineB);
          })
          .map(([line, stations]: [string, any]) => ({
            value: line,
            label: line,
            children: stations.map((station: any) => ({
              value: station.name,
              label: station.name
            }))
          }));

        setMetroStationOptions(options);
      }
    } catch (error) {
      console.error('获取地铁站数据失败:', error);
      message.error('获取地铁站数据失败');
    }
  };

  // 获取系统统计信息
  const fetchSystemStats = async () => {
    try {
      // 获取站点总数
      const { count: totalStations } = await supabase
        .from('metrostations')
        .select('*', { count: 'exact', head: true });
      
      // 获取线路总数
      const { data: lines } = await supabase
        .from('metrostations')
        .select('line')
        .not('line', 'is', null);
      
      const uniqueLines = lines ? [...new Set(lines.map(l => l.line))] : [];
      
      setSystemStats({
        totalStations: totalStations || 0,
        totalLines: uniqueLines.length
      });
    } catch (error) {
      console.error('获取系统统计信息失败:', error);
    }
  };

  // 调用数据库函数计算通勤时间
  const handleCalculate = async () => {
    if (!fromStation || !toStation) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('calculate_metro_commute_time', {
          p_start_station: fromStation,
          p_end_station: toStation
        });

      if (error) throw error;
      
      if (data) {
        setCommuteResult(data);
        message.success('计算完成！');
      }
    } catch (error: any) {
      console.error('计算通勤信息时出错:', error);
      message.error(`计算失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理站点选择
  const handleStationSelect = (_value: any, selectedOptions: any[], type: 'from' | 'to') => {
    let selectedStation = '';
    
    if (selectedOptions && selectedOptions.length > 1) {
      // 选择了两级：线路 -> 站点，保存站点名称
      selectedStation = selectedOptions[1].label;
    } else if (selectedOptions && selectedOptions.length === 1) {
      // 只选择了一级：线路，保存线路名称
      selectedStation = selectedOptions[0].label;
    }
    
    if (type === 'from') {
      setFromStation(selectedStation);
    } else {
      setToStation(selectedStation);
    }
  };

  // 查找级联选择器的路径（用于显示当前选中的值）
  const findCascaderPath = (options: CascaderOption[], value: string): string[] => {
    if (!value || !options) return [];
    
    for (const option of options) {
      if (option.value === value) {
        return [option.value];
      }
      if (option.children) {
        const childPath = findCascaderPath(option.children, value);
        if (childPath.length > 0) {
          return [option.value, ...childPath];
        }
      }
    }
    return [];
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`;
  };

  // 清理缓存（重新获取数据）
  const handleRefreshData = () => {
    loadMetroStationOptions();
    fetchSystemStats();
    message.success('数据已刷新');
  };

  return (
    <div className="metro-distance-calculator">
      <Title level={2} className="calculator-title">
        <DatabaseOutlined /> 上海地铁通勤时间计算器
        <Text type="secondary" style={{ fontSize: '14px', marginLeft: '16px' }}>
          使用数据库函数计算，性能优化版本
        </Text>
      </Title>

      {/* 系统状态信息 */}
      {systemStats && (
        <Alert
          message={`系统状态: ${systemStats.totalStations}个站点, ${systemStats.totalLines}条线路`}
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
          action={
            <Space>
              <Button size="small" onClick={handleRefreshData}>
                刷新数据
              </Button>
            </Space>
          }
        />
      )}

      <div className="calculator-container">
        {/* 站点选择区域 */}
        <Card title="选择站点" className="station-selection-card">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 起始站点 */}
            <div className="station-input-group">
              <Text strong>起始站点：</Text>
              <Cascader
                options={metroStationOptions}
                value={fromStation ? findCascaderPath(metroStationOptions, fromStation) : undefined}
                onChange={(value, selectedOptions) => handleStationSelect(value, selectedOptions, 'from')}
                placeholder="请选择起始站点"
                style={{ width: '100%' }}
                showSearch
                changeOnSelect={false}
                allowClear
                expandTrigger="hover"
              />
            </div>

            {/* 终点站点 */}
            <div className="station-input-group">
              <Text strong>终点站点：</Text>
              <Cascader
                options={metroStationOptions}
                value={toStation ? findCascaderPath(metroStationOptions, toStation) : undefined}
                onChange={(value, selectedOptions) => handleStationSelect(value, selectedOptions, 'to')}
                placeholder="请选择终点站点"
                style={{ width: '100%' }}
                showSearch
                changeOnSelect={false}
                allowClear
                expandTrigger="hover"
              />
            </div>

            {/* 计算按钮 */}
            <Button
              type="primary"
              size="large"
              onClick={handleCalculate}
              disabled={!fromStation || !toStation || loading}
              icon={<SearchOutlined />}
              style={{ width: '100%' }}
              loading={loading}
            >
              {loading ? '计算中...' : '计算通勤时间'}
            </Button>

            {/* 测试按钮 */}
            <Button
              type="dashed"
              size="large"
              onClick={() => {
                setFromStation("莘庄");
                setToStation("人民广场");
                setTimeout(() => {
                  handleCalculate();
                }, 100);
              }}
              style={{ width: '100%' }}
            >
              测试：莘庄 → 人民广场
            </Button>

            {/* 顾村公园到人民广场测试按钮 */}
            <Button
              type="dashed"
              size="large"
              onClick={() => {
                setFromStation("顾村公园");
                setToStation("人民广场");
                setTimeout(() => {
                  handleCalculate();
                }, 100);
              }}
              style={{ width: '100%' }}
            >
              测试：顾村公园 → 人民广场
            </Button>
          </Space>
        </Card>

        {/* 计算结果区域 */}
        {commuteResult && commuteResult.success && (
          <Card title="通勤信息" className="result-card">
            <div className="result-content">
              <div className="route-info">
                <div className="route-item">
                  <Tag color="blue" icon={<EnvironmentOutlined />}>
                    {commuteResult.start_station}
                  </Tag>
                  <Text className="route-arrow">→</Text>
                  <Tag color="green" icon={<EnvironmentOutlined />}>
                    {commuteResult.end_station}
                  </Tag>
                </div>
              </div>

              <Divider />

              <div className="result-details">
                <div className="detail-item">
                  <ClockCircleOutlined className="detail-icon" />
                  <Text strong>预计通勤时间：</Text>
                  <Text className="detail-value">
                    {formatTime(commuteResult.total_time_minutes)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                    ({commuteResult.total_time_formatted})
                  </Text>
                </div>

                <div className="detail-item">
                  <EnvironmentOutlined className="detail-icon" />
                  <Text strong>站点数量：</Text>
                  <Text className="detail-value">
                    {commuteResult.stations_count} 站
                  </Text>
                </div>

                <div className="detail-item">
                  <EnvironmentOutlined className="detail-icon" />
                  <Text strong>换乘次数：</Text>
                  <Text className="detail-value">
                    {commuteResult.transfer_count} 次
                  </Text>
                  {commuteResult.transfer_count > 0 && (
                    <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                      (每次换乘+5分钟)
                    </Text>
                  )}
                </div>

                {/* 路线摘要 */}
                <div className="detail-item">
                  <Text strong>路线摘要：</Text>
                  <Text className="detail-value" style={{ marginLeft: '8px' }}>
                    {commuteResult.route_summary}
                  </Text>
                </div>

                {/* 换乘详情 */}
                {commuteResult.transfers && commuteResult.transfers.length > 0 && (
                  <div className="detail-item">
                    <Text strong>换乘详情：</Text>
                    <div className="transfer-details">
                      {commuteResult.transfers.map((transfer, index) => (
                        <div key={index} className="transfer-detail">
                          <Tag color="orange">换乘</Tag>
                          <Text>在 {transfer.station} 从 {transfer.from_line} 换乘到 {transfer.to_line}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 完整路径 */}
                <div className="detail-item">
                  <Text strong>完整路径：</Text>
                  <div className="path-details">
                    {commuteResult.path.map((station, index) => (
                      <Tag key={index} color={index === 0 ? 'blue' : index === commuteResult.path.length - 1 ? 'green' : 'default'}>
                        {station}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 错误信息显示 */}
        {commuteResult && !commuteResult.success && (
          <Alert
            message="计算失败"
            description={commuteResult.error || '未知错误'}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 站点列表 */}
        <Card title="所有站点列表" className="stations-list-card">
          <div className="stations-grid">
            {metroStationOptions.map(lineOption => (
              <div key={lineOption.value} className="line-group">
                <Text strong style={{ display: 'block', marginBottom: '8px', color: '#1890ff' }}>
                  {lineOption.label}
                </Text>
                <div className="stations-in-line">
                  {lineOption.children?.map(station => (
                    <Tag
                      key={station.value}
                      className="station-tag"
                      onClick={() => {
                        if (!fromStation) {
                          setFromStation(station.value);
                        } else if (!toStation) {
                          setToStation(station.value);
                        }
                      }}
                    >
                      {station.label}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MetroDistanceCalculator;
