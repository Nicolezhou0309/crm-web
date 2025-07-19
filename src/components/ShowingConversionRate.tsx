import React, { useEffect, useState } from 'react';
import { Table, Spin, Radio, Space, Typography, DatePicker } from 'antd';
import { supabase } from '../supaClient';
import dayjs from 'dayjs';

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
}

type DateRange = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

const ShowingConversionRate: React.FC = () => {
  const [data, setData] = useState<ConversionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [previousData, setPreviousData] = useState<ConversionData[]>([]);

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

  // 获取转化率数据
  const fetchConversionData = async () => {
    setLoading(true);
    try {
      const dateRangeConfig = getDateRange(dateRange);

      // 查询当前期间数据
      const { data: showingsData, error } = await supabase
        .from('showings')
        .select(`
          showingsales,
          trueshowingsales,
          viewresult
        `)
        .gte('created_at', dateRangeConfig.start)
        .lte('created_at', dateRangeConfig.end)
        .not('showingsales', 'is', null);

      if (error) throw error;

      // 查询对比期间数据
      const { data: previousShowingsData, error: previousError } = await supabase
        .from('showings')
        .select(`
          showingsales,
          trueshowingsales,
          viewresult
        `)
        .gte('created_at', dateRangeConfig.previousStart)
        .lte('created_at', dateRangeConfig.previousEnd)
        .not('showingsales', 'is', null);

      if (previousError) throw previousError;

      // 获取销售员信息
      const salesIds = [...new Set(showingsData?.map(s => s.showingsales).filter(Boolean))];
      const { data: salesData, error: salesError } = await supabase
        .from('users_profile')
        .select('id, nickname')
        .in('id', salesIds);

      if (salesError) throw salesError;

      // 创建销售员映射
      const salesNameMap = new Map<number, string>();
      salesData?.forEach(sales => {
        salesNameMap.set(sales.id, sales.nickname);
      });

      // 处理当前期间数据
      const conversionMap = new Map<number, ConversionData>();

      showingsData?.forEach((showing: any) => {
        const salesId = showing.showingsales;
        const salesName = salesNameMap.get(salesId) || '未知销售';
        
        if (!conversionMap.has(salesId)) {
          conversionMap.set(salesId, {
            key: `showing_${salesId}`,
            showingsales_id: salesId,
            showingsales_name: salesName,
            showings_count: 0,
            direct_deal_count: 0,
            reserved_count: 0,
            intention_count: 0,
            considering_count: 0,
            lost_count: 0,
            unfilled_count: 0,
            direct_rate: 0,
            conversion_rate: 0,
          });
        }

        const salesData = conversionMap.get(salesId)!;
        salesData.showings_count++;

        // 统计直签（成交）
        if (showing.viewresult === '直签') {
          salesData.direct_deal_count++;
        }
        // 统计预定
        else if (showing.viewresult === '预定') {
          salesData.reserved_count++;
        }
        // 统计意向金
        else if (showing.viewresult === '意向金') {
          salesData.intention_count++;
        }
        // 统计考虑中
        else if (showing.viewresult === '考虑中') {
          salesData.considering_count++;
        }
        // 统计已流失
        else if (showing.viewresult === '已流失') {
          salesData.lost_count++;
        }
        // 统计未填写（空值或null）
        else if (!showing.viewresult || showing.viewresult === '') {
          salesData.unfilled_count++;
        }
      });

      // 处理对比期间数据
      const previousConversionMap = new Map<number, ConversionData>();

      previousShowingsData?.forEach((showing: any) => {
        const salesId = showing.showingsales;
        const salesName = salesNameMap.get(salesId) || '未知销售';
        
        if (!previousConversionMap.has(salesId)) {
          previousConversionMap.set(salesId, {
            key: `previous_showing_${salesId}`,
            showingsales_id: salesId,
            showingsales_name: salesName,
            showings_count: 0,
            direct_deal_count: 0,
            reserved_count: 0,
            intention_count: 0,
            considering_count: 0,
            lost_count: 0,
            unfilled_count: 0,
            direct_rate: 0,
            conversion_rate: 0,
          });
        }

        const salesData = previousConversionMap.get(salesId)!;
        salesData.showings_count++;

        // 统计直签（成交）
        if (showing.viewresult === '直签') {
          salesData.direct_deal_count++;
        }
        // 统计预定
        else if (showing.viewresult === '预定') {
          salesData.reserved_count++;
        }
        // 统计意向金
        else if (showing.viewresult === '意向金') {
          salesData.intention_count++;
        }
        // 统计考虑中
        else if (showing.viewresult === '考虑中') {
          salesData.considering_count++;
        }
        // 统计已流失
        else if (showing.viewresult === '已流失') {
          salesData.lost_count++;
        }
        // 统计未填写（空值或null）
        else if (!showing.viewresult || showing.viewresult === '') {
          salesData.unfilled_count++;
        }
      });

      // 计算当前期间转化率
      const processedData = Array.from(conversionMap.values()).map((item) => ({
        ...item,
        direct_rate: item.showings_count > 0 ? (item.direct_deal_count / item.showings_count) * 100 : 0,
        conversion_rate: item.showings_count > 0 ? ((item.direct_deal_count + item.reserved_count) / item.showings_count) * 100 : 0,
      }));

      // 计算对比期间转化率
      const processedPreviousData = Array.from(previousConversionMap.values()).map((item) => ({
        ...item,
        direct_rate: item.showings_count > 0 ? (item.direct_deal_count / item.showings_count) * 100 : 0,
        conversion_rate: item.showings_count > 0 ? ((item.direct_deal_count + item.reserved_count) / item.showings_count) * 100 : 0,
      }));

      // 按带看量排序
      processedData.sort((a, b) => b.showings_count - a.showings_count);
      processedPreviousData.sort((a, b) => b.showings_count - a.showings_count);

      // 构建树形结构：带看销售 -> 实际销售
      const treeData = processedData.map(showingSales => {
        // 获取该带看销售下的所有数据
        const allSalesData = showingsData?.filter(showing => 
          showing.showingsales === showingSales.showingsales_id
        ) || [];

        // 按实际销售分组统计
        const actualSalesMap = new Map<number, ConversionData>();
        
        allSalesData.forEach(showing => {
          // 如果有实际销售且与带看销售不同，则按实际销售分组
          if (showing.trueshowingsales && showing.trueshowingsales !== showing.showingsales) {
            const actualSalesId = showing.trueshowingsales;
            const actualSalesName = salesNameMap.get(actualSalesId) || '未知销售';
            
            if (!actualSalesMap.has(actualSalesId)) {
              actualSalesMap.set(actualSalesId, {
                key: `actual_${actualSalesId}`,
                showingsales_id: actualSalesId,
                showingsales_name: actualSalesName,
                showings_count: 0,
                direct_deal_count: 0,
                reserved_count: 0,
                intention_count: 0,
                considering_count: 0,
                lost_count: 0,
                unfilled_count: 0,
                direct_rate: 0,
                conversion_rate: 0,
              });
            }

            const actualSalesData = actualSalesMap.get(actualSalesId)!;
            actualSalesData.showings_count++;

            // 统计各种结果
            if (showing.viewresult === '直签') {
              actualSalesData.direct_deal_count++;
            } else if (showing.viewresult === '预定') {
              actualSalesData.reserved_count++;
            } else if (showing.viewresult === '意向金') {
              actualSalesData.intention_count++;
            } else if (showing.viewresult === '考虑中') {
              actualSalesData.considering_count++;
            } else if (showing.viewresult === '已流失') {
              actualSalesData.lost_count++;
            } else if (!showing.viewresult || showing.viewresult === '') {
              actualSalesData.unfilled_count++;
            }
          } else {
            // 如果没有实际销售或实际销售与带看销售相同，创建一个"无实际销售"的子级
            const noActualSalesKey = `no_actual_${showingSales.showingsales_id}`;
            if (!actualSalesMap.has(-1)) { // 使用-1作为特殊ID
              actualSalesMap.set(-1, {
                key: noActualSalesKey,
                showingsales_id: -1,
                showingsales_name: '未分配',
                showings_count: 0,
                direct_deal_count: 0,
                reserved_count: 0,
                intention_count: 0,
                considering_count: 0,
                lost_count: 0,
                unfilled_count: 0,
                direct_rate: 0,
                conversion_rate: 0,
              });
            }

            const noActualSalesData = actualSalesMap.get(-1)!;
            noActualSalesData.showings_count++;

            // 统计各种结果
            if (showing.viewresult === '直签') {
              noActualSalesData.direct_deal_count++;
            } else if (showing.viewresult === '预定') {
              noActualSalesData.reserved_count++;
            } else if (showing.viewresult === '意向金') {
              noActualSalesData.intention_count++;
            } else if (showing.viewresult === '考虑中') {
              noActualSalesData.considering_count++;
            } else if (showing.viewresult === '已流失') {
              noActualSalesData.lost_count++;
            } else if (!showing.viewresult || showing.viewresult === '') {
              noActualSalesData.unfilled_count++;
            }
          }
        });

        // 计算实际销售的转化率
        const actualSalesList = Array.from(actualSalesMap.values()).map(item => ({
          ...item,
          direct_rate: item.showings_count > 0 ? (item.direct_deal_count / item.showings_count) * 100 : 0,
          conversion_rate: item.showings_count > 0 ? ((item.direct_deal_count + item.reserved_count) / item.showings_count) * 100 : 0,
        }));

        // 按带看量排序实际销售
        actualSalesList.sort((a, b) => b.showings_count - a.showings_count);

        // 验证子级数据总和是否等于父级数据
        const childTotal = actualSalesList.reduce((acc, item) => ({
          showings_count: acc.showings_count + item.showings_count,
          direct_deal_count: acc.direct_deal_count + item.direct_deal_count,
          reserved_count: acc.reserved_count + item.reserved_count,
          intention_count: acc.intention_count + item.intention_count,
          considering_count: acc.considering_count + item.considering_count,
          lost_count: acc.lost_count + item.lost_count,
          unfilled_count: acc.unfilled_count + item.unfilled_count,
        }), { showings_count: 0, direct_deal_count: 0, reserved_count: 0, intention_count: 0, considering_count: 0, lost_count: 0, unfilled_count: 0 });

        console.log(`带看销售: ${showingSales.showingsales_name}`);
        console.log(`父级数据:`, {
          showings_count: showingSales.showings_count,
          direct_deal_count: showingSales.direct_deal_count,
          reserved_count: showingSales.reserved_count,
          intention_count: showingSales.intention_count,
          considering_count: showingSales.considering_count,
          lost_count: showingSales.lost_count,
          unfilled_count: showingSales.unfilled_count,
        });
        console.log(`子级总和:`, childTotal);
        console.log(`是否一致:`, 
          childTotal.showings_count === showingSales.showings_count &&
          childTotal.direct_deal_count === showingSales.direct_deal_count &&
          childTotal.reserved_count === showingSales.reserved_count &&
          childTotal.intention_count === showingSales.intention_count &&
          childTotal.considering_count === showingSales.considering_count &&
          childTotal.lost_count === showingSales.lost_count &&
          childTotal.unfilled_count === showingSales.unfilled_count
        );

        return {
          ...showingSales,
          children: actualSalesList.length > 0 ? actualSalesList : undefined
        };
      });

      console.log('树形数据结构:', treeData);
      setData(treeData);
      setPreviousData(processedPreviousData);
    } catch (error) {
      console.error('获取转化率数据失败:', error);
    } finally {
      setLoading(false);
    }
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
        // 判断是否为子级（实际销售）
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
  const previousTotals = previousData.reduce(
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
    const previous = previousData.find(item => item.showingsales_id === salesId)?.[field] || 0;
    const change = getComparisonChange(current as number, previous as number);
    console.log(`环比数据 - 销售ID: ${salesId}, 字段: ${field}, 当前: ${current}, 上期: ${previous}, 变化: ${change}`);
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
      
      <Spin spinning={loading}>
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
      </Spin>
    </div>
  );
};

export default ShowingConversionRate; 