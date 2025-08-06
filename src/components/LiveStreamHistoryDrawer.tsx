import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Table, Tag, Spin, Empty, Typography } from 'antd';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { supabase } from '../supaClient';

// 配置dayjs插件
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
// 设置时区为北京时间
dayjs.tz.setDefault('Asia/Shanghai');

const { Text } = Typography;

interface LiveStreamScheduleLog {
  id: number;
  schedule_id: number;
  operator_id: number | null;
  operator_name: string;
  operation_time: string;
  participants: number[] | null; // 可能为null
  created_at: string;
}

interface LiveStreamHistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  scheduleId: string;
  scheduleTitle?: string;
}

const LiveStreamHistoryDrawer: React.FC<LiveStreamHistoryDrawerProps> = ({
  visible,
  onClose,
  scheduleId,
  scheduleTitle = '直播场次历史记录'
}) => {
  const [logs, setLogs] = useState<LiveStreamScheduleLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [userNames, setUserNames] = useState<{ [key: number]: string }>({});
  const [participantNames, setParticipantNames] = useState<{ [key: string]: string[] }>({});
  const [participantDetails, setParticipantDetails] = useState<{ [key: string]: Array<{id: number, nickname: string, department: string}> }>({});

  // 获取日志记录
  const fetchLogs = async () => {
    if (!scheduleId) return;
    
    setLoading(true);
    try {
      console.log('🔄 开始获取历史记录，scheduleId:', scheduleId);
      
      const { data, error } = await supabase
        .from('live_stream_schedule_logs')
        .select('*')
        .eq('schedule_id', parseInt(scheduleId))
        .order('operation_time', { ascending: false });

      if (error) {
        console.error('❌ 获取日志记录失败:', error);
        return;
      }

      console.log('📊 获取到日志记录:', data?.length || 0, '条');
      setLogs(data || []);

      // 获取所有操作者的用户信息
      const operatorIds = [...new Set(data?.map(log => log.operator_id).filter(Boolean) || [])];
      console.log('👥 操作者ID列表:', operatorIds);
      
      if (operatorIds.length > 0) {
        const { data: users, error: userError } = await supabase
          .from('users_profile')
          .select('id, nickname')
          .in('id', operatorIds);

        if (!userError && users) {
          const nameMap: { [key: number]: string } = {};
          users.forEach(user => {
            nameMap[user.id] = user.nickname || `用户${user.id}`;
          });
          console.log('💾 操作者姓名映射:', nameMap);
          setUserNames(nameMap);
        } else {
          console.error('❌ 获取操作者信息失败:', userError);
        }
      }

      // 获取所有参与者的姓名
      const allParticipantIds = new Set<number>();
      data?.forEach(log => {
        console.log(`📋 日志 ${log.id} 的参与者:`, log.participants);
        if (log.participants && Array.isArray(log.participants)) {
                        log.participants.forEach((id: number) => {
                if (id && typeof id === 'number') {
                  allParticipantIds.add(id);
                }
              });
        }
      });

      console.log('👥 参与者ID列表:', Array.from(allParticipantIds));

      if (allParticipantIds.size > 0) {
        const participantIdsArray = Array.from(allParticipantIds);
        const { data: participants, error: participantError } = await supabase
          .from('users_profile')
          .select('id, nickname, organization_id')
          .in('id', participantIdsArray);

        if (!participantError && participants) {
          const participantNameMap: { [key: number]: string } = {};
          const participantDetailMap: { [key: number]: {id: number, nickname: string, department: string} } = {};
          
          participants.forEach(user => {
            participantNameMap[user.id] = user.nickname || `用户${user.id}`;
            participantDetailMap[user.id] = {
              id: user.id,
              nickname: user.nickname || `用户${user.id}`,
              department: '未知部门' // 稍后获取部门信息
            };
          });

          console.log('💾 参与者姓名映射:', participantNameMap);

          // 获取部门信息
          const organizationIds = [...new Set(participants.map(p => p.organization_id).filter(Boolean))];
          if (organizationIds.length > 0) {
            const { data: organizations, error: orgError } = await supabase
              .from('organizations')
              .select('id, name')
              .in('id', organizationIds);

            if (!orgError && organizations) {
              const orgMap: { [key: string]: string } = {};
              organizations.forEach(org => {
                orgMap[org.id] = org.name;
              });

              // 更新参与者详情，包含部门信息
              participants.forEach(user => {
                if (user.organization_id && orgMap[user.organization_id]) {
                  participantDetailMap[user.id].department = orgMap[user.organization_id];
                }
              });
            }
          }

          // 为每个日志记录创建参与者详情数组
          const detailsMap: { [key: string]: Array<{id: number, nickname: string, department: string}> } = {};
          const namesMap: { [key: string]: string[] } = {};
          
          data?.forEach(log => {
            const logKey = `${log.id}`;
            if (log.participants && Array.isArray(log.participants)) {
              const details: Array<{id: number, nickname: string, department: string}> = [];
              const names: string[] = [];
              
              log.participants.forEach((id: number) => {
                if (id && typeof id === 'number') {
                  const detail = participantDetailMap[id];
                  if (detail) {
                    details.push(detail);
                    names.push(detail.nickname);
                  } else {
                    details.push({id, nickname: `用户${id}`, department: '未知部门'});
                    names.push(`用户${id}`);
                  }
                }
              });
              
              detailsMap[logKey] = details;
              namesMap[logKey] = names;
            } else {
              detailsMap[logKey] = [];
              namesMap[logKey] = [];
            }
          });
          
          console.log('📋 日志参与者详情映射:', detailsMap);
          setParticipantNames(namesMap);
          setParticipantDetails(detailsMap);
        } else {
          console.error('❌ 获取参与者信息失败:', participantError);
        }
      } else {
        console.log('ℹ️ 没有参与者信息需要获取');
      }
    } catch (error) {
      console.error('❌ 获取日志记录异常:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化操作时间
  const formatOperationTime = (time: string) => {
    return dayjs.tz(time, 'Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
  };

  // 获取操作类型标签
  const getOperationTypeTag = (log: LiveStreamScheduleLog) => {
    // 根据参与者数量和其他信息判断操作类型
    if (!log.participants || log.participants.length === 0) {
      return <Tag color="red">释放场次</Tag>;
    } else if (log.participants.length === 2) {
      return <Tag color="green">报名成功</Tag>;
    } else {
      return <Tag color="blue">编辑记录</Tag>;
    }
  };

  // 表格列定义
  const columns = useMemo(() => [
    {
      title: '操作时间',
      dataIndex: 'operation_time',
      key: 'operation_time',
      width: 180,
      render: (time: string) => (
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>
            {formatOperationTime(time)}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {dayjs.tz(time, 'Asia/Shanghai').fromNow()}
          </div>
        </div>
      ),
    },
    {
      title: '操作类型',
      key: 'operation_type',
      width: 120,
      render: (_: any, record: LiveStreamScheduleLog) => getOperationTypeTag(record),
    },
    {
      title: '操作者',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 120,
      render: (name: string, record: LiveStreamScheduleLog) => {
        // 优先使用缓存的用户姓名，如果没有则使用原始数据
        const operatorName = record.operator_id && userNames[record.operator_id] 
          ? userNames[record.operator_id] 
          : (name || `用户${record.operator_id}` || '未知用户');
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <UserOutlined style={{ color: '#1890ff' }} />
            <span>{operatorName}</span>
          </div>
        );
      },
    },
    {
      title: '参与者',
      key: 'participants',
      render: (_: any, record: LiveStreamScheduleLog) => {
        const details = participantDetails[record.id.toString()] || [];
        
        // 如果没有参与者信息
        if (!record.participants || record.participants.length === 0) {
          return <Text type="secondary">无参与者</Text>;
        }

        // 如果有缓存的详情，显示姓名和部门
        if (details.length > 0) {
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {details.map((detail, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'flex-start',
                  minWidth: '120px'
                }}>
                  <Tag color="blue" style={{ marginBottom: '2px' }}>
                    {detail.nickname}
                  </Tag>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {detail.department}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // 如果没有缓存的详情，显示ID
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {record.participants.map((id, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-start',
                minWidth: '120px'
              }}>
                <Tag color="orange" style={{ marginBottom: '2px' }}>
                  用户{id}
                </Tag>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  未知部门
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
  ], [participantNames]);

  // 当抽屉打开时获取数据
  useEffect(() => {
    if (visible && scheduleId) {
      console.log('📋 打开历史记录抽屉，scheduleId:', scheduleId);
      fetchLogs();
    }
  }, [visible, scheduleId]);

  // 添加调试信息
  useEffect(() => {
    if (logs.length > 0) {
      console.log('📊 日志数据示例:', logs[0]);
      console.log('👥 用户姓名缓存:', userNames);
      console.log('👥 参与者姓名缓存:', participantNames);
      console.log('👥 参与者详情缓存:', participantDetails);
    }
  }, [logs, userNames, participantNames, participantDetails]);

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <span>{scheduleTitle}</span>
        </div>
      }
      placement="right"
      width={600}
      onClose={onClose}
      open={visible}
      styles={{
        header: {
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '16px',
        },
        body: {
          padding: '24px',
        },
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: '#999' }}>加载历史记录中...</div>
        </div>
      ) : logs.length === 0 ? (
        <Empty
          description="暂无历史记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <Text type="secondary">
              共找到 {logs.length} 条历史记录
            </Text>
          </div>
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
            style={{
              '--ant-table-row-hover-bg': 'transparent',
            } as React.CSSProperties}
          />
        </div>
      )}
    </Drawer>
  );
};

export default LiveStreamHistoryDrawer; 