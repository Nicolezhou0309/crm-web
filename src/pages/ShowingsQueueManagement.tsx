import { useState, useEffect } from 'react';
import { Tabs, Table, Button, Select, Modal, Form, Input, message, Popconfirm, InputNumber } from 'antd';
import { allocationApi } from '../utils/allocationApi';
import { supabase, fetchEnumValues } from '../supaClient';
import type { UserGroup } from '../types/allocation';
import UserTreeSelect from '../components/UserTreeSelect';

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
  const [activeTab, setActiveTab] = useState<'base' | 'direct' | 'skip'>('base');
  const [baseQueues, setBaseQueues] = useState<UserGroup[]>([]);
  const [directCards, setDirectCards] = useState<QueueCard[]>([]);
  const [skipCards, setSkipCards] = useState<QueueCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>({ visible: false, type: '', record: null });
  const [form] = Form.useForm();
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);

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
          initialValues={isBase ? { ...record, list: (record?.list || []).map?.(String) || [] } : record}
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
                const { add_count, ...restValues } = values;
                const submit = { 
                  ...restValues, 
                  community: values.community || community, 
                  queue_type: type,
                  remark: values.remark || null
                };
                const records = Array.from({ length: addCount }).map(() => ({ ...submit, consumed: false }));
                await supabase.from('showings_queue_record').insert(records);
              }
              message.success('新增卡片成功');
              setEditModal({ visible: false, type: '', record: null });
              reloadData(); // 立即刷新
            } catch (e: any) {
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
            <Form.Item label="用户ID" name="user_id" rules={[{ required: true, message: '请选择用户' }] }>
              <UserTreeSelect
                value={form.getFieldValue('user_id') ? [String(form.getFieldValue('user_id'))] : []}
                onChange={val => {
                  // 只允许单选
                  const userId = Array.isArray(val) ? val[0] : val;
                  form.setFieldsValue({ user_id: userId });
                }}
                placeholder="请选择用户"
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
        <Button style={{ marginLeft: 8 }} onClick={() => setEditModal({ visible: true, type: 'direct', record: null })}>新增直通卡</Button>
        <Button style={{ marginLeft: 8 }} onClick={() => setEditModal({ visible: true, type: 'skip', record: null })}>新增轮空卡</Button>
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
      </Tabs>
      {renderEditModal()}
    </div>
  );
} 