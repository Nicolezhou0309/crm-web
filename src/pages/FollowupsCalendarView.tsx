import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Badge, Modal, Button, Select, message, Spin, Empty } from 'antd';
import type { BadgeProps } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../supaClient';
import './FollowupsCalendarView.css';
import { toBeijingTime } from '../utils/timeUtils';
import { FollowupStageDrawer } from './Followups/components/FollowupStageDrawer';
import { FollowupsTable } from './Followups/components/FollowupsTable';

interface CalendarEvent {
  id: string;
  leadid: string;
  title: string;
  date: string;
  followupstage: string;
  customerprofile?: string;
  worklocation?: string;
  userbudget?: string | number;
  userrating?: string;
  phone?: string;
  wechat?: string;
  remark?: string;
  followupresult?: string;
  majorcategory?: string;
  interviewsales_user_name?: string;
  scheduledcommunity?: string;
  created_at: string;
  source?: string;
  interviewsales_user_id?: number | null;
  interviewsales_user?: string;
  moveintime?: string;
  scheduletime?: string;
  showingsales_user_id?: number | null;
  showingsales_user_name?: string;
  showingsales_user?: string;
  leadtype?: string;
  invalid?: boolean;
  extended_data?: {
    commute_times?: Record<string, number>;
    community_recommendations?: any[];
  };
}

const FollowupsCalendarView: React.FC = () => {
  // const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [calendarValue, setCalendarValue] = useState<Dayjs>(toBeijingTime(dayjs()));

  const [followupstageEnum, setFollowupstageEnum] = useState<{ label: string; value: string }[]>([]);
  const [metroStationOptions, setMetroStationOptions] = useState<any[]>([]);
  
  // 新增：其他枚举数据
  const [communityEnum, setCommunityEnum] = useState<any[]>([]);
  const [customerprofileEnum, setCustomerprofileEnum] = useState<any[]>([]);
  const [userratingEnum, setUserratingEnum] = useState<any[]>([]);
  const [majorCategoryOptions, setMajorCategoryOptions] = useState<any[]>([]);

  // 抽屉相关状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [forceUpdate] = useState(0);

  // 表格相关状态
  const [columnFilters, setColumnFilters] = useState<any>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });


  // 获取跟进记录数据
  const fetchFollowupsData = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      console.log('🔍 开始获取跟进记录数据...');
      console.log('📅 日期范围:', { startDate, endDate });
      
      // 构造参数对象
      const params: Record<string, any> = {
        p_moveintime_start: startDate ? `${startDate} 00:00:00` : undefined,
        p_moveintime_end: endDate ? `${endDate} 23:59:59` : undefined,
        p_limit: 1000, // 设置较大的限制以获取所有数据
        p_offset: 0,
      };

      // 移除未定义的参数
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null) {
          delete params[key];
        }
      });







      console.log('📤 执行RPC查询...');
      const { data, error } = await supabase.rpc('filter_followups', params);

      if (error) {
        console.error('❌ 获取数据失败:', error);
        console.error('❌ 错误详情:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        message.error('获取数据失败: ' + error.message);
        return;
      }

      console.log('✅ 查询成功，数据条数:', data?.length || 0);
      console.log('📊 原始数据:', data);

      // 更新记录总数
      // setTotalRecords(data?.length || 0); // This line was removed as per the edit hint

              // 转换数据格式 - RPC返回的数据结构
      const calendarEvents: CalendarEvent[] = (data || []).map((item: any) => ({
        id: item.id,
        leadid: item.leadid,
        title: item.leadid, // 只显示线索编号
        date: item.moveintime,
        followupstage: item.followupstage,
        customerprofile: item.customerprofile,
        worklocation: item.worklocation,
        userbudget: item.userbudget,
        userrating: item.userrating,
        phone: item.phone || '', // RPC可能包含phone字段
        wechat: item.wechat || '', // RPC可能包含wechat字段
        remark: item.remark,
        followupresult: item.followupresult,
        majorcategory: item.majorcategory,
        interviewsales_user_name: item.interviewsales_user_name || item.nickname, // RPC可能直接返回用户名
        scheduledcommunity: item.scheduledcommunity,
        created_at: item.created_at || new Date().toISOString(), // 确保有创建时间
        source: item.source,
        interviewsales_user_id: item.interviewsales_user_id,
        interviewsales_user: item.interviewsales_user,
        moveintime: item.moveintime,
        scheduletime: item.scheduletime,
        showingsales_user_id: item.showingsales_user_id,
        showingsales_user_name: item.showingsales_user_name,
        showingsales_user: item.showingsales_user,
        leadtype: item.leadtype,
        invalid: item.invalid,
        extended_data: item.extended_data,
      }));

      console.log('🔄 转换后的日历事件:', calendarEvents);
      setEvents(calendarEvents);
    } catch (error) {
      console.error('❌ 获取跟进记录失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };



  // 初始化数据 - 默认显示本月
  useEffect(() => {
    const now = dayjs();
    // 查询范围需要覆盖整个日历视图，包括上个月末和下个月初
    const startOfCalendar = now.startOf('month').startOf('week');
    const endOfCalendar = now.endOf('month').endOf('week');
    
    console.log('📅 初始化本月数据:', {
      startDate: startOfCalendar.format('YYYY-MM-DD'),
      endDate: endOfCalendar.format('YYYY-MM-DD'),
      currentMonth: now.format('YYYY年MM月')
    });
    
    // setCurrentMonth(now); // This line was removed as per the edit hint
    setCalendarValue(now);
    // setDateRange([startOfCalendar, endOfCalendar]); // This line was removed as per the edit hint
    fetchFollowupsData(startOfCalendar.format('YYYY-MM-DD'), endOfCalendar.format('YYYY-MM-DD'));
    
    // 加载枚举数据
    loadEnumWithCache('followupstage', setFollowupstageEnum);
    loadEnumWithCache('community', setCommunityEnum);
    loadEnumWithCache('customerprofile', setCustomerprofileEnum);
    loadEnumWithCache('userrating', setUserratingEnum);
    loadEnumWithCache('majorcategory', setMajorCategoryOptions);
    loadMetroStationOptions(); // 加载地铁站数据
  }, []);





  // 生成日历数据
  const calendarData = useMemo(() => {
    const data: Record<string, CalendarEvent[]> = {};
    
    events.forEach(event => {
      const dateKey = dayjs(event.date).format('YYYY-MM-DD');
      if (!data[dateKey]) {
        data[dateKey] = [];
      }
      data[dateKey].push(event);
    });
    
    return data;
  }, [events]);



  // 加载枚举数据
  const loadEnumWithCache = async (enumName: string, setter: any) => {
    const cacheKey = `enum_${enumName}`;
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const now = Date.now();
    
    // 缓存5分钟有效
    if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < 5 * 60 * 1000) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setter(JSON.parse(cached));
        return;
      }
    }
    
    try {
      const { data, error } = await supabase.rpc('get_enum_values', {
        enum_name: enumName
      });
      
      if (error) {
        console.error(`加载${enumName}枚举失败:`, error);
        return;
      }
      
      // 将字符串数组转换为对象数组格式
      const enumData = (data || []).map((value: string) => ({
        label: value,
        value: value
      }));
      
      setter(enumData);
      
      // 缓存数据
      localStorage.setItem(cacheKey, JSON.stringify(enumData));
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
    } catch (error) {
      console.error(`加载${enumName}枚举失败:`, error);
    }
  };

  // 加载地铁站数据
  const loadMetroStationOptions = async () => {
    const cacheKey = 'metro_stations';
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const now = Date.now();
    
    // 缓存5分钟有效
    if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < 5 * 60 * 1000) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setMetroStationOptions(JSON.parse(cached));
        return;
      }
    }
    
    try {
      const { data, error } = await supabase.rpc('get_metrostations');
      
      if (error) {
        console.error('加载地铁站数据失败:', error);
        return;
      }
      
      // 按线路分组，构建Cascader选项结构
      const lineGroups = (data || []).reduce((acc: any, station: any) => {
        const line = station.line || '其他';
        if (!acc[line]) {
          acc[line] = [];
        }
        acc[line].push(station);
        return acc;
      }, {});

      // 构建Cascader选项结构
      const options = Object.entries(lineGroups)
        .sort(([lineA], [lineB]) => {
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
      
      // 缓存数据
      localStorage.setItem(cacheKey, JSON.stringify(options));
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
    } catch (error) {
      console.error('加载地铁站数据失败:', error);
    }
  };

  // 更新本地数据
  const updateLocalData = (id: string, field: keyof any, value: any) => {
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === id ? { ...event, [field]: value } : event
      )
    );
  };

  // 处理抽屉保存回调
  const handleDrawerSave = (record: any, updatedFields: any) => {
    console.log('🔄 [FollowupsCalendarView] 抽屉保存操作:', { 
      recordId: record.id, 
      updatedFields,
      isAutoSave: updatedFields._autoSaveOnClose,
      isStageChange: updatedFields._stageChange
    });
    
    // 更新本地数据
    Object.entries(updatedFields).forEach(([field, value]) => {
      if (field !== '_autoSaveOnClose' && field !== '_stageChange') {
        updateLocalData(record.id, field, value);
      }
    });
    
    console.log('✅ [FollowupsCalendarView] 抽屉操作完成，本地数据已更新');
  };

  // 处理表格变更
  const handleTableChange = (pagination: any, filters: any) => {
    console.log('🔄 [FollowupsCalendarView] 表格变更:', { pagination, filters });
    
    // 更新分页状态
    setPagination({
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total
    });
    
    // 更新列筛选状态
    setColumnFilters(filters);
  };

  // 处理行编辑
  const handleRowEdit = async (record: any, field: keyof any, value: any) => {
    console.log('🔄 [FollowupsCalendarView] 行编辑:', { recordId: record.id, field, value });
    
    // 更新本地数据
    updateLocalData(record.id, field, value);
    
    // 这里可以添加保存到数据库的逻辑
    // 暂时只更新本地数据
    message.success('数据已更新');
  };

  // 处理线索详情点击
  const handleLeadDetailClick = (leadid: string) => {
    console.log('🔍 [FollowupsCalendarView] 线索详情点击:', leadid);
    // 这里可以添加线索详情查看逻辑
    message.info('线索详情功能待实现');
  };

  // 处理阶段点击
  const handleStageClick = async (record: any) => {
    console.log('🔄 [FollowupsCalendarView] 阶段点击:', { recordId: record.id, stage: record.followupstage });
    
    // 如果是待接收阶段，直接推进到确认需求阶段
    if (record.followupstage === '待接收') {
      console.log('🚀 [FollowupsCalendarView] 待接收阶段自动推进到确认需求阶段');
      
      try {
        // 更新本地数据
        updateLocalData(record.id, 'followupstage', '确认需求');
        
        // 保存到数据库
        const { error } = await supabase
          .from('followups')
          .update({ followupstage: '确认需求' })
          .eq('id', record.id);
        
        if (error) {
          // 保存失败，回滚本地数据
          updateLocalData(record.id, 'followupstage', record.followupstage);
          message.error('阶段推进失败: ' + error.message);
        } else {
          message.success('已自动推进到确认需求阶段');
        }
      } catch (error: any) {
        // 异常情况，回滚本地数据
        updateLocalData(record.id, 'followupstage', record.followupstage);
        message.error('阶段推进异常: ' + (error.message || '未知错误'));
      }
    } else {
      // 其他阶段正常打开抽屉
      setCurrentRecord(record);
      setDrawerOpen(true);
    }
  };

  // 处理回退点击
  const handleRollbackClick = (record: any) => {
    console.log('🔄 [FollowupsCalendarView] 回退点击:', { recordId: record.id });
    // 这里可以添加回退逻辑
    message.info('回退功能待实现');
  };

  // 检查字段是否禁用
  const isFieldDisabled = () => {
    return false; // 可以根据需要添加权限检查
  };

  // 查找级联选择器路径
  const findCascaderPath = (options: any[], targetValue: string): string[] => {
    if (!targetValue || !options || options.length === 0) {
      return [];
    }

    for (const option of options) {
      if (option.children && option.children.length > 0) {
        for (const child of option.children) {
          if (child.label === targetValue || child.value === targetValue) {
            return [option.value, child.value];
          }
        }
      } else if (option.label === targetValue || option.value === targetValue) {
        return [option.value];
      }
    }
    
    return [];
  };




  // 处理日期选择
  const handleDateSelect = (value: Dayjs) => {
    const dateKey = value.format('YYYY-MM-DD');
    const dayEvents = calendarData[dateKey] || [];
    
    // 只有当该日期有事件时才弹出弹窗
    if (dayEvents.length > 0) {
      setSelectedDate(value);
      setSelectedEvents(dayEvents);
      setIsModalVisible(true);
    } else {
    }
  };



  // 处理日历面板变化
  const handlePanelChange = (value: Dayjs, mode: string) => {
    // 只处理月视图变化，忽略年视图
    if (mode === 'month') {
      setCalendarValue(value);
      // setCurrentMonth(value); // This line was removed as per the edit hint
      
      // 当月份变化时，自动更新数据范围
      // 查询范围需要覆盖整个日历视图，包括上个月末和下个月初
      const startOfCalendar = value.startOf('month').startOf('week');
      const endOfCalendar = value.endOf('month').endOf('week');
      // setDateRange([startOfCalendar, endOfCalendar]); // This line was removed as per the edit hint
      fetchFollowupsData(startOfCalendar.format('YYYY-MM-DD'), endOfCalendar.format('YYYY-MM-DD'));
    } else {
    }
  };





  return (
    <div className="followups-calendar-view" style={{ margin: 0, padding: 0 }}>
        {/* 日历组件 */}
        <div className="calendar-container" style={{ margin: 0, padding: 0 }}>
          <Spin spinning={loading}>
            <Calendar
              value={calendarValue}
              style={{ margin: 0, padding: 0 }}
              className="no-margin-calendar"
              cellRender={(current) => {
                const dateKey = current.format('YYYY-MM-DD');
                const dayEvents = calendarData[dateKey] || [];
                
                // 统计当日唯一线索数量
                const uniqueLeads = new Set(dayEvents.map(event => event.leadid));
                const leadCount = uniqueLeads.size;
                
                return (
                  <div className="calendar-cell">
                    {/* 条数信息 - 固定在顶部 */}
                    {leadCount > 0 && (
                      <div className="count-header">
                        <span className="count-text">共{leadCount}条线索</span>
                      </div>
                    )}
                    
                    {/* 事件列表 - 使用Badge组件 */}
                    <ul className="events">
                      {dayEvents.map((event) => {
                        // 生成随机徽标颜色
                        const getRandomBadgeStatus = (): BadgeProps['status'] => {
                          const statuses: BadgeProps['status'][] = [
                            'success', 'processing', 'warning', 'error', 'default'
                          ];
                          return statuses[Math.floor(Math.random() * statuses.length)];
                        };
                        
                        return (
                          <li key={event.id}>
                            <Badge 
                              status={getRandomBadgeStatus()} 
                              text={event.title}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }}
              onSelect={handleDateSelect}
              onPanelChange={handlePanelChange}
              mode="month"
              validRange={[dayjs('1900-01-01'), dayjs('2100-12-31')]}
              headerRender={({ value, onChange }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(value.clone().subtract(1, 'month'));
                      }}
                    >
                      ‹
                    </Button>
                    
                    {/* 年份选择器 */}
                    <Select
                      value={value.year()}
                      onChange={(year) => {
                        const newValue = value.year(year);
                        onChange(newValue);
                      }}
                      style={{ width: 100 }}
                      size="small"
                      showSearch
                      placeholder="选择年份"
                    >
                      {Array.from({ length: 20 }, (_, i) => {
                        const year = dayjs().year() - 10 + i;
                        return (
                          <Select.Option key={year} value={year}>
                            {year}年
                          </Select.Option>
                        );
                      })}
                    </Select>
                    
                    {/* 月份选择器 */}
                    <Select
                      value={value.month()}
                      onChange={(month) => {
                        const newValue = value.month(month);
                        onChange(newValue);
                      }}
                      style={{ width: 80 }}
                      size="small"
                      showSearch
                      placeholder="选择月份"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <Select.Option key={i} value={i}>
                          {String(i + 1).padStart(2, '0')}月
                        </Select.Option>
                      ))}
                    </Select>
                    
                    <Button 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(value.clone().add(1, 'month'));
                      }}
                    >
                      ›
                    </Button>
                  </div>
                </div>
              )}
            />
          </Spin>
        </div>

      {/* 事件详情模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <CalendarOutlined style={{ color: '#1890ff' }} />
            <span>{selectedDate?.format('YYYY年MM月DD日')} 的跟进记录</span>
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={1000}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto', padding: 0, margin: 0 } }}
      >
        {selectedEvents.length > 0 ? (
          <div className="calendar-modal-content">
            {/* 使用统一的 FollowupsTable 组件 */}
            <FollowupsTable
              data={selectedEvents}
              loading={false}
              pagination={pagination}
              columnFilters={columnFilters}
              communityEnum={communityEnum}
              followupstageEnum={followupstageEnum}
              customerprofileEnum={customerprofileEnum}
              sourceEnum={[]} // 暂时为空，可以根据需要添加
              userratingEnum={userratingEnum}
              majorCategoryOptions={majorCategoryOptions}
              metroStationOptions={metroStationOptions}
              onTableChange={handleTableChange}
              onRowEdit={handleRowEdit}
              onLeadDetailClick={handleLeadDetailClick}
              onStageClick={handleStageClick}
              onRollbackClick={handleRollbackClick}
              isFieldDisabled={isFieldDisabled}
              forceUpdate={forceUpdate}
              // 新增的筛选选项
              leadtypeFilters={[]}
              remarkFilters={[]}
              worklocationFilters={[]}
              followupresultFilters={[]}
              majorcategoryFilters={[]}
              scheduledcommunityFilters={[]}
              // 新增的枚举数据
              interviewsalesUserList={[]}
              interviewsalesUserLoading={false}
              // 新增的工具函数
              findCascaderPath={findCascaderPath}
            />
                  </div>
        ) : (
          <Empty description="该日期没有跟进记录" />
        )}
      </Modal>

      {/* 跟进阶段抽屉 - 使用统一的 FollowupStageDrawer 组件 */}
      <FollowupStageDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        record={currentRecord}
        onSave={handleDrawerSave}
        isFieldDisabled={() => false}
        forceUpdate={forceUpdate}
        communityEnum={communityEnum}
        followupstageEnum={followupstageEnum}
        customerprofileEnum={customerprofileEnum}
        userratingEnum={userratingEnum}
        majorCategoryOptions={majorCategoryOptions}
        metroStationOptions={metroStationOptions}
      />
    </div>
  );
};

export default FollowupsCalendarView;