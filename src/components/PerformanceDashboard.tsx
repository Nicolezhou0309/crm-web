import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Progress, Tooltip, Card, Statistic, Slider, Button } from 'antd';
import { Line } from '@ant-design/charts';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { FullscreenOutlined } from '@ant-design/icons';
import { ExpandAltOutlined } from '@ant-design/icons';

interface PerformanceData {
  date: string;
  leads: number;
  deals: number;
}

interface PerformanceDashboardProps {
  trendData?: PerformanceData[];
  currentDeals?: number;
  targetDeals?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  showTrendChart?: boolean;
  showProgressBar?: boolean;
  showStatsCards?: boolean;
  height?: number;
  leads30Days?: number;
  deals30Days?: number;
  leadsChange?: number;
  dealsChange?: number;
  showSlider?: boolean; // 新增
  defaultRange?: [number, number]; // 新增
  onEnlarge?: () => void; // 新增
}

// 获取某日期是当年第几周
function getWeekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = ((date as any) - (firstDay as any)) / 86400000 + 1;
  return Math.ceil((dayOfYear + firstDay.getDay()) / 7);
}

// 按周聚合数据
function aggregateByWeek(data: PerformanceData[]) {
  const weekMap = new Map<string, { date: string; leads: number; deals: number }>();
  data.forEach(item => {
    const date = new Date(item.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-W${week}`;
    if (!weekMap.has(key)) {
      weekMap.set(key, { date: key, leads: 0, deals: 0 });
    }
    const obj = weekMap.get(key)!;
    obj.leads += item.leads;
    obj.deals += item.deals;
  });
  return Array.from(weekMap.values());
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  trendData = [
    { date: '2024-07-01', leads: 10, deals: 1 },
    { date: '2024-07-02', leads: 12, deals: 2 },
    { date: '2024-07-03', leads: 15, deals: 3 },
    { date: '2024-07-04', leads: 18, deals: 2 },
    { date: '2024-07-05', leads: 20, deals: 4 },
    { date: '2024-07-06', leads: 16, deals: 5 },
    { date: '2024-07-07', leads: 19, deals: 3 },
  ],
  currentDeals = 27,
  targetDeals = 50,
  title = '成交进度',
  className,
  style,
  showTrendChart = true,
  showProgressBar = true,
  showStatsCards = true,
  height = undefined, // 默认不设定固定高度
  leads30Days = 320,
  deals30Days = 27,
  leadsChange = 12.5,
  dealsChange = -5.2,
  showSlider = true, // 新增
  defaultRange = [Math.max(0, trendData.length - 7), trendData.length - 1], // 新增
  onEnlarge, // 新增
}) => {
  // 区间选择，默认显示最后7天
  const [range, setRange] = useState<[number, number]>(defaultRange);
  // 用于判断整体拖动
  const prevRangeRef = useRef<[number, number]>(range);
  // 拖动区间整体滑动的状态
  const dragState = useRef<{ dragging: boolean; startX: number; startRange: [number, number] } | null>(null);

  // 计算进度百分比
  const progressPercent = Math.round((currentDeals / targetDeals) * 100);
  const isCompleted = currentDeals >= targetDeals;
  const isNearTarget = progressPercent >= 80;
  const conversionRate = leads30Days > 0 ? Math.round((deals30Days / leads30Days) * 100 * 100) / 100 : 0;

  // 日期格式化函数
  const formatDate = (text: string) => {
    const d = new Date(text);
    if (isNaN(d.getTime())) return text;
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  };

  // trendData 预处理，保证date字段为yyyy-MM-dd
  const normalizedTrendData = useMemo(() => trendData.map(item => {
    let d = new Date(item.date);
    if (isNaN(d.getTime())) return item;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { ...item, date: `${yyyy}-${mm}-${dd}` };
  }), [trendData]);

  // 计算当前区间数据（用标准化后的数据）
  const slicedData = useMemo(() => normalizedTrendData.slice(range[0], range[1] + 1), [normalizedTrendData, range]);
  const showByDay = (range[1] - range[0] + 1) <= 7;
  const chartData = useMemo(() => {
    if (showByDay) {
      return [
        ...slicedData.map(d => ({ date: d.date, value: typeof d.leads === 'number' ? d.leads : 0, type: '线索量' })),
        ...slicedData.map(d => ({ date: d.date, value: typeof d.deals === 'number' ? d.deals : 0, type: '成交量' })),
      ];
    } else {
      const weekData = aggregateByWeek(slicedData);
      return [
        ...weekData.map(d => ({ date: d.date, value: typeof d.leads === 'number' ? d.leads : 0, type: '线索量' })),
        ...weekData.map(d => ({ date: d.date, value: typeof d.deals === 'number' ? d.deals : 0, type: '成交量' })),
      ];
    }
  }, [slicedData, showByDay]);
  // 图表自适应父容器高度
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (chartContainerRef.current) {
      setChartHeight(chartContainerRef.current.offsetHeight);
    }
  }, [height]);

  // 趋势图配置
  const lineConfig = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    height: '100%',
    smooth: true,
    color: ['#1890ff', '#52c41a'],
    legend: { position: 'top' },
    point: { size: 3, shape: 'circle' },
    padding: 0,
    marginBottom: 30,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    xAxis: {
      tickCount: showByDay ? 7 : undefined,
      label: {
        autoHide: false,
        autoRotate: true,
        formatter: (text: string) => {
          if (/W\d+$/.test(text)) {
            // 周数据，显示为 Wxx
            return text.replace(/^\d{4}-/, 'W');
          }
          return formatDate(text);
        },
      },
    },
    scrollbar: { type: 'horizontal' },
    tooltip: {
      customContent: (title: string, items: any[]) => {
        return `<div style="padding:4px 8px;font-size:14px;">${formatDate(title)}</div>` +
          items.map(item =>
            `<div style="margin:2px 0;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;"></span>
              ${item.name}: ${item.value}
            </div>`
          ).join('');
      }
    }
  };

  const getProgressColor = () => {
    if (isCompleted) return '#52c41a';
    if (isNearTarget) return '#faad14';
    return '#1890ff';
  };

  const renderChangeIndicator = (change: number) => {
    if (change > 0) {
      return (
        <span style={{ color: '#52c41a', fontSize: 11 }}>
          <ArrowUpOutlined /> +{change}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span style={{ color: '#ff4d4f', fontSize: 11 }}>
          <ArrowDownOutlined /> {change}%
        </span>
      );
    }
    return <span style={{ color: '#8c8c8c', fontSize: 11 }}>0%</span>;
  };

  // 优化Slider整体拖动体验
  const handleSliderChange = (newRange: [number, number]) => {
    const prevRange = prevRangeRef.current;
    const prevLen = prevRange[1] - prevRange[0];
    const newLen = newRange[1] - newRange[0];
    // 整体拖动：区间长度不变，且两端都变
    if (
      newLen === prevLen &&
      newRange[0] !== prevRange[0] &&
      newRange[1] !== prevRange[1]
    ) {
      // 限制整体拖动不超界
      let offset = newRange[0] - prevRange[0];
      let start = prevRange[0] + offset;
      let end = prevRange[1] + offset;
      if (start < 0) {
        start = 0;
        end = start + prevLen;
      }
      if (end > trendData.length - 1) {
        end = trendData.length - 1;
        start = end - prevLen;
      }
      setRange([start, end]);
      prevRangeRef.current = [start, end];
      return;
    }
    // 普通缩放
    setRange(newRange);
    prevRangeRef.current = newRange;
  };

  return (
    <div
      className={className}
      style={{
        minHeight: 0,
        height: height ?? '100%',
        borderRadius: 18,
        background: '#fff',
        padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 8, textAlign: 'left', flex: '0 0 auto', background: '#fff', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span>{title}</span>
        {onEnlarge && (
          <Button
            type="text"
            icon={<ExpandAltOutlined style={{ fontSize: 22, transition: 'transform 0.18s' }} />}
            onClick={onEnlarge}
            style={{
              color: '#1890ff',
              fontSize: 20,
              boxShadow: 'none',
              padding: 0,
              marginLeft: 4,
              background: 'none',
              border: 'none',
              borderRadius: 6,
              transition: 'background 0.18s, transform 0.18s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none', // 防止点击后出现outline
            }}
            title="放大查看"
            size="small"
            tabIndex={-1} // 禁止焦点框选
            onMouseDown={e => e.preventDefault()} // 阻止点击后出现虚线框
            onMouseOver={e => {
              e.currentTarget.style.background = '#e6f4ff';
              e.currentTarget.style.transform = 'scale(1.12)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        )}
      </div>

      {/* 数字卡片（缩小版） */}
      {showStatsCards && (
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
          minHeight: 0,
          flex: '0 0 auto',
        }}>
          <Card
            size="small"
            style={{
              flex: 1,
              minWidth: 90,
              maxWidth: 120,
              borderRadius: 18, // 圆角统一
              border: '1px solid #f0f0f0',
              boxShadow: '0 4px 16px rgba(52,107,255,0.08)', // shadow统一
              padding: 0,
            }}
            bodyStyle={{ padding: 6 }}
          >
            <Statistic
              title={<span style={{ fontSize: 11 }}>30天线索量</span>}
              value={leads30Days}
              suffix={<span style={{ fontSize: 11 }}>条</span>}
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#1890ff' }}
            />
            <div style={{ marginTop: 2 }}>
              {renderChangeIndicator(leadsChange)}
            </div>
          </Card>

          <Card
            size="small"
            style={{
              flex: 1,
              minWidth: 90,
              maxWidth: 120,
              borderRadius: 18, // 圆角统一
              border: '1px solid #f0f0f0',
              boxShadow: '0 4px 16px rgba(52,107,255,0.08)', // shadow统一
              padding: 0,
            }}
            bodyStyle={{ padding: 6 }}
          >
            <Statistic
              title={<span style={{ fontSize: 11 }}>30天成交量</span>}
              value={deals30Days}
              suffix={<span style={{ fontSize: 11 }}>单</span>}
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#52c41a' }}
            />
            <div style={{ marginTop: 2 }}>
              {renderChangeIndicator(dealsChange)}
            </div>
          </Card>

          <Card
            size="small"
            style={{
              flex: 1,
              minWidth: 90,
              maxWidth: 120,
              borderRadius: 18, // 圆角统一
              border: '1px solid #f0f0f0',
              boxShadow: '0 4px 16px rgba(52,107,255,0.08)', // shadow统一
              padding: 0,
            }}
            bodyStyle={{ padding: 6 }}
          >
            <Statistic
              title={<span style={{ fontSize: 11 }}>30天转化率</span>}
              value={conversionRate}
              suffix={<span style={{ fontSize: 11 }}>%</span>}
              precision={1}
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#722ed1' }}
            />
            <div style={{ marginTop: 2, fontSize: 10, color: '#8c8c8c' }}>
              线索→成交
            </div>
          </Card>
        </div>
      )}

      {showTrendChart && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0, height: '100%' }}>
            <Line {...{ ...lineConfig, height: chartHeight ?? 200 }} />
          </div>
          {/* 优化后的滑块区间选择器 */}
          {showSlider && (
            <div style={{ padding: '0 20px' }}>
              <Slider
                range={{ draggableTrack: true }}
                min={0}
                max={trendData.length - 1}
                value={range}
                onChange={(v: number[]) => handleSliderChange(v as [number, number])}
                step={1}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PerformanceDashboard; 