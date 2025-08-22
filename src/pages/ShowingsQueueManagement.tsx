import { useState, useEffect } from 'react';
import { Tabs, Table, Button, Select, Modal, Form, Input, message, Popconfirm, InputNumber, Space, Tag, Typography, Card } from 'antd';
import { UserOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { allocationApi } from '../utils/allocationApi';
import { supabase, fetchEnumValues } from '../supaClient';
import type { UserGroup } from '../types/allocation';
import UserTreeSelect from '../components/UserTreeSelect';

const { Text } = Typography;

const { TabPane } = Tabs;

// 直通/轮空卡类型
interface QueueCard {
  id: number;
  user_id: number;
  username?: string;
  community: string;
  queue_type: 'direct' | 'skip';
  created_at: string;
  consumed: boolean;
  consumed_at: string | null;
  remark?: string;
}

interface EditModalState {
  visible: boolean;
  type: string; // 'base' | 'direct' | 'skip'
  record: any;
}

export default function ShowingsQueueManagement() {
  const [communityOptions, setCommunityOptions] = useState<{ label: string; value: string }[]>([]);
  const [community] = useState<string>(''); // 仅用于弹窗表单初始值
  const [activeTab, setActiveTab] = useState<'base' | 'direct' | 'skip' | 'history'>('base');
  const [baseQueues, setBaseQueues] = useState<UserGroup[]>([]);
  const [directCards, setDirectCards] = useState<QueueCard[]>([]);
  const [skipCards, setSkipCards] = useState<QueueCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>({ visible: false, type: '', record: null });
  const [form] = Form.useForm();
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);

  // 带看分配历史相关状态
  const [showingsLogFilters, setShowingsLogFilters] = useState({
    community: '',
    allocationMethod: '',
    assignedUserId: '',
    queueType: '',
    page: 1,
    pageSize: 10,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [showingsLogLoading, setShowingsLogLoading] = useState(false);
  const [showingsLogData, setShowingsLogData] = useState<any[]>([]);
  const [showingsLogTotal, setShowingsLogTotal] = useState(0);
  const [userProfileCache, setUserProfileCache] = useState<Record<string, { nickname: string; status: string }>>({});
  


  // 获取社区枚举（修正：用fetchEnumValues('community')，避免404）
  useEffect(() => {
    fetchEnumValues('community').then(arr => {
      const opts = arr.map((v: string) => ({ label: v, value: v }));
      setCommunityOptions(opts);
    }).catch(() => message.error('获取社区列表失败'));
  }, []);

  // 获取所有用户昵称映射（用于卡片显示）
  const fetchUserMap = async () => {
    const { data, error } = await supabase.from('users_profile').select('id, nickname');
    if (!error && data) {
      const map: Record<number, string> = {};
      data.forEach((u: any) => { map[u.id] = u.nickname; });
      setUserMap(map);
    }
  };

  // 加载用户信息缓存
  const loadUserProfiles = async (userIds: number[]) => {
    try {
      const validUserIds = userIds.filter(id => 
        id !== null && id !== undefined && !isNaN(id)
      );

      if (validUserIds.length === 0) return;

      const { data, error } = await supabase
        .from('users_profile')
        .select('id, nickname, status')
        .in('id', validUserIds);

      if (error) throw error;

      const newCache = (data || []).reduce((acc, user) => ({
        ...acc,
        [String(user.id)]: { nickname: user.nickname || `用户${user.id}`, status: user.status }
      }), {});

      setUserProfileCache(prev => ({ ...prev, ...newCache }));
    } catch (error) {
      message.error('加载用户信息失败');
    }
  };

  // 查询带看分配日志
  const queryShowingsLogsBySupabase = async (filters = showingsLogFilters) => {
    let query = supabase
      .from('showings_allocation_logs')
      .select('*', { count: 'exact' });
    
    // 基础筛选条件
    if (filters.community) query = query.eq('community', filters.community);
    if (filters.allocationMethod) query = query.eq('allocation_method', filters.allocationMethod);
    if (filters.queueType) query = query.eq('queue_type', filters.queueType);
    
    if (filters.assignedUserId) {
      query = query.eq('assigned_user_id', parseInt(filters.assignedUserId));
    }
    
    // 排序
    query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
    // 分页
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    query = query.range(from, to);
    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil((count || 0) / filters.pageSize)
    };
  };

  // 查询带看分配日志函数
  const fetchShowingsLogs = async (filters = showingsLogFilters) => {
    setShowingsLogLoading(true);
    try {
      const res = await queryShowingsLogsBySupabase(filters);
      setShowingsLogData(res.data);
      setShowingsLogTotal(res.total);
      setShowingsLogFilters(f => ({ ...f, page: res.page, pageSize: res.pageSize }));
      
      // 加载用户信息
      const userIds = res.data.map(log => log.assigned_user_id).filter(Boolean);
      if (userIds.length > 0) {
        await loadUserProfiles(userIds);
      }
    } catch (error) {
      message.error('带看分配日志查询失败');
    } finally {
      setShowingsLogLoading(false);
    }
  };

  // 带看分配日志筛选表单提交
  const onShowingsLogFilterSubmit = (values: any) => {
    setShowingsLogFilters(f => ({
      ...f,
      ...values,
      page: 1 // 筛选后重置到第一页
    }));
  };

  // 带看分配日志筛选条件变化时自动重新加载
  useEffect(() => {
    if (activeTab === 'history') {
      fetchShowingsLogs();
    }
  }, [showingsLogFilters.community, showingsLogFilters.allocationMethod, showingsLogFilters.assignedUserId, showingsLogFilters.queueType, showingsLogFilters.page, showingsLogFilters.pageSize, showingsLogFilters.sortBy, showingsLogFilters.sortOrder]);



  // 编辑弹窗初始值同步selectedUsers
  useEffect(() => {
    if (!editModal.visible || editModal.type !== 'base') return;
    const list = editModal.record?.list || [];
    if (Array.isArray(list)) {
      setSelectedUsers(list.map(String));
      form.setFieldsValue({ list: list.map(String) });
    } else if (typeof list === 'string') {
      const arr = list.split(',').map((v: string) => v.trim()).filter(Boolean);
      setSelectedUsers(arr);
      form.setFieldsValue({ list: arr });
    } else {
      setSelectedUsers([]);
      form.setFieldsValue({ list: [] });
    }
  }, [editModal]);

  // 拉取数据（修正：所有拉取都过滤community为空的数据）
  useEffect(() => {
    if (activeTab === 'history') {
      // 如果是历史标签页，加载带看分配日志
      fetchShowingsLogs();
      return;
    }

    setLoading(true);
    // 基础队列
    allocationApi.groups.getGroups().then((res) => {
      if (res.success && res.data) {
        setBaseQueues(res.data.filter((g: any) => g.community));
      } else {
        setBaseQueues([]);
      }
    });
    // 直通卡
    supabase
      .from('showings_queue_record')
      .select('*')
      .eq('queue_type', 'direct')
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data) {
          await fetchUserMap();
          setDirectCards(data.filter((c: any) => c.community));
        } else {
          setDirectCards([]);
        }
      });
    // 轮空卡
    supabase
      .from('showings_queue_record')
      .select('*')
      .eq('queue_type', 'skip')
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data) {
          await fetchUserMap();
          setSkipCards(data.filter((c: any) => c.community));
        } else {
          setSkipCards([]);
        }
        setLoading(false);
      });
     
  }, [activeTab]);

  // 带看分配日志表格列
  const showingsLogColumns = [
    {
      title: '社区',
      dataIndex: 'community',
      key: 'community',
      width: 120,
      render: (community: string) => (
        <Tag color="green">{community}</Tag>
      )
    },
    {
      title: '分配销售',
      dataIndex: 'assigned_user_id',
      key: 'assigned_user_id',
      width: 150,
      render: (userId: number) => {
        const userInfo = userProfileCache[String(userId)] || {};
        return (
          <Space>
            <UserOutlined />
            <Text>{userInfo.nickname || (userId ? `用户${userId}` : '未分配')}</Text>
            {userInfo.status === 'inactive' && (
              <Tag color="red">已离职</Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: '分配方式',
      dataIndex: 'allocation_method',
      key: 'allocation_method',
      width: 120,
      render: (method: string) => {
        const methodMap: Record<string, string> = {
          'assigned': '指定人',
          'direct': '直通队列',
          'basic': '基础队列'
        };
        return (
          <Tag color="purple">{methodMap[method] || method}</Tag>
        );
      }
    },
    {
      title: '队列类型',
      dataIndex: 'queue_type',
      key: 'queue_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          'direct': '直通队列',
          'skip': '轮空队列',
          'basic': '基础队列'
        };
        return (
          <Tag color="blue">{typeMap[type] || type}</Tag>
        );
      }
    },
    {
      title: '卡片消耗',
      key: 'card_consumption',
      width: 150,
      render: (_: string, record: any) => (
        <Space direction="vertical" size={4}>
          {record.skip_card_consumed && (
            <Tag color="orange">轮空卡已消耗</Tag>
          )}
          {record.direct_card_consumed && (
            <Tag color="green">直通卡已消耗</Tag>
          )}
          {!record.skip_card_consumed && !record.direct_card_consumed && (
            <Tag color="gray">无卡片消耗</Tag>
          )}
        </Space>
      )
    },
    {
      title: '质量控制',
      dataIndex: 'quality_check_passed',
      key: 'quality_check_passed',
      width: 100,
      render: (passed: boolean) => (
        <Tag color={passed ? 'green' : 'red'}>
          {passed ? '通过' : '未通过'}
        </Tag>
      )
    },
    {
      title: '处理详情',
      key: 'processing_details',
      width: 200,
      render: (_: string, record: any) => {
        const details = record.processing_details;
        if (!details) return <Text type="secondary">无处理详情</Text>;

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {details.step && (
              <div>
                <Text type="secondary">处理步骤：</Text>
                <Tag color="blue">{details.step}</Tag>
              </div>
            )}
            {details.assigned_user_id && (
              <div>
                <Text type="secondary">指定用户：</Text>
                <Tag color="purple">{details.assigned_user_id}</Tag>
              </div>
            )}
            {!details.step && !details.assigned_user_id && (
              <div>
                <Text type="secondary">原始数据：</Text>
                <div style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
                  <pre style={{ margin: 0, maxHeight: '100px', overflow: 'auto' }}>
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Space>
        );
      }
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      render: (remark: string) => (
        <Text type="secondary">{remark || '-'}</Text>
      )
    },
    {
      title: '分配时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{new Date(time).toLocaleString()}</Text>
        </Space>
      )
    }
  ];

  // 表格列定义
  const baseQueueColumns = [
    { title: '队列名', dataIndex: 'groupname' },
    {
      title: '社区',
      dataIndex: 'community',
      filters: communityOptions.map(opt => ({ text: opt.label, value: opt.value })),
      filteredValue: communityFilter ? [communityFilter] : null,
      onFilter: (value: any, record: any) => record.community === value,
    },
    { title: '分配方式', dataIndex: 'allocation' },
    { title: '成员数', render: (_: any, row: UserGroup) => row.list.length },
    {
      title: '成员名称',
      render: (_: any, row: UserGroup) => {
        if (!row.list || !Array.isArray(row.list)) return '-';
        return row.list.map((id: number | string) =>
          userMap[Number(id)] || `用户${id}`
        ).join('，');
      }
    },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      render: (_: any, row: UserGroup) => (
        <>
          <Button size="small" onClick={() => setEditModal({ visible: true, type: 'base', record: row })}>编辑</Button>
          <Popconfirm title="确定删除该队列？" onConfirm={() => handleDelete('base', row)}><Button size="small" danger style={{ marginLeft: 8 }}>删除</Button></Popconfirm>
        </>
      ),
    },
  ];
  const cardColumns = [
    { title: '用户ID', dataIndex: 'user_id' },
    { title: '用户名', dataIndex: 'username', render: (v: any, row: QueueCard) => v || userMap[row.user_id] || '-' },
    {
      title: '社区',
      dataIndex: 'community',
      filters: communityOptions.map(opt => ({ text: opt.label, value: opt.value })),
      filteredValue: communityFilter ? [communityFilter] : null,
      onFilter: (value: any, record: any) => record.community === value,
    },
    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-' },
    { title: '已消耗', dataIndex: 'consumed', render: (v: any) => (v ? '是' : '否') },
    { title: '消耗时间', dataIndex: 'consumed_at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-' },
    { 
      title: '操作理由', 
      dataIndex: 'remark', 
      width: 200,
      render: (v: string) => v || '-',
      ellipsis: true
    },
    {
      title: '操作',
      render: (_: any, row: QueueCard) => (
        <>
          <Button size="small" onClick={() => setEditModal({ visible: true, type: row.queue_type, record: row })}>编辑</Button>
          <Popconfirm title="确定删除该卡？" onConfirm={() => handleDelete(row.queue_type, row)}><Button size="small" danger style={{ marginLeft: 8 }}>删除</Button></Popconfirm>
        </>
      ),
    },
  ];

  // 删除操作
  const handleDelete = async (type: string, record: any) => {
    setLoading(true);
    try {
      if (type === 'base') {
        await allocationApi.groups.deleteGroup(record.id);
        message.success('删除基础队列成功');
      } else {
        await supabase.from('showings_queue_record').delete().eq('id', record.id);
        message.success('删除卡片成功');
      }
      setEditModal({ visible: false, type: '', record: null });
      setTimeout(() => reloadData(), 500);
    } catch (e: any) {
      message.error('删除失败: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  // 统一刷新
  const reloadData = () => {
    // 立即刷新当前Tab数据
    setLoading(true);
    // 基础队列
    allocationApi.groups.getGroups().then((res) => {
      if (res.success && res.data) {
        setBaseQueues(res.data.filter((g: any) => g.community));
      } else {
        setBaseQueues([]);
      }
    });
    // 直通卡
    supabase
      .from('showings_queue_record')
      .select('*')
      .eq('queue_type', 'direct')
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data) {
          await fetchUserMap();
          setDirectCards(data.filter((c: any) => c.community));
        } else {
          setDirectCards([]);
        }
      });
    // 轮空卡
    supabase
      .from('showings_queue_record')
      .select('*')
      .eq('queue_type', 'skip')
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data) {
          await fetchUserMap();
          setSkipCards(data.filter((c: any) => c.community));
        } else {
          setSkipCards([]);
        }
        setLoading(false);
      });
  };

  // 编辑弹窗内容（修正：所有新增/编辑都强制带community字段）
  const renderEditModal = () => {
    if (!editModal.visible) return null;
    const { type, record } = editModal;
    const isBase = type === 'base';
    return (
      <Modal open={true} title={`编辑${isBase ? '基础队列' : type === 'direct' ? '直通卡' : '轮空卡'}`} onCancel={() => setEditModal({ visible: false, type: '', record: null })} footer={null}>
        <Form
          form={form}
          initialValues={isBase ? { ...record, list: (record?.list || []).map?.(String) || [] } : { ...record, user_ids: record?.user_id ? [String(record.user_id)] : [] }}
          layout="vertical"
          onFinish={async (values) => {
            setLoading(true);
            try {
              if (isBase) {
                // list字段转数组
                const submit = {
                  ...values,
                  list: selectedUsers.map(Number),
                  community: values.community || community
                };
                if (record?.id) {
                  await allocationApi.groups.updateGroup(record.id, submit);
                  message.success('更新基础队列成功');
                } else {
                  await allocationApi.groups.createGroup(submit);
                  message.success('新增基础队列成功');
                }
              } else {
                const addCount = Number(values.add_count) || 1;
                // 剔除add_count字段，仅用于循环
                const { add_count, user_ids, ...restValues } = values;
                
                // 获取选中的用户ID列表
                const selectedUserIds = Array.isArray(user_ids) ? user_ids : [];
                
                if (selectedUserIds.length === 0) {
                  message.error('请至少选择一个用户');
                  return;
                }
                
                const submit = { 
                  ...restValues, 
                  community: values.community || community, 
                  queue_type: type,
                  remark: values.remark || null
                };
                
                // 为每个选中的用户创建指定数量的卡片
                const records = [];
                for (const userId of selectedUserIds) {
                  for (let i = 0; i < addCount; i++) {
                    records.push({
                      ...submit,
                      user_id: Number(userId),
                      consumed: false
                    });
                  }
                }
                
                
                // 插入记录并等待服务器响应
                const { error } = await supabase.from('showings_queue_record').insert(records);
                
                if (error) {
                  console.error('❌ 插入记录失败:', error);
                  let errorMessage = '插入失败';
                  
                  if (error.code === '403' || error.message?.includes('Forbidden')) {
                    errorMessage = '权限不足：您没有 allocation_manage 权限，请联系管理员授予此权限';
                  } else if (error.message) {
                    errorMessage = `插入失败: ${error.message}`;
                  }
                  
                  message.error(errorMessage);
                  return;
                }
                
                message.success(`成功为 ${selectedUserIds.length} 个用户各创建 ${addCount} 张${type === 'direct' ? '直通卡' : '轮空卡'}`);
              }
              setEditModal({ visible: false, type: '', record: null });
              reloadData(); // 立即刷新
            } catch (e: any) {
              console.error('❌ 保存失败:', e);
              message.error('保存失败: ' + (e.message || e));
            } finally {
              setLoading(false);
            }
          }}
        >
          {isBase && <>
            <Form.Item label="队列名" name="groupname" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="社区" name="community"><Select options={communityOptions} /></Form.Item>
            <Form.Item label="分配方式" name="allocation">
              <Select options={[{ label: '轮询', value: 'round_robin' }, { label: '随机', value: 'random' }]} allowClear placeholder="分配方式" />
            </Form.Item>
            <div style={{ color: '#888', fontSize: 13, margin: '-8px 0 8px 0' }}>
              如不选择，默认采用轮询分配（顺序循环分配）；仅当需要随机分配时才需选择“随机”。
            </div>
            <Form.Item
              name="list"
              label="成员ID列表"
              rules={[{ required: true, message: '请选择成员' }]}
            >
              <UserTreeSelect
                value={selectedUsers}
                onChange={(value) => {
                  setSelectedUsers(value);
                  form.setFieldsValue({ list: value });
                }}
                placeholder="请选择成员"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="描述" name="description"><Input.TextArea /></Form.Item>
          </>}
          {!isBase && <>
            <Form.Item label="选择用户" name="user_ids" rules={[{ required: true, message: '请选择用户' }] }>
              <UserTreeSelect
                value={(() => {
                  const userIds = form.getFieldValue('user_ids');
                  return Array.isArray(userIds) ? userIds.map(String) : [];
                })()}
                multiple={true}
                onChange={val => {
                  // 处理多选逻辑：过滤掉部门节点，只保留用户节点
                  let userIds: string[] = [];
                  if (Array.isArray(val)) {
                    userIds = val.filter(id => !String(id).startsWith('dept_'));
                  }
                  form.setFieldsValue({ user_ids: userIds });
                }}
                placeholder="请选择用户（可多选）"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="添加数量" name="add_count" initialValue={1} rules={[{ required: true, type: 'number', min: 1, message: '请输入大于0的数量' }] }>
              <InputNumber min={1} step={1} placeholder="请输入要添加的数量" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="社区" name="community"><Select options={communityOptions} /></Form.Item>
            <Form.Item label="操作理由" name="remark">
              <Input.TextArea 
                placeholder="请输入发放该卡片的理由，如：带看回退补偿、手动发放等" 
                rows={3}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </>}
          <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
        </Form>
      </Modal>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>带看分配管理</h2>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setEditModal({ visible: true, type: 'base', record: null })}>新增基础队列</Button>
        <Button 
          style={{ marginLeft: 8 }} 
          onClick={() => setEditModal({ visible: true, type: 'direct', record: null })}
        >
          新增直通卡
        </Button>
        <Button 
          style={{ marginLeft: 8 }} 
          onClick={() => setEditModal({ visible: true, type: 'skip', record: null })}
        >
          新增轮空卡
        </Button>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab as any}>
        <TabPane tab="基础队列" key="base">
          <Table
            rowKey="id"
            columns={baseQueueColumns}
            dataSource={baseQueues}
            loading={loading}
            pagination={false}
            onChange={(_, filters) => {
              const val = filters.community ? filters.community[0] : null;
              setCommunityFilter(typeof val === 'string' ? val : (val ? String(val) : null));
            }}
          />
        </TabPane>
        <TabPane tab="直通卡" key="direct">
          <Table
            rowKey="id"
            columns={cardColumns}
            dataSource={directCards}
            loading={loading}
            pagination={false}
            onChange={(_, filters) => {
              const val = filters.community ? filters.community[0] : null;
              setCommunityFilter(typeof val === 'string' ? val : (val ? String(val) : null));
            }}
          />
        </TabPane>
        <TabPane tab="轮空卡" key="skip">
          <Table
            rowKey="id"
            columns={cardColumns}
            dataSource={skipCards}
            loading={loading}
            pagination={false}
            onChange={(_, filters) => {
              const val = filters.community ? filters.community[0] : null;
              setCommunityFilter(typeof val === 'string' ? val : (val ? String(val) : null));
            }}
          />
        </TabPane>
        <TabPane tab="分配历史" key="history">
          <Card 
            title="带看分配历史记录"
            extra={
              <Space>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={() => fetchShowingsLogs()}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            <Form layout="inline" onFinish={onShowingsLogFilterSubmit} initialValues={showingsLogFilters} style={{ marginBottom: 16 }}>
              <Form.Item name="community" label="社区">
                <Select allowClear style={{ width: 120 }} placeholder="选择社区">
                  {communityOptions.map(opt => (
                    <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="allocationMethod" label="分配方式">
                <Select allowClear style={{ width: 120 }} placeholder="选择分配方式">
                  <Select.Option value="assigned">指定人</Select.Option>
                  <Select.Option value="direct">直通队列</Select.Option>
                  <Select.Option value="basic">基础队列</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="queueType" label="队列类型">
                <Select allowClear style={{ width: 120 }} placeholder="选择队列类型">
                  <Select.Option value="direct">直通队列</Select.Option>
                  <Select.Option value="skip">轮空队列</Select.Option>
                  <Select.Option value="basic">基础队列</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="assignedUserId" label="分配销售">
                <Select 
                  allowClear 
                  style={{ width: 150 }} 
                  placeholder="选择销售"
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {Object.entries(userProfileCache).map(([userId, userInfo]) => (
                    <Select.Option key={userId} value={userId}>
                      {userInfo.nickname || `用户${userId}`}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">筛选</Button>
              </Form.Item>
              <Form.Item>
                <Button onClick={() => {
                  setShowingsLogFilters({
                    community: '',
                    allocationMethod: '',
                    assignedUserId: '',
                    queueType: '',
                    page: 1,
                    pageSize: 10,
                    sortBy: 'created_at',
                    sortOrder: 'desc'
                  });
                }}>重置</Button>
              </Form.Item>
            </Form>
            <Table
              columns={showingsLogColumns}
              dataSource={showingsLogData}
              loading={showingsLogLoading}
              rowKey="id"
              scroll={{ x: 1300 }}
              pagination={{
                current: showingsLogFilters.page,
                pageSize: showingsLogFilters.pageSize,
                total: showingsLogTotal,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setShowingsLogFilters(f => ({ ...f, page, pageSize }));
                }
              }}
              onChange={(pagination, _filters, sorter: any) => {
                setShowingsLogFilters(f => ({
                  ...f,
                  page: pagination.current || 1,
                  pageSize: pagination.pageSize || 10,
                  sortBy: (sorter.field as 'created_at' | 'community' | 'assigned_user_id' | 'allocation_method') || 'created_at',
                  sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc'
                }));
              }}
            />
          </Card>
        </TabPane>
      </Tabs>
      {renderEditModal()}
    </div>
  );
} 