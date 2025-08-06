import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Badge, Modal, Tag, Button, Select, message, Spin, Empty, Table, Tooltip, Form, Input, InputNumber, DatePicker, Cascader, Drawer, Steps } from 'antd';
import type { BadgeProps } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../supaClient';
import locale from 'antd/es/date-picker/locale/zh_CN';
import './FollowupsCalendarView.css';

interface CalendarEvent {
  id: string;
  leadid: string;
  title: string;
  date: string;
  followupstage: string;
  customerprofile: string;
  worklocation: string;
  userbudget: string;
  userrating: string;
  phone: string;
  wechat: string;
  remark: string;
  followupresult?: string;
  majorcategory?: string;
  interviewsales_user_name?: string;
  scheduledcommunity?: string;
}

const FollowupsCalendarView: React.FC = () => {
  // const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());

  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [followupstageEnum, setFollowupstageEnum] = useState<{ label: string; value: string }[]>([]);

  // 抽屉相关状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [stageForm] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0);

  // 步骤条、表单字段、label
  const followupStages = [
    '丢单', '待接收', '确认需求', '邀约到店', '已到店', '赢单'
  ];
  const stageFields = {
    '丢单': ['majorcategory', 'followupresult'],
    '待接收': [],
    '确认需求': [
      'customerprofile',
      'worklocation',
      'userbudget',
      'moveintime',
      'userrating',
      'majorcategory',
      'followupresult'
    ],
    '邀约到店': ['scheduletime', 'scheduledcommunity'],
    '已到店': [],
    '赢单': []
  };
  const fieldLabelMap: Record<string, string> = {
    customerprofile: '用户画像',
    worklocation: '工作地点',
    userbudget: '用户预算',
    moveintime: '入住时间',
    userrating: '来访意向',
    majorcategory: '跟进结果',
    followupresult: '跟进备注',
    scheduletime: '预约到店时间',
    scheduledcommunity: '预约社区',
    showingsales_user: '带看管家',
    followupstage: '跟进阶段',
  };

  // 根据当前阶段动态调整字段标签
  const getFieldLabel = (field: string, currentStage: string) => {
    if (currentStage === '丢单' && field === 'followupresult') {
      return '丢单原因';
    }
    return fieldLabelMap[field] || field;
  };

  // 转换日期字段
  const convertDateFields = (record: any) => {
    const converted: any = { ...record };
    ['moveintime', 'scheduletime'].forEach(field => {
      if (converted[field] && typeof converted[field] === 'string') {
        converted[field] = dayjs(converted[field]);
      }
    });
    return converted;
  };

  // 检查字段是否禁用
  const isFieldDisabled = () => {
    return false; // 可以根据需要添加权限检查
  };

  // 保存抽屉表单
  const saveDrawerForm = async (additionalFields: any = {}) => {
    if (!currentRecord) return { success: false, error: '无当前记录' };

    try {
      // 获取表单当前值
      const values = stageForm.getFieldsValue();
      
      // 格式化日期字段
      ['moveintime', 'scheduletime'].forEach(field => {
        if (values[field] && typeof values[field]?.format === 'function') {
          values[field] = values[field].format('YYYY-MM-DD HH:mm:ss');
        }
      });

      // 从values中移除deals表特有的字段
      const { contractcommunity, contractnumber, roomnumber, ...followupValues } = values;
      
      // 合并额外字段（如阶段推进）
      const updateObj = { ...followupValues, ...additionalFields };
      
      // 乐观更新：使用统一的updateLocalData函数更新所有相关状态
      Object.entries(updateObj).forEach(([field, value]) => {
        if (value !== currentRecord[field]) {
          updateLocalData(currentRecord.id, field, value);
        }
      });

      // 异步保存到后端
      const { error } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', currentRecord.id);

      if (error) {
        // 保存失败，回滚所有修改的字段
        Object.entries(updateObj).forEach(([field, value]) => {
          if (value !== currentRecord[field]) {
            updateLocalData(currentRecord.id, field, currentRecord[field]);
          }
        });
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      // 异常处理，回滚所有修改的字段
      const values = stageForm.getFieldsValue();
      const { contractcommunity, contractnumber, roomnumber, ...followupValues } = values;
      const updateObj = { ...followupValues, ...additionalFields };
      Object.entries(updateObj).forEach(([field, value]) => {
        if (value !== currentRecord[field]) {
          updateLocalData(currentRecord.id, field, currentRecord[field]);
        }
      });
      return { success: false, error: '保存过程中发生错误' };
    }
  };

  // 添加自动保存并关闭抽屉的函数
  const handleDrawerClose = async () => {
    if (!currentRecord) {
      setDrawerOpen(false);
      return;
    }

    const result = await saveDrawerForm();
    
    if (result.success) {
      message.success('已自动保存');
    } else {
      message.error('保存失败: ' + result.error);
    }
    
    // 无论成功失败都关闭抽屉
    setDrawerOpen(false);
  };

  // 确认丢单处理函数
  const handleConfirmDropout = async () => {
    if (!currentRecord) return;
    
    try {
      await stageForm.validateFields();
      const result = await saveDrawerForm({ followupstage: '丢单' });
      
      if (result.success) {
        setDrawerOpen(false);
        message.success('已确认丢单');
      } else {
        message.error('确认丢单失败: ' + result.error);
      }
    } catch {
      message.error('请完整填写所有必填项');
    }
  };

  // 恢复状态处理函数
  const handleRestoreStatus = async () => {
    if (!currentRecord) return;
    
    try {
      const result = await saveDrawerForm({ followupstage: '待接收' });
      
      if (result.success) {
        setDrawerOpen(false);
        message.success('已恢复状态');
      } else {
        message.error('恢复状态失败: ' + result.error);
      }
    } catch (error) {
      message.error('恢复状态失败');
    }
  };

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
      setTotalRecords(data?.length || 0);

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
    
    setCurrentMonth(now);
    setCalendarValue(now);
    setDateRange([startOfCalendar, endOfCalendar]);
    fetchFollowupsData(startOfCalendar.format('YYYY-MM-DD'), endOfCalendar.format('YYYY-MM-DD'));
    
    // 加载枚举数据
    loadEnumWithCache('followupstage', setFollowupstageEnum);
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

  // 更新本地数据
  const updateLocalData = (id: string, field: keyof any, value: any) => {
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === id ? { ...event, [field]: value } : event
      )
    );
  };

  // 获取跟进阶段对应的颜色
  const getStageColor = (stage: string) => {
    const colorMap: Record<string, string> = {
      '丢单': '#ff4d4f', '待接收': '#bfbfbf', '确认需求': '#1677ff', '邀约到店': '#fa8c16', '已到店': '#52c41a', '赢单': '#faad14',
    };
    return colorMap[stage] || '#1677ff';
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
      console.log('📅 显示日期详情:', {
        date: dateKey,
        eventsCount: dayEvents.length
      });
    } else {
      console.log('📅 该日期无事件:', dateKey);
    }
  };



  // 处理日历面板变化
  const handlePanelChange = (value: Dayjs, mode: string) => {
    // 只处理月视图变化，忽略年视图
    if (mode === 'month') {
      console.log('🔄 日历面板变化:', {
        value: value.format('YYYY-MM-DD'),
        mode: mode,
        monthText: value.format('YYYY年MM月'),
        year: value.year(),
        monthNumber: value.month() + 1
      });
      setCalendarValue(value);
      setCurrentMonth(value);
      
      // 当月份变化时，自动更新数据范围
      // 查询范围需要覆盖整个日历视图，包括上个月末和下个月初
      const startOfCalendar = value.startOf('month').startOf('week');
      const endOfCalendar = value.endOf('month').endOf('week');
      setDateRange([startOfCalendar, endOfCalendar]);
      fetchFollowupsData(startOfCalendar.format('YYYY-MM-DD'), endOfCalendar.format('YYYY-MM-DD'));
    } else {
      console.log('⚠️ 忽略非月视图变化:', mode);
    }
  };





  return (
    <div className="followups-calendar-view">
        {/* 日历组件 */}
        <div className="calendar-container">
          <Spin spinning={loading}>
            <Calendar
              value={calendarValue}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarOutlined style={{ color: '#1890ff' }} />
            <span>{selectedDate?.format('YYYY年MM月DD日')} 的跟进记录</span>
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
        styles={{ body: { padding: '24px', maxHeight: '70vh', overflow: 'auto' } }}
      >
        {selectedEvents.length > 0 ? (
          <div className="calendar-modal-content">


            {/* 表格内容 */}
            <Table
            dataSource={selectedEvents}
              columns={[
                {
                  title: '线索编号',
                  dataIndex: 'leadid',
                  key: 'leadid',
                  width: 120,
                  fixed: 'left' as const,
                  render: (text: string) => (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, height: 'auto', fontSize: 14, color: '#1677ff', fontWeight: 500 }}
                    >
                      {text}
                    </Button>
                  )
                },
                {
                  title: '跟进阶段',
                  dataIndex: 'followupstage',
                  key: 'followupstage',
                  width: 100,
                  render: (text: string, record: any) => {
                    const item = followupstageEnum.find(i => i.value === text);
                    const color = getStageColor(item?.label || text);
                    return (
                      <Button
                        type="primary"
                        size="small"
                        style={{
                          background: color,
                          borderColor: color,
                          color: '#fff',
                          boxShadow: 'none',
                          minWidth: 60,
                          display: 'inline-block',
                          textAlign: 'center',
                          padding: '0 8px',
                          fontSize: 12,
                          zIndex: 2
                        }}
                        onClick={() => {
                          setCurrentRecord(record);
                          setDrawerOpen(true);
                          setCurrentStage(record.followupstage);
                          setCurrentStep(followupStages.indexOf(record.followupstage));
                          stageForm.setFieldsValue(convertDateFields(record));
                        }}
                      >
                        {item?.label || text}
                      </Button>
                    );
                  }
                },
                {
                  title: '客户画像',
                  dataIndex: 'customerprofile',
                  key: 'customerprofile',
                  width: 120,
                  render: (text: string) => text ? <Tag color="purple">{text}</Tag> : '-'
                },
                {
                  title: '销售',
                  dataIndex: 'interviewsales_user_name',
                  key: 'interviewsales_user_name',
                  width: 100,
                  render: (text: string) => text || '-'
                },
                {
                  title: '预约社区',
                  dataIndex: 'scheduledcommunity',
                  key: 'scheduledcommunity',
                  width: 120,
                  ellipsis: true,
                  render: (text: string) => text || '-'
                },
                {
                  title: '工作地点',
                  dataIndex: 'worklocation',
                  key: 'worklocation',
                  width: 150,
                  ellipsis: true,
                  render: (text: string) => text || '-'
                },
                {
                  title: '预算',
                  dataIndex: 'userbudget',
                  key: 'userbudget',
                  width: 100,
                  render: (text: string) => text || '-'
                },
                {
                  title: '来访意向',
                  dataIndex: 'userrating',
                  key: 'userrating',
                  width: 100,
                  render: (text: string) => text ? <Tag color="orange">{text}</Tag> : '-'
                },
                {
                  title: '跟进结果',
                  dataIndex: 'majorcategory',
                  key: 'majorcategory',
                  width: 200,
                  ellipsis: true,
                  render: (text: string) => {
                    if (!text) return '-';
                    return (
                      <Tooltip title={text}>
                        <Tag color="purple" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {text}
                      </Tag>
                      </Tooltip>
                    );
                  }
                },
                {
                  title: '跟进备注',
                  dataIndex: 'followupresult',
                  key: 'followupresult',
                  width: 200,
                  ellipsis: true,
                  render: (text: string) => {
                    if (!text) return '-';
                    return (
                      <Tooltip title={text}>
                        <div style={{ 
                          maxWidth: '180px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          color: '#666'
                        }}>
                          {text}
                        </div>
                      </Tooltip>
                    );
                  }
                },

              ]}
              size="small"
              pagination={false}
              scroll={{ x: 1100, y: 400 }}
              rowKey="id"
              style={{ backgroundColor: 'transparent' }}
              locale={{
                emptyText: '暂无跟进记录'
              }}
            />
                  </div>
        ) : (
          <Empty description="该日期没有跟进记录" />
        )}
      </Modal>

      {/* 跟进阶段抽屉 */}
      <Drawer
        title="跟进阶段进度"
        placement="bottom"
        open={drawerOpen}
        onClose={handleDrawerClose}
        destroyOnHidden
        footer={null}
        className="lead-detail-drawer"
      >
        <div className="drawer-flex-row">
          {/* 左侧线索信息 */}
          <div className="page-drawer-info">
            <div className="mb-12">
              <span className="text-secondary">线索编号：</span>
              {currentRecord?.leadid ? (
                <span style={{ color: '#1677ff', fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>{currentRecord.leadid}</span>
              ) : <span className="text-muted">-</span>}
                    </div>
            <div className="mb-12">
              <span className="text-secondary">手机号：</span>
              {currentRecord?.phone ? (
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>
                  {currentRecord.phone.substring(0, 4) + '****' + currentRecord.phone.substring(currentRecord.phone.length - 3)}
                </span>
              ) : <span className="text-muted">-</span>}
                    </div>
            <div className="mb-12">
              <span className="text-secondary">微信号：</span>
              {currentRecord?.wechat ? (
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>
                  {currentRecord.wechat.substring(0, 2) + '****' + currentRecord.wechat.substring(currentRecord.wechat.length - 2)}
                </span>
              ) : <span className="text-muted">-</span>}
                    </div>
            <div className="mb-12">
              <span className="text-secondary">渠道：</span>
              <span className="text-primary">{currentRecord?.source || '-'}</span>
                    </div>
            <div className="mb-12">
              <span className="text-secondary">创建时间：</span>
              <span>{currentRecord?.created_at ? new Date(currentRecord.created_at).toLocaleString('zh-CN') : '-'}</span>
                      </div>
                      </div>
          {/* 右侧步骤条和表单 */}
          <div className="page-drawer-form">
            <Steps
              current={currentStep}
              items={followupStages.map((stage, idx) => ({ 
                title: stage, 
                disabled: idx !== 0,
                subTitle: null,
                description: null
              }))}
              onChange={(step: number) => {
                if (step === 0) {
                  setCurrentStep(step);
                  setCurrentStage(followupStages[step]);
                  if (currentRecord) stageForm.setFieldsValue(convertDateFields(currentRecord));
                }
              }}
              style={{ marginBottom: 32 }}
              data-current={currentStep}
              size="small"
            />
            <div className="form-content">
              <Form
                form={stageForm}
                layout="vertical"
                onFinishFailed={() => message.error('请完整填写所有必填项')}
                onValuesChange={(changed) => {
                  // 保证所有时间字段始终为 dayjs 对象，且清空时为 undefined
                  const dateFields = ['moveintime', 'scheduletime'];
                  let needSet = false;
                  const patch: any = {};
                  dateFields.forEach(field => {
                    if (field in changed) {
                      const v = changed[field];
                      if (!v || v === '' || v === null) {
                        patch[field] = undefined;
                        needSet = true;
                      } else if (!dayjs.isDayjs(v)) {
                        patch[field] = dayjs(v);
                        needSet = true;
                      }
                    }
                  });
                  if (needSet) {
                    stageForm.setFieldsValue(patch);
                  }
                }}
              >
                {/* 确认需求阶段使用三栏布局 */}
                {(currentStage === '确认需求' || currentStage === '邀约到店' || currentStage === '丢单') && (
                  <div className="page-step-fields" data-stage={currentStage}>
                    {(stageFields[currentStage as keyof typeof stageFields] || []).map((field: string) => (
                      <div key={field} className="page-step-field-item">
                        <Form.Item
                          name={field}
                          label={getFieldLabel(field, currentStage)}
                          rules={[
                            {
                              required: true,
                              message: `请填写${getFieldLabel(field, currentStage)}`,
                            },
                          ]}
                        >
                          {field === 'scheduledcommunity'
                            ? <Select options={[]} placeholder="请选择社区" disabled={isFieldDisabled()} key={forceUpdate} />
                            : field === 'customerprofile'
                              ? <Select options={[]} placeholder="请选择用户画像" disabled={isFieldDisabled()} key={forceUpdate} />
                              : field === 'followupstage'
                                ? <Select options={followupstageEnum} placeholder="请选择阶段" loading={followupstageEnum.length === 0} disabled={followupstageEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                : field === 'userrating'
                                  ? <Select options={[]} placeholder="请选择来访意向" disabled={isFieldDisabled()} key={forceUpdate} />
                                  : field === 'worklocation'
                                    ? <Cascader
                                        options={[]}
                                        placeholder="请选择工作地点"
                                        showSearch
                                        changeOnSelect={false}
                                        allowClear
                                        disabled={isFieldDisabled()}
                                        key={forceUpdate}
                                      />
                                    : field === 'moveintime' || field === 'scheduletime'
                                      ? <DatePicker
                                          showTime
                                          locale={locale}
                                          style={{ width: '100%' }}
                                          placeholder="请选择时间"
                                          disabled={isFieldDisabled()}
                                          key={forceUpdate}
                                          value={(() => {
                                            const v = stageForm.getFieldValue(field);
                                            if (!v || v === '' || v === null) return undefined;
                                            if (dayjs.isDayjs(v)) return v;
                                            if (typeof v === 'string') return dayjs(v);
                                            return undefined;
                                          })()}
                                          onChange={(v: any) => {
                                            stageForm.setFieldValue(field, v || undefined);
                                          }}
                                        />
                                      : field === 'userbudget'
                                        ? <InputNumber
                                            style={{ width: '100%' }}
                                            placeholder="请输入预算金额"
                                            min={0}
                                            precision={0}
                                            disabled={isFieldDisabled()}
                                            key={forceUpdate}
                                          />
                                        : field === 'majorcategory'
                                          ? <Input placeholder="请选择跟进结果" disabled={isFieldDisabled()} key={forceUpdate} />
                                          : <Input disabled={isFieldDisabled()} key={forceUpdate} />}
                        </Form.Item>
                      </div>
                    ))}
                      </div>
                    )}
                
                {/* 其他阶段使用单栏布局 */}
                {currentStage !== '确认需求' && currentStage !== '邀约到店' && currentStage !== '丢单' && currentStage !== '已到店' && currentStage !== '赢单' && (
                  <div className="page-step-fields-single">
                    {(stageFields[currentStage as keyof typeof stageFields] || []).map((field: string) => (
                      <div key={field}>
                        <Form.Item
                          name={field}
                          label={getFieldLabel(field, currentStage)}
                          rules={[
                            {
                              required: true,
                              message: `请填写${getFieldLabel(field, currentStage)}`,
                            },
                          ]}
                        >
                          {field === 'scheduledcommunity'
                            ? <Select options={[]} placeholder="请选择社区" disabled={isFieldDisabled()} key={forceUpdate} />
                            : field === 'customerprofile'
                              ? <Select options={[]} placeholder="请选择用户画像" disabled={isFieldDisabled()} key={forceUpdate} />
                              : field === 'followupstage'
                                ? <Select options={followupstageEnum} placeholder="请选择阶段" loading={followupstageEnum.length === 0} disabled={followupstageEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                : field === 'userrating'
                                  ? <Select options={[]} placeholder="请选择来访意向" disabled={isFieldDisabled()} key={forceUpdate} />
                                  : field === 'worklocation'
                                    ? <Cascader
                                        options={[]}
                                        placeholder="请选择工作地点"
                                        showSearch
                                        changeOnSelect={false}
                                        allowClear
                                        disabled={isFieldDisabled()}
                                        key={forceUpdate}
                                      />
                                    : field === 'moveintime' || field === 'scheduletime'
                                      ? <DatePicker
                                          showTime
                                          locale={locale}
                                          style={{ width: '100%' }}
                                          placeholder="请选择时间"
                                          disabled={isFieldDisabled()}
                                          key={forceUpdate}
                                          value={(() => {
                                            const v = stageForm.getFieldValue(field);
                                            if (!v || v === '' || v === null) return undefined;
                                            if (dayjs.isDayjs(v)) return v;
                                            if (typeof v === 'string') return dayjs(v);
                                            return undefined;
                                          })()}
                                          onChange={(v: any) => {
                                            stageForm.setFieldValue(field, v || undefined);
                                          }}
                                        />
                                      : field === 'userbudget'
                                        ? <InputNumber
                                            style={{ width: '100%' }}
                                            placeholder="请输入预算金额"
                                            min={0}
                                            precision={0}
                                            disabled={isFieldDisabled()}
                                            key={forceUpdate}
                                          />
                                        : field === 'majorcategory'
                                          ? <Input placeholder="请选择跟进结果" disabled={isFieldDisabled()} key={forceUpdate} />
                                          : <Input disabled={isFieldDisabled()} key={forceUpdate} />}
                        </Form.Item>
                      </div>
                    ))}
                  </div>
                )}
              </Form>
            </div>
            
            {/* 固定底部按钮区域 */}
            <div className="drawer-footer">
              <div className="button-group">
                {/* 上一步按钮显示逻辑 */}
                {currentStage !== '丢单' && (
                  <Button
                    disabled={currentStep === 0}
                    onClick={async () => {
                      // 上一步前不再校验表单完整性，直接保存
                      if (!currentRecord) return;
                      const result = await saveDrawerForm({ followupstage: followupStages[currentStep - 1] });
                      if (result.success) {
                        setCurrentStep(currentStep - 1);
                        setCurrentStage(followupStages[currentStep - 1]);
                      } else {
                        message.error('保存失败: ' + result.error);
                      }
                    }}
                  >上一步</Button>
                )}
                
                {/* 丢单阶段的特殊按钮 */}
                {currentStage === '丢单' && (
                  <>
                    <Button
                      danger
                      onClick={handleConfirmDropout}
                      disabled={isFieldDisabled()}
                    >
                      确认丢单
                    </Button>
                    <Button
                      onClick={handleRestoreStatus}
                      disabled={isFieldDisabled()}
                    >
                      恢复状态
                    </Button>
                  </>
                )}
                
                {currentStep === followupStages.length - 1 ? (
                  <Button
                    type="primary"
                    onClick={() => {
                      message.success('跟进阶段管理完成');
                      setDrawerOpen(false);
                    }}
                  >
                    完成
                  </Button>
                ) : currentStage === '已到店' || currentStage === '丢单' ? (
                  // 已到店阶段和丢单阶段不显示下一步按钮
                  null
                ) : (
                  <Button
                    type="primary"
                    onClick={async () => {
                      // 下一步前自动保存并校验表单
                      try {
                        if (!currentRecord) return;
                        await stageForm.validateFields(); // 新增：校验表单必填项
                        const result = await saveDrawerForm({ followupstage: followupStages[currentStep + 1] });
                        if (result.success) {
                          setCurrentStep(currentStep + 1);
                          setCurrentStage(followupStages[currentStep + 1]);
                        } else {
                          message.error('保存失败: ' + result.error);
                        }
                      } catch {
                        message.error('请完整填写所有必填项');
                      }
                    }}
                  >
                    下一步
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default FollowupsCalendarView; 