import React, { useState, useEffect, memo } from 'react';
import { Button, Table, Tag, Modal, Form, Select, message, Tooltip, Space } from 'antd';
import { UserOutlined, EnvironmentOutlined, HomeOutlined, PlusOutlined, CheckCircleOutlined, VideoCameraAddOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { LiveStreamSchedule, LiveStreamManager, LiveStreamLocation, LiveStreamPropertyType } from '../types/liveStream';
import { TIME_SLOTS } from '../types/liveStream';
import { getLiveStreamManagers, getLiveStreamLocations, getLiveStreamPropertyTypes, createLiveStreamSchedule, updateLiveStreamSchedule, getWeeklySchedule, cleanupExpiredEditingStatus } from '../api/liveStreamApi';
import { fetchBannersByPageType } from '../api/bannersApi';
import { supabase } from '../supaClient';
import { useRealtimeConcurrencyControl } from '../hooks/useRealtimeConcurrencyControl';
import { useUser } from '../context/UserContext';
const { Option } = Select;



// 独立的卡片组件，使用memo优化性能
const ScheduleCard = memo<{
  schedule: LiveStreamSchedule | undefined;
  timeSlot: any;
  dateInfo: any;
  onCardClick: (schedule: LiveStreamSchedule | undefined, timeSlot: any, dateInfo: any) => void;
  userAvatars: { [key: number]: string };
  avatarFrames: { [key: number]: string };
  isConnected: boolean;
  getCardColor: (id: string) => { bg: string; text: string };
  cardUpdateKey?: number;
  currentUserId?: string;
  currentProfileId?: number;
}>(({ 
  schedule, 
  timeSlot, 
  dateInfo, 
  onCardClick, 
  userAvatars, 
  avatarFrames, 
  isConnected, 
  getCardColor,
  cardUpdateKey,
  currentUserId,
  currentProfileId
}) => {
  // 检查是否可以编辑：无记录、状态为available、或状态为空（排除editing状态）
  const canEdit = !schedule || schedule.status === 'available' || (!schedule.status && schedule.status !== 'editing');
  
  // 检查是否是当前用户报名的 - 使用profile.id进行比较
  const isMyBooking = schedule && currentProfileId && (
    schedule.createdBy === currentProfileId || 
    schedule.managers.some(manager => parseInt(manager.id) === currentProfileId)
  );
  
  // 添加调试信息
  if (schedule && currentProfileId) {
    console.log('🔍 状态栏调试信息:', {
      scheduleId: schedule.id,
      currentProfileId: currentProfileId,
      createdBy: schedule.createdBy,
      managers: schedule.managers.map(m => ({ id: m.id, parsedId: parseInt(m.id) })),
      isMyBooking: isMyBooking,
      isCreator: schedule.createdBy === currentProfileId,
      isParticipant: schedule.managers.some(manager => parseInt(manager.id) === currentProfileId)
    });
  }
  
  if (canEdit) {
    return (
      <div
        key={`${schedule?.id || 'empty'}-${cardUpdateKey || 0}`}
        onClick={() => onCardClick(schedule, timeSlot, dateInfo)}
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
        {isMyBooking && (
          <div style={{
            background: '#faad14',
            color: 'white',
            fontSize: '10px',
            padding: '2px 2px 2px 2px',
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
        key={`${schedule.id}-${cardUpdateKey || 0}`}
        onClick={() => onCardClick(schedule, timeSlot, dateInfo)}
        style={{
          background: 'white',
          border: schedule.status === 'editing' ? '1px solid #52c41a' : 
                  (schedule.status === 'available' || !schedule.status) ? '2px solid #1890ff' : '1px solid #e8e8e8',
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

        {/* 上半部分容器 - 人名区域 */}
        <div style={{
          background: (schedule.status === 'available' || !schedule.status || schedule.status === 'editing') ? '#ffffff' : getCardColor(schedule.id).bg,
          padding: '2px 2px',
          margin: '0',
          borderBottom: schedule.status === 'editing' ? '1px solid #52c41a' :
                       (schedule.status === 'available' || !schedule.status) ? '1px solid #1890ff' : '1px solid #e8e8e8',
          width: '100%',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          overflow: 'hidden',
          boxSizing: 'border-box'
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
                color: '#1890ff',
                fontWeight: '600',
                lineHeight: '1.2'
              }}>
                立即报名
              </span>
            </div>
          ) : schedule.status === 'editing' ? (
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
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0,
              width: 'auto',
              marginLeft: '2px',
              marginRight: '2px'
            }}>
              {schedule.managers.slice(0, 2).map((manager, index) => {
                const managerId = parseInt(manager.id);
                const avatarUrl = userAvatars[managerId] || '';
                const frameUrl = avatarFrames[managerId] || '';

                return (
                  <div
                    key={manager.id}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      border: '1px solid #e8e8e8',
                      zIndex: 1,
                      transform: index === 1 ? 'translateX(-6px)' : 'translateX(0)'
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
                        fontSize: '12px',
                        color: '#999',
                        fontWeight: '500',
                        zIndex: 1,
                      }}>
                        {manager.name.charAt(0)}
                      </span>
                    )}
                    {/* 头像框 */}
                    {frameUrl && (
                      <img
                        src={frameUrl}
                        alt="头像框"
                        style={{
                          width: '56px',
                          height: '56px',
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
          {(schedule.status === 'available' || !schedule.status || schedule.status === 'editing') ? null : (
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
            title={schedule.location.name}>
              {schedule.location.name}
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
        {isMyBooking && (
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
      </div>
    </Tooltip>
  );
});

ScheduleCard.displayName = 'ScheduleCard';

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

  // 添加卡片级别的更新状态
  const [cardUpdateKeys, setCardUpdateKeys] = useState<{ [key: string]: number }>({});

  // 使用realtime并发控制
  const { 
    isConnected
  } = useRealtimeConcurrencyControl();

  // 自动清理过期的编辑状态
  useEffect(() => {
    const performCleanup = async () => {
      try {
        console.log('🧹 开始自动清理过期的编辑状态');
        await cleanupExpiredEditingStatus();
        console.log('✅ 自动清理完成');
      } catch (error) {
        console.error('❌ 自动清理过期编辑状态失败:', error);
      }
    };
    
    // 页面加载时立即清理一次
    performCleanup();
    
    // 每5分钟自动清理一次
    const interval = setInterval(performCleanup, 5 * 60 * 1000);
    
    console.log('⏰ 自动清理定时器已启动，间隔：5分钟');
    
    return () => {
      console.log('🛑 清理自动清理定时器');
      clearInterval(interval);
    };
  }, []);

  // 统一的权限检查函数
  const checkEditPermission = async (schedule: LiveStreamSchedule): Promise<{ hasPermission: boolean; message?: string }> => {
    console.log('🔐 开始统一权限检查');
    console.log('📋 检查记录:', {
      id: schedule.id,
      status: schedule.status,
      editingBy: schedule.editingBy,
      createdBy: schedule.createdBy,
      managersCount: schedule.managers.length
    });

    // 检查用户登录状态
    if (!user) {
      console.error('❌ 用户未登录');
      return { hasPermission: false, message: '用户未登录' };
    }

    console.log('👤 当前用户ID:', user.id);

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

      console.log('📋 用户profile ID:', userProfile.id);

      // 根据记录状态进行不同的权限检查
      if (schedule.status === 'booked') {
        // booked状态：检查是否是创建者或参与者
        const isCreator = schedule.createdBy === userProfile.id;
        const isParticipant = schedule.managers.some(m => parseInt(m.id) === userProfile.id);
        
        console.log('🔍 booked权限检查结果:', {
          isCreator,
          isParticipant,
          createdBy: schedule.createdBy,
          participantIds: schedule.managers.map(m => m.id)
        });
        
        if (!isCreator && !isParticipant) {
          return { 
            hasPermission: false, 
            message: '只有记录创建者或报名人可以编辑已报名的记录' 
          };
        }
        
        console.log('✅ booked权限检查通过');
        return { hasPermission: true };
        
      } else if (schedule.status === 'editing') {
        // editing状态：检查是否是编辑者本人
        // 如果editingBy为null，可能是数据库字段未正确设置，允许编辑
        const isEditor = schedule.editingBy === userProfile.id;
        const isNullEditingBy = schedule.editingBy === null;
        
        console.log('🔍 editing权限检查结果:', {
          isEditor,
          isNullEditingBy,
          editingBy: schedule.editingBy,
          currentUserId: userProfile.id
        });
        
        // 如果editingBy为null，允许编辑（可能是数据库字段未正确设置）
        if (isNullEditingBy) {
          console.log('✅ editingBy为null，允许编辑');
          return { hasPermission: true };
        }
        
        if (!isEditor) {
          return { 
            hasPermission: false, 
            message: '该记录正在被其他用户编辑，请稍后再试' 
          };
        }
        
        console.log('✅ editing权限检查通过');
        return { hasPermission: true };
        
      } else if (schedule.status === 'available' || !schedule.status) {
        // available状态或无状态：任何人都可以编辑
        console.log('✅ available状态或无状态，允许编辑');
        return { hasPermission: true };
        
      } else {
        // 其他状态：默认不允许编辑
        console.log('⚠️ 其他状态，不允许编辑');
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
      }

      setAvatarFrames(prev => ({ ...prev, ...frameMap }));
    } catch (error) {
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

    // 测试实时连接
    const testChannel = supabase.channel('test-connection')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_schedules'
      }, (payload) => {
      })
      .subscribe((status) => {
      });
    
    const channel = supabase.channel('live-stream-schedules')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_schedules'
      }, async (payload) => {
        console.log('🎯 主通道收到事件:', payload);
        console.log('🎯 事件类型:', payload.eventType);
        console.log('🎯 事件ID:', (payload.new as any)?.id);
        console.log('🎯 事件状态:', (payload.new as any)?.status);
        console.log('🎯 事件参与者:', (payload.new as any)?.participant_ids);
        
        if (payload.eventType === 'INSERT') {
          const newSchedule = payload.new;
          console.log('📝 收到INSERT事件，新增记录:', {
            id: newSchedule.id,
            date: newSchedule.date,
            time_slot_id: newSchedule.time_slot_id,
            status: newSchedule.status,
            participant_ids: newSchedule.participant_ids
          });
          
          // 检查是否在当前选中的周范围内
          const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
          const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
          
          if (newSchedule.date >= weekStart && newSchedule.date <= weekEnd) {
            console.log('✅ 新记录在当前周范围内，添加到本地状态');
            
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
              console.log('🔄 本地状态已更新，当前记录数:', updated.length);
              return updated;
            });
            
            // 更新特定卡片
            const cardKey = newSchedule.id.toString();
            console.log('🔄 更新卡片:', cardKey);
            updateSingleCard(cardKey);
          } else {
            console.log('ℹ️ 新记录不在当前周范围内，忽略');
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedSchedule = payload.new;
          console.log('📊 收到UPDATE事件详情:');
          console.log('  - 记录ID:', updatedSchedule.id);
          console.log('  - 旧状态:', (payload.old as any)?.status);
          console.log('  - 新状态:', updatedSchedule.status);
          console.log('  - 参与者IDs:', updatedSchedule.participant_ids);
          console.log('  - 地点:', updatedSchedule.location);
          console.log('  - 户型:', updatedSchedule.notes);
          
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
            console.log('🔄 本地状态已更新');
            console.log('  - 更新后的状态:', updatedSchedule.status);
            return updated;
          });
          
          // 更新特定卡片
          const cardKey = updatedSchedule.id.toString();
          console.log('🔄 更新卡片:', cardKey);
          updateSingleCard(cardKey);
        } else if (payload.eventType === 'DELETE') {
          const deletedSchedule = payload.old;
          console.log('🗑️ 收到DELETE事件，删除记录:', {
            id: deletedSchedule.id,
            date: deletedSchedule.date,
            time_slot_id: deletedSchedule.time_slot_id
          });
          
          // 从本地状态中移除
          setSchedules(prev => {
            const updated = prev.filter(schedule => schedule.id !== deletedSchedule.id.toString());
            console.log('🔄 本地状态已更新，移除记录后剩余:', updated.length);
            return updated;
          });
          
          // 更新特定卡片
          const cardKey = deletedSchedule.id.toString();
          console.log('🔄 更新卡片:', cardKey);
          updateSingleCard(cardKey);
        }
      })
      .subscribe((status) => {
        console.log('LiveStream实时订阅状态:', status);
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(testChannel);
    };
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
      // 使用UTC时间，避免时区问题
      const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
      
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

  // 测试函数：检查数据库中的记录
  const testDatabaseRecords = async () => {
    try {
      // 使用UTC时间，避免时区问题
      const weekStart = selectedWeek.startOf('week').utc().format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').utc().format('YYYY-MM-DD');
      
      
      const { data, error } = await supabase
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
    console.log('🔍 开始验证报名状态');
    console.log('  - 记录ID:', scheduleId);
    console.log('  - 期望状态:', expectedStatus);
    console.log('  - 当前schedules数量:', schedules.length);
    
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.warn('❌ 未找到对应的安排记录');
      console.log('  - 可用的记录IDs:', schedules.map(s => s.id));
      return false;
    }
    
    console.log('  - 找到记录:', schedule);
    console.log('  - 记录状态:', schedule.status);
    
    if (schedule.status !== expectedStatus) {
      console.warn(`❌ 状态不匹配：期望 ${expectedStatus}，实际 ${schedule.status}`);
      return false;
    }
    
    console.log('✅ 状态验证通过');
    return true;
  };



  // 处理创建/编辑安排
  const handleScheduleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 权限检查：确保用户有权限提交编辑
      if (editingSchedule) {
        console.log('🔐 提交前进行权限检查');
        const permissionResult = await checkEditPermission(editingSchedule);
        
        if (!permissionResult.hasPermission) {
          console.warn('⚠️ 提交权限检查失败:', permissionResult.message);
          message.warning(permissionResult.message || '无权限提交此编辑');
          setLoading(false);
          return;
        }
        
        console.log('✅ 提交权限检查通过');
      }
      
      // 验证管家数量
      if (!values.managers || values.managers.length !== 2) {
        message.error('请选择2名直播管家');
        return;
      }
      
      const scheduleData = {
        date: editingSchedule ? editingSchedule.date : dayjs().format('YYYY-MM-DD'),
        timeSlotId: values.timeSlot,
        managers: managers.filter(m => values.managers.includes(m.id)),
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
          form.resetFields();
          
          // 重新加载数据以显示最新状态
          await loadData();
          
          // 验证报名状态是否正确
          setTimeout(() => {
            console.log('🔍 延迟验证报名状态');
            console.log('  - 验证记录ID:', recordId);
            if (validateBookingStatus(recordId, 'booked')) {
              console.log('✅ 状态验证成功');
            } else {
              console.error('❌ 状态验证失败');
              // 如果第一次验证失败，再延迟2秒重试一次
              setTimeout(() => {
                console.log('🔄 重试验证报名状态');
                if (validateBookingStatus(recordId, 'booked')) {
                  console.log('✅ 重试验证成功');
                } else {
                  console.error('❌ 重试验证仍然失败');
                }
              }, 2000);
            }
          }, 2000); // 延迟2秒验证，确保数据已更新
          
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
    console.log('📝 开始编辑安排');
    console.log('📋 要编辑的记录:', {
      id: schedule.id,
      status: schedule.status,
      managers: schedule.managers.map(m => ({ id: m.id, name: m.name })),
      location: schedule.location,
      propertyType: schedule.propertyType
    });
    
    try {
      // 使用统一的权限检查函数
      const permissionResult = await checkEditPermission(schedule);
      
      if (!permissionResult.hasPermission) {
        console.warn('⚠️ 权限检查失败:', permissionResult.message);
        message.warning(permissionResult.message || '无权限编辑此记录');
        return;
      }
      
      console.log('✅ 权限检查通过');

      // 设置编辑状态
      console.log('🎨 设置编辑状态并打开弹窗');
      setEditingSchedule(schedule);
      setModalVisible(true);
      
      // 延迟设置表单值，确保Form组件已经渲染
      setTimeout(() => {
        console.log('📝 设置表单值');
        const formValues = {
          timeSlot: schedule.timeSlotId,
          managers: schedule.managers.length > 0 ? schedule.managers.map(m => m.id) : [],
          location: schedule.location.id || undefined,
          propertyType: schedule.propertyType.id || undefined,
        };
        console.log('📋 表单值:', formValues);
        form.setFieldsValue(formValues);
        console.log('✅ 表单值设置完成');
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
              isConnected={isConnected}
              getCardColor={getCardColor}
              cardUpdateKey={cardUpdateKeys[schedule?.id || `${dateInfo.date}-${record.timeSlot.id}`] || 0}
              currentUserId={user?.id}
              currentProfileId={userProfile?.id}
            />
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

  // 处理弹窗关闭的统一函数
  const handleModalClose = async () => {
    console.log('🚪 开始关闭弹窗');
    console.log('📋 当前编辑的记录:', editingSchedule ? {
      id: editingSchedule.id,
      status: editingSchedule.status,
      managers: editingSchedule.managers,
      location: editingSchedule.location,
      propertyType: editingSchedule.propertyType
    } : '无');
    
    if (editingSchedule) {
      // 检查是否是临时记录或editing状态的记录
      const isTempSchedule = editingSchedule.managers.length === 0;
      const isEditingSchedule = editingSchedule.status === 'editing';
      
      console.log('🔍 检查记录类型:', {
        isTempSchedule,
        isEditingSchedule,
        status: editingSchedule.status
      });
      console.log('📊 检查条件:', {
        managersEmpty: editingSchedule.managers.length === 0
      });
      
      // 对于临时记录，直接删除
      if (isTempSchedule) {
        console.log('🗑️ 开始删除临时记录');
        console.log('📋 要删除的记录ID:', editingSchedule.id);
        console.log('📋 删除原因: 临时记录');
        
        try {
          console.log('🔄 执行数据库删除操作...');
          console.log('📋 删除记录详情:', {
            id: editingSchedule.id,
            idType: typeof editingSchedule.id,
            status: editingSchedule.status,
            managers: editingSchedule.managers.length
          });
          
          // 检查ID是否为有效数字
          const recordId = parseInt(editingSchedule.id);
          if (isNaN(recordId)) {
            console.error('❌ 记录ID无效:', editingSchedule.id);
            throw new Error('记录ID无效');
          }
          
          console.log('📋 使用数字ID进行删除:', recordId);
          
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
            console.log('✅ 记录删除成功');
            console.log('📊 删除结果:', data);
            
            // 验证删除是否真的成功
            if (data && data.length > 0) {
              console.log('⚠️ 删除操作返回了数据，可能删除失败');
              console.log('📊 返回的数据:', data);
            } else {
              console.log('✅ 删除操作成功，没有返回数据');
            }
            
            // 手动从本地状态中移除记录，确保UI立即更新
            console.log('🔄 手动更新本地状态');
            setSchedules(prev => {
              const updated = prev.filter(schedule => schedule.id !== editingSchedule.id);
              console.log('🔄 本地状态已更新，移除记录后剩余:', updated.length);
              return updated;
            });
            
            // 手动触发卡片更新
            console.log('🔄 手动更新卡片:', editingSchedule.id);
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
        console.log('🔐 对其他记录进行权限检查');
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
        
        console.log('✅ 删除权限检查通过');
        
        // 权限检查通过后，如果是editing状态记录，也删除
        if (isEditingSchedule) {
          console.log('🗑️ 删除editing状态记录');
          try {
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
              console.error('❌ 删除editing状态记录失败:', error);
            } else {
              console.log('✅ editing状态记录删除成功');
              
              // 手动从本地状态中移除记录
              setSchedules(prev => {
                const updated = prev.filter(schedule => schedule.id !== editingSchedule.id);
                console.log('🔄 本地状态已更新，移除记录后剩余:', updated.length);
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
      console.log('ℹ️ 没有编辑记录，无需删除');
    }
    
    console.log('🧹 清理状态...');
    setModalVisible(false);
    setEditingSchedule(null);
    form.resetFields();
    message.info('已取消编辑');
    
    console.log('🔄 重新加载数据...');
    await loadData(); // 重新加载数据
    console.log('✅ 弹窗关闭流程完成');
  };

  // 处理卡片点击
  const handleCardClick = async (schedule: LiveStreamSchedule | undefined, timeSlot: any, dateInfo: any) => {
    if (!schedule) {
      // 创建临时记录
      console.log('🎯 开始创建临时记录');
      console.log('📅 日期信息:', dateInfo);
      console.log('⏰ 时间段信息:', timeSlot);
      
      try {
        const tempScheduleData = {
          date: dateInfo.date,
          timeSlotId: timeSlot.id,
          managers: [], // 设置为空数组，表示未选择人员
          location: { id: '', name: '' }, // 设置为空，表示未选择位置
          propertyType: { id: '', name: '' }, // 设置为空，表示未选择户型
          status: 'editing' as const, // 明确指定为editing状态
        };

        console.log('📊 准备创建的临时记录数据:', tempScheduleData);
        console.log('🔄 调用 createLiveStreamSchedule API...');
        
        const tempSchedule = await createLiveStreamSchedule(tempScheduleData);
        
        console.log('✅ 临时记录创建成功');
        console.log('📋 创建的记录详情:', {
          id: tempSchedule.id,
          date: tempSchedule.date,
          timeSlotId: tempSchedule.timeSlotId,
          status: tempSchedule.status,
          managers: tempSchedule.managers,
          location: tempSchedule.location,
          propertyType: tempSchedule.propertyType
        });
        
        setEditingSchedule(tempSchedule);
        setModalVisible(true);
        
        console.log('🎨 弹窗已激活，设置编辑状态');
        
        // 延迟设置表单值，确保Form组件已经渲染
        setTimeout(() => {
          console.log('📝 设置表单初始值');
          form.setFieldsValue({
            timeSlot: timeSlot.id
          });
          console.log('✅ 表单初始值设置完成');
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
      console.log('📝 编辑现有记录:', {
        id: schedule.id,
        status: schedule.status,
        managers: schedule.managers.map(m => m.name),
        location: schedule.location.name,
        propertyType: schedule.propertyType.name
      });
      
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
          console.error('获取用户profile失败:', error);
          setUserProfile(null);
        } else {
          console.log('✅ 获取用户profile成功:', profile);
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('获取用户profile异常:', error);
        setUserProfile(null);
      }
    };

    fetchUserProfile();
  }, [user]);

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
          
          // 检查表单是否有未保存的更改
          const formValues = form.getFieldsValue();
          
          const hasUnsavedChanges = (formValues.managers && formValues.managers.length > 0);
          
          if (hasUnsavedChanges) {
            // 有未保存的更改
            showConfirmModal(
              '确认关闭编辑',
              '您有未保存的更改，确定要关闭吗？\n\n关闭后：\n1. 未保存的更改将丢失',
              async () => {
                await handleModalClose();
              }
            );
          } else {
            // 没有未保存的更改
            showConfirmModal(
              '确认取消编辑',
              '确定要取消编辑吗？',
              async () => {
                await handleModalClose();
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
              styles={{
                popup: {
                  root: {
                    maxWidth: '400px'
                  }
                }
              }}
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

          <Form.Item>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button 
                onClick={async () => {
                  // 检查表单是否有未保存的更改
                  const formValues = form.getFieldsValue();
                  
                  const hasUnsavedChanges = (formValues.managers && formValues.managers.length > 0);
                  
                  if (hasUnsavedChanges) {
                    // 有未保存的更改
                    showConfirmModal(
                      '确认取消编辑',
                      '您有未保存的更改，确定要取消吗？\n\n取消后：\n1. 未保存的更改将丢失\n2. 临时记录将被删除',
                      async () => {
                        await handleModalClose();
                      }
                    );
                  } else {
                    // 没有未保存的更改
                    showConfirmModal(
                      '确认取消编辑',
                      '确定要取消编辑吗？',
                      async () => {
                        await handleModalClose();
                      }
                    );
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
    </div>
  );
};

export default LiveStreamRegistration;