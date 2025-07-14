import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Button, Tag, Modal, Descriptions, Space, Typography, Tooltip, Empty, Spin } from 'antd';
import { BellOutlined, CheckOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { DuplicateNotification } from '../types/allocation';
import { NOTIFICATION_STATUSES, DUPLICATE_TYPES } from '../types/allocation';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface DuplicateNotificationCenterProps {
  userId: number;
  onNotificationChange?: (count: number) => void;
}

export const DuplicateNotificationCenter: React.FC<DuplicateNotificationCenterProps> = ({
  userId,
  onNotificationChange
}) => {
  const [notifications, setNotifications] = useState<DuplicateNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<DuplicateNotification | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadNotifications();
    // 设置定时器，每30秒刷新一次
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    // 通知父组件未处理通知数量
    const pendingCount = notifications.filter(n => n.notification_status === 'pending').length;
    onNotificationChange?.(pendingCount);
  }, [notifications, onNotificationChange]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // TODO: 实现重复通知功能
      ('获取通知功能待实现', userId);
      setNotifications([]);
    } catch (error) {
      console.error('加载重复客户通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: DuplicateNotification) => {
    setSelectedNotification(notification);
    setDetailModalVisible(true);
    
    // 如果通知状态是pending，自动标记为read
    if (notification.notification_status === 'pending') {
      markAsRead(notification.id);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // 这里应该调用API标记为已读，暂时只更新本地状态
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, notification_status: 'read' as const }
            : n
        )
      );
    } catch (error) {
      console.error('标记通知为已读失败:', error);
    }
  };

  const handleNotification = async (notificationId: string) => {
    try {
      // TODO: 实现处理通知功能
      ('处理通知功能待实现', notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, notification_status: 'handled' as const, handled_at: new Date().toISOString() }
            : n
        )
      );
      setDetailModalVisible(false);
    } catch (error) {
      console.error('处理通知失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const statusConfig = NOTIFICATION_STATUSES.find(s => s.value === status);
    return statusConfig?.color || 'default';
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'pending': '待处理',
      'sent': '已发送',
      'read': '已查看',
      'handled': '已处理'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const getDuplicateTypeInfo = (type: string) => {
    const typeConfig = DUPLICATE_TYPES.find(t => t.value === type);
    return typeConfig || { label: type, icon: '🔄' };
  };

  const renderNotificationItem = (notification: DuplicateNotification) => {
    const typeInfo = getDuplicateTypeInfo(notification.duplicate_type);
    const isUnread = notification.notification_status === 'pending';
    
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
            <Badge dot={isUnread}>
              <div style={{ fontSize: '24px' }}>{typeInfo.icon}</div>
            </Badge>
          }
          title={
            <Space>
              <Text strong={isUnread}>重复客户通知</Text>
              <Tag color={getStatusColor(notification.notification_status)}>
                {getStatusText(notification.notification_status)}
              </Tag>
            </Space>
          }
          description={
            <div>
              <div style={{ marginBottom: '4px' }}>
                <Text type="secondary">{typeInfo.label}</Text>
              </div>
              <div style={{ marginBottom: '4px' }}>
                <Text>新线索: {notification.new_leadid}</Text>
                {notification.original_leadid && (
                  <Text style={{ marginLeft: '12px' }}>
                    原线索: {notification.original_leadid}
                  </Text>
                )}
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
        </div>
      </List.Item>
    );
  };

  const pendingNotifications = notifications.filter(n => n.notification_status === 'pending');
  const otherNotifications = notifications.filter(n => n.notification_status !== 'pending');

  return (
    <>
      <Card 
        title={
          <Space>
            <BellOutlined />
            <span>重复客户通知</span>
            {pendingNotifications.length > 0 && (
              <Badge count={pendingNotifications.length} />
            )}
          </Space>
        }
        extra={
          <Button onClick={loadNotifications} loading={loading}>
            刷新
          </Button>
        }
      >
        <Spin spinning={loading}>
          {notifications.length === 0 ? (
            <Empty 
              description="暂无重复客户通知" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div>
              {/* 待处理通知 */}
              {pendingNotifications.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <Title level={5} style={{ color: '#fa8c16' }}>
                    待处理通知 ({pendingNotifications.length})
                  </Title>
                  <List
                    dataSource={pendingNotifications}
                    renderItem={renderNotificationItem}
                    pagination={false}
                  />
                </div>
              )}

              {/* 其他通知 */}
              {otherNotifications.length > 0 && (
                <div>
                  <Title level={5} style={{ color: '#666' }}>
                    历史通知 ({otherNotifications.length})
                  </Title>
                  <List
                    dataSource={otherNotifications.slice(0, 10)} // 只显示最近10条
                    renderItem={renderNotificationItem}
                    pagination={false}
                  />
                </div>
              )}
            </div>
          )}
        </Spin>
      </Card>

      {/* 通知详情弹窗 */}
      <Modal
        title="重复客户详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          selectedNotification && selectedNotification.notification_status !== 'handled' ? [
            <Button key="cancel" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="handle" 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={() => handleNotification(selectedNotification.id)}
            >
              标记为已处理
            </Button>
          ] : [
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
          ]
        }
        width={700}
      >
        {selectedNotification && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="通知状态" span={2}>
                <Tag color={getStatusColor(selectedNotification.notification_status)}>
                  {getStatusText(selectedNotification.notification_status)}
                </Tag>
              </Descriptions.Item>
              
              <Descriptions.Item label="重复类型" span={2}>
                <Space>
                  <span>{getDuplicateTypeInfo(selectedNotification.duplicate_type).icon}</span>
                  <span>{getDuplicateTypeInfo(selectedNotification.duplicate_type).label}</span>
                </Space>
              </Descriptions.Item>

              <Descriptions.Item label="新线索ID">
                {selectedNotification.new_leadid}
              </Descriptions.Item>
              <Descriptions.Item label="原线索ID">
                {selectedNotification.original_leadid || '无'}
              </Descriptions.Item>

              {selectedNotification.customer_phone && (
                <Descriptions.Item label="客户手机号">
                  {selectedNotification.customer_phone}
                </Descriptions.Item>
              )}
              {selectedNotification.customer_wechat && (
                <Descriptions.Item label="客户微信号">
                  {selectedNotification.customer_wechat}
                </Descriptions.Item>
              )}

              <Descriptions.Item label="创建时间">
                {dayjs(selectedNotification.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedNotification.handled_at && (
                <Descriptions.Item label="处理时间">
                  {dayjs(selectedNotification.handled_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 线索对比信息 */}
            {selectedNotification.new_lead_info && selectedNotification.original_lead_info && (
              <div style={{ marginTop: '16px' }}>
                <Title level={5}>线索对比</Title>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <Card title="新线索" size="small" style={{ flex: 1 }}>
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="来源">
                        {selectedNotification.new_lead_info.source || '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="类型">
                        {selectedNotification.new_lead_info.leadtype || '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="创建时间">
                        {selectedNotification.new_lead_info.created_at 
                          ? dayjs(selectedNotification.new_lead_info.created_at).format('YYYY-MM-DD HH:mm')
                          : '无'
                        }
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                  
                  <Card title="原线索" size="small" style={{ flex: 1 }}>
                    <Descriptions size="small" column={1}>
                      <Descriptions.Item label="来源">
                        {selectedNotification.original_lead_info.source || '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="类型">
                        {selectedNotification.original_lead_info.leadtype || '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="创建时间">
                        {selectedNotification.original_lead_info.created_at 
                          ? dayjs(selectedNotification.original_lead_info.created_at).format('YYYY-MM-DD HH:mm')
                          : '无'
                        }
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </div>
              </div>
            )}

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '6px' }}>
              <Space>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                <Text type="secondary">
                  重复客户已自动分配给原销售人员，请及时联系客户确认需求变化。
                </Text>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}; 