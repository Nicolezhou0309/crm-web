import React, { useState, useEffect, memo } from 'react';
import { Button, Table, Modal, Form, Select, message, Tooltip } from 'antd';
import { PlusOutlined, CheckCircleOutlined, VideoCameraAddOutlined, ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { LiveStreamSchedule, TimeSlot } from '../types/liveStream';
import { createLiveStreamSchedule, updateLiveStreamSchedule, getWeeklySchedule, cleanupExpiredEditingStatus, getTimeSlots } from '../api/liveStreamApi';

import { supabase } from '../supaClient';
import { useUser } from '../context/UserContext';
import UserTreeSelect from './UserTreeSelect';
import LiveStreamCardContextMenu from './LiveStreamCardContextMenu';
import LiveStreamHistoryDrawer from './LiveStreamHistoryDrawer';
import LiveStreamScoringDrawer from './LiveStreamScoringDrawer';
const { Option } = Select;



// 独立的卡片组件，使用memo优化性能
const ScheduleCard = memo<{
  schedule: LiveStreamSchedule | undefined;
  timeSlot: any;
  dateInfo: any;
  onCardClick: (schedule: LiveStreamSchedule | undefined, timeSlot: any, dateInfo: any) => void;
  userAvatars: { [key: number]: string };
  avatarFrames: { [key: number]: string };
  getCardColor: (id: string) => { bg: string; text: string };
  cardUpdateKey?: number;
  currentUserId?: string;
  currentProfileId?: number;
  timeSlots: TimeSlot[];
  onContextMenuEdit?: (schedule: LiveStreamSchedule) => void;
  onContextMenuHistory?: (schedule: LiveStreamSchedule) => void;
  onContextMenuRate?: (schedule: LiveStreamSchedule) => void;
  onContextMenuRelease?: (schedule: LiveStreamSchedule) => void;
}>(({ 
  schedule, 
  timeSlot, 
  dateInfo, 
  onCardClick, 
  userAvatars, 
  avatarFrames, 
  getCardColor,
  cardUpdateKey,
  currentProfileId,
  timeSlots,
  onContextMenuEdit,
  onContextMenuHistory,
  onContextMenuRate,
  onContextMenuRelease
}) => {
  // 检查是否可以编辑：无记录、状态为available、状态为空、或状态为editing
  // 对于available状态且没有参与者的卡片，应该显示为可报名状态
  const canEdit = !schedule || 
                  schedule.status === 'available' || 
                  schedule.status === 'editing' ||
                  (!schedule.status && schedule.status !== 'editing');
  
  // 检查是否是当前用户报名的 - 使用profile.id进行比较
  // 对于available状态且没有参与者的卡片，不应该显示为"我报名的"
  const isMyBooking = schedule && currentProfileId && schedule.status !== 'available' && (
    schedule.createdBy === currentProfileId || 
    schedule.managers.some((manager: any) => parseInt(manager.id) === currentProfileId)
  );
  
  // 检查是否是当前时间的直播场次
  const isCurrentLiveStream = schedule && schedule.status === 'booked' && (() => {
    const now = dayjs();
    const scheduleDate = dayjs(schedule.date);
    const timeSlot = timeSlots.find((ts: TimeSlot) => ts.id === schedule.timeSlotId);
    
    if (!timeSlot) return false;
    
    // 检查是否是今天
    if (!scheduleDate.isSame(now, 'day')) return false;
    
    // 检查当前时间是否在直播时间段内
    const currentTime = now.format('HH:mm');
    return currentTime >= timeSlot.startTime && currentTime <= timeSlot.endTime;
  })();
  
  // 状态栏显示优先级：正在直播中 > 我报名的
  const showLiveStreamStatus = isCurrentLiveStream;
  const showMyBookingStatus = isMyBooking && !isCurrentLiveStream;
  
  // 统一的卡片渲染函数
  const renderCard = (cardContent: React.ReactNode) => {
    // 如果没有schedule，或者available状态且没有参与者，或者editing状态，不显示右键菜单
    if (!schedule || 
        (schedule?.status === 'available' && schedule?.managers?.length === 0) ||
        schedule?.status === 'editing') {
      return (
        <div
          key={`${schedule?.id || 'empty'}-${cardUpdateKey || 0}`}
          onClick={() => onCardClick(schedule, timeSlot, dateInfo)}
          style={{
            background: 'white',
            border: schedule?.status === 'editing' ? '1px solid #52c41a' : '1px solid #1890ff',
            borderRadius: '8px',
            margin: '1px',
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
          {cardContent}
        </div>
      );
    }

    // 有schedule时，直接使用右键菜单包裹
    return (
      <LiveStreamCardContextMenu
        onEdit={() => onContextMenuEdit?.(schedule)}
        onHistory={() => onContextMenuHistory?.(schedule)}
        onRate={() => onContextMenuRate?.(schedule)}
        onRelease={() => onContextMenuRelease?.(schedule)}
      >
        {cardContent}
      </LiveStreamCardContextMenu>
    );
  };

  // 统一的空状态/释放状态卡片内容渲染函数
  const renderEmptyOrAvailableCardContent = () => (
    <>
      {/* 上半部分容器 - 人名区域 */}
      <div style={{
        background: '#ffffff',
        padding: '2px 2px',
        margin: '0',
        borderBottom: '1px solid #1890ff',
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
            color: '#1890ff',
            fontWeight: '600',
            lineHeight: '1.2'
          }}>
            立即报名
          </span>
        </div>
      </div>
      
      {/* 下半部分容器 - 双栏布局 */}
      <div style={{ 
        padding: '8px 8px', 
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'white',
        gap: '8px'
      }}>
        {/* 左侧 - Location */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <span style={{ 
            fontSize: '12px', 
            color: '#999', 
            lineHeight: '1.2',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={schedule?.location?.name || ''}>
            {schedule?.location?.name || ''}
          </span>
        </div>
        
        {/* 右侧 - Notes (PropertyType) */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {schedule?.propertyType?.name && schedule.propertyType.name !== '' && (
            <span style={{ 
              fontSize: '12px', 
              color: '#999', 
              lineHeight: '1.2',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={schedule.propertyType.name}>
              {schedule.propertyType.name}
            </span>
          )}
        </div>
      </div>
      
      {/* 状态栏 */}
      {showLiveStreamStatus && (
        <div style={{
          background: '#1890ff',
          color: 'white',
          fontSize: '10px',
          padding: '2px 6px 2px 10px',
          textAlign: 'left',
          fontWeight: '500',
          lineHeight: '1.2',
          borderBottomLeftRadius: '7px',
          borderBottomRightRadius: '7px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'white',
            flexShrink: 0
          }}></span>
          正在直播中...
        </div>
      )}
      {showMyBookingStatus && (
        <div style={{
          background: '#faad14',
          color: 'white',
          fontSize: '10px',
          padding: '2px 6px 2px 10px',
          textAlign: 'left',
          fontWeight: '500',
          lineHeight: '1.2',
          borderBottomLeftRadius: '7px',
          borderBottomRightRadius: '7px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'white',
            flexShrink: 0
          }}></span>
          我报名的
        </div>
      )}
    </>
  );

  // 统一的编辑状态卡片内容渲染函数
  const renderEditingCardContent = () => (
    <>
      {/* 上半部分容器 - 人名区域 */}
      <div style={{
        background: '#ffffff',
        padding: '2px 2px',
        margin: '0',
        borderBottom: '1px solid #52c41a',
        width: '100%',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* 编辑中状态显示 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          flex: 1,
          width: '100%'
        }}>
          <span style={{ 
            fontSize: '12px', 
            color: '#52c41a',
            fontWeight: '600',
            lineHeight: '1.2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <VideoCameraAddOutlined style={{ marginRight: '4px', fontSize: '20px', color: '#52c41a' }} />
            报名中
            <span style={{
              display: 'inline-block',
              marginLeft: '2px'
            }}>
              <span style={{
                animation: 'wave 1.5s infinite',
                display: 'inline-block',
                animationDelay: '0s'
              }}>.</span>
              <span style={{
                animation: 'wave 1.5s infinite',
                display: 'inline-block',
                animationDelay: '0.2s'
              }}>.</span>
              <span style={{
                animation: 'wave 1.5s infinite',
                display: 'inline-block',
                animationDelay: '0.4s'
              }}>.</span>
            </span>
          </span>
        </div>
      </div>
      
      {/* 下半部分容器 - 双栏布局 */}
      <div style={{ 
        padding: '8px 8px', 
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'white',
        gap: '8px'
      }}>
        {/* 左侧 - Location */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <span style={{ 
            fontSize: '12px', 
            color: '#999', 
            lineHeight: '1.2',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={schedule?.location?.name || ''}>
            {schedule?.location?.name || ''}
          </span>
        </div>
        
        {/* 右侧 - Notes (PropertyType) */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {schedule?.propertyType?.name && schedule.propertyType.name !== '' && (
            <span style={{ 
              fontSize: '12px', 
              color: '#999', 
              lineHeight: '1.2',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={schedule.propertyType.name}>
              {schedule.propertyType.name}
            </span>
          )}
        </div>
      </div>
    </>
  );

  // 统一的已报名卡片内容渲染函数
  const renderBookedCardContent = () => (
    <Tooltip
      title={
        <div>
          <div><strong>直播管家:</strong> {schedule?.managers?.map((m: any) => m.name).join(', ') || '未知'}</div>
          <div><strong>地点:</strong> {schedule?.location?.name || '未知'}</div>
          {schedule?.propertyType?.name && schedule.propertyType.name !== '' && (
            <div><strong>户型:</strong> {schedule.propertyType.name}</div>
          )}
        </div>
      }
      placement="top"
    >
      <div 
        key={`${schedule?.id}-${cardUpdateKey || 0}`}
        onClick={() => onCardClick(schedule, timeSlot, dateInfo)}
        style={{
          background: 'white',
          border: schedule?.status === 'editing' ? '1px solid #52c41a' : 
                  (schedule?.status === 'available' || !schedule?.status) ? '2px solid #1890ff' : '1px solid #e8e8e8',
          borderRadius: '8px',
          margin: '1px',
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
          background: (schedule?.status === 'available' || !schedule?.status || schedule?.status === 'editing') ? '#ffffff' : getCardColor(schedule?.id || '').bg,
          padding: '2px 2px',
          margin: '0',
          borderBottom: schedule?.status === 'editing' ? '1px solid #52c41a' :
                       (schedule?.status === 'available' || !schedule?.status) ? '1px solid #1890ff' : '1px solid #e8e8e8',
          width: '100%',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Icon + 立即报名 或 头像组 */}
          {(schedule?.status === 'available' || !schedule?.status || schedule?.managers?.length === 0) ? (
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
                color: '#1890ff',
                fontWeight: '600',
                lineHeight: '1.2'
              }}>
                立即报名
              </span>
            </div>
          ) : schedule?.status === 'editing' ? (
            // editing状态不显示头像，只显示编辑中文本
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flex: 1,
              width: '100%'
            }}>
              <span style={{ 
                fontSize: '12px', 
                color: '#52c41a',
                fontWeight: '600',
                lineHeight: '1.2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <VideoCameraAddOutlined style={{ marginRight: '4px', fontSize: '20px', color: '#52c41a' }} />
                报名中
                <span style={{
                  display: 'inline-block',
                  marginLeft: '2px'
                }}>
                  <span style={{
                    animation: 'wave 1.5s infinite',
                    display: 'inline-block',
                    animationDelay: '0s'
                  }}>.</span>
                  <span style={{
                    animation: 'wave 1.5s infinite',
                    display: 'inline-block',
                    animationDelay: '0.2s'
                  }}>.</span>
                  <span style={{
                    animation: 'wave 1.5s infinite',
                    display: 'inline-block',
                    animationDelay: '0.4s'
                  }}>.</span>
                </span>
              </span>
            </div>
          ) : (
            // 已报名状态 - 显示头像组
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              flex: 1,
              width: '100%',
              overflow: 'hidden',
              padding: '0 2px'
            }}>
              {schedule?.managers?.slice(0, 3).map((manager: any, index: number) => {
                const userId = parseInt(manager.id);
                const avatar = userAvatars[userId];
                const frame = avatarFrames[userId];
                
                return (
                  <div
                    key={manager.id}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '1px solid #e8e8e8',
                      backgroundColor: '#f5f5f5',
                      zIndex: 3 - index
                    }}
                    title={manager.name}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={manager.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <span style={{
                        fontSize: '10px',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        {manager.name?.charAt(0) || '?'}
                      </span>
                    )}
                    {frame && (
                      <img
                        src={frame}
                        alt="frame"
                        style={{
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>
                );
              })}
              {schedule?.managers && schedule.managers.length > 3 && (
                <span style={{
                  fontSize: '10px',
                  color: '#666',
                  fontWeight: '600',
                  marginLeft: '2px'
                }}>
                  +{schedule?.managers.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* 下半部分容器 - 双栏布局 */}
        <div style={{ 
          padding: '8px 8px', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflow: 'hidden'
        }}>
          {/* 第一行：时间 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: '#666',
            fontWeight: '500'
          }}>
            <ClockCircleOutlined style={{ fontSize: '10px' }} />
            <span>{timeSlot?.startTime || ''} - {timeSlot?.endTime || ''}</span>
          </div>
          
          {/* 第二行：地点 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: '#666',
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            <EnvironmentOutlined style={{ fontSize: '10px' }} />
            <span>{schedule?.location?.name || '未知地点'}</span>
          </div>
        </div>
        
        {/* 状态指示器 */}
        {(showLiveStreamStatus || showMyBookingStatus) && (
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: showLiveStreamStatus ? '#ff4d4f' : '#52c41a',
            zIndex: 10
          }}>
            {showLiveStreamStatus ? '直播中' : '我报名的'}
          </div>
        )}
      </div>
    </Tooltip>
  );

  // 根据状态渲染不同的卡片内容
  if (canEdit) {
    // 如果是编辑状态，使用专门的编辑状态渲染函数
    if (schedule && schedule?.status === 'editing') {
      return renderCard(renderEditingCardContent());
    }
    // 其他可编辑状态（空状态、available状态）
    return renderCard(renderEmptyOrAvailableCardContent());
  }

  return renderCard(renderBookedCardContent());
});

ScheduleCard.displayName = 'ScheduleCard';

const LiveStreamRegistrationBase: React.FC = () => {
  const [schedules, setSchedules] = useState<LiveStreamSchedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LiveStreamSchedule | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(dayjs());
  const [form] = Form.useForm();

  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<any>(null);

  // 头像相关状态
  const [userAvatars, setUserAvatars] = useState<{ [key: number]: string }>({});
  const [avatarFrames, setAvatarFrames] = useState<{ [key: number]: string }>({});

  // 确认弹窗状态
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState('');
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalCallback, setConfirmModalCallback] = useState<(() => void) | null>(null);

  // 历史记录抽屉状态
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [selectedScheduleForHistory, setSelectedScheduleForHistory] = useState<LiveStreamSchedule | null>(null);

  // 评分抽屉状态
  const [scoringDrawerVisible, setScoringDrawerVisible] = useState(false);
  const [selectedScheduleForScoring, setSelectedScheduleForScoring] = useState<LiveStreamSchedule | null>(null);

  // 添加卡片级别的更新状态
  const [cardUpdateKeys, setCardUpdateKeys] = useState<{ [key: string]: number }>({});

  // UserTreeSelect相关状态 - 参考AllocationManagement的实现
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);

  // 右键菜单回调函数
  const handleContextMenuEdit = (schedule: LiveStreamSchedule) => {
    handleEditSchedule(schedule);
  };

  const handleContextMenuHistory = (schedule: LiveStreamSchedule) => {
    setSelectedScheduleForHistory(schedule);
    setHistoryDrawerVisible(true);
  };

  const handleContextMenuRate = (schedule: LiveStreamSchedule) => {
    setSelectedScheduleForScoring(schedule);
    setScoringDrawerVisible(true);
  };

  const handleContextMenuRelease = async (schedule: LiveStreamSchedule) => {
    try {
      // 检查权限
      const permissionResult = await checkEditPermission(schedule);
      if (!permissionResult.hasPermission) {
        message.warning(permissionResult.message || '无权限释放此场次');
        return;
      }

      // 更新状态为available，只清除participant_ids，保留location和notes
      const updatedSchedule = await updateLiveStreamSchedule(schedule?.id || '', {
        ...schedule,
        status: 'available',
        managers: [] // 清除参与者信息
      });

      if (updatedSchedule) {
        // 更新本地状态
        setSchedules(prev => 
          prev.map(s => s.id === schedule?.id ? updatedSchedule : s)
        );
        message.success('场次释放成功');
        // 更新卡片
        updateSingleCard(schedule?.id || '');
      }
    } catch (error) {
      console.error('释放场次失败:', error);
      message.error('释放场次失败');
    }
  };

  // 自动清理过期的编辑状态
  useEffect(() => {
    const performCleanup = async () => {
      try {
        await cleanupExpiredEditingStatus();
      } catch (error) {
      }
    };
    
    // 页面加载时立即清理一次
    performCleanup();
    
    // 每5分钟自动清理一次
    const interval = setInterval(performCleanup, 5 * 60 * 1000);
    
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // 统一的权限检查函数
  const checkEditPermission = async (schedule: LiveStreamSchedule): Promise<{ hasPermission: boolean; message?: string }> => {


    // 检查用户登录状态
    if (!user) {
      console.error('❌ 用户未登录');
      return { hasPermission: false, message: '用户未登录' };
    }



    try {
      // 获取当前用户的profile ID
      const { data: userProfile, error: profileError } = await supabase
        .from('users_profile')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('❌ 获取用户profile失败:', profileError);
        return { hasPermission: false, message: '用户信息不完整' };
      }

      if (!userProfile) {
        console.error('❌ 用户profile不存在');
        return { hasPermission: false, message: '用户信息不完整' };
      }

      // 根据记录状态进行不同的权限检查
      if (schedule.status === 'booked') {
        // booked状态：检查是否是创建者或参与者
        const isCreator = schedule.createdBy === userProfile.id;
        const isParticipant = schedule.managers.some((m: any) => parseInt(m.id) === userProfile.id);
        

        if (!isCreator && !isParticipant) {
          return { 
            hasPermission: false, 
            message: '只有记录创建者或报名人可以编辑已报名的记录' 
          };
        }
        
        return { hasPermission: true };
        
      } else if (schedule.status === 'editing') {
        // editing状态：检查是否是编辑者本人
        // 如果editingBy为null，可能是数据库字段未正确设置，允许编辑
        const isEditor = schedule.editingBy === userProfile.id;
        const isNullEditingBy = schedule.editingBy === null;
        
        
        // 如果editingBy为null，允许编辑（可能是数据库字段未正确设置）
        if (isNullEditingBy) {
          return { hasPermission: true };
        }
        
        if (!isEditor) {
          return { 
            hasPermission: false, 
            message: '该记录正在被其他用户编辑，请稍后再试' 
          };
        }
        
        return { hasPermission: true };
        
      } else if (schedule.status === 'available' || !schedule.status) {
        // available状态或无状态：任何人都可以编辑
        return { hasPermission: true };
        
      } else {
        // 其他状态：默认不允许编辑
        return { 
          hasPermission: false, 
          message: '该记录状态不允许编辑' 
        };
      }
      
    } catch (error) {
      console.error('❌ 权限检查失败:', error);
      return { hasPermission: false, message: '权限检查失败' };
    }
  };

  // 获取用户头像的函数
  const fetchUserAvatars = async (userIds: number[]) => {
    try {
      // 过滤掉无效值
      const validUserIds = userIds.filter(id => id > 0);
      
      if (validUserIds.length === 0) {
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
      
      // 过滤掉无效值
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
        console.error('获取头像框失败:', error);
      }

      setAvatarFrames(prev => ({ ...prev, ...frameMap }));
    } catch (error) {
      console.error('获取头像框失败:', error);
    }
  };

  // 更新单个卡片的函数
  const updateSingleCard = (scheduleId: string) => {
    setCardUpdateKeys(prev => ({
      ...prev,
      [scheduleId]: (prev[scheduleId] || 0) + 1
    }));
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
    // 测试数据库记录
    testDatabaseRecords();
  }, [selectedWeek]);

  // 添加realtime订阅，监听数据变化
  useEffect(() => {
    if (!selectedWeek) return;
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;
    
    const establishConnection = () => {
      const channel = supabase.channel('live-stream-schedules')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'live_stream_schedules'
        }, async (payload) => {
          
          if (payload.eventType === 'INSERT') {
            const newSchedule = payload.new;
            
            // 检查是否在当前选中的周范围内
            const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
            const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
            
            if (newSchedule.date >= weekStart && newSchedule.date <= weekEnd) {
              
              // 构建新的schedule对象
              const scheduleToAdd: LiveStreamSchedule = {
                id: newSchedule.id.toString(),
                date: newSchedule.date,
                timeSlotId: newSchedule.time_slot_id,
                status: newSchedule.status,
                managers: newSchedule.participant_ids 
                  ? newSchedule.participant_ids.map((id: number) => ({
                      id: id.toString(),
                      name: '未知用户',
                      department: '',
                      avatar: undefined
                    }))
                  : [],
                location: {
                  id: newSchedule.location || '',
                  name: newSchedule.location || ''
                },
                propertyType: {
                  id: newSchedule.notes || '',
                  name: newSchedule.notes || ''
                },
                createdAt: newSchedule.created_at,
                updatedAt: newSchedule.updated_at,
                createdBy: newSchedule.created_by,
                editingBy: newSchedule.editing_by,
                editingAt: newSchedule.editing_at,
                editingExpiresAt: newSchedule.editing_expires_at,
                lockType: newSchedule.lock_type,
                lockReason: newSchedule.lock_reason,
                lockEndTime: newSchedule.lock_end_time,
              };
              
              // 添加到本地状态
              setSchedules(prev => {
                const updated = [...prev, scheduleToAdd];
                return updated;
              });
              
              // 更新特定卡片
              const cardKey = newSchedule.id.toString();
              updateSingleCard(cardKey);
            } else {
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedSchedule = payload.new;
            
            
            // 简单更新本地状态
            setSchedules(prev => {
              const updated = prev.map(schedule => 
                schedule.id === updatedSchedule.id.toString() 
                  ? {
                      ...schedule,
                      status: updatedSchedule.status,
                      managers: updatedSchedule.participant_ids 
                        ? updatedSchedule.participant_ids.map((id: number) => ({
                            id: id.toString(),
                            name: '未知用户',
                            department: '',
                            avatar: undefined
                          }))
                        : schedule.managers,
                      location: {
                        id: updatedSchedule.location || 'default',
                        name: updatedSchedule.location || ''
                      },
                      propertyType: {
                        id: updatedSchedule.notes || '',
                        name: updatedSchedule.notes || ''
                      },
                      createdAt: schedule.createdAt,
                      updatedAt: schedule.updatedAt,
                      createdBy: schedule.createdBy,
                      editingBy: schedule.editingBy,
                      editingAt: schedule.editingAt,
                      editingExpiresAt: schedule.editingExpiresAt,
                      lockType: schedule.lockType,
                      lockReason: schedule.lockReason,
                      lockEndTime: schedule.lockEndTime,
                    }
                  : schedule
              );
              
              return updated;
            });
            
            // 更新特定卡片
            const cardKey = updatedSchedule.id.toString();
            
            updateSingleCard(cardKey);
          } else if (payload.eventType === 'DELETE') {
            const deletedSchedule = payload.old;
            
            
            // 从本地状态中移除
            setSchedules(prev => {
              const updated = prev.filter(schedule => schedule.id !== deletedSchedule.id.toString());
              
              return updated;
            });
            
            // 更新特定卡片
            const cardKey = deletedSchedule.id.toString();
            
            updateSingleCard(cardKey);
          }
        })
        .on('system', { event: 'disconnect' }, () => {
          
        })
        .on('system', { event: 'reconnect' }, () => {
          
          reconnectAttempts = 0; // 重置重连计数
        })
        .subscribe((status) => {
          
          // 如果连接失败，尝试重新连接
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              
              setTimeout(() => {
                
                establishConnection();
              }, reconnectDelay);
            } else {
              console.error('❌ 重连失败，已达到最大重试次数');
            }
          } else if (status === 'SUBSCRIBED') {
            
            reconnectAttempts = 0; // 重置重连计数
          }
        });
      
      return channel;
    };
    
    const channel = establishConnection();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWeek]);



  const loadData = async () => {
    try {
      setLoading(true);
      // 使用UTC时间，避免时区问题
      const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
      
      const [schedulesData, timeSlotsData] = await Promise.all([
        getWeeklySchedule(weekStart, weekEnd),
        getTimeSlots()
      ]);

      setSchedules(schedulesData);
      setTimeSlots(timeSlotsData);

      // 获取所有参与者的头像 - 从managers中提取ID
      const participantIds = new Set<number>();
      schedulesData.forEach((schedule: any) => {
        schedule.managers.forEach((manager: any) => {
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

  // 测试函数：检查数据库中的记录
  const testDatabaseRecords = async () => {
    try {
      // 使用UTC时间，避免时区问题
      const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
      
      
      const { error } = await supabase
        .from('live_stream_schedules')
        .select('*')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date, time_slot_id');
      
      if (error) {
        console.error('❌ 查询数据库失败:', error);
        return;
      }
      
    } catch (error) {
      console.error('❌ 测试数据库记录失败:', error);
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
    const schedule = schedules.find(s => s.date === date && s.timeSlotId === timeSlotId);
    return schedule;
  };

  // 验证报名状态是否正确
  const validateBookingStatus = (scheduleId: string, expectedStatus: string = 'booked') => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.warn('❌ 未找到对应的安排记录');
      return false;
    }
    
    if (schedule.status !== expectedStatus) {
      console.warn(`❌ 状态不匹配：期望 ${expectedStatus}，实际 ${schedule.status}`);
      return false;
    }
    
    
    return true;
  };



  // 处理创建/编辑安排
  const handleScheduleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 权限检查：确保用户有权限提交编辑
      if (editingSchedule) {
        
        const permissionResult = await checkEditPermission(editingSchedule);
        
        if (!permissionResult.hasPermission) {
          console.warn('⚠️ 提交权限检查失败:', permissionResult.message);
          message.warning(permissionResult.message || '无权限提交此编辑');
          setLoading(false);
          return;
        }
        
        
      }
      
      // 验证管家数量
      // 验证管家数量 - 使用独立状态
      if (!selectedManagers || selectedManagers.length !== 2) {
        message.error('请选择2名直播管家');
        return;
      }

      // 检查是否有undefined值
      const validManagers = selectedManagers.filter((userId: any) => userId && userId !== 'undefined' && userId !== 'null');
      if (validManagers.length !== 2) {
        console.warn('⚠️ 检测到无效的管家数据:', selectedManagers);
        message.error('请选择2名有效的直播管家');
        return;
      }

      console.log('✅ 有效的管家数据:', validManagers);

      
      const scheduleData = {
        date: editingSchedule ? editingSchedule.date : dayjs().format('YYYY-MM-DD'),
        timeSlotId: values.timeSlot,
        managers: validManagers.map((userId: string) => {
          // 尝试从用户缓存中获取真实姓名
          const userInfo = userAvatars[parseInt(userId)] ? { nickname: `用户${userId}` } : null;
          return {
            id: userId,
            name: userInfo?.nickname || `用户${userId}`,
            department: '',
            avatar: undefined
          };
        }),
        location: { id: '', name: '' },
        propertyType: { id: '', name: '' },
        status: 'booked' as const, // 报名成功后状态变为booked
      };


      if (editingSchedule) {
        // 检查是否是临时记录（用于创建新安排）
        const isTempSchedule = editingSchedule.managers.length === 0;
        
        
        try {
          if (isTempSchedule) {
            // 更新临时记录为真实数据，确保状态为booked
            const updateResult = await updateLiveStreamSchedule(editingSchedule.id, {
              ...scheduleData,
              status: 'booked' // 明确设置状态为booked
            });
            
            
            if (updateResult && updateResult.status === 'booked') {
              message.success('报名成功！');
            } else {
              console.error('❌ 报名状态更新失败');
              console.error('  - 期望状态: booked');
              console.error('  - 实际状态:', updateResult?.status);
              throw new Error('报名状态更新失败');
            }
          } else {
            // 更新现有记录，确保状态为booked
            const updateResult = await updateLiveStreamSchedule(editingSchedule.id, {
              ...scheduleData,
              status: 'booked' // 明确设置状态为booked
            });
            
            
            if (updateResult && updateResult.status === 'booked') {
              message.success('报名更新成功！');
            } else {
              console.error('❌ 报名状态更新失败');
              console.error('  - 期望状态: booked');
              console.error('  - 实际状态:', updateResult?.status);
              throw new Error('报名状态更新失败');
            }
          }
          
          // 保存记录ID用于验证
          const recordId = editingSchedule.id;
          
          // 关闭弹窗并清理状态
          setModalVisible(false);
          setEditingSchedule(null);
          setSelectedManagers([]);
          form.resetFields();
          
          // 重新加载数据以显示最新状态
          await loadData();
          
          // 等待一个微任务周期，确保状态更新完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 验证报名状态是否正确
          if (validateBookingStatus(recordId, 'booked')) {
          } else {
            // 如果第一次验证失败，再延迟1秒重试一次
            setTimeout(async () => {
              await loadData(); // 再次加载数据
              await new Promise(resolve => setTimeout(resolve, 100)); // 等待状态更新
              
              if (validateBookingStatus(recordId, 'booked')) {
              } else {
                console.error('❌ 重试验证仍然失败');
              }
            }, 1000);
          }
          
        } catch (updateError) {
          console.error('❌ 更新直播安排失败:', updateError);
          console.error('  - 错误详情:', updateError);
          
          // 根据错误类型显示不同的错误信息
          if (updateError instanceof Error) {
            if (updateError.message.includes('权限')) {
              message.error('权限不足，无法报名');
            } else if (updateError.message.includes('网络')) {
              message.error('网络连接失败，请检查网络后重试');
            } else {
              message.error(`报名失败：${updateError.message}`);
            }
          } else {
            message.error('报名失败，请重试');
          }
          return;
        }
      } else {
        console.error('❌ 编辑状态异常');
        // 这种情况不应该发生，因为创建新安排时都会设置editingSchedule
        message.error('编辑状态异常，请刷新页面重试');
      }

    } catch (error) {
      console.error('❌ 报名操作失败:', error);
      message.error('报名失败，请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理编辑安排
  const handleEditSchedule = async (schedule: LiveStreamSchedule) => {
    
    
    try {
      // 使用统一的权限检查函数
      const permissionResult = await checkEditPermission(schedule);
      
      if (!permissionResult.hasPermission) {
        console.warn('⚠️ 权限检查失败:', permissionResult.message);
        message.warning(permissionResult.message || '无权限编辑此记录');
        return;
      }
      
      

      // 设置编辑状态
      
      setEditingSchedule(schedule);
      setModalVisible(true);
      
      // 延迟设置表单值，确保Form组件已经渲染
      setTimeout(() => {
        
        // 过滤有效的manager ID
        const validManagerIds = schedule.managers
          .filter((m: any) => m && m.id && m.id !== 'undefined' && m.id !== 'null')
          .map((m: any) => String(m.id));
        
        console.log('📋 设置表单值:', {
          timeSlot: schedule.timeSlotId,
          managers: validManagerIds,
          originalManagers: schedule.managers
        });
        
        // 设置独立的状态
        setSelectedManagers(validManagerIds);
        
        const formValues = {
          timeSlot: schedule.timeSlotId,
          managers: validManagerIds,
          location: schedule.location.id || undefined,
          propertyType: schedule.propertyType.id || undefined,
        };
          
        form.setFieldsValue(formValues);
        
      }, 100);
      
    } catch (error) {
      console.error('❌ 获取编辑权限失败:', error);
      console.error('🔍 错误详情:', {
        message: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });
      message.error('获取编辑权限失败');
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
        render: (timeSlot: any, _record: any, _index: number) => {
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
            return (
            <ScheduleCard
              schedule={schedule}
              timeSlot={record.timeSlot}
              dateInfo={dateInfo}
              onCardClick={handleCardClick}
              userAvatars={userAvatars}
              avatarFrames={avatarFrames}
              getCardColor={getCardColor}
              cardUpdateKey={cardUpdateKeys[schedule?.id || `${dateInfo.date}-${record.timeSlot.id}`] || 0}
              currentUserId={user?.id}
              currentProfileId={userProfile?.id}
              timeSlots={timeSlots}
              onContextMenuEdit={handleContextMenuEdit}
              onContextMenuHistory={handleContextMenuHistory}
              onContextMenuRate={handleContextMenuRate}
              onContextMenuRelease={handleContextMenuRelease}
            />
          );
        }
      }))
    ];

    const dataSource = timeSlots.map((timeSlot: TimeSlot) => {
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

  // 处理弹窗关闭的统一函数
  const handleModalClose = async () => {

    
    if (editingSchedule) {
      // 检查是否是临时记录或editing状态的记录
      const isTempSchedule = editingSchedule.managers.length === 0;
      const isEditingSchedule = editingSchedule.status === 'editing';
      

      
      // 对于临时记录，直接删除
      if (isTempSchedule) {

        
        try {

          
          // 检查ID是否为有效数字
          const recordId = parseInt(editingSchedule.id);
          if (isNaN(recordId)) {
            console.error('❌ 记录ID无效:', editingSchedule.id);
            throw new Error('记录ID无效');
          }
          
          
          const { data, error } = await supabase
            .from('live_stream_schedules')
            .delete()
            .eq('id', recordId)
            .select();
          
          if (error) {
            console.error('❌ 删除记录失败:', error);
            console.error('🔍 错误详情:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
          } else {
            
            // 验证删除是否真的成功
            if (data && data.length > 0) {
            } else {
            }
            
            // 手动从本地状态中移除记录，确保UI立即更新
            setSchedules(prev => {
              const updated = prev.filter(schedule => schedule.id !== editingSchedule.id);
              return updated;
            });
            
            // 手动触发卡片更新
            updateSingleCard(editingSchedule.id);
          }
        } catch (error) {
          console.error('❌ 删除记录时发生异常:', error);
          console.error('🔍 异常详情:', {
            message: error instanceof Error ? error.message : '未知错误',
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      } else {
        // 对于其他记录（包括editing状态的已报名记录），进行权限检查
        const permissionResult = await checkEditPermission(editingSchedule);
        
        if (!permissionResult.hasPermission) {
          console.warn('⚠️ 删除权限检查失败:', permissionResult.message);
          message.warning(permissionResult.message || '无权限删除此记录');
          // 即使没有权限，也要清理状态
          setModalVisible(false);
          setEditingSchedule(null);
          form.resetFields();
          return;
        }
        
        
        // 权限检查通过后，如果是editing状态记录，也删除
        if (isEditingSchedule) {
          
          try {
            const recordId = parseInt(editingSchedule.id);
            if (isNaN(recordId)) {
              console.error('❌ 记录ID无效:', editingSchedule.id);
              throw new Error('记录ID无效');
            }
            
            const { error } = await supabase
              .from('live_stream_schedules')
              .delete()
              .eq('id', recordId)
              .select();
            
            if (error) {
              console.error('❌ 删除editing状态记录失败:', error);
            } else {
              
              
              // 手动从本地状态中移除记录
              setSchedules(prev => {
                const updated = prev.filter(schedule => schedule.id !== editingSchedule.id);
                
                return updated;
              });
              
              // 手动触发卡片更新
              updateSingleCard(editingSchedule.id);
            }
          } catch (error) {
            console.error('❌ 删除editing状态记录时发生异常:', error);
          }
        }
      }
    } else {
      
    }
    
    
    setModalVisible(false);
    setEditingSchedule(null);
    setSelectedManagers([]);
    form.resetFields();
    message.info('已取消编辑');
    
    
    await loadData(); // 重新加载数据
    
  };

  // 处理卡片点击
  const handleCardClick = async (schedule: LiveStreamSchedule | undefined, timeSlot: any, dateInfo: any) => {
    if (!schedule) {
      // 创建临时记录
      
      
      
      
      try {
        const tempScheduleData = {
          date: dateInfo.date,
          timeSlotId: timeSlot.id,
          managers: [], // 设置为空数组，表示未选择人员
          location: { id: '', name: '' }, // 设置为空，表示未选择位置
          propertyType: { id: '', name: '' }, // 设置为空，表示未选择户型
          status: 'editing' as const, // 明确指定为editing状态
        };

        
        
        
        const tempSchedule = await createLiveStreamSchedule(tempScheduleData);
        
        
        
        setEditingSchedule(tempSchedule);
        setModalVisible(true);
        setSelectedManagers([]); // 清空选中的管家
        
        // 延迟设置表单值，确保Form组件已经渲染
        setTimeout(() => {
          
          form.setFieldsValue({
            timeSlot: timeSlot.id
          });
          
        }, 100);
      } catch (error) {
        console.error('❌ 创建临时记录失败:', error);
        console.error('🔍 错误详情:', {
          message: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined
        });
        message.error('创建临时记录失败');
      }
    } else {
      // 编辑现有记录 - 使用统一的权限检查
      
      
      // 先进行权限检查
      const permissionResult = await checkEditPermission(schedule);
      
      if (!permissionResult.hasPermission) {
        console.warn('⚠️ 权限检查失败:', permissionResult.message);
        message.warning(permissionResult.message || '无权限编辑此记录');
        return;
      }
      
      // 权限检查通过后，调用编辑函数
      handleEditSchedule(schedule);
    }
  };

  // 确认弹窗处理函数
  const showConfirmModal = (title: string, content: string, callback: () => void) => {
    setConfirmModalTitle(title);
    setConfirmModalContent(content);
    setConfirmModalCallback(() => callback);
    setConfirmModalVisible(true);
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

  // 获取用户profile信息
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        
        setUserProfile(null);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('users_profile')
          .select('id, nickname, avatar_url')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('❌ 获取用户profile失败:', error);
          setUserProfile(null);
        } else {
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('❌ 获取用户profile异常:', error);
        setUserProfile(null);
      }
    };

    fetchUserProfile();
  }, [user]);

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
            @keyframes wave {
              0%, 60%, 100% {
                transform: translateY(0);
              }
              30% {
                transform: translateY(-4px);
              }
            }
          `}
        </style>
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
        
        {renderScheduleTable()}
      </div>

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
          
          // 检查表单是否有未保存的更改
          const formValues = form.getFieldsValue();
          
          // 比较当前表单值与原始数据
          const currentManagers = formValues.managers || [];
          const originalManagers = editingSchedule?.managers?.map((m: any) => m.id) || [];
          
          // 检查是否有实际更改
          const hasUnsavedChanges = (
            currentManagers.length !== originalManagers.length ||
            currentManagers.some((id: string) => !originalManagers.includes(id)) ||
            originalManagers.some((id: string) => !currentManagers.includes(id))
          );
          
          if (hasUnsavedChanges) {
            // 有未保存的更改，弹出确认弹窗
            showConfirmModal(
              '温馨提示',
              '您有未保存的更改，确定要关闭吗？',
              async () => {
                await handleModalClose();
              }
            );
          } else {
            // 没有未保存的更改，直接关闭
            await handleModalClose();
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
              {timeSlots.map((slot: TimeSlot) => {
                // 获取当前编辑记录的日期
                const currentDate = editingSchedule?.date || dayjs().format('YYYY-MM-DD');
                const dateInfo = dayjs(currentDate);
                const dayOfWeek = dateInfo.format('ddd');
                const dateStr = dateInfo.format('MM-DD');
                
                return (
                  <Option key={slot.id} value={slot.id}>
                    {dateStr} {dayOfWeek} {slot.startTime}-{slot.endTime} ({slot.period === 'morning' ? '上午' : slot.period === 'afternoon' ? '下午' : '晚上'})
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item
            label="直播管家"
            name="managers"
            extra="请选择2名直播管家（最多2名）"
            rules={[
              { 
                validator: (_, value) => {
                  // 使用selectedManagers进行验证，而不是form的value
                  const managersToValidate = selectedManagers.length > 0 ? selectedManagers : (value || []);
                  
                  if (!managersToValidate || managersToValidate.length === 0) {
                    return Promise.reject(new Error('请选择直播管家'));
                  }
                  if (managersToValidate.length < 2) {
                    return Promise.reject(new Error('请选择2名直播管家'));
                  }
                  if (managersToValidate.length > 2) {
                    return Promise.reject(new Error('最多只能选择2名直播管家'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <UserTreeSelect
              value={selectedManagers}
              onChange={(val) => {
                console.log('🔄 UserTreeSelect onChange:', val);
                
                // 限制只能选择2名直播管家
                const limitedVal = val.slice(0, 2);
                
                // 如果被截断了，显示提示
                if (val.length > 2) {
                  console.log('⚠️ 用户尝试选择超过2名管家，已自动限制为前2名');
                  message.warning('最多只能选择2名直播管家，已自动保留前2名');
                }
                
                console.log('✅ 最终选择的管家:', limitedVal);
                setSelectedManagers(limitedVal);
                form.setFieldsValue({ managers: limitedVal });
              }}
              placeholder="请选择2名直播管家"
              maxTagCount={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button 
                onClick={async () => {
                  // 检查表单是否有未保存的更改
                  const formValues = form.getFieldsValue();
                  
                  // 比较当前表单值与原始数据
                  const currentManagers = formValues.managers || [];
                  const originalManagers = editingSchedule?.managers?.map((m: any) => m.id) || [];
                  
                  // 检查是否有实际更改
                  const hasUnsavedChanges = (
                    currentManagers.length !== originalManagers.length ||
                    currentManagers.some((id: string) => !originalManagers.includes(id)) ||
                    originalManagers.some((id: string) => !currentManagers.includes(id))
                  );
                  
                  if (hasUnsavedChanges) {
                    // 有未保存的更改，弹出确认弹窗
                    showConfirmModal(
                      '温馨提示',
                      '您有未保存的更改，确定要取消吗？',
                      async () => {
                        await handleModalClose();
                      }
                    );
                  } else {
                    // 没有未保存的更改，直接关闭
                    await handleModalClose();
                  }
                }}
                disabled={loading}
              >
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                {editingSchedule ? '更新' : '创建'}
              </Button>
            </div>
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

      {/* 历史记录抽屉 */}
      <LiveStreamHistoryDrawer
        scheduleId={selectedScheduleForHistory?.id || ''}
        visible={historyDrawerVisible}
        onClose={() => {
          setHistoryDrawerVisible(false);
          setSelectedScheduleForHistory(null);
        }}
        scheduleTitle={selectedScheduleForHistory ? 
          `${selectedScheduleForHistory.date} ${selectedScheduleForHistory.managers.map((m: any) => m.name).join(' / ')} 的历史记录` : 
          '直播场次历史记录'
        }
      />

      {/* 评分抽屉 */}
      <LiveStreamScoringDrawer
        visible={scoringDrawerVisible}
        schedule={selectedScheduleForScoring}
        onClose={() => {
          setScoringDrawerVisible(false);
          setSelectedScheduleForScoring(null);
        }}
        onRefresh={() => {
          loadData();
          setScoringDrawerVisible(false);
        }}
      />
    </div>
  );
};

export default LiveStreamRegistrationBase;