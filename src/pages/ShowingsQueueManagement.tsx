import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Select, Modal, Form, Input, Switch, message, Popconfirm, TreeSelect, Tag, InputNumber } from 'antd';
import { allocationApi } from '../utils/allocationApi';
import { supabase, fetchEnumValues } from '../supaClient';
import type { UserGroup } from '../types/allocation';

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
}

interface EditModalState {
  visible: boolean;
  type: string; // 'base' | 'direct' | 'skip'
  record: any;
}

export default function ShowingsQueueManagement() {
  const [communityOptions, setCommunityOptions] = useState<{ label: string; value: string }[]>([]);
  const [community, setCommunity] = useState<string>(''); // 仅用于弹窗表单初始值
  const [activeTab, setActiveTab] = useState<'base' | 'direct' | 'skip'>('base');
  const [baseQueues, setBaseQueues] = useState<UserGroup[]>([]);
  const [directCards, setDirectCards] = useState<QueueCard[]>([]);
  const [skipCards, setSkipCards] = useState<QueueCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>({ visible: false, type: '', record: null });
  const [form] = Form.useForm();
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [treeData, setTreeData] = useState<any[]>([]);
  const [userProfileCache, setUserProfileCache] = useState<Record<string, any>>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);

  // 获取社区枚举（修正：用fetchEnumValues('community')，避免404）
  useEffect(() => {
    fetchEnumValues('community').then(arr => {
      const opts = arr.map((v: string) => ({ label: v, value: v }));
      setCommunityOptions(opts);
    }).catch(() => message.error('获取社区列表失败'));
    // eslint-disable-next-line
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

  // 动态加载部门树和成员（不依赖社区）
  useEffect(() => {
    // 只要弹窗打开就加载
    if (!editModal.visible) return;
    // 获取部门
    supabase.from('organizations').select('id, name, parent_id').then(async ({ data: orgs }) => {
      // 获取所有 active 成员
      const { data: users } = await supabase
        .from('users_profile')
        .select('id, nickname, organization_id');
      // 用户缓存
      if (users && users.length > 0) {
        const newCache = users.reduce((acc, user) => ({
          ...acc,
          [String(user.id)]: { nickname: user.nickname || `用户${user.id}`, status: 'active' }
        }), {});
        setUserProfileCache(newCache);
        // userMap 也同步
        const map: Record<number, string> = {};
        users.forEach((u: any) => { map[u.id] = u.nickname; });
        setUserMap(map);
      }
      // 递归组装部门树
      const buildTree = (parentId: string | null): any[] => {
        return (orgs || [])
          .filter(dep => dep.parent_id === parentId)
          .map(dep => {
            const deptUsers = (users || []).filter(u => u.organization_id === dep.id);
            const subDepts = buildTree(dep.id);
            return {
              title: `${dep.name} (${deptUsers.length}人)`,
              value: `dept_${dep.id}`,
              key: `dept_${dep.id}`,
              children: [
                ...deptUsers.map(u => ({
                  title: u.nickname,
                  value: String(u.id),
                  key: String(u.id),
                  isLeaf: true
                })),
                ...subDepts
              ]
            };
          });
      };
      // 未分配部门成员
      const ungrouped = (users || [])
        .filter(u => !u.organization_id)
        .map(u => ({
          title: u.nickname,
          value: String(u.id),
          key: String(u.id),
          isLeaf: true
        }));
      const tree = buildTree(null);
      if (ungrouped.length > 0) {
        tree.push({
          title: `未分配部门 (${ungrouped.length}人)`,
          value: 'dept_none',
          key: 'dept_none',
          children: ungrouped
        });
      }
      setTreeData(tree);
    });
  }, [editModal]);

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
    // eslint-disable-next-line
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
          userMap[Number(id)] || userProfileCache[String(id)]?.nickname || `用户${id}`
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
                const submit = { ...restValues, community: values.community || community, queue_type: type };
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
              <TreeSelect
                treeData={treeData}
                value={selectedUsers}
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                treeCheckStrictly={false}
                onSelect={(value, node) => {
                  if (String(value).startsWith('dept_')) {
                    const getAllUsersInDeptRecursive = (deptKey: string): string[] => {
                      const findDept = (nodes: any[]): any | undefined => nodes.find(n => n.key === deptKey);
                      const dept = findDept(treeData) || (function find(nodes: any[]): any | undefined {
                        for (const n of nodes) {
                          if (n.key === deptKey) return n;
                          if (n.children) {
                            const found = find(n.children);
                            if (found) return found;
                          }
                        }
                        return undefined;
                      })(treeData);
                      if (!dept) return [];
                      const getAllUsersFromNode = (node: any): string[] => {
                        let users: string[] = [];
                        if (node.children) {
                          node.children.forEach((child: any) => {
                            if (child.isLeaf) {
                              users.push(child.key);
                            } else {
                              users.push(...getAllUsersFromNode(child));
                            }
                          });
                        }
                        return users;
                      };
                      return getAllUsersFromNode(dept);
                    };
                    const deptUsers = getAllUsersInDeptRecursive(String(value));
                    const allSelected = deptUsers.length > 0 && deptUsers.every((id: string) => selectedUsers.includes(id));
                    let newSelectedUsers = [...selectedUsers];
                    if (allSelected) {
                      newSelectedUsers = newSelectedUsers.filter(id => !deptUsers.includes(id));
                    } else {
                      deptUsers.forEach((id: string) => {
                        if (!newSelectedUsers.includes(id)) {
                          newSelectedUsers.push(id);
                        }
                      });
                    }
                    setSelectedUsers(newSelectedUsers);
                    form.setFieldsValue({ list: newSelectedUsers });
                    return;
                  }
                }}
                onDeselect={(value, node) => {
                  if (String(value).startsWith('dept_')) {
                    const getAllUsersInDeptRecursive = (deptKey: string): string[] => {
                      const findDept = (nodes: any[]): any | undefined => nodes.find(n => n.key === deptKey);
                      const dept = findDept(treeData) || (function find(nodes: any[]): any | undefined {
                        for (const n of nodes) {
                          if (n.key === deptKey) return n;
                          if (n.children) {
                            const found = find(n.children);
                            if (found) return found;
                          }
                        }
                        return undefined;
                      })(treeData);
                      if (!dept) return [];
                      const getAllUsersFromNode = (node: any): string[] => {
                        let users: string[] = [];
                        if (node.children) {
                          node.children.forEach((child: any) => {
                            if (child.isLeaf) {
                              users.push(child.key);
                            } else {
                              users.push(...getAllUsersFromNode(child));
                            }
                          });
                        }
                        return users;
                      };
                      return getAllUsersFromNode(dept);
                    };
                    const deptUsers = getAllUsersInDeptRecursive(String(value));
                    let newSelectedUsers = selectedUsers.filter(id => !deptUsers.includes(id));
                    setSelectedUsers(newSelectedUsers);
                    form.setFieldsValue({ list: newSelectedUsers });
                    return;
                  }
                }}
                onChange={(val, labelList, extra) => {
                  const values = Array.isArray(val) ? val : [];
                  // 递归获取部门下所有成员（包括子部门）
                  const getAllUsersInDeptRecursive = (deptKey: string): string[] => {
                    const findDept = (nodes: any[]): any | undefined => nodes.find(n => n.key === deptKey);
                    const dept = findDept(treeData) || (function find(nodes: any[]): any | undefined {
                      for (const n of nodes) {
                        if (n.key === deptKey) return n;
                        if (n.children) {
                          const found = find(n.children);
                          if (found) return found;
                        }
                      }
                      return undefined;
                    })(treeData);
                    if (!dept) return [];
                    let allUsers: string[] = [];
                    const getAllUsersFromNode = (node: any): string[] => {
                      let users: string[] = [];
                      if (node.children) {
                        node.children.forEach((child: any) => {
                          if (child.isLeaf) {
                            users.push(child.key);
                          } else {
                            users.push(...getAllUsersFromNode(child));
                          }
                        });
                      }
                      return users;
                    };
                    return getAllUsersFromNode(dept);
                  };
                  let finalSelectedUsers: string[] = [];
                  const deptSelections = values.filter((value: any) => String(value).startsWith('dept_'));
                  const userSelections = values.filter((value: any) => !String(value).startsWith('dept_'));
                  deptSelections.forEach(deptId => {
                    const deptUsers = getAllUsersInDeptRecursive(deptId);
                    deptUsers.forEach(id => {
                      if (!finalSelectedUsers.includes(id)) {
                        finalSelectedUsers.push(id);
                      }
                    });
                  });
                  userSelections.forEach(userId => {
                    const userIdStr = String(userId);
                    if (!finalSelectedUsers.includes(userIdStr)) {
                      finalSelectedUsers.push(userIdStr);
                    }
                  });
                  // 只保留叶子节点成员id
                  finalSelectedUsers = finalSelectedUsers.filter(id => treeData.some(dept => {
                    const findLeaf = (nodes: any[]): boolean => nodes.some(n => (n.isLeaf && n.key === id) || (n.children && findLeaf(n.children)));
                    return findLeaf([dept]);
                  }));
                  setSelectedUsers(finalSelectedUsers);
                  form.setFieldsValue({ list: finalSelectedUsers });
                }}
                tagRender={({ value, closable, onClose }) => {
                  const userInfo = userProfileCache?.[String(value)];
                  const nickname = userInfo?.nickname || `用户${value}`;
                  return <Tag closable={closable} onClose={onClose}>{nickname}</Tag>;
                }}
                placeholder="请选择成员"
                showSearch
                filterTreeNode={(input, node) =>
                  (node.title as string).toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
                allowClear
                treeDefaultExpandAll
                maxTagCount="responsive"
                popupMatchSelectWidth={false}
              />
            </Form.Item>
            <Form.Item label="描述" name="description"><Input.TextArea /></Form.Item>
          </>}
          {!isBase && <>
            <Form.Item label="用户ID" name="user_id" rules={[{ required: true, message: '请选择用户' }] }>
              <TreeSelect
                treeData={treeData}
                value={form.getFieldValue('user_id') ? [String(form.getFieldValue('user_id'))] : []}
                treeCheckable={false}
                showSearch
                placeholder="请选择用户"
                allowClear
                onChange={val => {
                  // 只允许单选
                  const userId = Array.isArray(val) ? val[0] : val;
                  form.setFieldsValue({ user_id: userId });
                }}
                filterTreeNode={(input, node) =>
                  (node.title as string).toLowerCase().includes(input.toLowerCase())
                }
                treeDefaultExpandAll
                style={{ width: '100%' }}
                maxTagCount="responsive"
                popupMatchSelectWidth={false}
              />
            </Form.Item>
            <Form.Item label="添加数量" name="add_count" initialValue={1} rules={[{ required: true, type: 'number', min: 1, message: '请输入大于0的数量' }] }>
              <InputNumber min={1} step={1} placeholder="请输入要添加的数量" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="社区" name="community"><Select options={communityOptions} /></Form.Item>
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
            onChange={(pagination, filters) => {
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
            onChange={(pagination, filters) => {
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
            onChange={(pagination, filters) => {
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