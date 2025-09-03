import React, { useState, useEffect } from 'react';
import { Select, Button, Card, Tag, Space, Divider, List, Typography, Alert, message, Switch } from 'antd';
import { SearchOutlined, ClockCircleOutlined, EnvironmentOutlined, InfoCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { supabase } from '../../supaClient';
import FrontendCommuteCalculationService from '../../services/FrontendCommuteCalculationService';
import './MetroDistanceCalculator.css';

const { Option } = Select;
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

// 定义站点类型
interface MetroStation {
  name: string;
  line: string;
}

const MetroDistanceCalculatorOptimized: React.FC = () => {
  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MetroStation[]>([]);
  const [commuteResult, setCommuteResult] = useState<MetroCommuteResult | null>(null);
  const [allStations, setAllStations] = useState<MetroStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  
  // 前端计算相关状态
  const [useFrontendCalculation, setUseFrontendCalculation] = useState(false);
  const [frontendCommuteService] = useState(() => FrontendCommuteCalculationService.getInstance());
  
  // 批量计算相关状态
  const [batchCalculating, setBatchCalculating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentCommunity: '' });
  const [batchResult, setBatchResult] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchAllStations();
    fetchSystemStats();
  }, []);

  // 获取所有站点
  const fetchAllStations = async () => {
    try {
      const { data, error } = await supabase
        .from('metrostations')
        .select('name, line')
        .order('name');
      
      if (error) throw error;
      if (data) {
        setAllStations(data);
      }
    } catch (error) {
      console.error('获取站点列表失败:', error);
      message.error('获取站点列表失败');
    }
  };

  // 获取系统统计信息
  const fetchSystemStats = async () => {
    try {
      const { count: totalStations } = await supabase
        .from('metrostations')
        .select('*', { count: 'exact', head: true });
      
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

  const handleStationSearch = (query: string) => {
    if (query.trim()) {
      const results = allStations.filter(station => 
        station.name.toLowerCase().includes(query.toLowerCase()) ||
        station.line.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  // 计算通勤时间（支持数据库和前端两种方式）
  const handleCalculate = async () => {
    if (!fromStation || !toStation) return;

    setLoading(true);
    try {
      let result: MetroCommuteResult;

      if (useFrontendCalculation) {
        // 使用前端计算
        console.log('🚇 [前端计算] 使用前端算法计算通勤时间');
        const frontendResult = await frontendCommuteService.calculateMetroCommuteTime(fromStation, toStation);
        // 转换类型以匹配组件期望的格式
        result = {
          ...frontendResult,
          transfers: frontendResult.transfers.map(transfer => ({
            station: transfer.station,
            from_line: transfer.fromLine,
            to_line: transfer.toLine
          }))
        };
      } else {
        // 使用数据库计算
        console.log('🚇 [数据库计算] 使用数据库算法计算通勤时间');
        const { data, error } = await supabase
          .rpc('calculate_metro_commute_time', {
            p_start_station: fromStation,
            p_end_station: toStation
          });

        if (error) throw error;
        result = data;
      }
      
      if (result) {
        // 转换前端计算结果格式以匹配组件期望的类型
        const convertedResult: MetroCommuteResult = {
          ...result,
          transfers: result.transfers.map(transfer => ({
            station: transfer.station,
            from_line: (transfer as any).fromLine || transfer.from_line,
            to_line: (transfer as any).toLine || transfer.to_line
          }))
        };
        setCommuteResult(convertedResult);
        const method = useFrontendCalculation ? '前端' : '数据库';
        message.success(`${method}计算完成！`);
      }
    } catch (error: any) {
      console.error('计算通勤信息时出错:', error);
      message.error(`计算失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStationSelect = (stationName: string, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromStation(stationName);
    } else {
      setToStation(stationName);
    }
    setSearchResults([]);
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`;
  };

  const handleRefreshData = () => {
    fetchAllStations();
    fetchSystemStats();
    message.success('数据已刷新');
  };

  // 批量计算通勤时间（测试功能）
  const handleBatchCalculate = async () => {
    if (!fromStation) {
      message.warning('请先选择起始站点');
      return;
    }

    setBatchCalculating(true);
    setBatchProgress({ current: 0, total: 0, currentCommunity: '' });
    setBatchResult(null);

    try {
      const result = await frontendCommuteService.calculateCommuteTimesForWorklocation(
        'test-followup-id', // 测试用的跟进记录ID
        fromStation,
        {
          maxCommunities: 10, // 限制计算10个社区进行测试
          onProgress: (current, total, community) => {
            setBatchProgress({ current, total, currentCommunity: community });
          },
          onComplete: (commuteTimes) => {
            setBatchResult(commuteTimes);
            message.success(`批量计算完成！共计算 ${Object.keys(commuteTimes).length} 个社区`);
          }
        }
      );

      if (result.success) {
        console.log('✅ 批量计算成功:', result);
      } else {
        message.error(`批量计算失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('❌ 批量计算异常:', error);
      message.error(`批量计算异常: ${error.message}`);
    } finally {
      setBatchCalculating(false);
    }
  };

  return (
    <div className="metro-distance-calculator">
      <Title level={2} className="calculator-title">
        <DatabaseOutlined /> 上海地铁通勤时间计算器
        <Text type="secondary" style={{ fontSize: '14px', marginLeft: '16px' }}>
          使用数据库函数计算，性能优化版本
        </Text>
      </Title>

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
        <Card title="选择站点" className="station-selection-card">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="station-input-group">
              <Text strong>起始站点：</Text>
              <Select
                showSearch
                placeholder="请输入起始站点名称"
                value={fromStation}
                onChange={(value) => setFromStation(value)}
                onSearch={(query) => handleStationSearch(query)}
                style={{ width: '100%' }}
                filterOption={false}
                notFoundContent={searchResults.length > 0 ? (
                  <List
                    size="small"
                    dataSource={searchResults}
                    renderItem={(station) => (
                      <List.Item
                        className="search-result-item"
                        onClick={() => handleStationSelect(station.name, 'from')}
                      >
                        <Space>
                          <Tag color="blue">{station.line}</Tag>
                          <Text>{station.name}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : null}
              >
                {allStations.map(station => (
                  <Option key={`${station.name}-${station.line}`} value={station.name}>
                    <Space>
                      <Tag color="blue">{station.line}</Tag>
                      {station.name}
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>

            <div className="station-input-group">
              <Text strong>终点站点：</Text>
              <Select
                showSearch
                placeholder="请输入终点站点名称"
                value={toStation}
                onChange={(value) => setToStation(value)}
                onSearch={(query) => handleStationSearch(query)}
                style={{ width: '100%' }}
                filterOption={false}
                notFoundContent={searchResults.length > 0 ? (
                  <List
                    size="small"
                    dataSource={searchResults}
                    renderItem={(station) => (
                      <List.Item
                        className="search-result-item"
                        onClick={() => handleStationSelect(station.name, 'to')}
                      >
                        <Space>
                          <Tag color="green">{station.line}</Tag>
                          <Text>{station.name}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : null}
              >
                {allStations.map(station => (
                  <Option key={`${station.name}-${station.line}`} value={station.name}>
                    <Space>
                      <Tag color="green">{station.line}</Tag>
                      {station.name}
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>

            {/* 计算方式切换开关 */}
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <DatabaseOutlined style={{ color: '#1890ff' }} />
                  <Text strong>计算方式：</Text>
                </Space>
                <Space>
                  <Text style={{ color: !useFrontendCalculation ? '#1890ff' : undefined }}>数据库</Text>
                  <Switch
                    checked={useFrontendCalculation}
                    onChange={setUseFrontendCalculation}
                    checkedChildren="前端"
                    unCheckedChildren="数据库"
                  />
                  <Text style={{ color: useFrontendCalculation ? '#1890ff' : undefined }}>前端</Text>
                </Space>
              </Space>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {useFrontendCalculation 
                    ? '使用前端算法计算，避免数据库超时问题' 
                    : '使用数据库Dijkstra算法计算，结果更准确'
                  }
                </Text>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              onClick={handleCalculate}
              disabled={!fromStation || !toStation || loading}
              icon={<SearchOutlined />}
              style={{ width: '100%' }}
              loading={loading}
            >
              {loading ? '计算中...' : `计算通勤时间 (${useFrontendCalculation ? '前端' : '数据库'})`}
            </Button>

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

            {/* 批量计算测试按钮 */}
            <Button
              type="default"
              size="large"
              onClick={handleBatchCalculate}
              disabled={!fromStation || batchCalculating}
              loading={batchCalculating}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {batchCalculating ? '批量计算中...' : '批量计算测试 (前端)'}
            </Button>

            {/* 批量计算进度显示 */}
            {batchCalculating && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f0f8ff', borderRadius: '6px' }}>
                <Text strong>批量计算进度：</Text>
                <div style={{ marginTop: '8px' }}>
                  <Text>
                    {batchProgress.current} / {batchProgress.total} 
                    {batchProgress.currentCommunity && ` - 当前: ${batchProgress.currentCommunity}`}
                  </Text>
                </div>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    background: '#e6f7ff', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
                      height: '100%',
                      background: '#1890ff',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* 批量计算结果显示 */}
            {batchResult && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f6ffed', borderRadius: '6px' }}>
                <Text strong>批量计算结果：</Text>
                <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {Object.entries(batchResult).map(([community, time]) => (
                    <div key={community} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '4px 0',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      <Text>{community}</Text>
                      <Text style={{ color: time < 60 ? '#52c41a' : time < 90 ? '#faad14' : '#f5222d' }}>
                        {time}分钟
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Space>
        </Card>

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

                <div className="detail-item">
                  <Text strong>路线摘要：</Text>
                  <Text className="detail-value" style={{ marginLeft: '8px' }}>
                    {commuteResult.route_summary}
                  </Text>
                </div>

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

        {commuteResult && !commuteResult.success && (
          <Alert
            message="计算失败"
            description={commuteResult.error || '未知错误'}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Card title="所有站点列表" className="stations-list-card">
          <div className="stations-grid">
            {allStations.map(station => (
              <Tag
                key={`${station.name}-${station.line}`}
                className="station-tag"
                onClick={() => {
                  if (!fromStation) {
                    setFromStation(station.name);
                  } else if (!toStation) {
                    setToStation(station.name);
                  }
                }}
              >
                <Space>
                  <Text strong>{station.name}</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {station.line}
                  </Text>
                </Space>
              </Tag>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MetroDistanceCalculatorOptimized;
