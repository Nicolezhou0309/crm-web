import React, { useState, useEffect } from 'react';
import {
  List, Button, Tag, Modal, Descriptions, Space, Typography,
  Tooltip, Empty, Tabs, notification, Avatar, Skeleton, Popconfirm, message
} from 'antd';
import {
  BellOutlined, CheckOutlined, EyeOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import { notificationApi, type Notification, type Announcement } from '../api/notificationApi';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TabPane } = Tabs;

interface NotificationCenterProps {
  onNotificationChange?: (count: number) => void;
}

// 通知类型映射
const typeMap: Record<string, string> = {
  all: '全部',
  system: '系统',
  task_reminder: '任务',
  duplicate_customer: '客户',
  lead_assignment: '线索',
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNotificationChange
}) => {
  const { user } = useAuth();
  const { isDepartmentAdmin } = usePermissions();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsHandled,
    deleteNotification,
    loading
  } = useRealtimeNotifications();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // 拉取公告
  useEffect(() => {
    notificationApi.getAnnouncements().then(setAnnouncements).catch(console.error);
  }, []);

  // 合并数据，按时间倒序
  const allItems = [
    ...announcements.map(a => ({ ...a, _type: 'announcement' as const })),
    ...notifications.map(n => ({ ...n, _type: 'notification' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 统计所有类型
  const allTypes = ['all', ...Array.from(new Set(notifications.map(n => n.type)))];

  // 只统计通知未读数
  useEffect(() => {
    onNotificationChange?.(unreadCount);
  }, [unreadCount, onNotificationChange]);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailModalVisible(true);
    if (notification.status === 'unread') {
      markAsRead(notification.id);
      // 立即在本地更新状态，提升响应体验
      notification.status = 'read';
    }
  };

  const handleNotificationAction = async (notificationId: string, action: 'read' | 'handled' | 'delete') => {
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
      } else {
        notification.success({
          message: action === 'read' ? '已标记为已读' : '已标记为已处理'
        });
      }
    } catch (error) {
      console.error('❌ 操作失败:', error);
      notification.error({
        message: '操作失败',
        description: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
      'lead_assignment': { icon: '🎯', color: '#1890ff' },
      'duplicate_customer': { icon: '🔄', color: '#fa8c16' },
      'system': { icon: '🔔', color: '#52c41a' },
      'task_reminder': { icon: '⏰', color: '#722ed1' }
    };
    return iconMap[type] || { icon: '📢', color: '#666' };
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'unread': 'red',
      'read': 'blue',
      'handled': 'green'
    };
    return statusMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'unread': '未读',
      'read': '已读',
      'handled': '已处理'
    };
    return statusMap[status] || status;
  };

  const renderNotificationItem = (notification: Notification) => {
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
          padding: '12px'
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
              <Text strong={isUnread}>{notification.title}</Text>
              <Tag color={getStatusColor(notification.status)}>
                {getStatusText(notification.status)}
              </Tag>
              {notification.priority > 0 && (
                <Tag color="red">优先级 {notification.priority}</Tag>
              )}
            </Space>
          }
          description={
            <div>
              <div style={{ marginBottom: '4px' }}>
                <Text type="secondary">{notification.content}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {dayjs(notification.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
            </div>
          }
        />
        <div>
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="删除通知">
            <Button type="text" icon={<DeleteOutlined />} danger onClick={e => { e.stopPropagation(); handleNotificationAction(notification.id, 'delete'); }} />
          </Tooltip>
        </div>
      </List.Item>
    );
  };

  // 渲染单条
  const renderItem = (item: any) => {
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
            padding: '12px'
          }}
        >
          <List.Item.Meta
            avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<span style={{ fontSize: '16px' }}>📢</span>} />}
            title={<Space><Text strong>{item.title}</Text><Tag color="blue">公告</Tag>{item.priority > 0 && <Tag color="red">优先级 {item.priority}</Tag>}</Space>}
            description={<div><div style={{ marginBottom: '4px' }}><Text type="secondary">{item.content}</Text></div><div><Text type="secondary" style={{ fontSize: '12px' }}>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text></div></div>}
          />
        </List.Item>
      );
    } else {
      return renderNotificationItem(item);
    }
  };

  // 分类过滤
  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeTab);

  return (
    <div className="notification-center-main">

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="notification-center-tabs">
        <TabPane tab={<span>全部</span>} key="all">
          {loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : allItems.length === 0 ? (
            <Empty description="暂无通知或公告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              dataSource={allItems}
              renderItem={renderItem}
              pagination={false}
            />
          )}
        </TabPane>
        {/* 其他Tab可保留原有逻辑，仅展示通知 */}
        {allTypes.filter(type => type !== 'all').map(type => (
          <TabPane
            tab={<span>{typeMap[type] || type}{type === 'all' ? (unreadCount > 0 && <Tag color="red" style={{ marginLeft: 6 }}>{unreadCount}</Tag>) : (notifications.filter(n => n.type === type && n.status === 'unread').length > 0 && <Tag color="red" style={{ marginLeft: 6 }}>{notifications.filter(n => n.type === type && n.status === 'unread').length}</Tag>)}</span>}
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
              />
            )}
          </TabPane>
        ))}
      </Tabs>

      {/* 通知详情弹窗 */}
      <Modal
        title="通知详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          selectedNotification ? (
            selectedNotification.status !== 'handled' ? [
              <Button key="cancel" onClick={() => setDetailModalVisible(false)}>
                关闭
              </Button>,
              selectedNotification.status === 'unread' && (
                <Button
                  key="read"
                  icon={<EyeOutlined />}
                  onClick={() => handleNotificationAction(selectedNotification.id, 'read')}
                >
                  标记为已读
                </Button>
              ),
              <Button
                key="handled"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleNotificationAction(selectedNotification.id, 'handled')}
              >
                标记为已处理
              </Button>,
              <Button
                key="delete"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleNotificationAction(selectedNotification.id, 'delete')}
              >
                删除
              </Button>
            ] : [
              <Button key="close" onClick={() => setDetailModalVisible(false)}>
                关闭
              </Button>,
              <Button
                key="delete"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleNotificationAction(selectedNotification.id, 'delete')}
              >
                删除
              </Button>
            ]
          ) : [
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
          ]
        }
        width={600}
      >
        {selectedNotification && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="通知类型" span={2}>
                <Space>
                  <span>{getNotificationIcon(selectedNotification.type).icon}</span>
                  <span>{selectedNotification.type}</span>
                </Space>
              </Descriptions.Item>

              <Descriptions.Item label="状态" span={2}>
                <Tag color={getStatusColor(selectedNotification.status)}>
                  {getStatusText(selectedNotification.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="标题" span={2}>
                {selectedNotification.title}
              </Descriptions.Item>

              <Descriptions.Item label="内容" span={2}>
                {selectedNotification.content}
              </Descriptions.Item>

              {selectedNotification.metadata && (
                <Descriptions.Item label="详细信息" span={2}>
                  <pre style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                    {JSON.stringify(selectedNotification.metadata, null, 2)}
                  </pre>
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
                <Descriptions.Item label="处理时间">
                  {dayjs(selectedNotification.handled_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
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
            <Descriptions.Item label="优先级">{selectedAnnouncement.priority}</Descriptions.Item>
            <Descriptions.Item label="生效时间">{dayjs(selectedAnnouncement.start_time).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(selectedAnnouncement.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}; 