import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Modal, Form, Select, message, Tooltip, Space, Progress, Badge } from 'antd';
import { UserOutlined, EnvironmentOutlined, HomeOutlined, PlusOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { LiveStreamSchedule, LiveStreamManager, LiveStreamLocation, LiveStreamPropertyType } from '../types/liveStream';
import { TIME_SLOTS, SAMPLE_MANAGERS, SAMPLE_LOCATIONS, SAMPLE_PROPERTY_TYPES } from '../types/liveStream';
import { getLiveStreamManagers, getLiveStreamLocations, getLiveStreamPropertyTypes, createLiveStreamSchedule, updateLiveStreamSchedule, getWeeklySchedule } from '../api/liveStreamApi';
import { fetchBannersByPageType } from '../api/bannersApi';
import { useAchievements } from '../hooks/useAchievements';
import { supabase } from '../supaClient';
const { Option } = Select;

const LiveStreamRegistration: React.FC = () => {
  const [currentView] = useState<'registration' | 'management'>('registration');
  const [schedules, setSchedules] = useState<LiveStreamSchedule[]>([]);
  const [managers, setManagers] = useState<LiveStreamManager[]>([]);
  const [locations, setLocations] = useState<LiveStreamLocation[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<LiveStreamPropertyType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LiveStreamSchedule | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(dayjs());
  const [form] = Form.useForm();
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  // 头像相关状态
  const [userAvatars, setUserAvatars] = useState<{ [key: number]: string }>({});
  const [avatarFrames, setAvatarFrames] = useState<{ [key: number]: string }>({});

  // 成就系统 - 获取头像框
  const { getEquippedAvatarFrame } = useAchievements();
  const equippedFrame = getEquippedAvatarFrame();
  const frameUrl = (equippedFrame && (equippedFrame as any).icon_url) || equippedFrame?.frame_data?.icon_url;

  // 获取用户头像的函数
  const fetchUserAvatars = async (userIds: number[]) => {
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('id, avatar_url')
        .in('id', userIds);

      if (error) throw error;

      const avatarMap: { [key: number]: string } = {};
      (data || []).forEach(user => {
        if (user.avatar_url) {
          avatarMap[user.id] = user.avatar_url;
        }
      });

      setUserAvatars(prev => ({ ...prev, ...avatarMap }));
    } catch (error) {
      console.error('获取用户头像失败:', error);
    }
  };

  // 获取用户头像框的函数
  const fetchUserAvatarFrames = async (userIds: number[]) => {
    try {
      console.log('开始获取用户头像框，用户ID:', userIds);
      const frameMap: { [key: number]: string } = {};
      
      // 为每个用户获取装备的头像框
      for (const userId of userIds) {
        try {
          const { data: avatarFrames, error } = await supabase
            .from('user_avatar_frames')
            .select(`
              avatar_frames (
                id,
                name,
                icon_url,
                frame_data
              )
            `)
            .eq('user_id', userId)
            .eq('is_equipped', true)
            .single();

          console.log(`用户 ${userId} 头像框查询结果:`, { data: avatarFrames, error });

          if (!error && avatarFrames?.avatar_frames) {
            const frame = avatarFrames.avatar_frames as any;
            const frameUrl = frame.icon_url || (frame.frame_data?.icon_url);
            console.log(`用户 ${userId} 头像框URL:`, frameUrl);
            if (frameUrl) {
              frameMap[userId] = frameUrl;
            }
          }
        } catch (error) {
          console.error(`获取用户 ${userId} 头像框失败:`, error);
        }
      }

      console.log('最终头像框映射:', frameMap);
      setAvatarFrames(prev => ({ ...prev, ...frameMap }));
    } catch (error) {
      console.error('获取用户头像框失败:', error);
    }
  };

  // 随机颜色数组
  const cardColors = [
    { bg: '#e6f7ff', text: '#1890ff' }, // 浅蓝
    { bg: '#f6ffed', text: '#52c41a' }, // 浅绿
    { bg: '#fff7e6', text: '#fa8c16' }, // 浅黄
    { bg: '#fff1f0', text: '#f5222d' }, // 浅红
    { bg: '#f9f0ff', text: '#722ed1' }, // 浅紫
    { bg: '#e6fffb', text: '#13c2c2' }, // 浅青
  ];

  // 根据卡片ID获取固定颜色的函数
  const getCardColor = (cardId: string) => {
    const hash = cardId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return cardColors[Math.abs(hash) % cardColors.length];
  };

  // 计算周数的函数
  const getWeekNumber = (date: Dayjs) => {
    const startOfYear = date.startOf('year');
    const diff = date.diff(startOfYear, 'day');
    return Math.ceil((diff + startOfYear.day()) / 7);
  };

  // 加载数据
  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  // 加载banner数据
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const data = await fetchBannersByPageType('live_stream_registration');
        setBanners(data);
      } catch (error) {
        console.error('加载banner失败:', error);
      }
    };
    loadBanners();
  }, []);

  // Banner自动轮播
  useEffect(() => {
    if (banners.length > 1) {
      const timer = setTimeout(() => {
        setBannerIndex((prev) => (prev + 1) % banners.length);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [bannerIndex, banners.length]);

  const loadData = async () => {
    try {
      setLoading(true);
      const weekStart = selectedWeek.startOf('week').format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').format('YYYY-MM-DD');
      
      const [managersData, locationsData, propertyTypesData, schedulesData] = await Promise.all([
        getLiveStreamManagers(),
        getLiveStreamLocations(),
        getLiveStreamPropertyTypes(),
        getWeeklySchedule(weekStart, weekEnd)
      ]);

      setManagers(managersData);
      setLocations(locationsData);
      setPropertyTypes(propertyTypesData);
      setSchedules(schedulesData);

      // 获取所有参与者的头像 - 从managers中提取ID
      const participantIds = new Set<number>();
      schedulesData.forEach(schedule => {
        schedule.managers.forEach(manager => {
          const managerId = parseInt(manager.id);
          if (!isNaN(managerId)) {
            participantIds.add(managerId);
          }
        });
      });

      if (participantIds.size > 0) {
        await Promise.all([
          fetchUserAvatars(Array.from(participantIds)),
          fetchUserAvatarFrames(Array.from(participantIds))
        ]);
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取本周的日期列表
  const getWeekDates = () => {
    const dates = [];
    const weekStart = selectedWeek.startOf('week');
    
    for (let i = 0; i < 7; i++) {
      const date = weekStart.add(i, 'day');
      dates.push({
        date: date.format('YYYY-MM-DD'),
        day: date.format('MM-DD'),
        weekday: date.format('ddd'),
        isToday: date.isSame(dayjs(), 'day')
      });
    }
    
    return dates;
  };

  // 获取指定日期和时间段的安排
  const getSchedule = (date: string, timeSlotId: string) => {
    return schedules.find(s => s.date === date && s.timeSlotId === timeSlotId);
  };

  // 计算统计数据
  const getStatistics = () => {
    const totalSlots = TIME_SLOTS.length * 7;
    const filledSlots = schedules.length;
    const availableSlots = totalSlots - filledSlots;
    const completionRate = Math.round((filledSlots / totalSlots) * 100);
    
    return {
      totalSlots,
      filledSlots,
      availableSlots,
      completionRate
    };
  };

  // 处理创建/编辑安排
  const handleScheduleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const scheduleData = {
        date: editingSchedule ? editingSchedule.date : dayjs().format('YYYY-MM-DD'),
        timeSlotId: values.timeSlot,
        managers: managers.filter(m => values.managers.includes(m.id)),
        location: locations.find(l => l.id === values.location)!,
        propertyType: propertyTypes.find(p => p.id === values.propertyType)!,
        status: 'available' as const, // 默认状态
      };

      if (editingSchedule) {
        await updateLiveStreamSchedule(editingSchedule.id, scheduleData);
        message.success('安排更新成功');
      } else {
        await createLiveStreamSchedule(scheduleData);
        message.success('安排创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingSchedule(null);
      loadData(); // 重新加载数据
    } catch (error) {
      message.error('操作失败');
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理编辑安排
  const handleEditSchedule = (schedule: LiveStreamSchedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      timeSlot: schedule.timeSlotId,
      managers: schedule.managers.map(m => m.id),
      location: schedule.location.id,
      propertyType: schedule.propertyType.id,
    });
    setModalVisible(true);
  };

  // 渲染Banner组件
  const renderBanner = () => {
    if (banners.length === 0) return null;

    const currentBanner = banners[bannerIndex];
    
    return (
      <div style={{
        width: '100%',
        aspectRatio: '9.6/1', // 1920x200的比例
        position: 'relative',
        background: '#364d79',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(52,107,255,0.08)',
        marginBottom: 16,
      }}>
        <img
          src={currentBanner.image_url}
          alt={currentBanner.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 10,
            background: '#222',
            cursor: currentBanner.jump_type && currentBanner.jump_type !== 'none' ? 'pointer' : 'default',
            display: 'block',
          }}
          onClick={() => handleBannerClick(currentBanner)}
        />
        {/* 指示器 */}
        {banners.length > 1 && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8, // 调整指示器位置，适应更小的banner高度
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
          }}>
            {banners.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setBannerIndex(idx)}
                style={{
                  display: 'inline-block',
                  width: 24, // 调整指示器大小
                  height: 4,
                  borderRadius: 2,
                  background: idx === bannerIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Banner点击处理
  const handleBannerClick = (banner: any) => {
    if (!banner.jump_type || banner.jump_type === 'none') return;
    if (banner.jump_type === 'url' && banner.jump_target) {
      window.open(banner.jump_target, '_blank');
    } else if (banner.jump_type === 'route' && banner.jump_target) {
      // 这里可以添加路由跳转逻辑
      console.log('路由跳转:', banner.jump_target);
    } else if (banner.jump_type === 'iframe' && banner.jump_target) {
      // 这里可以添加iframe弹窗逻辑
      console.log('iframe弹窗:', banner.jump_target);
    }
  };

  // 渲染时间段表格
  const renderScheduleTable = () => {
    const weekDates = getWeekDates();
    
    const columns = [
      {
        title: (
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            <span>时间段</span>
          </div>
        ),
        dataIndex: 'timeSlot',
        key: 'timeSlot',
        width: 100,
        fixed: 'left' as const,
        render: (timeSlot: any, _record: any, index: number) => {
          // 根据行索引计算对应的日期
          const weekStart = selectedWeek.startOf('week');
          const currentDate = weekStart.add(index, 'day');
          
          return (
            <div style={{ fontSize: '14px', lineHeight: '1.2' }}>
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                {currentDate.format('MM-DD')}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                {timeSlot.startTime}-{timeSlot.endTime}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                {timeSlot.period === 'morning' ? '上午' : 
                 timeSlot.period === 'afternoon' ? '下午' : '晚上'}
              </div>
            </div>
          );
        }
      },
      ...weekDates.map(dateInfo => ({
        title: (
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            <div>
              {dateInfo.day}
            </div>
            <div style={{ color: '#999', fontWeight: 'normal' }}>
              {dateInfo.weekday}
            </div>

          </div>
        ),
        dataIndex: dateInfo.date,
        key: dateInfo.date,
        width: 170,
        render: (schedule: LiveStreamSchedule | undefined, record: any) => {
          if (!schedule) {
                      return (
            <div
              onClick={() => {
                form.setFieldsValue({
                  timeSlot: record.timeSlot.id
                });
                setEditingSchedule(null);
                setModalVisible(true);
              }}
              style={{
                background: 'white',
                border: '1px solid #1890ff',
                borderRadius: '8px',
                margin: '2px',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100px',
                width: '160px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ 
                fontSize: '13px', 
                color: '#1890ff', 
                fontWeight: '600', 
                textAlign: 'center', 
                lineHeight: '1.2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <PlusOutlined style={{ color: '#1890ff' }} />
                立即报名
              </div>
            </div>
          );
          }

          return (
            <Tooltip
              title={
                <div>
                  <div><strong>直播管家:</strong> {schedule.managers.map(m => m.name).join(', ')}</div>
                  <div><strong>地点:</strong> {schedule.location.name}</div>
                  <div><strong>户型:</strong> {schedule.propertyType.name}</div>

                </div>
              }
              placement="top"
            >
              <div 
                onClick={() => handleEditSchedule(schedule)}
                style={{
                  background: 'white',
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  margin: '2px',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  height: '100px',
                  width: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* 上半部分容器 - 人名区域 */}
                <div style={{
                  background: getCardColor(schedule.id).bg,
                  padding: '2px 2px', // 增加内边距
                  margin: '0',
                  borderBottom: '1px solid #e8e8e8',
                  width: '100%',
                  minHeight: '48px', // 增加最小高度
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1px', // 减少间距
                  overflow: 'hidden',
                  boxSizing: 'border-box' // 确保内边距计算正确
                }}>
                  {/* 头像组 */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '2px', // 增加间距
                    flexShrink: 0,
                    width: 'auto',
                    marginLeft: '2px', // 调整为4px
                    marginRight: '2px' // 减少右边距
                  }}>
                    {schedule.managers.slice(0, 2).map((manager, index) => {
                      const managerId = parseInt(manager.id);
                      const avatarUrl = userAvatars[managerId];
                      const frameUrl = avatarFrames[managerId];
                      
                      console.log(`渲染头像 - 用户ID: ${managerId}, 头像URL: ${avatarUrl}, 头像框URL: ${frameUrl}`);
                      
                      return (
                        <div
                          key={manager.id}
                          style={{
                            width: '28px', // 放大头像尺寸
                            height: '28px', // 放大头像尺寸
                            borderRadius: '50%',
                            background: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            border: '1px solid #e8e8e8',
                            zIndex: 1,
                            transform: index === 1 ? 'translateX(-6px)' : 'translateX(0)' // 调整重叠距离
                          }}
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={manager.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                background: '#fff',
                                zIndex: 1,
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span style={{ 
                              fontSize: '12px', // 放大字体
                              color: '#999',
                              fontWeight: '500',
                              zIndex: 1,
                            }}>
                              {manager.name.charAt(0)}
                            </span>
                          )}
                          {/* 头像框 - 参考App.tsx的比例关系 */}
                          {frameUrl && (
                            <img
                              src={frameUrl}
                              alt="头像框"
                              style={{
                                width: '56px', // 头像框是头像的2倍大小 (28px * 2)
                                height: '56px', // 头像框是头像的2倍大小 (28px * 2)
                                borderRadius: '50%',
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 2,
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 人名文本 - 填满剩余空间 */}
                  <div 
                    style={{ 
                      fontSize: '12px', 
                      color: getCardColor(schedule.id).text, 
                      fontWeight: '500', 
                      lineHeight: '1.2',
                      flex: 1,
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      width: '100%',
                      display: 'block',
                      maxWidth: 'none'
                    }}
                    title={schedule.managers.map(m => m.name).join(' / ')}
                  >
                    {schedule.managers.map(m => m.name).join(' / ')}
                  </div>
                </div>
                
                {/* 下半部分容器 - 其他信息 */}
                <div style={{ 
                  padding: '8px 8px', 
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {schedule.location.name}
                    </span>
                  </div>
                  <div>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {schedule.propertyType.name}
                    </span>
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        }
      }))
    ];

    const dataSource = TIME_SLOTS.map(timeSlot => {
      const row: any = { timeSlot, key: timeSlot.id };
      weekDates.forEach(dateInfo => {
        row[dateInfo.date] = getSchedule(dateInfo.date, timeSlot.id);
      });
      return row;
    });

    return (
      <div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="small"
          loading={loading}
          style={{
            '--ant-table-row-hover-bg': 'transparent',
            '--ant-table-row-hover-transform': 'none',
            borderRadius: '8px',
            overflow: 'hidden'
          } as React.CSSProperties}
          rowClassName={() => 'compact-row'}
        />
      </div>
    );
  };

  return (
    <div>
      <style>
        {`
          .ant-table-tbody > tr:hover > td {
            transform: none !important;
            scale: none !important;
            box-shadow: none !important;
          }
          .ant-table-tbody > tr:hover {
            transform: none !important;
            scale: none !important;
            box-shadow: none !important;
          }
          .ant-table-tbody > tr > td {
            transform: none !important;
            scale: none !important;
            box-shadow: none !important;
            padding: 4px 8px !important;
          }
          .ant-table-tbody > tr {
            box-shadow: none !important;
          }
          .compact-row {
            height: auto !important;
          }
          .compact-row td {
            padding: 4px 8px !important;
            vertical-align: top !important;
          }
        `}
      </style>
      {currentView === 'registration' ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                直播报名表 W{getWeekNumber(selectedWeek)}
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button 
                  onClick={() => setSelectedWeek(selectedWeek.subtract(1, 'week'))}
                >
                  上一周
                </Button>
                <Button 
                  onClick={() => setSelectedWeek(dayjs())}
                >
                  本周
                </Button>
                <Button 
                  onClick={() => setSelectedWeek(selectedWeek.add(1, 'week'))}
                >
                  下一周
                </Button>
              </div>
            </div>
            
            {/* Banner显示区域 */}
            {renderBanner()}
            
            {renderScheduleTable()}
          </div>
        </>
      ) : (
        <div>直播管理功能（待实现）</div>
      )}

      {/* 创建/编辑安排弹窗 */}
      <Modal
        title={editingSchedule ? '编辑直播安排' : '立即报名'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingSchedule(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleScheduleSubmit}
        >
          <Form.Item
            label="时间段"
            name="timeSlot"
            rules={[{ required: true, message: '请选择时间段' }]}
          >
            <Select 
              placeholder="选择时间段"
              disabled={true}
              style={{ backgroundColor: '#f5f5f5' }}
            >
              {TIME_SLOTS.map(slot => (
                <Option key={slot.id} value={slot.id}>
                  {slot.startTime}-{slot.endTime} ({slot.period === 'morning' ? '上午' : slot.period === 'afternoon' ? '下午' : '晚上'})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="直播管家"
            name="managers"
            rules={[
              { required: true, message: '请选择直播管家' },
              { 
                validator: (_, value) => {
                  if (!value || value.length !== 2) {
                    return Promise.reject(new Error('请选择2名直播管家'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择2名直播管家"
              maxTagCount={2}
              showSearch
              filterOption={(input, option) => {
                const optionText = option?.label || option?.children;
                return String(optionText || '').toLowerCase().includes(input.toLowerCase());
              }}
              style={{ width: '100%' }}
              dropdownStyle={{ maxWidth: '400px' }}
              tagRender={(props) => {
                const { label, closable, onClose } = props;
                return (
                  <Tag
                    closable={closable}
                    onClose={onClose}
                    style={{ 
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </Tag>
                );
              }}
            >
              {managers.map(manager => (
                <Option key={manager.id} value={manager.id}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    width: '100%',
                    minWidth: 0
                  }}>
                    <UserOutlined style={{ flexShrink: 0 }} />
                    <span style={{ 
                      flex: 1, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      minWidth: 0
                    }}>
                      {manager.name}
                    </span>
                    {manager.department && (
                      <Tag 
                        color="blue" 
                        style={{ 
                          flexShrink: 0,
                          maxWidth: '80px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {manager.department}
                      </Tag>
                    )}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="直播地点"
            name="location"
            rules={[{ required: true, message: '请选择直播地点' }]}
          >
            <Select
              placeholder="请选择直播地点"
              showSearch
              filterOption={(input, option) => {
                const optionText = option?.label || option?.children;
                return String(optionText || '').toLowerCase().includes(input.toLowerCase());
              }}
            >
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  <Space>
                    <EnvironmentOutlined />
                    {location.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="直播户型"
            name="propertyType"
            rules={[{ required: true, message: '请选择直播户型' }]}
          >
            <Select
              placeholder="请选择直播户型"
              showSearch
              filterOption={(input, option) => {
                const optionText = option?.label || option?.children;
                return String(optionText || '').toLowerCase().includes(input.toLowerCase());
              }}
            >
              {propertyTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  <Space>
                    <HomeOutlined />
                    {type.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                {editingSchedule ? '更新' : '创建'}
              </Button>
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  setEditingSchedule(null);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveStreamRegistration;