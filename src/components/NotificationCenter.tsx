import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  List, Button, Tag, Modal, Descriptions, Space, Typography,
  Tooltip, Empty, Tabs, notification, Avatar, Skeleton, message
} from 'antd';
const { TabPane } = Tabs;
import {
  CheckOutlined, EyeOutlined, DeleteOutlined, CopyOutlined, ClockCircleOutlined, CheckCircleOutlined} from '@ant-design/icons';
import { notificationApi, type Announcement } from '../api/notificationApi';
// import { useUser } from '../context/UserContext';
import dayjs from 'dayjs';
import { useState as useReactState } from 'react';
import { message as antdMessage } from 'antd';
import { supabase } from '../supaClient';
import { useNavigate } from 'react-router-dom';
// 保留 antd Typography.Text 的 import，删除自定义 Notification 类型的 import
interface NotificationCenterProps {
  notifications?: any[];
  unreadCount?: number;
  markAsRead?: (id: string) => Promise<void>;
  markAsHandled?: (id: string) => Promise<void>;
  deleteNotification?: (id: string) => Promise<void>;
  loading?: boolean;
  onNotificationChange?: (count: number) => void;
  simple?: boolean; // 是否使用简化版显示
  onViewAll?: () => void; // 查看全部回调
}

// 通知类型映射
const typeMap: Record<string, string> = {
  all: '全部',
  announcement: '公告', // 新增公告分组
  system: '系统',
  task_reminder: '任务',
  duplicate_customer: '客户',
  lead_assignment: '线索',
  followup_assignment: '线索', // 新增映射
};

// 防抖函数
const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 移除阶段颜色映射

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications: propsNotifications,
  unreadCount: propsUnreadCount,
  markAsRead: propsMarkAsRead,
  markAsHandled: propsMarkAsHandled,
  deleteNotification: propsDeleteNotification,
  loading: propsLoading,
  onNotificationChange,
  simple = false,
  onViewAll
}) => {
  // const { user } = useUser();
  // 如果 props 传递了 notifications/unreadCount 等，则优先用 props，否则用内部 hook
  // 移除 useRealtimeNotifications 相关代码
  const notifications = propsNotifications ?? [];
  const unreadCount = propsUnreadCount ?? 0;
  const markAsRead = propsMarkAsRead ?? (async () => {});
  const markAsHandled = propsMarkAsHandled ?? (async () => {});
  const deleteNotification = propsDeleteNotification ?? (async () => {});
  const loading = propsLoading ?? false;

  // props 传递日志

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);

  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showRaw, setShowRaw] = useReactState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // 强制更新计数器

  // 防抖的通知数量回调
  const debouncedNotificationChange = useCallback(
    debounce((count: number) => {
      onNotificationChange?.(count);
    }, 100),
    [onNotificationChange]
  );

  // 拉取公告 - 添加缓存
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        // 先尝试使用缓存
        const cachedAnnouncements = localStorage.getItem('announcements_cache');
        const cacheTimestamp = localStorage.getItem('announcements_timestamp');
        
        if (cachedAnnouncements && cacheTimestamp) {
          const cacheAge = Date.now() - parseInt(cacheTimestamp);
          // 缓存5分钟有效
          if (cacheAge < 5 * 60 * 1000) {
            setAnnouncements(JSON.parse(cachedAnnouncements));
            return;
          }
        }
        
        const data = await notificationApi.getAnnouncements();
        setAnnouncements(data);
        
        // 更新缓存
        localStorage.setItem('announcements_cache', JSON.stringify(data));
        localStorage.setItem('announcements_timestamp', Date.now().toString());
      } catch (error) {
        // 静默处理错误，尝试使用缓存数据
        const cachedAnnouncements = localStorage.getItem('announcements_cache');
        if (cachedAnnouncements) {
          setAnnouncements(JSON.parse(cachedAnnouncements));
        }
      }
    };
    
    loadAnnouncements();
  }, []);

  // 合并数据，按时间倒序 - 使用useMemo优化

  // 统计所有类型 - 使用useMemo优化
  const allTypes = useMemo(() => {
    // 只统计通知类型，不含公告
    const notificationTypes = Array.from(new Set((notifications as any[]).map((n: any) => n.type)));
    // 固定顺序：全部、公告、其他类型
    const result = ['all', 'announcement', ...notificationTypes];
    return result;
  }, [notifications]);

  // 只统计通知未读数 - 使用useMemo优化
  useEffect(() => {
    debouncedNotificationChange(unreadCount);
  }, [unreadCount, debouncedNotificationChange]);

  // 添加通知数据变化监听
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [notifications]);

  // 通知点击处理 - 使用useCallback优化
  const handleNotificationClick = useCallback((notification: any) => {
    setSelectedNotification(notification);
    setDetailModalVisible(true);
    if (notification.status === 'unread') {
      markAsRead(notification.id);
    }
  }, [markAsRead]);

  // 通知操作处理 - 使用useCallback优化
  const handleNotificationAction = useCallback(async (notificationId: string, action: 'read' | 'handled' | 'delete') => {
    try {
      if (action === 'read') {
        await markAsRead(notificationId);
      } else if (action === 'handled') {
        await markAsHandled(notificationId);
      } else if (action === 'delete') {
        await deleteNotification(notificationId);
      }
      setDetailModalVisible(false);
      if (action === 'delete') {
        message.success('已删除通知');
      }
    } catch (error) {
      notification.error({
        message: '操作失败',
        description: error instanceof Error ? error.message : '未知错误'
      });
    }
  }, [markAsRead, markAsHandled, deleteNotification]);

  // 获取通知图标 - 使用useMemo优化
  const getNotificationIcon = useCallback((type: string) => {
    const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
      'lead_assignment': { icon: '🎯', color: '#1890ff' },
      'duplicate_customer': { icon: '🔄', color: '#fa8c16' },
      'system': { icon: '🔔', color: '#52c41a' },
      'task_reminder': { icon: '⏰', color: '#722ed1' }
    };
    return iconMap[type] || { icon: '📢', color: '#666' };
  }, []);

  // 获取状态颜色 - 使用useMemo优化
  const getStatusColor = useCallback((status: string) => {
    const statusMap: Record<string, string> = {
      'unread': 'red',
      'read': 'blue',
      'handled': 'green'
    };
    return statusMap[status] || 'default';
  }, []);

  // 获取状态文本 - 使用useMemo优化
  const getStatusText = useCallback((status: string) => {
    const statusMap: Record<string, string> = {
      'unread': '未读',
      'read': '已读',
      'handled': '已接收'
    };
    return statusMap[status] || status;
  }, []);

  // 渲染通知项 - 使用useCallback优化
  const renderNotificationItem = useCallback((notification: any) => {
    const iconInfo = getNotificationIcon(notification.type);
    const isUnread = notification.status === 'unread';
    return (
      <List.Item
        key={notification.id}
        onClick={() => handleNotificationClick(notification)}
        style={{
          cursor: 'pointer',
          backgroundColor: isUnread ? '#f6ffed' : 'transparent',
          border: isUnread ? '1px solid #b7eb8f' : '1px solid transparent',
          borderRadius: '6px',
          marginBottom: '8px',
          padding: '12px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isUnread ? '#f0f9ff' : '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isUnread ? '#f6ffed' : 'transparent';
        }}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              style={{ backgroundColor: iconInfo.color }}
              icon={<span style={{ fontSize: '16px' }}>{iconInfo.icon}</span>}
            />
          }
          title={
            <Space>
              <Typography.Text strong={isUnread}>{notification.title}</Typography.Text>
              <Tag color={getStatusColor(notification.status)}>
                {getStatusText(notification.status)}
              </Tag>
            </Space>
          }
          description={
            <div>
              <div style={{ marginBottom: '4px' }}>
                <Typography.Text type="secondary">{notification.content}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {dayjs(notification.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Typography.Text>
              </div>
            </div>
          }
        />
        <div>
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="删除通知">
            <Button 
              type="text" 
              icon={<DeleteOutlined />} 
              danger 
              onClick={e => { 
                e.stopPropagation(); 
                handleNotificationAction(notification.id, 'delete'); 
              }} 
            />
          </Tooltip>
        </div>
      </List.Item>
    );
  }, [handleNotificationClick, handleNotificationAction, getNotificationIcon, getStatusColor, getStatusText]);

  // 渲染单条 - 使用useCallback优化
  const renderItem = useCallback((item: any) => {
    if (item._type === 'announcement') {
      return (
        <List.Item
          key={item.id}
          onClick={() => { setSelectedAnnouncement(item); setAnnouncementModalVisible(true); }}
          style={{
            cursor: 'pointer',
            backgroundColor: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '6px',
            marginBottom: '8px',
            padding: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f9ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#e6f7ff';
          }}
        >
          <List.Item.Meta
            avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<span style={{ fontSize: '16px' }}>📢</span>} />}
            title={<Space><Typography.Text strong>{item.title}</Typography.Text><Tag color="blue">公告</Tag></Space>}
            description={<div><div style={{ marginBottom: '4px' }}><Typography.Text type="secondary">{item.content}</Typography.Text></div><div><Typography.Text type="secondary" style={{ fontSize: '12px' }}>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</Typography.Text></div></div>}
          />
        </List.Item>
      );
    } else {
      return renderNotificationItem(item);
    }
  }, [renderNotificationItem]);

  // 分类过滤 - 使用useMemo优化
  const filteredNotifications = useMemo(() => {
    const filtered = activeTab === 'all'
      ? notifications
      : (notifications as any[]).filter((n: any) => n.type === activeTab);
    return filtered;
  }, [activeTab, notifications]);

  // 渲染标签页 - 使用useCallback优化
  const renderTabPane = useCallback((type: string) => {
    const unreadCountForType = type === 'all' 
      ? unreadCount 
      : notifications.filter(n => n.type === type && n.status === 'unread').length;
    
    return (
      <TabPane
        tab={
          <span>
            {typeMap[type] || type}
            {unreadCountForType > 0 && (
              <Tag color="red" style={{ marginLeft: 6 }}>
                {unreadCountForType}
              </Tag>
            )}
          </span>
        }
        key={type}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : filteredNotifications.length === 0 ? (
          <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={renderNotificationItem}
            pagination={false}
            style={{ maxHeight: '600px', overflow: 'auto' }}
          />
        )}
      </TabPane>
    );
  }, [activeTab, notifications, unreadCount, loading, filteredNotifications, renderNotificationItem]);

  // 渲染简化版通知项 - 用于悬浮卡片
  const renderSimpleNotificationItem = useCallback((notification: any) => {
    const iconInfo = getNotificationIcon(notification.type);
    const isUnread = notification.status === 'unread';
    
    return (
      <div
        key={notification.id}
        style={{
          padding: '8px 12px',
          backgroundColor: isUnread ? '#f6ffed' : '#f8f9fa',
          border: isUnread ? '1px solid #b7eb8f' : '1px solid #e9ecef',
          borderRadius: '6px',
          marginBottom: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isUnread ? '#f0f9ff' : '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isUnread ? '#f6ffed' : '#f8f9fa';
        }}
        onClick={() => handleNotificationClick(notification)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 图标 */}
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: iconInfo.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}>
            {iconInfo.icon}
          </div>
          
          {/* 内容区域 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: isUnread ? 600 : 400,
              color: isUnread ? '#000' : '#666',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {notification.title}
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: '#999',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {dayjs(notification.created_at).format('MM-DD HH:mm')}
            </div>
          </div>
          
          {/* 状态标签 */}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center', minWidth: '20px', justifyContent: 'flex-end' }}>
            {isUnread && (
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ff4d4f',
                marginRight: '5px'
              }} />
            )}
            {notification.status === 'handled' ? (
              <CheckCircleOutlined style={{
                fontSize: '14px',
                color: '#52c41a'
              }} />
            ) : notification.status === 'read' ? (
              <ClockCircleOutlined style={{
                fontSize: '14px',
                color: '#d9d9d9'
              }} />
            ) : null}
          </div>
        </div>
      </div>
    );
  }, [handleNotificationClick, getNotificationIcon]);

  // 渲染简化版通知列表 - 用于悬浮卡片
  const renderSimpleNotificationList = useCallback(() => {
    const itemHeight = 56; // 每条通知高度，按实际UI调整
    const maxHeight = itemHeight * 4; // 展示3.5张卡片高度
    const total = notifications.length;
  
    if (loading) {
      return (
        <div style={{ padding: '12px' }}>
          <div style={{ height: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ height: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ height: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px' }} />
        </div>
      );
    }
    if (total === 0) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#999',
          fontSize: '12px'
        }}>
          暂无通知
        </div>
      );
    }
    
    // 使用普通List替代VirtualList，确保实时更新
    return (
      <div style={{ padding: '0', maxHeight, overflow: 'auto' }}>
        <List
          dataSource={notifications}
          renderItem={(item: any) => renderSimpleNotificationItem(item)}
          pagination={false}
          style={{ maxHeight }}
          key={`notification-list-${forceUpdate}`} // 强制重新渲染
        />
      </div>
    );
  }, [notifications, loading, renderSimpleNotificationItem, forceUpdate]);

  // 在组件内部添加推进阶段函数
  const handleAdvanceStage = async (leadid: string) => {
    try {
      // 直接使用Supabase客户端更新followups表
      const { error } = await supabase
        .from('followups')
        .update({ followupstage: '确认需求' })
        .eq('leadid', leadid);
      
      if (error) {
        antdMessage.error('推进失败: ' + error.message);
      } else {
        antdMessage.success('已推进到"确认需求"阶段');
        setDetailModalVisible(false);
      }
    } catch (e) {
      antdMessage.error('推进失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  // 新增：接收线索联动推进阶段
  const handleReceiveLead = async () => {
    if (!selectedNotification?.metadata?.leadid) return;
    // 只有待接收阶段才推进
    if (selectedNotification.metadata?.followupstage === '待接收') {
      await handleAdvanceStage(selectedNotification.metadata.leadid);
    }
    await handleNotificationAction(selectedNotification.id, 'handled');
  };

  // 统一操作编号提取逻辑
  const extractOperationId = useCallback((notification: any) => {
    if (notification.type === 'approval') {
      
      // 1. 优先使用related_id（最可靠）
      if (notification.related_id) {
        return notification.related_id;
      }
      
      // 2. 从metadata中获取operation_id
      if (notification.metadata?.operation_id) {
        return notification.metadata.operation_id;
      }
      
      // 3. 从内容中提取"操作编号：" 后面的UUID
      const operationIdMatch = notification.content?.match(/操作编号：\s*([a-f0-9-]+)/i);
      if (operationIdMatch) {
        return operationIdMatch[1];
      }
      
      // 4. 从内容中提取"实例 ID:" 后面的UUID（兼容旧格式）
      const instanceIdMatch = notification.content?.match(/实例\s*ID:\s*([a-f0-9-]+)/i);
      if (instanceIdMatch) {
        return instanceIdMatch[1];
      }
      
      // 5. 从内容中提取任意UUID格式的操作编号
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = notification.content?.match(uuidRegex);
      if (match) {
        return match[0];
      }
      
    }
    return null;
  }, []);

  // 新增：跳转到审批详情
  const navigate = useNavigate();
  const handleGoToApprovalDetails = useCallback(() => {
    
    const operationId = extractOperationId(selectedNotification);
    
    if (operationId) {
      const targetUrl = `/approval-details?tab=all&filter_target_id=${operationId}`;
      navigate(targetUrl);
      setDetailModalVisible(false);
    } else {
      message.warning('无法获取操作编号，无法跳转到审批详情');
    }
  }, [selectedNotification, extractOperationId]);

  return (
    <div className="notification-center-main">
      {simple ? (
        // 简化版显示
        <div>
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#333' 
          }}>
            <span>通知中心</span>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={onViewAll}>
              查看全部{notifications.length > 0 ? ` (${notifications.length})` : ''}
            </Button>
          </div>
          {renderSimpleNotificationList()}
        </div>
      ) : (
        // 完整版显示
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="notification-center-tabs">
          {allTypes.map(type =>
            type === 'announcement' ? (
              <TabPane
                tab={<span>{typeMap[type]}</span>}
                key={type}
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : announcements.length === 0 ? (
                  <Empty description="暂无公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List
                    dataSource={announcements.map(a => ({ ...a, _type: 'announcement' as const }))}
                    renderItem={renderItem}
                    pagination={false}
                    style={{ maxHeight: '600px', overflow: 'auto' }}
                  />
                )}
              </TabPane>
            ) : (
              renderTabPane(type)
            )
          )}
        </Tabs>
      )}

      {/* 通知详情弹窗 */}
      <Modal
        title={(
          <Space>
            <span style={{ fontSize: 20 }}>{getNotificationIcon(selectedNotification?.type || '').icon}</span>
            <span>{selectedNotification?.title}</span>
            <Tag color={getStatusColor(selectedNotification?.status || '')}>
              {getStatusText(selectedNotification?.status || '')}
            </Tag>
          </Space>
        )}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          selectedNotification ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedNotification.type === 'followup_assignment' && selectedNotification.status !== 'handled' && (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleReceiveLead}
                  >
                    接收线索
                  </Button>
                )}
              </div>
              <div>
                {selectedNotification.type === 'approval' && (
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={handleGoToApprovalDetails}
                  >
                    查看审批详情
                  </Button>
                )}
                <Button onClick={() => setDetailModalVisible(false)} style={{ marginLeft: 8 }}>
                  关闭
                </Button>
              </div>
            </div>
          ) : null
        }
        width={selectedNotification?.type === 'followup_assignment' ? 500 : 400}
      >
        {selectedNotification && selectedNotification.type === 'followup_assignment' ? (
          // 新线索专用弹窗
          <div>
            <Descriptions
              column={1}
              bordered
              size="small"
              styles={{ label: { width: 100 }, content: { fontWeight: 500 } }}
            >
              <Descriptions.Item label="线索ID">
                <Space>
                  <Tag color="blue">{selectedNotification.metadata?.leadid}</Tag>
                  {selectedNotification.metadata?.leadid && (
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNotification.metadata.leadid);
                        antdMessage.success('线索编号已复制');
                      }}
                    />
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="分配人">
                <span>👤 {selectedNotification.metadata?.assigned_user_nickname}</span>
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                {selectedNotification.metadata?.phone ? (
                  <Space>
                    📞 {selectedNotification.metadata.phone}
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      style={{ marginLeft: 4 }}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNotification.metadata.phone);
                        antdMessage.success('手机号已复制');
                      }}
                    />
                  </Space>
                ) : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="微信号">
                {selectedNotification.metadata?.wechat ? (
                  <Space>
                    💬 {selectedNotification.metadata.wechat}
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      style={{ marginLeft: 4 }}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNotification.metadata.wechat);
                        antdMessage.success('微信号已复制');
                      }}
                    />
                  </Space>
                ) : '--'}
              </Descriptions.Item>
              {selectedNotification.metadata?.source && (
                <Descriptions.Item label="来源">
                  <span>{selectedNotification.metadata?.source}</span>
                </Descriptions.Item>
              )}
              {selectedNotification.metadata?.leadtype && (
                <Descriptions.Item label="类型">
                  <span>{selectedNotification.metadata?.leadtype}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(selectedNotification.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedNotification.read_at && (
                <Descriptions.Item label="已读时间">
                  {dayjs(selectedNotification.read_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {selectedNotification.handled_at && (
                <Descriptions.Item label="接收时间">
                  {dayjs(selectedNotification.handled_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
            {/* 可选：展开原始JSON */}
            <div style={{ marginTop: 12 }}>
              <Button type="link" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? '隐藏原始数据' : '显示原始数据'}
              </Button>
              {showRaw && (
                <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selectedNotification.metadata, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : selectedNotification ? (
          // 普通通知弹窗
          <div>
            <Descriptions
              column={1}
              bordered
              size="small"
              styles={{ label: { width: 100 }, content: { fontWeight: 500 } }}
            >
              <Descriptions.Item label="标题">
                {selectedNotification.title}
              </Descriptions.Item>
              <Descriptions.Item label="内容">
                {selectedNotification.content}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {typeMap[selectedNotification.type] || selectedNotification.type}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedNotification.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedNotification.read_at && (
                <Descriptions.Item label="已读时间">
                  {dayjs(selectedNotification.read_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {selectedNotification.handled_at && (
                <Descriptions.Item label="处理时间">
                  {dayjs(selectedNotification.handled_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
            {/* 可选：展开原始JSON */}
            <div style={{ marginTop: 12 }}>
              <Button type="link" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? '隐藏原始数据' : '显示原始数据'}
              </Button>
              {showRaw && (
                <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selectedNotification.metadata, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 公告详情弹窗 */}
      <Modal
        title="公告详情"
        open={announcementModalVisible}
        onCancel={() => setAnnouncementModalVisible(false)}
        footer={<Button onClick={() => setAnnouncementModalVisible(false)}>关闭</Button>}
      >
        {selectedAnnouncement && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="标题">{selectedAnnouncement.title}</Descriptions.Item>
            <Descriptions.Item label="内容">{selectedAnnouncement.content}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedAnnouncement.type}</Descriptions.Item>

            <Descriptions.Item label="生效时间">{dayjs(selectedAnnouncement.start_time).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(selectedAnnouncement.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}; 