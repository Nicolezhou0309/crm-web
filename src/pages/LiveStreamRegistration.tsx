import React, { useState, useEffect } from 'react';
import { Button, Table, Tag, Modal, Form, Select, message, Tooltip, Space } from 'antd';
import { UserOutlined, EnvironmentOutlined, HomeOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { LiveStreamSchedule, LiveStreamManager, LiveStreamLocation, LiveStreamPropertyType } from '../types/liveStream';
import { TIME_SLOTS } from '../types/liveStream';
import { getLiveStreamManagers, getLiveStreamLocations, getLiveStreamPropertyTypes, createLiveStreamSchedule, updateLiveStreamSchedule, getWeeklySchedule } from '../api/liveStreamApi';
import { fetchBannersByPageType } from '../api/bannersApi';
import { supabase } from '../supaClient';
import { useRealtimeConcurrencyControl } from '../hooks/useRealtimeConcurrencyControl';
const { Option } = Select;

// 编辑倒计时组件
const EditCountdown: React.FC<{ scheduleId: string }> = ({ scheduleId }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const { getEditLockInfo } = useRealtimeConcurrencyControl();

  useEffect(() => {
    const updateTimeLeft = () => {
      const lockInfo = getEditLockInfo(scheduleId);
      if (lockInfo && lockInfo.editing_expires_at) {
        const expiresAt = new Date(lockInfo.editing_expires_at);
        const now = new Date();
        const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        setTimeLeft(remaining);
      }
    };

    // 立即更新一次
    updateTimeLeft();

    // 每秒更新一次
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [scheduleId, getEditLockInfo]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 即使时间到了也继续显示倒计时，直到真正释放
  if (timeLeft <= 0) {
    return <span>即将释放</span>;
  }
  
  return <span>距离释放还有 {formatTime(timeLeft)}</span>;
};

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

  // 确认弹窗状态
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState('');
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalCallback, setConfirmModalCallback] = useState<(() => void) | null>(null);


  // 使用realtime并发控制
  const { 
    acquireEditLock, 
    releaseEditLock, 
    isBeingEdited, 
    isLocked,
    isBeingEditedByCurrentUser,
    isConnected,
    checkUserRegisterLimit
  } = useRealtimeConcurrencyControl();

  // 获取用户头像的函数
  const fetchUserAvatars = async (userIds: number[]) => {
    try {
      // 过滤掉临时用户ID（ID为0的用户）
      const validUserIds = userIds.filter(id => id > 0);
      
      if (validUserIds.length === 0) {
        console.log('没有有效的用户ID需要查询头像');
        return;
      }
      
      const { data, error } = await supabase
        .from('users_profile')
        .select('id, avatar_url')
        .in('id', validUserIds);

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
      const frameMap: { [key: number]: string } = {};
      
      // 过滤掉临时用户ID（ID为0的用户）
      const validUserIds = userIds.filter(id => id > 0);
      
      if (validUserIds.length === 0) {
        return;
      }
      
      // 使用批量查询，避免单个查询的406错误
      try {
        const { data: userFrames, error: userError } = await supabase
          .from('user_avatar_frames')
          .select('user_id, frame_id')
          .in('user_id', validUserIds)
          .eq('is_equipped', true);

        if (userError) {
          return;
        }

        if (!userFrames || userFrames.length === 0) {
          return;
        }

        // 获取所有相关的头像框ID
        const frameIds = userFrames.map(uf => uf.frame_id);
        
        // 批量查询头像框详情
        const { data: frameData, error: frameError } = await supabase
          .from('avatar_frames')
          .select('id, name, icon_url, frame_data')
          .in('id', frameIds);

        if (frameError) {
          console.error('批量查询头像框详情失败:', frameError);
          return;
        }

        // 创建头像框ID到详情的映射
        const frameMapById = new Map();
        frameData?.forEach(frame => {
          frameMapById.set(frame.id, frame);
        });

        // 为用户分配头像框URL
        userFrames.forEach(userFrame => {
          const frame = frameMapById.get(userFrame.frame_id);
          if (frame) {
            const frameUrl = frame.icon_url || (frame.frame_data?.icon_url);
            if (frameUrl) {
              frameMap[userFrame.user_id] = frameUrl;
            }
          }
        });

      } catch (error) {
      }

      setAvatarFrames(prev => ({ ...prev, ...frameMap }));
    } catch (error) {
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



  // 处理创建/编辑安排
  const handleScheduleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 验证管家数量
      if (!values.managers || values.managers.length !== 2) {
        message.error('请选择2名直播管家');
        return;
      }
      
      const scheduleData = {
        date: editingSchedule ? editingSchedule.date : dayjs().format('YYYY-MM-DD'),
        timeSlotId: values.timeSlot,
        managers: managers.filter(m => values.managers.includes(m.id)),
        location: locations.find(l => l.id === values.location)!,
        propertyType: propertyTypes.find(p => p.id === values.propertyType)!,
        status: 'booked' as const, // 报名成功后状态变为booked
      };

      if (editingSchedule) {
        // 检查是否是临时记录（用于创建新安排）
        const isTempSchedule = editingSchedule.managers.length === 0 && 
                              editingSchedule.location.name === '' && 
                              editingSchedule.propertyType.name === '';
        
        if (isTempSchedule) {
          // 更新临时记录为真实数据
          await updateLiveStreamSchedule(editingSchedule.id, scheduleData);
          message.success('报名成功');
        } else {
          // 更新现有记录
          await updateLiveStreamSchedule(editingSchedule.id, scheduleData);
          message.success('报名更新成功');
        }
        
        // 释放编辑锁定
        await releaseEditLock(editingSchedule.id);
        
        // 关闭弹窗并清理状态
        setModalVisible(false);
        setEditingSchedule(null);
        form.resetFields();
        loadData(); // 重新加载数据
      } else {
        // 这种情况不应该发生，因为创建新安排时都会设置editingSchedule
        message.error('编辑状态异常');
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
  const handleEditSchedule = async (schedule: LiveStreamSchedule) => {
    try {
      // 验证可编辑状态
      if (isLocked(schedule.id)) {
        message.warning('该时间段已被锁定，无法编辑');
        return;
      }

      if (isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id)) {
        message.warning('该时间段正在被其他用户编辑');
        return;
      }

      // 检查booked状态的权限
      if (schedule.status === 'booked') {
        // 获取当前用户信息
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          message.error('用户未登录');
          return;
        }

        // 获取当前用户的profile ID
        const { data: userProfile } = await supabase
          .from('users_profile')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!userProfile) {
          message.error('用户信息不完整');
          return;
        }

        // 检查是否是记录创建者或报名人
        const isCreator = schedule.createdBy === userProfile.id;
        const isParticipant = schedule.managers.some(m => parseInt(m.id) === userProfile.id);
        
        if (!isCreator && !isParticipant) {
          message.warning('只有记录创建者或报名人可以编辑已报名的记录');
          return;
        }
      }

      // 尝试获取编辑锁定
      const lockResult = await acquireEditLock(schedule.id);
      
      if (!lockResult.success) {
        message.warning(lockResult.error);
        return;
      }

      // 立即设置编辑状态，不等待弹窗打开
      setEditingSchedule(schedule);
      form.setFieldsValue({
        timeSlot: schedule.timeSlotId,
        managers: schedule.managers.length > 0 ? schedule.managers.map(m => m.id) : [],
        location: schedule.location.id || undefined,
        propertyType: schedule.propertyType.id || undefined,
      });
      
      // 显示成功消息
      message.success('已进入编辑状态，请完成编辑');
      
      // 延迟打开弹窗，让用户看到编辑状态变化
      setTimeout(() => {
        setModalVisible(true);
      }, 500);
      
    } catch (error) {
      message.error('获取编辑权限失败');
    }
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
    } else if (banner.jump_type === 'iframe' && banner.jump_target) {
      // 这里可以添加iframe弹窗逻辑
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
          return (
            <div style={{ fontSize: '14px', lineHeight: '1.2' }}>
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>
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
          // 检查是否可以编辑：无记录、状态为available、或状态为空
          const canEdit = !schedule || schedule.status === 'available' || !schedule.status;
          
          if (canEdit) {
            return (
            <div
              onClick={async () => {
                // 检查是否被锁定
                if (isLocked(record.timeSlot.id)) {
                  message.warning('该时间段已被锁定，无法报名');
                  return;
                }

                // 检查用户报名限制
                const limitCheck = await checkUserRegisterLimit();
                if (!limitCheck.success) {
                  message.error(limitCheck.error);
                  return;
                }

                // 如果有现有schedule，直接编辑；否则创建临时记录
                if (schedule) {
                  // 直接编辑现有记录
                  handleEditSchedule(schedule);
                } else {
                  // 创建临时记录以获取锁定
                  try {
                    // 获取正确的日期（从列信息中获取）
                    const tempScheduleData = {
                      date: dateInfo.date, // 使用列对应的日期
                      timeSlotId: record.timeSlot.id,
                      managers: [], // 设置为空数组，表示未选择人员
                      location: { id: '', name: '' }, // 设置为空，表示未选择位置
                      propertyType: { id: '', name: '' }, // 设置为空，表示未选择户型
                      status: 'available' as const,
                    };

                    console.log('创建临时记录:', tempScheduleData);

                    const tempSchedule = await createLiveStreamSchedule(tempScheduleData);
                    
                    console.log('临时记录创建成功:', tempSchedule);
                    
                    // 尝试获取编辑锁定（使用临时记录的ID）
                    const lockResult = await acquireEditLock(tempSchedule.id);
                    if (!lockResult.success) {
                      message.warning(lockResult.error);
                      // 如果获取锁定失败，删除临时记录
                      try {
                        await supabase
                          .from('live_stream_schedules')
                          .delete()
                          .eq('id', tempSchedule.id);
                      } catch (deleteError) {
                        console.error('删除临时记录失败:', deleteError);
                      }
                      return;
                    }

                    form.setFieldsValue({
                      timeSlot: record.timeSlot.id
                    });
                    setEditingSchedule(tempSchedule);
                    setModalVisible(true);
                  } catch (error) {
                    console.error('创建临时记录失败:', error);
                    message.error('创建临时记录失败');
                  }
                }
              }}
              style={{
                background: 'white',
                border: '1px solid #1890ff',
                borderRadius: '8px',
                margin: '2px',
                boxShadow: 'none',
                cursor: isLocked(record.timeSlot.id) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                height: '100px',
                width: '160px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                opacity: isLocked(record.timeSlot.id) ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLocked(record.timeSlot.id)) {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLocked(record.timeSlot.id)) {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
                          >
                {/* 锁定指示器 */}
                {isLocked(record.timeSlot.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#ff4d4f',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    zIndex: 10
                  }}>
                    🔒 已锁定
                  </div>
                )}

                {/* 上半部分容器 - 人名区域 */}
                <div style={{
                  background: '#ffffff', // 改为白色底色
                  padding: '2px 2px',
                  margin: '0',
                  borderBottom: '1px solid #1890ff', // 立即报名卡片使用蓝色分割线
                  width: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1px',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}>
                  {/* Icon + 立即报名 - 居中显示 */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    flex: 1,
                    width: '100%'
                  }}>
                    <PlusOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#1890ff', // 改为蓝色文字
                      fontWeight: '600',
                      lineHeight: '1.2'
                    }}>
                      立即报名
                    </span>
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
                      {/* 如果有schedule数据，显示地点，否则不显示 */}
                      {schedule?.location?.name || ''}
                    </span>
                  </div>
                  <div>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      lineHeight: '1.2',
                      display: 'block'
                    }}>
                      {/* 如果有schedule数据且户型不为空，显示户型，否则不显示 */}
                      {schedule?.propertyType?.name && schedule.propertyType.name !== '' ? schedule.propertyType.name : ''}
                    </span>
                  </div>
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
                  {schedule.propertyType.name && schedule.propertyType.name !== '' && (
                    <div><strong>户型:</strong> {schedule.propertyType.name}</div>
                  )}
                </div>
              }
              placement="top"
            >
              <div 
                onClick={() => {
                  // 如果当前用户正在编辑这个卡片，直接打开弹窗
                  if (isBeingEditedByCurrentUser(schedule.id)) {
                    setModalVisible(true);
                    return;
                  }
                  
                  // 否则尝试获取编辑锁定
                  handleEditSchedule(schedule);
                }}
                style={{
                  background: isBeingEditedByCurrentUser(schedule.id) ? '#f6ffed' : 'white',
                  border: isBeingEditedByCurrentUser(schedule.id) ? '2px solid #52c41a' : 
                          isBeingEdited(schedule.id) ? '2px solid #faad14' : 
                          (schedule.status === 'available' || !schedule.status) ? '2px solid #1890ff' : '1px solid #e8e8e8',
                  borderRadius: '8px',
                  margin: '2px',
                  boxShadow: isBeingEditedByCurrentUser(schedule.id) ? '0 0 8px rgba(82, 196, 26, 0.3)' : 'none',
                  cursor: (isLocked(schedule.id) || (isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id))) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  height: '100px',
                  width: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  opacity: (isLocked(schedule.id) || (isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id))) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLocked(schedule.id) && !(isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id))) {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLocked(schedule.id) && !(isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id))) {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {/* 连接状态指示器 */}
                {!isConnected && (
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    background: '#ff4d4f',
                    color: 'white',
                    fontSize: '8px',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    zIndex: 10
                  }}>
                    ⚠️ 离线
                  </div>
                )}

                {/* 锁定指示器 */}
                {isLocked(schedule.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#ff4d4f',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    zIndex: 10
                  }}>
                    🔒 已锁定
                  </div>
                )}

                {/* 编辑中指示器 */}
                {isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id) && !isLocked(schedule.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#faad14',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    ✏️ 编辑中
                  </div>
                )}

                {/* 其他用户编辑中倒计时指示器 */}
                {isBeingEdited(schedule.id) && !isBeingEditedByCurrentUser(schedule.id) && !isLocked(schedule.id) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    right: '4px',
                    background: 'rgba(250, 173, 20, 0.9)',
                    color: 'white',
                    fontSize: '8px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    zIndex: 10,
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    <EditCountdown scheduleId={schedule.id} />
                  </div>
                )}

                {/* 当前用户编辑中指示器 */}
                {isBeingEditedByCurrentUser(schedule.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#52c41a',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    ✏️ 编辑中...
                  </div>
                )}

                {/* 当前用户编辑倒计时指示器 */}
                {isBeingEditedByCurrentUser(schedule.id) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    right: '4px',
                    background: 'rgba(82, 196, 26, 0.9)',
                    color: 'white',
                    fontSize: '8px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    zIndex: 10,
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    <EditCountdown scheduleId={schedule.id} />
                  </div>
                )}
                {/* 上半部分容器 - 人名区域 */}
                <div style={{
                  background: (schedule.status === 'available' || !schedule.status) ? '#ffffff' : getCardColor(schedule.id).bg, // 改为白色底色
                  padding: '2px 2px', // 增加内边距
                  margin: '0',
                  borderBottom: (schedule.status === 'available' || !schedule.status) ? '1px solid #1890ff' : '1px solid #e8e8e8', // 立即报名状态使用蓝色分割线，其他状态使用灰色
                  width: '100%',
                  minHeight: '48px', // 增加最小高度
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1px', // 减少间距
                  overflow: 'hidden',
                  boxSizing: 'border-box' // 确保内边距计算正确
                }}>
                  {/* Icon + 立即报名 或 头像组 */}
                  {(schedule.status === 'available' || !schedule.status) ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      flex: 1,
                      width: '100%'
                    }}>
                      <PlusOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#1890ff', // 改为蓝色文字
                        fontWeight: '600',
                        lineHeight: '1.2'
                      }}>
                        立即报名
                      </span>
                    </div>
                  ) : (
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
                  )}
                  
                  {/* 人名文本 - 填满剩余空间 */}
                  {(schedule.status === 'available' || !schedule.status) ? null : (
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
                  )}
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
                      {schedule.propertyType.name && schedule.propertyType.name !== '' ? schedule.propertyType.name : ''}
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

  // 确认弹窗处理函数
  const showConfirmModal = (title: string, content: string, callback: () => void) => {
    console.log('showConfirmModal被调用:', { title, content }); // 添加调试日志
    setConfirmModalTitle(title);
    setConfirmModalContent(content);
    setConfirmModalCallback(() => callback);
    setConfirmModalVisible(true);
    console.log('确认弹窗状态已设置为显示'); // 添加调试日志
  };

  const handleConfirmModalOk = () => {
    if (confirmModalCallback) {
      confirmModalCallback();
    }
    setConfirmModalVisible(false);
    setConfirmModalCallback(null);
  };

  const handleConfirmModalCancel = () => {
    setConfirmModalVisible(false);
    setConfirmModalCallback(null);
  };

  return (
    <div>
      {/* 连接状态显示 */}
      <div style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        background: isConnected ? '#52c41a' : '#ff4d4f',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {isConnected ? '🟢 实时同步' : '🔴 离线模式'}
      </div>

      {/* 编辑状态指示器 */}
      {editingSchedule && (
        <div style={{
          position: 'fixed',
          top: '120px',
          right: '20px',
          background: '#52c41a',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(82, 196, 26, 0.3)'
        }}>
          <span>✏️ 正在编辑</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>
            {editingSchedule.date} {editingSchedule.timeSlotId}
          </span>
          <EditCountdown scheduleId={editingSchedule.id} />
        </div>
      )}

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
        title={editingSchedule ? 
          (editingSchedule.managers.length === 0 && 
           editingSchedule.location.name === '' && 
           editingSchedule.propertyType.name === '') ? 
          '立即报名' : '编辑直播安排' : '立即报名'}
        open={modalVisible}
        maskClosable={false}
        onCancel={async () => {
          console.log('Modal被关闭（X按钮或点击外部）'); // 添加调试日志
          
          // 检查表单是否有未保存的更改
          const formValues = form.getFieldsValue();
          console.log('表单值:', formValues); // 添加调试日志
          
          const hasUnsavedChanges = (formValues.managers && formValues.managers.length > 0) ||
                                   formValues.location ||
                                   formValues.propertyType;
          
          console.log('是否有未保存更改:', hasUnsavedChanges); // 添加调试日志
          
          if (hasUnsavedChanges) {
            console.log('显示有更改的确认弹窗'); // 添加调试日志
            // 如果有未保存的更改，显示详细确认弹窗
            showConfirmModal(
              '确认关闭编辑',
              '您有未保存的更改，确定要关闭吗？\n\n关闭后：\n1. 编辑锁定将被释放\n2. 其他用户可以编辑此时间段\n3. 未保存的更改将丢失',
              async () => {
                console.log('用户确认关闭（有更改）'); // 添加调试日志
                // 用户确认关闭，执行清理操作
                if (editingSchedule) {
                  // 检查是否是临时记录，如果是则删除
                  const isTempSchedule = editingSchedule.managers.length === 0 && 
                                        editingSchedule.location.name === '' && 
                                        editingSchedule.propertyType.name === '';
                  
                  if (isTempSchedule) {
                    // 删除临时记录
                    try {
                      await supabase
                        .from('live_stream_schedules')
                        .delete()
                        .eq('id', editingSchedule.id);
                    } catch (error) {
                      console.error('删除临时记录失败:', error);
                    }
                  } else {
                    // 根据当前状态决定是否回退状态
                    const currentStatus = editingSchedule.status;
                    if (currentStatus === 'editing') {
                      // editing状态退出时，回退为available
                      try {
                        await updateLiveStreamSchedule(editingSchedule.id, {
                          status: 'available'
                        });
                        console.log('editing状态退出，回退为available');
                      } catch (error) {
                        console.error('回退状态失败:', error);
                      }
                    }
                    // booked状态退出时，保持booked状态不变
                    
                    // 释放编辑锁定
                    await releaseEditLock(editingSchedule.id);
                  }
                }
                setModalVisible(false);
                setEditingSchedule(null);
                form.resetFields();
                message.info('已取消编辑');
                loadData(); // 重新加载数据
              }
            );
          } else {
            console.log('显示无更改的确认弹窗'); // 添加调试日志
            // 如果没有更改，显示简单确认弹窗
            showConfirmModal(
              '确认取消编辑',
              '确定要取消编辑吗？这将释放编辑锁定。',
              async () => {
                console.log('用户确认关闭（无更改）'); // 添加调试日志
                // 用户确认关闭，执行清理操作
                if (editingSchedule) {
                  // 检查是否是临时记录，如果是则删除
                  const isTempSchedule = editingSchedule.managers.length === 0 && 
                                        editingSchedule.location.name === '' && 
                                        editingSchedule.propertyType.name === '';
                  
                  if (isTempSchedule) {
                    // 删除临时记录
                    try {
                      await supabase
                        .from('live_stream_schedules')
                        .delete()
                        .eq('id', editingSchedule.id);
                    } catch (error) {
                      console.error('删除临时记录失败:', error);
                    }
                  } else {
                    // 根据当前状态决定是否回退状态
                    const currentStatus = editingSchedule.status;
                    if (currentStatus === 'editing') {
                      // editing状态退出时，回退为available
                      try {
                        await updateLiveStreamSchedule(editingSchedule.id, {
                          status: 'available'
                        });
                        console.log('editing状态退出，回退为available');
                      } catch (error) {
                        console.error('回退状态失败:', error);
                      }
                    }
                    // booked状态退出时，保持booked状态不变
                    
                    // 释放编辑锁定
                    await releaseEditLock(editingSchedule.id);
                  }
                }
                setModalVisible(false);
                setEditingSchedule(null);
                form.resetFields();
                message.info('已取消编辑');
                loadData(); // 重新加载数据
              }
            );
          }
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
                  if (!value || value.length === 0) {
                    return Promise.reject(new Error('请选择直播管家'));
                  }
                  if (value.length < 2) {
                    return Promise.reject(new Error('请选择2名直播管家'));
                  }
                  if (value.length > 2) {
                    return Promise.reject(new Error('最多只能选择2名直播管家'));
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
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<CheckCircleOutlined />}
            >
              {editingSchedule ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 确认弹窗 */}
      <Modal
        title={confirmModalTitle}
        open={confirmModalVisible}
        onOk={handleConfirmModalOk}
        onCancel={handleConfirmModalCancel}
        okText="确认"
        cancelText="取消"
        width={500}
        zIndex={2000}
        styles={{
          mask: {
            zIndex: 1999
          }
        }}
      >
        <div style={{ 
          whiteSpace: 'pre-line', 
          lineHeight: '1.6',
          fontSize: '14px'
        }}>
          {confirmModalContent}
        </div>
      </Modal>
    </div>
  );
};

export default LiveStreamRegistration;