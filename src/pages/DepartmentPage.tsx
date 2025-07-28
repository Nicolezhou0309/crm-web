import { useState, useEffect } from 'react';
import type { Key } from 'react';
import { Tree, Table, Button, Modal, Form, Input, message, Badge, Dropdown, Select, Tag, Tooltip, Pagination } from 'antd';
import { supabase } from '../supaClient';
import { withRetry, supabaseRetryOptions } from '../utils/retryUtils';
import { EllipsisOutlined, ExclamationCircleOutlined, CrownOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import { useRolePermissions } from '../hooks/useRolePermissions';
import './DepartmentPage.css';
import React from 'react';


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
  const { canManageOrganization, canManageUser, isSuperAdmin, isDepartmentAdmin } = useRolePermissions();

  
  // 新增：树节点搜索关键词
  const [treeSearch, setTreeSearch] = useState('');
  // 新增：自动展开的keys
  const [autoExpandKeys, setAutoExpandKeys] = useState<Key[]>([]);
  
  // 检查用户认证状态

  
  useEffect(() => { 
    fetchDepartments();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (selectedDept) {
      fetchMembers(selectedDept.id);
    } else {
      fetchMembers(null);
    }
  }, [selectedDept]);

  // 新增：过滤人员列表
  useEffect(() => {
    filterMembers();
  }, [members]);

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

  const fetchMembers = async (deptId: string | null) => {
    setLoading(true);
    setMembers([]); // 切换部门时先清空成员
    if (!deptId) {
      const { data } = await supabase
        .from('users_profile')
        .select('id, user_id, organization_id, nickname, email, status, organizations(name)');
      
      // 获取积分信息 - 使用 profile.id (bigint) 而不是 user_id (uuid)
      const profileIds = data?.map(user => user.id).filter(Boolean) || [];
      let pointsData: any[] = [];
      if (profileIds.length > 0) {
        
        // 使用正确的积分表名：user_points_wallet
        const { data: points } = await supabase
          .from('user_points_wallet')
          .select('user_id, total_points')
          .in('user_id', profileIds);
        
        pointsData = points || [];
      } else {
      }
      
      // 获取销售组信息 - 使用 profile.id (bigint) 而不是 user_id (uuid)
      let salesGroupsData: any[] = [];
      if (profileIds.length > 0) {
        
        // 获取基础销售组信息 - 使用 profile.id
        const { data: salesGroups } = await supabase
          .from('users_list')
          .select('id, groupname, list, allocation')
          .overlaps('list', profileIds);
        
        
        // 获取每个用户的销售组状态
        const salesGroupsWithStatus = await Promise.all(
          (salesGroups || []).map(async (group) => {
            
            // 为每个用户获取该销售组的详细状态
            const userStatusPromises = profileIds.map(async (profileId) => {
              
              const { data: userStatus } = await supabase.rpc('get_user_allocation_status_multi', {
                p_user_id: profileId
              });
              
              return { profileId, status: userStatus };
            });
            
            const userStatuses = await Promise.all(userStatusPromises);
            
            return {
              ...group,
              user_statuses: userStatuses
            };
          })
        );
        
        salesGroupsData = salesGroupsWithStatus;
      }
      
      // 合并数据
      const membersWithData = data?.map(user => {
        const userPoints = pointsData.find(p => p.user_id === user.id);
        const userSalesGroups = salesGroupsData.filter(sg => 
          sg.list && sg.list.includes(user.id)
        );
        
        return {
          ...user,
          points: userPoints?.total_points || 0,
          sales_groups: userSalesGroups
        };
      }) || [];
      
      setMembers(membersWithData);
      setLoading(false);
      return;
    }
    const deptIds = getAllDeptIds(departments, deptId);
    const { data } = await supabase
      .from('users_profile')
      .select('id, user_id, organization_id, nickname, email, status, organizations(name)')
      .in('organization_id', deptIds);
    
    // 获取积分信息 - 使用 profile.id (bigint) 而不是 user_id (uuid)
    const profileIds = data?.map(user => user.id).filter(Boolean) || [];
    let pointsData: any[] = [];
    if (profileIds.length > 0) {
      
      // 使用正确的积分表名：user_points_wallet
      const { data: points } = await supabase
        .from('user_points_wallet')
        .select('user_id, total_points')
        .in('user_id', profileIds);
      
      
      pointsData = points || [];
    } else {
    }
    
    // 获取销售组信息 - 使用 profile.id (bigint) 而不是 user_id (uuid)
    let salesGroupsData: any[] = [];
    if (profileIds.length > 0) {
      
      // 获取基础销售组信息 - 使用 profile.id
      const { data: salesGroups } = await supabase
        .from('users_list')
        .select('id, groupname, list, allocation')
        .overlaps('list', profileIds);
      
      
      // 获取每个用户的销售组状态
      const salesGroupsWithStatus = await Promise.all(
        (salesGroups || []).map(async (group) => {
          
                      // 为每个用户获取该销售组的详细状态
            const userStatusPromises = profileIds.map(async (profileId) => {
              
              const { data: userStatus } = await supabase.rpc('get_user_allocation_status_multi', {
                p_user_id: profileId
              });
              
              
              
              return { profileId, status: userStatus };
            });
          
          const userStatuses = await Promise.all(userStatusPromises);
          
          return {
            ...group,
            user_statuses: userStatuses
          };
        })
      );
      
      salesGroupsData = salesGroupsWithStatus;
    } else {
    }
    
    // 合并数据
    const membersWithData = data?.map(user => {
      const userPoints = pointsData.find(p => p.user_id === user.id);
      const userSalesGroups = salesGroupsData.filter(sg => 
        sg.list && sg.list.includes(user.id)
      );
      
      
      return {
        ...user,
        points: userPoints?.total_points || 0,
        sales_groups: userSalesGroups
      };
    }) || [];
    
    setMembers(membersWithData);
    setLoading(false);
  };

  // 新增：过滤人员列表
  const filterMembers = () => {
    if (!treeSearch.trim()) {
      setMembers(members);
      return;
    }

    const keyword = treeSearch.toLowerCase();
    const filtered = members.filter(member => 
      member.nickname?.toLowerCase().includes(keyword) ||
      member.email?.toLowerCase().includes(keyword) ||
      member.organizations?.name?.toLowerCase().includes(keyword)
    );
    setMembers(filtered);
  };

  // 高亮函数：支持人员/部门不同class
  const highlightTreeText = (text: string, keyword: string, isPerson = false) => {
    if (!keyword.trim() || !text) return text;
    const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeKeyword})`, 'gi');
    return text.split(regex).map((part, idx) =>
      regex.test(part)
        ? <span key={idx} className={isPerson ? 'tree-highlight-person' : 'tree-highlight-dept'}>{part}</span>
        : part
    );
  };

  // 递归查找所有包含搜索结果的部门key（含父节点）
  const getMatchedDeptKeys = (list: any[], parentId: string | null = null, parentPath: string[] = []) => {
    let keys: string[] = [];
    list.filter(item => item.parent_id === parentId).forEach(item => {
      const deptNameMatch = treeSearch && item.name && item.name.toLowerCase().includes(treeSearch.toLowerCase());
      // 找到该部门的直属人员
      const deptMembers = members.filter(m => m.organization_id === item.id);
      const memberMatch = deptMembers.some(user => treeSearch && user.nickname && user.nickname.toLowerCase().includes(treeSearch.toLowerCase()));
      // 如果本部门或直属人员有匹配，收集本部门和所有父节点
      if (deptNameMatch || memberMatch) {
        keys = keys.concat(parentPath, [item.id]);
      }
      // 递归子部门
      keys = keys.concat(getMatchedDeptKeys(list, item.id, parentPath.concat(item.id)));
    });
    return Array.from(new Set(keys));
  };

  // 监听treeSearch变化，自动展开包含结果的部门
  useEffect(() => {
    if (treeSearch.trim()) {
      setAutoExpandKeys(getMatchedDeptKeys(departments));
    } else {
      setAutoExpandKeys([]);
    }
  }, [treeSearch, departments, members]);

  // 构建treeData，人员节点样式和高亮修正
  const buildTree = (list: any[], parentId: string | null = null): any[] =>
    list
      .filter(item => item.parent_id === parentId)
      .map(item => {
        const deptMembers = members.filter(m => m.organization_id === item.id);
        const memberNodes = deptMembers.map((user: any) => ({
          key: `user_${user.user_id || user.email}`,
          title: (
            <span className="tree-member-node">
              <span className="tree-member-name">
                {highlightTreeText(user.nickname || '未命名', treeSearch, true)}
              </span>
            </span>
          ),
          isLeaf: true,
          selectable: false,
        }));
        return {
          title: (
            <span className="tree-dept-node">
              {highlightTreeText(item.name, treeSearch, false)}
              {deptMembers.length > 0 && (
                <span className="dept-member-count">
                  {deptMembers.length}人
                </span>
              )}
            </span>
          ),
          key: item.id,
          children: [
            ...memberNodes,
            ...buildTree(list, item.id)
          ]
        };
      });

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

  // 邀请用户注册 - 异步处理
  const handleInviteUser = async (email: string, name?: string) => {
    try {
      
      // 1. 首先检查用户认证状态
      const { data: { session } } = await supabase.auth.getSession();

      
      if (!session || !session.user) {
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
      }

      if (existingProfile && existingProfile.user_id) {
        // 已注册用户，提示使用密码重置功能
        message.info('用户已注册，请使用"发送密码重置"功能来发送邮件');
        return;
      }

      // 3. 检查是否有权限邀请到该部门
      if (!selectedDept?.id) {
        message.error('请先选择要邀请用户加入的部门');
        return;
      }

      // 4. 显示邀请进行中的提示
      const inviteKey = `invite_${email}_${Date.now()}`;
      message.loading({
        content: '正在发送邀请邮件...',
        key: inviteKey,
        duration: 0
      });

      // 5. 异步发送邀请邮件 - 使用重试机制
      withRetry(async () => {
        const { data, error } = await supabase.functions.invoke('invite-user', {
          body: {
            email: email,
            name: name || email.split('@')[0],
            organizationId: selectedDept.id,
            redirectTo: `${window.location.origin}/set-password`
          }
        });
        
        if (error) {
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
          
          message.error({
            content: errorMessage,
            key: inviteKey,
            duration: 3
          });
          throw new Error(errorMessage);
        } else {
          // 邀请成功
          message.success({
            content: '邀请邮件已发送！用户将收到注册邀请邮件。',
            key: inviteKey,
            duration: 3
          });
          
          // 异步刷新成员列表
          setTimeout(() => {
            fetchMembers(selectedDept?.id ?? null);
          }, 1000);
        }
        
        return data;
      }, supabaseRetryOptions).catch((error) => {
        // 处理重试失败后的最终错误
        message.error({
          content: '邀请发送失败: ' + (error.message || '网络错误'),
          key: inviteKey,
          duration: 3
        });
      });
      
    } catch (error: any) {
      message.error('邀请用户失败: ' + (error.message || '未知错误'));
    }
  };







  // 检查当前用户是否有权限管理指定组织
  const hasManagePermission = (orgId: string | null) => {
    if (!orgId) return false;
    return canManageOrganization(orgId);
  };

  // 检查当前用户是否有权限管理指定用户
  const hasUserManagePermission = (userOrgId: string | null) => {
    if (!userOrgId) return false;
    return canManageUser(userOrgId);
  };

  // 邀请成员弹窗回调 - 异步处理
  const handleInviteMember = async () => {
    try {
      const values = await form.validateFields();
      // 立即关闭弹窗，不等待邀请结果
      setShowInviteMember(false);
      form.resetFields();
      // 只做邮箱存在性检查，不新建 profile
      const { data: existingProfile } = await supabase
        .from('users_profile')
        .select('user_id, status')
        .eq('email', values.email)
        .maybeSingle();
      if (existingProfile && existingProfile.user_id) {
        message.info('用户已注册，请使用“发送密码重置”功能');
        return;
      }
      // 只调用后端 invite-user 函数
      handleInviteUser(values.email, values.name);
    } catch (error: any) {
      message.error('邀请成员失败: ' + error.message);
    }
  };

  // 设置管理员弹窗回调
  const handleSetAdmin = async () => {
    try {
      const values = await setAdminForm.validateFields();
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

  // 移除管理员回调
  const handleRemoveAdmin = async () => {
    try {
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

  const [showLeftMembers, setShowLeftMembers] = useState(false);

  // 合并成员排序与折叠逻辑
  const sortedMembers = React.useMemo(() => {
    const active = members.filter(m => m.status !== 'left');
    const left = members.filter(m => m.status === 'left');
    return showLeftMembers ? [...active, ...left] : active;
  }, [members, showLeftMembers]);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 分页后的成员
  const pagedMembers = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedMembers.slice(start, start + pageSize);
  }, [sortedMembers, currentPage, pageSize]);


  return (
    <div className="dept-page-container">
      <div className="dept-tree-container" style={{ width: 320 }}>
        {/* 搜索框区域 */}
        <div className="dept-search-section">
          <Input
            className="dept-search-input"
            size="middle"
            allowClear
            placeholder="搜索部门或人员名称"
            value={treeSearch}
            onChange={e => setTreeSearch(e.target.value)}
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          />
        </div>
        
        {/* 树形结构容器 */}
        <div className="dept-tree-wrapper">
          <div className="dept-tree-content">
            <Tree
              className="dept-tree"
              treeData={buildTree(departments)}
              draggable={(node) => {
                // 只有部门节点可以拖动，成员节点不可拖动
                return !String(node.key).startsWith('user_');
              }}
              showLine={false}
              expandedKeys={treeSearch.trim() ? autoExpandKeys : expandedKeys}
              onExpand={keys => setExpandedKeys(keys)}
              selectedKeys={selectedDept ? [selectedDept.id] : []}
              onSelect={(_, { node }) => {
                // 只允许选中部门节点，人员节点不可选
                if (!node || node.key === undefined || node.key === null || String(node.key).startsWith('user_')) {
                  setSelectedDept(null);
                } else {
                  setSelectedDept({ id: String(node.key), name: node.title });
                }
              }}
              onDrop={async (info) => {
                const dragKey = String(info.dragNode.key);
                const dropKey = String(info.node.key);
                // 只允许拖拽部门节点
                if (String(dragKey).startsWith('user_') || String(dropKey).startsWith('user_')) return;
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
            />
          </div>
        </div>
        
        {/* 底部按钮区域 */}
        <div className="dept-tree-actions">
          {hasManagePermission(selectedDept?.id) && (
            <Button
              type="primary"
              className="dept-add-btn"
              onClick={() => setShowAddDept(true)}
            >
              新增部门
            </Button>
          )}
        </div>
      </div>
      <div className="dept-content-area">
        <div className="dept-page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="dept-page-title">
              {selectedDept?.name || '全部人员'}
            </h2>
            {selectedDept && (() => {
              const dept = departments.find(d => d.id === selectedDept.id);
              if (dept?.admin_profile) {
                return (
                  <Tag 
                    color="blue" 
                    className="dept-status-badge"
                  >
                    管理员: {dept.admin_profile.nickname}
                  </Tag>
                );
              }
              return null;
            })()}
          </div>
          <div className="dept-action-buttons">
            {hasManagePermission(selectedDept?.id) && (
              <Button
                type="primary"
                size="large"
                style={{
                  borderRadius: '12px',
                  fontWeight: 600,
                  height: '40px',
                  padding: '0 20px',
                  background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)'
                }}
                onClick={() => setShowInviteMember(true)}
                disabled={!selectedDept}
              >
                邀请成员
              </Button>
            )}
            {selectedDept && (
              <Dropdown
                menu={{
                  items: [
                    ...((() => {
                      // 权限判断：设置/移除管理员
                      const arr = [];
                      if (hasManagePermission(selectedDept?.id)) {
                        arr.push({
                          key: 'set-admin',
                          icon: <CrownOutlined />,
                          label: '设置管理员',
                          onClick: () => setShowSetAdmin(true),
                        });
                        if (selectedDept?.admin) {
                          arr.push({
                            key: 'remove-admin',
                            icon: <ExclamationCircleOutlined style={{ color: 'orange' }} />,
                            label: '移除管理员',
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
                        arr.push({
                          key: 'delete',
                          icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
                          label: '删除部门',
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
                        });
                      }
                      return arr;
                    })()),
                  ]
                }}
                trigger={['click']}
              >
                <Button 
                  type="text" 
                  icon={<EllipsisOutlined />}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </Dropdown>
            )}
          </div>
        </div>
        
        <div className="page-table-wrap" style={{ width: '100%' }}>
          <div style={{ width: '100%', overflow: 'auto' }}>
            <Table
              className="page-table"
              dataSource={pagedMembers}
              loading={loading}
              rowKey={(record) => record.user_id || record.email || `temp_${record.email}_${record.nickname || 'unknown'}`}
              scroll={{ x: 'max-content' }}
              columns={[
                { 
                  title: '姓名', 
                  dataIndex: 'nickname', 
                  className: 'page-col-nowrap',
                  width: 120,
                  render: (text: string) => (
                    <span style={{ fontWeight: 600, color: '#262626' }}>
                      {text || '未命名'}
                    </span>
                  )
                },
                // 只有管理员可以看到邮箱列
                ...(hasManagePermission(selectedDept?.id) ? [{
                  title: '邮箱', 
                  dataIndex: 'email', 
                  className: 'page-col-nowrap',
                  width: 200,
                  render: (text: string) => (
                    <span style={{ color: '#595959', fontFamily: 'monospace' }}>
                      {text || '-'}
                    </span>
                  )
                }] : []),
                {
                  title: '部门',
                  dataIndex: ['organizations', 'name'],
                  className: 'page-col-nowrap',
                  width: 150,
                  render: (name: string) => (
                    <Tag 
                      color="blue" 
                      style={{ 
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '4px 8px'
                      }}
                    >
                      {name || '未分配'}
                    </Tag>
                  )
                },
                // 只有管理员可以看到状态、积分、销售组和操作列
                ...(hasManagePermission(selectedDept?.id) ? [
                  {
                    title: '状态',
                    dataIndex: 'status',
                    className: 'page-col-nowrap',
                    width: 120,
                    render: (status: string) => (
                      <Badge 
                        color={status === 'left' ? 'gray' : statusColorMap[status] || 'gray'} 
                        text={status === 'left' ? '已离职' : statusTextMap[status] || '未知'}
                        style={{ fontSize: '12px' }}
                      />
                    )
                  },
                  {
                    title: '剩余积分',
                    dataIndex: 'points',
                    className: 'page-col-nowrap',
                    width: 120,
                    render: (points: number) => (
                      <span style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: points > 0 ? '#52c41a' : '#ff4d4f',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}>
                        <TrophyOutlined style={{ fontSize: '12px', marginRight: '4px' }} />
                        {points || 0}
                      </span>
                    )
                  },
                  {
                    title: '销售组状态',
                    dataIndex: 'sales_groups',
                    className: 'page-col-nowrap',
                    width: 100,
                    render: (salesGroups: any[], record: any) => { 
                      if (!salesGroups || salesGroups.length === 0) {
                        return (
                          <span style={{ 
                            color: '#8c8c8c',
                            fontSize: '12px'
                          }}>
                            未加入
                          </span>
                        );
                      }
                      
                      // 检查当前用户在该销售组中的状态
                      const userGroups = salesGroups.filter(sg => 
                        sg.list && sg.list.includes(record.id)
                      );
                      
                      if (userGroups.length === 0) {
                        return (
                          <span style={{ 
                            color: '#8c8c8c',
                            fontSize: '12px'
                          }}>
                            未加入
                          </span>
                        );
                      }
                      
                      // 检查是否有异常状态
                      const hasAbnormal = userGroups.some(sg => {
                        const userStatus = sg.user_statuses?.find((us: any) => us.profileId === record.id);
                        // get_user_allocation_status_multi 返回数组，需要检查该用户在该组中的状态
                        if (!userStatus?.status || !Array.isArray(userStatus.status)) {
                          return false;
                        }
                        // 找到该用户在该组中的状态
                        const groupStatus = userStatus.status.find((status: any) => 
                          status.groupname === sg.groupname
                        );
                        const isAbnormal = groupStatus && !groupStatus.can_allocate;
                        
                        return isAbnormal;
                      });
                      
                      return (
                        <Badge 
                          color={hasAbnormal ? 'red' : 'green'} 
                          text={hasAbnormal ? '异常' : '正常'}
                          style={{ fontSize: '12px' }}
                        />
                      );
                    }
                  },
                  {
                    title: '销售组列表',
                    dataIndex: 'sales_groups',
                    className: 'page-col-nowrap',
                    width: 300,
                    render: (salesGroups: any[], record: any) => {
                      if (!salesGroups || salesGroups.length === 0) {
                        return <span style={{ color: '#8c8c8c' }}>-</span>;
                      }
                      const userGroups = salesGroups.filter(sg => sg.list && sg.list.includes(record.id));
                      if (userGroups.length === 0) {
                        return <span style={{ color: '#8c8c8c' }}>-</span>;
                      }
                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            minHeight: '24px',
                            maxHeight: '80px',
                            alignItems: 'flex-start',
                            overflowY: 'auto',
                            overflowX: 'hidden'
                          }}
                        >
                          {userGroups.map((group) => {
                            // 检查该用户在该销售组中的状态
                            const userStatus = group.user_statuses?.find((us: any) => us.profileId === record.id);
                            let isAbnormal = false;
                            let abnormalReasons: string[] = [];
                            if (userStatus?.status && Array.isArray(userStatus.status)) {
                              const groupStatus = userStatus.status.find((status: any) => 
                                status.groupname === group.groupname
                              );
                              isAbnormal = groupStatus && !groupStatus.can_allocate;
                              if (isAbnormal && groupStatus?.reason && Array.isArray(groupStatus.reason)) {
                                abnormalReasons = groupStatus.reason;
                              }
                            }
                            const tooltipContent = isAbnormal && abnormalReasons.length > 0 
                              ? `${group.groupname}\n异常原因：\n${abnormalReasons.join('\n')}`
                              : group.groupname;
                            return (
                              <Tooltip 
                                key={group.id} 
                                title={tooltipContent} 
                                placement="top"
                                styles={{ 
                                  root: {
                                    maxWidth: '350px',
                                    whiteSpace: 'pre-line'
                                  }
                                }}
                              >
                                <Tag 
                                  color={isAbnormal ? 'red' : 'blue'}
                                  style={{ 
                                    fontSize: '11px',
                                    margin: 0,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    lineHeight: '1.3',
                                    maxWidth: '120px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'help',
                                    display: 'inline-block',
                                    verticalAlign: 'middle'
                                  }}
                                >
                                  {group.groupname}
                                </Tag>
                              </Tooltip>
                            );
                          })}
                        </div>
                      );
                    }
                  },
                  {
                    title: '操作',
                    dataIndex: 'actions',
                    width: 180,
                    render: (_: any, record: any) => {
                      // 检查是否有权限管理该用户
                      const canManage = hasUserManagePermission(record.organization_id);
                      
                      if (!canManage) {
                        return null; // 无权限时不显示任何操作按钮
                      }
                      
                      return (
                        <div className="dept-table-actions" style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            size="small"
                            type="link"
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
                          
                          <Button
                            danger
                            size="small"
                            type="link"
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
                        </div>
                      );
                    }
                  }
                ] : []),
              ]}
              style={{ 
                marginTop: 0,
                borderRadius: '12px',
                width: '100%'
              }}
              pagination={false}
            />
          </div>
          {/* 分页器和离职成员按钮同一行，按钮左，分页器右，始终固定 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginTop: 8, 
            width: '100%',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              {members.some(m => m.status === 'left') && !showLeftMembers && (
                <Button type="link" className="no-outline-btn" onClick={() => setShowLeftMembers(true)} style={{ paddingLeft: 0 }}>
                  显示离职成员
                </Button>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={sortedMembers.length}
                showSizeChanger
                showQuickJumper
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                onChange={page => setCurrentPage(page)}
                onShowSizeChange={(_, size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
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
          <Form.Item 
            name="email" 
            label="邮箱" 
            rules={[{ required: true, type: 'email' }]}
            extra="只有部门管理员可以查看和邀请成员"
          >
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增部门弹窗 */}
      {hasManagePermission(selectedDept?.id) && (
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
      )}

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


    </div>
  );
};

export default DepartmentPage; 