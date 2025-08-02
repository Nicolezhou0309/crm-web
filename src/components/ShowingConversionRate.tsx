import React, { useEffect, useState } from 'react';
import { Table, Radio, Typography, DatePicker } from 'antd';
import LoadingScreen from './LoadingScreen';
import dayjs from 'dayjs';
import { 
  getConversionRateStatsWithActualSales, 
  type ConversionRateStatsWithActualSales,
  type ConversionRateParams 
} from '../api/showingsApi';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ConversionData {
  key: string;
  showingsales_id: number;
  showingsales_name: string;
  showings_count: number;
  direct_deal_count: number;
  reserved_count: number;
  intention_count: number; // 意向金
  considering_count: number; // 考虑中
  lost_count: number; // 已流失
  unfilled_count: number; // 未填写
  direct_rate: number;
  conversion_rate: number;
  children?: ConversionData[]; // 子级数据
  // 环比数据
  previous_showings_count: number;
  previous_direct_deal_count: number;
  previous_reserved_count: number;
  previous_intention_count: number;
  previous_considering_count: number;
  previous_lost_count: number;
  previous_unfilled_count: number;
  previous_direct_rate: number;
  previous_conversion_rate: number;
}

type DateRange = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

const ShowingConversionRate: React.FC = () => {
  const [data, setData] = useState<ConversionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 获取日期范围
  const getDateRange = (range: DateRange) => {
    const now = dayjs();
    switch (range) {
      case 'thisWeek':
        return {
          start: now.startOf('week').toISOString(),
          end: now.endOf('week').toISOString(),
          previousStart: now.subtract(1, 'week').startOf('week').toISOString(),
          previousEnd: now.subtract(1, 'week').endOf('week').toISOString(),
        };
      case 'lastWeek':
        return {
          start: now.subtract(1, 'week').startOf('week').toISOString(),
          end: now.subtract(1, 'week').endOf('week').toISOString(),
          previousStart: now.subtract(2, 'week').startOf('week').toISOString(),
          previousEnd: now.subtract(2, 'week').endOf('week').toISOString(),
        };
      case 'thisMonth':
        return {
          start: now.startOf('month').toISOString(),
          end: now.endOf('month').toISOString(),
          previousStart: now.subtract(1, 'month').startOf('month').toISOString(),
          previousEnd: now.subtract(1, 'month').endOf('month').toISOString(),
        };
      case 'lastMonth':
        return {
          start: now.subtract(1, 'month').startOf('month').toISOString(),
          end: now.subtract(1, 'month').endOf('month').toISOString(),
          previousStart: now.subtract(2, 'month').startOf('month').toISOString(),
          previousEnd: now.subtract(2, 'month').endOf('month').toISOString(),
        };
      case 'custom':
        if (customDateRange) {
          const [start, end] = customDateRange;
          const duration = end.diff(start, 'day');
          const previousStart = start.subtract(duration, 'day');
          const previousEnd = end.subtract(duration, 'day');
          return {
            start: start.toISOString(),
            end: end.toISOString(),
            previousStart: previousStart.toISOString(),
            previousEnd: previousEnd.toISOString(),
          };
        }
        // 如果没有自定义日期，默认使用本月
        return {
          start: now.startOf('month').toISOString(),
          end: now.endOf('month').toISOString(),
          previousStart: now.subtract(1, 'month').startOf('month').toISOString(),
          previousEnd: now.subtract(1, 'month').endOf('month').toISOString(),
        };
    }
  };

  // 获取转化率数据（使用后端函数）
  const fetchConversionData = async () => {
    setLoading(true);
    try {
      const dateRangeConfig = getDateRange(dateRange);

      const params: ConversionRateParams = {
        date_start: dateRangeConfig.start,
        date_end: dateRangeConfig.end,
        previous_date_start: dateRangeConfig.previousStart,
        previous_date_end: dateRangeConfig.previousEnd
      };


      // 使用后端函数获取数据
      const backendData = await getConversionRateStatsWithActualSales(params);
      
      // 将后端数据转换为前端需要的格式
      const processedData = processBackendData(backendData);
      
      
      setData(processedData);
    } catch (error) {
      console.error('获取转化率数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理后端数据，转换为前端需要的树形结构
  const processBackendData = (backendData: ConversionRateStatsWithActualSales[]): ConversionData[] => {
    // 按带看销售分组
    const salesMap = new Map<number, ConversionData>();
    
    
    // 首先处理所有数据，按带看销售分组
    backendData.forEach((item) => {
      const salesId = item.sales_id;
      

      
      if (!salesMap.has(salesId)) {
        // 创建带看销售节点
        salesMap.set(salesId, {
            key: `showing_${salesId}`,
            showingsales_id: salesId,
          showingsales_name: item.sales_name,
            showings_count: 0,
            direct_deal_count: 0,
            reserved_count: 0,
            intention_count: 0,
            considering_count: 0,
            lost_count: 0,
            unfilled_count: 0,
            direct_rate: 0,
            conversion_rate: 0,
          previous_showings_count: 0,
          previous_direct_deal_count: 0,
          previous_reserved_count: 0,
          previous_intention_count: 0,
          previous_considering_count: 0,
          previous_lost_count: 0,
          previous_unfilled_count: 0,
          previous_direct_rate: 0,
          previous_conversion_rate: 0,
          children: []
        });

      }
      
      const salesNode = salesMap.get(salesId)!;
      
      // 如果有实际销售数据，创建子级记录
      if (item.actual_sales_id !== null) {

        const childNode: ConversionData = {
          key: `actual_${item.actual_sales_id}`,
          showingsales_id: item.actual_sales_id,
          showingsales_name: item.actual_sales_name || '未知销售',
          showings_count: item.showings_count,
          direct_deal_count: item.direct_deal_count,
          reserved_count: item.reserved_count,
          intention_count: item.intention_count,
          considering_count: item.considering_count,
          lost_count: item.lost_count,
          unfilled_count: item.unfilled_count,
          direct_rate: item.direct_rate,
          conversion_rate: item.conversion_rate,
          previous_showings_count: item.previous_showings_count,
          previous_direct_deal_count: item.previous_direct_deal_count,
          previous_reserved_count: item.previous_reserved_count,
          previous_intention_count: item.previous_intention_count,
          previous_considering_count: item.previous_considering_count,
          previous_lost_count: item.previous_lost_count,
          previous_unfilled_count: item.previous_unfilled_count,
          previous_direct_rate: item.previous_direct_rate,
          previous_conversion_rate: item.previous_conversion_rate
        };
        salesNode.children!.push(childNode);
        
        // 将子级数据汇总到父级

        salesNode.showings_count += item.showings_count;
        salesNode.direct_deal_count += item.direct_deal_count;
        salesNode.reserved_count += item.reserved_count;
        salesNode.intention_count += item.intention_count;
        salesNode.considering_count += item.considering_count;
        salesNode.lost_count += item.lost_count;
        salesNode.unfilled_count += item.unfilled_count;
        salesNode.previous_showings_count += item.previous_showings_count;
        salesNode.previous_direct_deal_count += item.previous_direct_deal_count;
        salesNode.previous_reserved_count += item.previous_reserved_count;
        salesNode.previous_intention_count += item.previous_intention_count;
        salesNode.previous_considering_count += item.previous_considering_count;
        salesNode.previous_lost_count += item.previous_lost_count;
        salesNode.previous_unfilled_count += item.previous_unfilled_count;

      } else {
        // 如果没有实际销售数据，创建"未分配"子记录

        const childNode: ConversionData = {
          key: `no_actual_${salesId}`,
          showingsales_id: salesId,
          showingsales_name: '未分配',
          showings_count: item.showings_count,
          direct_deal_count: item.direct_deal_count,
          reserved_count: item.reserved_count,
          intention_count: item.intention_count,
          considering_count: item.considering_count,
          lost_count: item.lost_count,
          unfilled_count: item.unfilled_count,
          direct_rate: item.direct_rate,
          conversion_rate: item.conversion_rate,
          previous_showings_count: item.previous_showings_count,
          previous_direct_deal_count: item.previous_direct_deal_count,
          previous_reserved_count: item.previous_reserved_count,
          previous_intention_count: item.previous_intention_count,
          previous_considering_count: item.previous_considering_count,
          previous_lost_count: item.previous_lost_count,
          previous_unfilled_count: item.previous_unfilled_count,
          previous_direct_rate: item.previous_direct_rate,
          previous_conversion_rate: item.previous_conversion_rate
        };
        salesNode.children!.push(childNode);
        
        // 将子级数据汇总到父级

        salesNode.showings_count += item.showings_count;
        salesNode.direct_deal_count += item.direct_deal_count;
        salesNode.reserved_count += item.reserved_count;
        salesNode.intention_count += item.intention_count;
        salesNode.considering_count += item.considering_count;
        salesNode.lost_count += item.lost_count;
        salesNode.unfilled_count += item.unfilled_count;
        salesNode.previous_showings_count += item.previous_showings_count;
        salesNode.previous_direct_deal_count += item.previous_direct_deal_count;
        salesNode.previous_reserved_count += item.previous_reserved_count;
        salesNode.previous_intention_count += item.previous_intention_count;
        salesNode.previous_considering_count += item.previous_considering_count;
        salesNode.previous_lost_count += item.previous_lost_count;
        salesNode.previous_unfilled_count += item.previous_unfilled_count;
      }
    });
    
    // 重新计算父级的比率
    salesMap.forEach((salesNode) => {
      if (salesNode.showings_count > 0) {
        salesNode.direct_rate = (salesNode.direct_deal_count / salesNode.showings_count) * 100;
        salesNode.conversion_rate = ((salesNode.direct_deal_count + salesNode.reserved_count) / salesNode.showings_count) * 100;
      }
      if (salesNode.previous_showings_count > 0) {
        salesNode.previous_direct_rate = (salesNode.previous_direct_deal_count / salesNode.previous_showings_count) * 100;
        salesNode.previous_conversion_rate = ((salesNode.previous_direct_deal_count + salesNode.previous_reserved_count) / salesNode.previous_showings_count) * 100;
      }
    });
    
    // 转换为数组并排序
    const result = Array.from(salesMap.values())
      .map(salesNode => {
        // 按带看量排序子级
        if (salesNode.children && salesNode.children.length > 0) {
          salesNode.children.sort((a, b) => b.showings_count - a.showings_count);
        }
        return salesNode;
      })
      .sort((a, b) => b.showings_count - a.showings_count);
    

    
    return result;
  };

  useEffect(() => {
    fetchConversionData();
  }, [dateRange, customDateRange]);

  const columns = [
    {
      title: '带看管家',
      dataIndex: 'showingsales_name',
      key: 'showingsales_name',
      width: 120,
      fixed: 'left' as const,
      render: (text: string, record: ConversionData) => {
        // 判断是否为子级（实际销售、未分配）
        const isChild = record.key.startsWith('actual_') || record.key.startsWith('no_actual_');
        const isNoActualSales = record.key.startsWith('no_actual_');
        return (
          <span style={{ 
            color: isChild ? '#666' : '#262626',
            fontWeight: isChild ? 'normal' : 600
          }}>
            {isNoActualSales ? '未分配' : text}
          </span>
        );
      },
    },
    {
      title: '带看量',
      dataIndex: 'showings_count',
      key: 'showings_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '直签量',
      dataIndex: 'direct_deal_count',
      key: 'direct_deal_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '预定量',
      dataIndex: 'reserved_count',
      key: 'reserved_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '意向金',
      dataIndex: 'intention_count',
      key: 'intention_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '考虑中',
      dataIndex: 'considering_count',
      key: 'considering_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '已流失',
      dataIndex: 'lost_count',
      key: 'lost_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '未填写',
      dataIndex: 'unfilled_count',
      key: 'unfilled_count',
      width: 100,
      render: (value: number) => (
        <span style={{ color: '#000000' }}>{value}</span>
      ),
    },
    {
      title: '直签率',
      dataIndex: 'direct_rate',
      key: 'direct_rate',
      width: 100,
      fixed: 'right' as const,
              render: (value: number, record: ConversionData) => {
        const comparison = getComparisonData(record.showingsales_id, 'direct_rate');
        return (
          <div>
            <div style={{ fontWeight: 600, color: getGradientColor(value, allDirectRates) }}>
              {value.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: comparison.change.startsWith('+') ? '#ff4d4f' : '#52c41a' }}>
              {comparison.change}
            </div>
          </div>
        );
      },
    },
    {
      title: '成交率',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      width: 100,
      fixed: 'right' as const,
              render: (value: number, record: ConversionData) => {
        const comparison = getComparisonData(record.showingsales_id, 'conversion_rate');
        return (
          <div>
            <div style={{ fontWeight: 600, color: getGradientColor(value, allConversionRates) }}>
              {value.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: comparison.change.startsWith('+') ? '#ff4d4f' : '#52c41a' }}>
              {comparison.change}
            </div>
          </div>
        );
      },
    },
  ];

  // 计算总计（只计算顶级数据，即带看销售）
  const totals = data.reduce(
    (acc, item) => ({
      showings_count: acc.showings_count + item.showings_count,
      direct_deal_count: acc.direct_deal_count + item.direct_deal_count,
      reserved_count: acc.reserved_count + item.reserved_count,
      intention_count: acc.intention_count + item.intention_count,
      considering_count: acc.considering_count + item.considering_count,
      lost_count: acc.lost_count + item.lost_count,
      unfilled_count: acc.unfilled_count + item.unfilled_count,
    }),
    { showings_count: 0, direct_deal_count: 0, reserved_count: 0, intention_count: 0, considering_count: 0, lost_count: 0, unfilled_count: 0 }
  );

  // 计算对比期间总计
  const previousTotals = data.reduce(
    (acc, item) => ({
      showings_count: acc.showings_count + item.previous_showings_count,
      direct_deal_count: acc.direct_deal_count + item.previous_direct_deal_count,
      reserved_count: acc.reserved_count + item.previous_reserved_count,
      intention_count: acc.intention_count + item.previous_intention_count,
      considering_count: acc.considering_count + item.previous_considering_count,
      lost_count: acc.lost_count + item.previous_lost_count,
      unfilled_count: acc.unfilled_count + item.previous_unfilled_count,
    }),
    { showings_count: 0, direct_deal_count: 0, reserved_count: 0, intention_count: 0, considering_count: 0, lost_count: 0, unfilled_count: 0 }
  );

  const totalDirectRate = totals.showings_count > 0 
    ? (totals.direct_deal_count / totals.showings_count) * 100 
    : 0;
  const totalConversionRate = totals.showings_count > 0 
    ? ((totals.direct_deal_count + totals.reserved_count) / totals.showings_count) * 100 
    : 0;

  const previousTotalDirectRate = previousTotals.showings_count > 0 
    ? (previousTotals.direct_deal_count / previousTotals.showings_count) * 100 
    : 0;
  const previousTotalConversionRate = previousTotals.showings_count > 0 
    ? ((previousTotals.direct_deal_count + previousTotals.reserved_count) / previousTotals.showings_count) * 100 
    : 0;

  // 计算渐变色函数
  const getGradientColor = (value: number, allValues: number[]) => {
    if (allValues.length === 0) return '#000000';
    
    const sortedValues = [...allValues].sort((a, b) => a - b);
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    
    if (max === min) return '#000000';
    
    const percentile = (value - min) / (max - min);
    
    if (percentile <= 0.2) return '#389e0d'; // 前20% 绿色（表现好）
    if (percentile >= 0.8) return '#cf1322'; // 后20% 红色（表现差）
    return '#000000'; // 中间 黑色
  };

  // 获取所有直签率和成交率值用于计算渐变色
  const allDirectRates = data.map(item => item.direct_rate);
  const allConversionRates = data.map(item => item.conversion_rate);

  // 计算环比变化
  const getComparisonChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+∞' : '0%';
    const change = ((current - previous) / previous) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  // 获取环比数据
  const getComparisonData = (salesId: number, field: keyof ConversionData) => {
    const current = data.find(item => item.showingsales_id === salesId)?.[field] || 0;
    const previous = data.find(item => item.showingsales_id === salesId)?.[`previous_${field}` as keyof ConversionData] || 0;
    const change = getComparisonChange(current as number, previous as number);
    return { current, previous, change };
  };

  // 计算总计环比
  const totalDirectRateChange = getComparisonChange(totalDirectRate, previousTotalDirectRate);
  const totalConversionRateChange = getComparisonChange(totalConversionRate, previousTotalConversionRate);

  // 获取日期范围显示文本
  const getDateRangeText = () => {
    const now = dayjs();
    switch (dateRange) {
      case 'thisWeek':
        return `本周 (${now.startOf('week').format('MM/DD')} - ${now.endOf('week').format('MM/DD')})`;
      case 'lastWeek':
        return `上周 (${now.subtract(1, 'week').startOf('week').format('MM/DD')} - ${now.subtract(1, 'week').endOf('week').format('MM/DD')})`;
      case 'thisMonth':
        return `本月 (${now.startOf('month').format('YYYY/MM')})`;
      case 'lastMonth':
        return `上月 (${now.subtract(1, 'month').startOf('month').format('YYYY/MM')})`;
      case 'custom':
        if (customDateRange) {
          const [start, end] = customDateRange;
          return `自定义 (${start.format('MM/DD')} - ${end.format('MM/DD')})`;
        }
        return `本月 (${now.startOf('month').format('YYYY/MM')})`;
    }
  };



    return (
    <div>
      <div style={{ 
        marginBottom: 24,
        padding: '16px 20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text strong style={{ fontSize: '14px', color: '#262626' }}>
                统计周期：
              </Text>
              <Text style={{ fontSize: '14px', color: '#595959' }}>
                {getDateRangeText()}
              </Text>
            </div>
            <RangePicker
              value={customDateRange}
              onChange={(dates) => {
                if (dates) {
                  setCustomDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
                  setDateRange('custom');
                } else {
                  // 取消选择时重置为本月
                  setCustomDateRange(null);
                  setDateRange('thisMonth');
                }
              }}
              size="small"
              style={{ width: 220 }}
              placeholder={['开始日期', '结束日期']}
              allowClear
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Radio.Group 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              size="small"
              buttonStyle="solid"
            >
              <Radio.Button value="thisWeek">本周</Radio.Button>
              <Radio.Button value="lastWeek">上周</Radio.Button>
              <Radio.Button value="thisMonth">本月</Radio.Button>
              <Radio.Button value="lastMonth">上月</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </div>
      
      {loading ? (
        <LoadingScreen type="data" />
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 1000, y: 400 }}
          expandable={{
            defaultExpandAllRows: true,
            rowExpandable: (record) => {
              // 只有带看销售（顶级节点）且有子级数据才能展开
              return !record.key.startsWith('actual_') && !record.key.startsWith('no_actual_') && Boolean(record.children && record.children.length > 0);
            }
          }}
          summary={() => (
            <Table.Summary.Row style={{ 
              backgroundColor: '#e6f7ff', 
              fontWeight: 600,
              position: 'sticky',
              bottom: 0,
              zIndex: 1
            }}>
              <Table.Summary.Cell index={0}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>总计</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.showings_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.direct_deal_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.reserved_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.intention_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.considering_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.lost_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7}>
                <span style={{ fontWeight: 600, color: '#1890ff' }}>{totals.unfilled_count}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1890ff' }}>
                    {totalDirectRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '12px', color: totalDirectRateChange.startsWith('+') ? '#ff4d4f' : '#52c41a' }}>
                    {totalDirectRateChange}
                  </div>
                </div>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1890ff' }}>
                    {totalConversionRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '12px', color: totalConversionRateChange.startsWith('+') ? '#ff4d4f' : '#52c41a' }}>
                    {totalConversionRateChange}
                  </div>
                </div>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      )}
    </div>
  );
};

export default ShowingConversionRate; 