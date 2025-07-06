import { useState, useEffect } from 'react';
import { Tree, Table, Button, Modal, Form, Input, message, Badge, Dropdown, Space, Select, Tag } from 'antd';
import { supabase } from '../supaClient';
import { EllipsisOutlined, ExclamationCircleOutlined, CrownOutlined, MailOutlined } from '@ant-design/icons';
import { PermissionGate } from '../components/PermissionGate';
import type { Key } from 'react';
import { usePermissions } from '../hooks/usePermissions';

const statusColorMap: Record<string, string> = {
  active: 'green',
  pending: 'red',
  invited: 'gold',
  disabled: 'gray',
};
const statusTextMap: Record<string, string> = {
  active: '已激活',
  pending: '未激活',
  invited: '待注册',
  disabled: '已禁用',
};

const DepartmentPage = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showSetAdmin, setShowSetAdmin] = useState(false);
  const [addDeptForm] = Form.useForm();
  const [setAdminForm] = Form.useForm();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const { canManageOrganization } = usePermissions();
  const [showResetEmail, setShowResetEmail] = useState(false);
  const [resetEmailForm] = Form.useForm();
  const [currentResetUser, setCurrentResetUser] = useState<any>(null);
  
  // 检查用户认证状态
  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase.auth.getUser();
      
      console.log('🔍 认证状态检查:', {
        hasSession: !!session,
        hasUser: !!user,
        sessionUserId: session?.user?.id,
        userUserId: user?.user?.id,
        hasAccessToken: !!session?.access_token
      });
      
      if (session?.access_token) {
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          console.log('🔐 JWT Claims:', {
            sub: payload.sub,
            role: payload.role,
            iss: payload.iss,
            hasSub: !!payload.sub
          });
        } catch (e) {
          console.error('❌ JWT解析失败:', e);
        }
      }
    } catch (e) {
      console.error('❌ 认证状态检查失败:', e);
    }
  };
  
  useEffect(() => { 
    fetchDepartments();
    fetchAllUsers();
  }, []);

  const fetchDepartments = async () => {
    // 1. 查所有部门
    const { data: orgs } = await supabase.from('organizations').select('*');
    if (!orgs) {
      setDepartments([]);
      return;
    }
    // 2. 查所有admin用户信息
    const adminIds = orgs.map(org => org.admin).filter(Boolean);
    let adminProfiles: any[] = [];
    if (adminIds.length > 0) {
      const { data } = await supabase.from('users_profile').select('user_id, nickname, email').in('user_id', adminIds);
      adminProfiles = data || [];
    }
    // 3. 合并
    const departments = orgs.map(org => ({
      ...org,
      admin_profile: adminProfiles.find(u => u.user_id === org.admin) || null
    }));
    setDepartments(departments);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase.from('users_profile').select('user_id, nickname, email');
    setAllUsers(data || []);
  };

  useEffect(() => {
    if (selectedDept) {
      fetchMembers(selectedDept.id);
    } else {
      fetchMembers(null);
    }
  }, [selectedDept]);

  const fetchMembers = async (deptId: string | null) => {
    setLoading(true);
    setMembers([]); // 切换部门时先清空成员
    if (!deptId) {
      const { data } = await supabase
        .from('users_profile')
        .select('user_id, organization_id, nickname, email, status, organizations(name)');
      setMembers(data || []);
      setLoading(false);
      return;
    }
    const deptIds = getAllDeptIds(departments, deptId);
    const { data } = await supabase
      .from('users_profile')
      .select('user_id, organization_id, nickname, email, status, organizations(name)')
      .in('organization_id', deptIds);
    setMembers(data || []);
    setLoading(false);
  };

  const handleInviteMember = async () => {
    try {
      const values = await form.validateFields();
      console.log('邀请成员:', values);
      
      // 使用新的邀请功能 - 统一传递name字段
      await handleInviteUser(values.email, values.name);
      
      setShowInviteMember(false);
      form.resetFields();
    } catch (error: any) {
      console.error('邀请成员失败:', error);
      message.error('邀请成员失败: ' + error.message);
    }
  };

  const handleSetAdmin = async () => {
    try {
      const values = await setAdminForm.validateFields();
      
      // 直接使用Supabase客户端更新部门管理员
      const { error } = await supabase
        .from('organizations')
        .update({ admin: values.admin_id })
        .eq('id', selectedDept.id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      message.success('管理员设置成功');
      setShowSetAdmin(false);
      setAdminForm.resetFields();
      fetchDepartments();
    } catch (error: any) {
      message.error('设置失败: ' + error.message);
    }
  };

  const handleRemoveAdmin = async () => {
    try {
      // 直接使用Supabase客户端移除部门管理员
      const { error } = await supabase
        .from('organizations')
        .update({ admin: null })
        .eq('id', selectedDept.id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      message.success('管理员移除成功');
      fetchDepartments();
    } catch (error: any) {
      message.error('移除失败: ' + error.message);
    }
  };

  const handleResetEmail = async () => {
    try {
      const values = await resetEmailForm.validateFields();
      const newEmail = values.newEmail;
      
      console.log('✅ 邮箱格式验证通过，准备重置邮箱');
      console.log('📝 用户输入的新邮箱:', newEmail);
      
      if (currentResetUser.user_id) {
        // 已注册用户：使用内置的邮箱变更功能
        console.log('📤 重置已注册用户邮箱');
        await handleChangeEmail(currentResetUser.user_id, newEmail);
      } else {
        console.error('❌ 未注册用户暂不支持重置邮箱，请先邀请用户注册');
        message.error('未注册用户暂不支持重置邮箱，请先邀请用户注册');
        return;
      }
      
      setShowResetEmail(false);
      resetEmailForm.resetFields();
      setCurrentResetUser(null);
    } catch (error: any) {
      console.error('❌ 重置邮箱失败:', error);
      message.error('重置邮箱失败: ' + error.message);
    }
  };

  // 构建treeData，节点只含name和children
  const buildTree = (list: any[], parentId: string | null = null): any[] =>
    list
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        title: item.name,
        name: item.name,
        key: item.id,
        children: buildTree(list, item.id)
      }));

  // 递归获取所有子部门id（含自身）
  function getAllDeptIds(departments: any[], deptId: string): string[] {
    const result = [deptId];
    const findChildren = (id: string) => {
      departments
        .filter(dep => dep.parent_id === id)
        .forEach(dep => {
          result.push(dep.id);
          findChildren(dep.id);
        });
    };
    findChildren(deptId);
    return result;
  }

  // 邀请用户注册
  const handleInviteUser = async (email: string, name?: string) => {
    try {
      console.log('📧 邀请用户:', email);
      
      // 1. 首先检查用户认证状态
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 邀请前认证检查:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      });
      
      if (!session || !session.user) {
        console.error('❌ 用户未登录');
        message.error('用户未登录，请先登录后再邀请成员');
        return;
      }
      
      // 2. 检查用户是否已存在
      const { data: existingProfile, error: profileError } = await supabase
        .from('users_profile')
        .select('user_id, status')
        .eq('email', email)
        .maybeSingle();
      
      // 如果查询出错，记录但不阻止流程
      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('查询用户资料时出现警告:', profileError);
      }

      if (existingProfile && existingProfile.user_id) {
        // 已注册用户，提示使用密码重置功能
        message.info('用户已注册，请使用"发送密码重置"功能来发送邮件');
        return;
      }

      // 3. 检查是否有权限邀请到该部门
      if (!selectedDept?.id) {
        console.error('❌ 未选择部门');
        message.error('请先选择要邀请用户加入的部门');
        return;
      }

      console.log('📤 发送邀请请求:', {
        email,
        name: name || email.split('@')[0],
        organizationId: selectedDept.id,
        redirectTo: `${window.location.origin}/set-password`
      });

      // 4. 使用专用的invite-user Edge Function发送邀请邮件
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: email,
          name: name || email.split('@')[0],
          organizationId: selectedDept.id,
          redirectTo: `${window.location.origin}/set-password`
        }
      });

      console.log('📥 邀请响应:', { data, error });

      if (error) {
        console.error('❌ 邀请用户失败:', error);
        
        // 详细错误处理
        let errorMessage = '邀请用户失败';
        if (error.message?.includes('未授权')) {
          errorMessage = '认证失败，请刷新页面重新登录';
        } else if (error.message?.includes('无权管理')) {
          errorMessage = '您没有权限管理此部门';
        } else if (error.message?.includes('已被注册')) {
          errorMessage = '该邮箱已被注册，无法重复邀请';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        message.error(errorMessage);
        return;
      }

      console.log('✅ 邀请成功:', data);
      message.success('邀请邮件已发送！用户将收到注册邀请邮件。');
      
      // 刷新成员列表
      fetchMembers(selectedDept?.id ?? null);
      
    } catch (error: any) {
      console.error('❌ 邀请用户异常:', error);
      message.error('邀请用户失败: ' + (error.message || '未知错误'));
    }
  };

  // 发送密码重置邮件
  const handleResetPassword = async (email: string) => {
    try {
      console.log('🔑 发送密码重置邮件:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('发送密码重置邮件失败:', error);
        throw new Error(error.message || '发送密码重置邮件失败');
      }

      message.success('密码重置邮件已发送！');
      
    } catch (error: any) {
      console.error('发送密码重置邮件异常:', error);
      message.error(error.message || '发送密码重置邮件失败');
    }
  };

  // 重置邮箱地址
  const handleChangeEmail = async (userId: string, newEmail: string) => {
    try {
      console.log('📧 重置邮箱地址:', { userId, newEmail });
      
      // 首先检查新邮箱是否已被使用
      const { data: existingUser, error: checkError } = await supabase
        .from('users_profile')
        .select('user_id')
        .eq('email', newEmail)
        .limit(1);
      
      if (checkError) {
        console.error('检查邮箱唯一性失败:', checkError);
        throw new Error('检查邮箱唯一性失败');
      }

      if (existingUser && existingUser.length > 0) {
        message.error('该邮箱已被使用，请选择其他邮箱');
        return;
      }

      // 由于普通用户只能修改自己的邮箱，管理员重置其他用户邮箱需要特殊处理
      Modal.confirm({
        title: '重置用户邮箱',
        content: (
          <div>
            <p>由于安全限制，管理员无法直接重置其他用户的邮箱。</p>
            <p>建议的操作方式：</p>
            <ol>
              <li>通知用户前往个人资料页面自行修改邮箱</li>
              <li>或者用户可以使用"忘记密码"功能重置账户</li>
              <li>如需强制重置，请联系系统管理员</li>
            </ol>
            <p>新邮箱地址：<strong>{newEmail}</strong></p>
          </div>
        ),
        okText: '我已了解',
        cancelText: '取消',
        onOk: () => {
          message.info('请按照建议的方式处理邮箱重置');
        }
      });
      
    } catch (error: any) {
      console.error('重置邮箱异常:', error);
      message.error(error.message || '重置邮箱失败');
    }
  };

  return (
    <div style={{ display: 'flex', padding: 24 }}>
      <div className="page-card dept-tree" style={{ width: 280 }}>
        <Tree
          treeData={buildTree(departments)}
          draggable
          showLine={false}
          expandedKeys={expandedKeys}
          onExpand={keys => setExpandedKeys(keys)}
          selectedKeys={selectedDept ? [selectedDept.id] : []}
          onSelect={(_, { node }) => {
            if (!node || node.key === undefined || node.key === null) {
              setSelectedDept(null);
            } else {
              setSelectedDept({ id: String(node.key), name: node.title });
            }
          }}
          onDrop={async (info) => {
            const dragKey = String(info.dragNode.key);
            const dropKey = String(info.node.key);
            // 权限校验：只能拖到自己可管理的部门下
            if (!canManageOrganization(dropKey)) {
              message.warning('无权限调整到该部门下');
              return;
            }
            // 禁止拖拽到自身或子节点
            const getAllChildIds = (id: string): string[] => {
              const result = [id];
              const findChildren = (pid: string) => {
                departments.filter(dep => dep.parent_id === pid).forEach(dep => {
                  result.push(dep.id);
                  findChildren(dep.id);
                });
              };
              findChildren(id);
              return result;
            };
            const invalidIds = getAllChildIds(dragKey);
            if (invalidIds.includes(dropKey)) {
              message.warning('不能拖拽到自身或子节点下');
              return;
            }
            // 拖拽到根节点
            const newParentId = info.dropToGap ? null : dropKey;
            await supabase.from('organizations').update({ parent_id: newParentId }).eq('id', dragKey);
            message.success('部门关系已调整');
            fetchDepartments();
          }}
          style={{ marginBottom: 16 }}
        />
        <PermissionGate organizationId={selectedDept?.id}>
          <Button
            type="primary"
            className="page-btn"
            block
            onClick={() => setShowAddDept(true)}
          >
            新增部门
          </Button>
        </PermissionGate>
      </div>
      <div className="page-card" style={{ flex: 1 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>{selectedDept?.name || '全部人员'}</h2>
            {selectedDept && (() => {
              const dept = departments.find(d => d.id === selectedDept.id);
              if (dept?.admin_profile) {
                return <Tag color="blue">管理员: {dept.admin_profile.nickname}</Tag>;
              }
              return null;
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PermissionGate organizationId={selectedDept?.id}>
              <Button
                type="primary"
                className="page-btn"
                onClick={() => setShowInviteMember(true)}
                disabled={!selectedDept}
              >
                邀请成员
              </Button>
            </PermissionGate>
            <Button
              type="default"
              onClick={checkAuthStatus}
              size="small"
            >
              检查认证
            </Button>
            {selectedDept && (
              <Dropdown
                menu={{
                  items: [
                    ...((() => {
                      // 权限判断：设置/移除管理员
                      const arr = [];
                      arr.push({
                        key: 'set-admin',
                        icon: <CrownOutlined />,
                        label: (
                          <PermissionGate organizationId={selectedDept?.id}>
                            设置管理员
                          </PermissionGate>
                        ),
                        onClick: () => setShowSetAdmin(true),
                      });
                      if (selectedDept?.admin) {
                        arr.push({
                          key: 'remove-admin',
                          icon: <ExclamationCircleOutlined style={{ color: 'orange' }} />,
                          label: (
                            <PermissionGate organizationId={selectedDept?.id}>
                              移除管理员
                            </PermissionGate>
                          ),
                          danger: true,
                          onClick: () => {
                            Modal.confirm({
                              title: '确认移除该部门管理员？',
                              content: '移除后该部门将没有管理员，只有上级管理员可以管理。',
                              okText: '移除',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: handleRemoveAdmin
                            });
                          }
                        });
                      }
                      return arr;
                    })()),
                    {
                      key: 'delete',
                      icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
                      label: (
                        <PermissionGate organizationId={selectedDept?.id}>
                          删除部门
                        </PermissionGate>
                      ),
                      danger: true,
                      onClick: () => {
                        Modal.confirm({
                          title: '确认删除该部门？',
                          content: '删除后该部门及其所有子部门将被移除，且该部门下成员将变为未分配状态。',
                          okText: '删除',
                          okType: 'danger',
                          cancelText: '取消',
                          onOk: async () => {
                            await supabase.from('organizations').delete().eq('id', selectedDept.id);
                            setSelectedDept(null);
                            fetchDepartments();
                            fetchMembers(null);
                          }
                        });
                      }
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button type="text" icon={<EllipsisOutlined />} />
              </Dropdown>
            )}
          </div>
        </div>
        
        <div className="page-table-wrap">
          <Table
            className="page-table"
            dataSource={members}
            loading={loading}
            rowKey={(record) => record.user_id || record.email || `temp_${record.email}_${record.nickname || 'unknown'}`}
            columns={[
              { title: '姓名', dataIndex: 'nickname', className: 'page-col-nowrap' },
              { title: '邮箱', dataIndex: 'email', className: 'page-col-nowrap' },
              {
                title: '部门',
                dataIndex: ['organizations', 'name'],
                className: 'page-col-nowrap',
                render: (name: string) => name || '未分配'
              },
              {
                title: '状态',
                dataIndex: 'status',
                className: 'page-col-nowrap',
                render: (status: string) => (
                  <Badge color={status === 'left' ? 'gray' : statusColorMap[status] || 'gray'} text={status === 'left' ? '已离职' : statusTextMap[status] || '未知'} />
                )
              },
              {
                title: '操作',
                dataIndex: 'actions',
                render: (_: any, record: any) => (
                  <PermissionGate organizationId={record.organization_id}>
                    <Space>
                      <Button
                        size="small"
                        disabled={record.status === 'left'}
                        onClick={() => {
                          Modal.confirm({
                            title: '调整部门',
                            content: (
                              <Select
                                style={{ width: '100%' }}
                                defaultValue={record.organization_id}
                                options={departments.map(dep => ({ value: dep.id, label: dep.name }))}
                                onChange={async (value) => {
                                  if (!record.user_id) {
                                    message.error('用户未注册，无法调整部门');
                                    return;
                                  }
                                  const { error } = await supabase
                                    .from('users_profile')
                                    .update({ organization_id: value })
                                    .eq('user_id', record.user_id);
                                  if (error) {
                                    message.error('部门调整失败: ' + error.message);
                                  } else {
                                    message.success('部门调整成功');
                                    fetchMembers(selectedDept?.id ?? null);
                                    Modal.destroyAll();
                                  }
                                }}
                              />
                            ),
                            okButtonProps: { style: { display: 'none' } },
                            cancelText: '取消'
                          });
                        }}
                      >
                        调整部门
                      </Button>
                      
                      {/* 邮箱管理下拉菜单 */}
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'send-verification',
                              icon: <MailOutlined />,
                              label: '发送邀请邮件',
                              onClick: () => {
                                if (record.email) {
                                  handleInviteUser(record.email, record.nickname);
                                } else {
                                  message.error('用户邮箱信息缺失，无法发送邀请');
                                }
                              }
                            },
                            {
                              key: 'send-password-reset',
                              icon: <MailOutlined />,
                              label: '发送密码重置',
                              onClick: () => {
                                if (record.email) {
                                  handleResetPassword(record.email);
                                } else {
                                  message.error('用户邮箱信息缺失，无法发送密码重置');
                                }
                              }
                            },
                            {
                              key: 'reset-email',
                              icon: <MailOutlined />,
                              label: '邮箱重置指引',
                              onClick: () => {
                                if (record.user_id) {
                                  console.log('🔥 点击重置邮箱按钮，用户信息:', { 
                                    user_id: record.user_id, 
                                    email: record.email, 
                                    organization_id: record.organization_id 
                                  });
                                  setCurrentResetUser(record);
                                  setShowResetEmail(true);
                                  resetEmailForm.resetFields();
                                } else {
                                  message.error('用户未注册，无法重置邮箱');
                                }
                              }
                            }
                          ]
                        }}
                        trigger={['click']}
                      >
                        <Button size="small" icon={<MailOutlined />}>
                          邮箱管理
                        </Button>
                      </Dropdown>
                      
                      <Button
                        danger
                        size="small"
                        disabled={record.status === 'left'}
                        onClick={() => {
                          Modal.confirm({
                            title: '确认将该成员标记为离职？',
                            okText: '离职',
                            okType: 'danger',
                            cancelText: '取消',
                            onOk: async () => {
                              await supabase.from('users_profile').update({ status: 'left' }).eq('user_id', record.user_id);
                              fetchMembers(selectedDept?.id ?? null);
                            }
                          });
                        }}
                      >
                        离职
                      </Button>
                    </Space>
                  </PermissionGate>
                )
              }
            ]}
            style={{ marginTop: 0 }}
            pagination={{ pageSize: 20 }}
          />
        </div>
      </div>
      
      {/* 邀请成员弹窗 */}
      <Modal
        title="邀请成员"
        open={showInviteMember}
        onCancel={() => setShowInviteMember(false)}
        onOk={handleInviteMember}
        okText="发送邀请"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 新增部门弹窗 */}
      <PermissionGate organizationId={selectedDept?.id}>
        <Modal
          title="新增部门"
          open={showAddDept}
          onCancel={() => setShowAddDept(false)}
          onOk={async () => {
            const values = await addDeptForm.validateFields();
            const { data, error } = await supabase.from('organizations').insert({
              name: values.name,
              parent_id: selectedDept?.id ?? null
            }).select();
            if (!error && data && data[0]) {
              setShowAddDept(false);
              addDeptForm.resetFields();
              await fetchDepartments();
              setSelectedDept({ id: data[0].id, name: data[0].name });
              fetchMembers(data[0].id);
            }
          }}
          okText="保存"
        >
          <Form form={addDeptForm} layout="vertical">
            <Form.Item
              name="name"
              label="部门名称"
              rules={[{ required: true, message: '请输入部门名称' }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </PermissionGate>

      {/* 设置管理员弹窗 */}
      <Modal
        title="设置部门管理员"
        open={showSetAdmin}
        onCancel={() => setShowSetAdmin(false)}
        onOk={handleSetAdmin}
        okText="设置"
      >
        <Form form={setAdminForm} layout="vertical">
          <Form.Item
            name="admin_id"
            label="选择管理员"
            rules={[{ required: true, message: '请选择管理员' }]}
          >
            <Select
              placeholder="请选择管理员"
              options={allUsers.map(user => ({
                value: user.user_id,
                label: `${user.nickname} (${user.email})`
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置邮箱弹窗 */}
      <Modal
        title="邮箱重置指引"
        open={showResetEmail}
        onCancel={() => {
          setShowResetEmail(false);
          resetEmailForm.resetFields();
          setCurrentResetUser(null);
        }}
        onOk={handleResetEmail}
        okText="查看指引"
        cancelText="取消"
      >
        <Form form={resetEmailForm} layout="vertical">
          <Form.Item label="当前用户">
            <span>{currentResetUser?.nickname} ({currentResetUser?.email})</span>
          </Form.Item>
          <Form.Item
            name="newEmail"
            label="目标邮箱地址"
            rules={[
              { required: true, message: '请输入目标邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入用户想要更换的邮箱地址" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentPage; 