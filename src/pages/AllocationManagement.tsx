import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Tabs,
  Row,
  Col,
  Typography,
  Popconfirm,
  Switch,
  InputNumber,
  TimePicker,
  Alert,
  Badge,
  Tooltip,
  TreeSelect
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  BranchesOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { allocationApi } from '../utils/allocationApi';
import type { 
  SimpleAllocationRule, 
  SimpleAllocationLog, 
  UserGroup, 
  AllocationStats,
  AllocationRuleForm 
} from '../types/allocation';
import { ALLOCATION_METHODS, WEEKDAY_OPTIONS } from '../types/allocation';
import AllocationFlowChart from '../components/AllocationFlowChart';
import { supabase } from '../supaClient';
import dayjs from 'dayjs';
import { validateRuleForm, validateGroupForm } from '../utils/validationUtils';

const { Title, Text } = Typography;
const { Option, OptGroup } = Select;
const { RangePicker } = TimePicker;

const AllocationManagement: React.FC = () => {
  // 将 Form 实例声明移到组件内部
  const [testForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  
  const [activeTab, setActiveTab] = useState('1');
  const [rules, setRules] = useState<SimpleAllocationRule[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [allocationLogs, setAllocationLogs] = useState<SimpleAllocationLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 枚举值状态
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [communityOptions, setCommunityOptions] = useState<string[]>([]);
  
  // 弹窗状态
  const [isRuleModalVisible, setIsRuleModalVisible] = useState(false);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<SimpleAllocationRule | null>(null);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  
  // 测试相关
  const [testResult, setTestResult] = useState<any>(null);

  // 加载数据
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadRules(),
      loadUserGroups(),
      loadAllocationLogs(),
      loadEnumOptions()
    ]);
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await allocationApi.rules.getRules();
      if (response.success && response.data) {
        setRules(response.data);
      }
    } catch (error) {
      console.error('加载分配规则失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 新增：搜索关键词状态
  const [searchKeyword, setSearchKeyword] = useState('');
  // 新增：销售组成员信息缓存
  const [groupMembersCache, setGroupMembersCache] = useState<Record<number, Array<{id: string; nickname: string}>>>({});
  
  // 修改：加载销售组成员信息
  const loadGroupMembers = async (groups: UserGroup[]) => {
    try {
      // 收集所有需要查询的用户ID
      const allUserIds = groups.reduce<number[]>((acc, group) => {
        if (group.list && group.list.length > 0) {
          acc.push(...group.list);
        }
        return acc;
      }, []);

      if (allUserIds.length === 0) return;

      // 批量查询所有用户信息
      const { data: userData, error } = await supabase
        .from('users_profile')
        .select('id, nickname, status')
        .in('id', allUserIds);

      if (error) throw error;

      // 按组整理用户信息
      const membersByGroup = groups.reduce<Record<number, Array<{id: string; nickname: string}>>>((acc, group) => {
        if (group.list && group.list.length > 0) {
          acc[group.id] = group.list
            .map(userId => {
              const user = userData?.find(u => u.id === userId);
              return user ? { id: String(userId), nickname: user.nickname || `用户${userId}` } : null;
            })
            .filter((user): user is {id: string; nickname: string} => user !== null);
        } else {
          acc[group.id] = [];
        }
        return acc;
      }, {});

      setGroupMembersCache(prev => ({...prev, ...membersByGroup}));
    } catch (error) {
      console.error('加载销售组成员失败:', error);
      message.error('加载成员信息失败');
    }
  };

  // 新增：过滤后的销售组列表
  const filteredUserGroups = useMemo(() => {
    if (!searchKeyword) return userGroups;
    
    return userGroups.filter(group => {
      // 匹配组名
      const matchGroupName = group.groupname.toLowerCase().includes(searchKeyword.toLowerCase());
      
      // 匹配成员昵称
      const members = groupMembersCache[group.id] || [];
      const matchMemberName = members.some(member => 
        member.nickname.toLowerCase().includes(searchKeyword.toLowerCase())
      );
      
      return matchGroupName || matchMemberName;
    });
  }, [userGroups, searchKeyword, groupMembersCache]);

  // 修改：加载销售组时同时加载成员信息
  const loadUserGroups = async () => {
    try {
      const response = await allocationApi.groups.getGroups();
      if (response.success && response.data) {
        setUserGroups(response.data);
        // 立即加载所有销售组的成员信息
        await loadGroupMembers(response.data);
      } else {
        message.error('获取销售组失败');
      }
    } catch (error) {
      message.error('加载销售组异常');
    }
  };

  // 新增：用户信息缓存
  const [userProfileCache, setUserProfileCache] = useState<Record<number, { nickname: string; status: string }>>({});

  // 修改加载用户信息的函数
  const loadUserProfiles = async (userIds: number[]) => {
    try {
      // 过滤掉无效的用户ID
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
        [user.id]: { nickname: user.nickname || `用户${user.id}`, status: user.status }
      }), {});

      setUserProfileCache(prev => ({ ...prev, ...newCache }));
    } catch (error) {
      console.error('加载用户信息失败:', error);
      message.error('加载用户信息失败');
    }
  };

  // 修改分配日志时同时加载用户信息
  const loadAllocationLogs = async () => {
    try {
      setLoading(true);
      const response = await allocationApi.logs.getLogs();
      if (response?.success && response?.data) {
        // 收集所有需要加载信息的用户ID
        const userIds = response.data.map(log => log.assigned_user_id).filter(Boolean);
        if (userIds.length > 0) {
          await loadUserProfiles(userIds);
        }
        setAllocationLogs(response.data);
      } else {
        message.error('获取分配日志失败');
      }
    } catch (error) {
      console.error('加载分配日志失败:', error);
      message.error('加载分配日志失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载枚举选项
  const loadEnumOptions = async () => {
    try {
      // 并发获取来源和社区枚举
      const [sourceResponse, communityResponse] = await Promise.all([
        allocationApi.enums.getSourceTypes(),
        allocationApi.enums.getCommunityTypes()
      ]);

      if (sourceResponse.success && sourceResponse.data) {
        setSourceOptions(sourceResponse.data);
      }
      if (communityResponse.success && communityResponse.data) {
        setCommunityOptions(communityResponse.data);
      }
    } catch (error) {
      console.error('加载枚举选项失败:', error);
    }
  };

  // 分配规则表格列
  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: SimpleAllocationRule) => (
        <Space>
          <Text strong>{text}</Text>
          {record.is_active ? (
            <Tag color="green">启用</Tag>
          ) : (
            <Tag color="red">禁用</Tag>
          )}
        </Space>
      )
    },
    {
      title: '触发条件',
      key: 'conditions',
      render: (text: string, record: SimpleAllocationRule) => {
        const { conditions } = record;
        return (
          <Space direction="vertical" size="small">
            {conditions.sources && conditions.sources.length > 0 && (
        <div>
                <Text type="secondary">来源：</Text>
                {conditions.sources.map((source: string) => (
                  <Tag key={source} color="blue">{source}</Tag>
                ))}
              </div>
          )}
            {conditions.communities && conditions.communities.length > 0 && (
              <div>
                <Text type="secondary">社区：</Text>
                {conditions.communities.map((community: string) => (
                  <Tag key={community} color="green">{community}</Tag>
                ))}
              </div>
          )}
            {conditions.time_ranges && (
              <div>
                <Text type="secondary">时间：</Text>
                <Tag color="orange">
                  {conditions.time_ranges.start || '00:00'}-{conditions.time_ranges.end || '23:59'}
                </Tag>
        </div>
            )}
          </Space>
        );
      }
    },
    {
      title: '销售组',
      key: 'user_groups',
      render: (text: string, record: SimpleAllocationRule) => {
        const groups = userGroups.filter(group => 
          record.user_groups?.includes(group.id) || false
        );
        return (
          <Space>
            {groups.map(group => (
              <Tag key={group.id} color="purple">{group.groupname}</Tag>
            ))}
            {(!record.user_groups || record.user_groups.length === 0) && (
              <Text type="secondary">未设置销售组</Text>
            )}
          </Space>
        );
      }
    },
    {
      title: '分配方式',
      dataIndex: 'allocation_method',
      key: 'allocation_method',
      render: (method: string) => {
        const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
        return (
          <Tooltip title={methodInfo?.description}>
            <Tag color="blue">{methodInfo?.label || method}</Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number, record: SimpleAllocationRule) => {
        const displayPriority = record.name === '默认分配规则' ? 0 : priority;
        return (
          <Badge 
            count={displayPriority} 
            style={{ 
              backgroundColor: record.name === '默认分配规则' ? '#999' : '#52c41a' 
            }} 
          />
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: SimpleAllocationRule) => (
           <Space>
             <Button 
               type="link" 
               icon={<EditOutlined />} 
               onClick={() => handleEditRule(record)}
          >
            编辑
          </Button>
             <Button 
               type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleViewRule(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除这个分配规则吗？"
            onConfirm={() => handleDeleteRule(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
           </Space>
      )
    }
  ];

  // 修改：销售组表格列配置
  const groupColumns = [
    {
      title: '组名称',
      dataIndex: 'groupname',
      key: 'groupname',
      render: (text: string, record: UserGroup) => (
        <Space>
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '分配方式',
      dataIndex: 'allocation',
      key: 'allocation',
      render: (method: string) => {
        const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
        return (
          <Tooltip title={methodInfo?.description}>
            <Tag color="blue">{methodInfo?.label || method}</Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '质量控制',
      key: 'quality_control',
      render: (text: string, record: UserGroup) => (
        <div>
          <div>
            <Tag color={record.enable_quality_control ? 'green' : 'gray'}>
              {record.enable_quality_control ? '启用' : '禁用'}
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            <div>日限制: {record.daily_lead_limit !== undefined && record.daily_lead_limit !== null ? record.daily_lead_limit : '-'}</div>
            <div>转化率: {record.conversion_rate_requirement !== undefined && record.conversion_rate_requirement !== null ? record.conversion_rate_requirement + '%' : '-'}</div>
            <div>最大待处理: {record.max_pending_leads !== undefined && record.max_pending_leads !== null ? record.max_pending_leads : '-'}</div>
          </div>
        </div>
      )
    },
    {
      title: '社区匹配',
      dataIndex: 'enable_community_matching',
      key: 'enable_community_matching',
      render: (val: boolean) => (
        <Tag color={val ? 'blue' : 'gray'}>{val ? '启用' : '禁用'}</Tag>
      )
    },
    {
      title: '成员列表',
      key: 'members',
      width: 300,
      render: (text: string, record: UserGroup) => {
        const members = groupMembersCache[record.id] || [];
        return (
          <div style={{ maxWidth: 280, minHeight: 32 }}>
            {members.length > 0 ? (
              <Space size={[0, 4]} wrap>
                {members.map(member => (
                  <Tag key={member.id} style={{ margin: '2px' }}>
                    {member.nickname}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无成员</Text>
            )}
          </div>
        );
      }
    },
    {
      title: '成员数量',
      dataIndex: 'list',
      key: 'member_count',
      width: 100,
      render: (list: number[]) => list?.length || 0
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const, // 修复类型错误
      render: (text: string, record: UserGroup) => (
        <Space direction="vertical" size={0}>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditGroup(record)}>
            编辑
          </Button>
          <Button type="link" icon={<CopyOutlined />} onClick={() => handleCopyGroup(record)}>
            复制
          </Button>
          <Popconfirm
            title="确定删除这个销售组吗？"
            onConfirm={() => handleDeleteGroup(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 分配日志表格列
  const logColumns = [
    {
      title: '线索ID',
      dataIndex: 'leadid',
      key: 'leadid',
      width: 120,
      render: (leadid: string) => (
        <Tag>{leadid}</Tag>
      )
    },
    {
      title: '分配销售',
      dataIndex: 'assigned_user_id',
      key: 'assigned_user_id',
      width: 150,
      render: (userId: number) => {
        const userInfo = userProfileCache[userId] || {};
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
        const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
        return (
          <Tag color="purple">{methodInfo?.label || method}</Tag>
        );
      }
    },
    {
      title: '使用规则',
      key: 'rule_name',
      width: 150,
      render: (text: string, record: SimpleAllocationLog) => {
        const ruleName = record.processing_details?.rule_name;
        return ruleName ? (
          <Tag color="blue">{ruleName}</Tag>
        ) : (
          <Tag color="gray">默认分配</Tag>
        );
      }
    },
    {
      title: '处理详情',
      key: 'processing_details',
      render: (text: string, record: SimpleAllocationLog) => {
        const details = record.processing_details;
        if (!details) return null;

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {details.conditions && (
              <div>
                <Text type="secondary">匹配条件：</Text>
                <div style={{ marginLeft: 8 }}>
                  {details.conditions.sources && details.conditions.sources.length > 0 && (
                    <div>
                      <Text type="secondary">来源：</Text>
                      {details.conditions.sources.map((source: string) => (
                        <Tag key={source} color="blue">{source}</Tag>
                      ))}
                    </div>
                  )}
                  {details.conditions.communities && details.conditions.communities.length > 0 && (
                    <div>
                      <Text type="secondary">社区：</Text>
                      {details.conditions.communities.map((community: string) => (
                        <Tag key={community} color="green">{community}</Tag>
                      ))}
                    </div>
                  )}
                  {details.conditions.lead_types && details.conditions.lead_types.length > 0 && (
                    <div>
                      <Text type="secondary">类型：</Text>
                      {details.conditions.lead_types.map((type: string) => (
                        <Tag key={type} color="orange">{type}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {details.group_info && (
              <div>
                <Text type="secondary">销售组：</Text>
                <Tag color="purple">{details.group_info.groupname}</Tag>
              </div>
            )}
            {details.allocation_steps && details.allocation_steps.length > 0 && (
              <div>
                <Text type="secondary">分配步骤：</Text>
                <div style={{ marginLeft: 8 }}>
                  {details.allocation_steps.map((step, index) => (
                    <div key={index} style={{ marginBottom: 4 }}>
                      <Text type="secondary">{index + 1}. {step.step}</Text>
                      {step.result && (
                        <div style={{ marginLeft: 16, fontSize: '12px', color: '#666' }}>
                          {typeof step.result === 'object' ? (
                            <pre style={{ margin: 0 }}>{JSON.stringify(step.result, null, 2)}</pre>
                          ) : (
                            step.result
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Space>
        );
      }
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

  // 处理函数
  const handleEditRule = (rule: SimpleAllocationRule) => {
    setEditingRule(rule);
    
    // 确保user_groups字段正确设置
    const formValues = {
      ...rule,
      // 确保默认分配规则的优先级显示为0
      priority: rule.name === '默认分配规则' ? 0 : rule.priority,
      time_start: rule.conditions.time_ranges?.start ? dayjs(rule.conditions.time_ranges.start, 'HH:mm') : undefined,
      time_end: rule.conditions.time_ranges?.end ? dayjs(rule.conditions.time_ranges.end, 'HH:mm') : undefined,
      weekdays: rule.conditions.time_ranges?.weekdays,
      // 确保user_groups是数组格式，并且元素是数字
      user_groups: Array.isArray(rule.user_groups) ? rule.user_groups : [],
      // 展开其他conditions字段
      sources: rule.conditions.sources || [],
      communities: rule.conditions.communities || [],
      lead_types: rule.conditions.lead_types || []
    };
    
    ruleForm.setFieldsValue(formValues);
    setIsRuleModalVisible(true);
  };

  const handleViewRule = (rule: SimpleAllocationRule) => {
    Modal.info({
      title: '分配规则详情',
      content: (
        <div>
          <p><strong>规则名称：</strong>{rule.name}</p>
          <p><strong>描述：</strong>{rule.description}</p>
          <p><strong>优先级：</strong>{rule.priority}</p>
          <p><strong>状态：</strong>{rule.is_active ? '启用' : '禁用'}</p>
          <p><strong>触发条件：</strong></p>
          <pre>{JSON.stringify(rule.conditions, null, 2)}</pre>
          <p><strong>销售组：</strong>{rule.user_groups.join(', ')}</p>
        </div>
      ),
      width: 600
    });
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const response = await allocationApi.rules.deleteRule(id);
      if (response.success) {
        message.success('分配规则已删除');
        loadRules();
      } else {
        message.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除分配规则失败:', error);
      message.error('删除失败');
    }
  };

  const handleEditGroup = (group: UserGroup) => {
    setEditingGroup(group);
    groupForm.setFieldsValue(group);
    setIsGroupModalVisible(true);
  };

  const handleViewGroup = (group: UserGroup) => {
    Modal.info({
      title: '销售组详情',
      content: (
        <div>
          <p><strong>组名称：</strong>{group.groupname}</p>
          <p><strong>描述：</strong>{group.description}</p>
          <p><strong>成员数量：</strong>{group.list.length}</p>
          <p><strong>分配方式：</strong>{group.allocation}</p>
          <p><strong>质量控制：</strong>{group.enable_quality_control ? '启用' : '禁用'}</p>
          {group.daily_lead_limit && (
            <p><strong>日限制：</strong>{group.daily_lead_limit}</p>
          )}
          <p><strong>成员列表：</strong>{group.list.join(', ')}</p>
        </div>
      ),
      width: 600
    });
  };

  const handleDeleteGroup = async (id: number) => {
    try {
      const response = await allocationApi.groups.deleteGroup(id);
      if (response.success) {
        message.success('销售组已删除');
        loadUserGroups();
      } else {
        message.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除销售组失败:', error);
      message.error('删除失败');
    }
  };

  const handleCopyGroup = (group: UserGroup) => {
    const newGroup = { ...group, groupname: group.groupname + '（复制）' };
    setEditingGroup(null);
    groupForm.setFieldsValue(newGroup);
    setIsGroupModalVisible(true);
  };

  // 保存规则
  const handleSaveRule = async (values: any) => {
    try {
      // 使用验证工具函数处理表单数据
      const ruleData = validateRuleForm(values);
      
      let response;
      if (editingRule) {
        response = await allocationApi.rules.updateRule(editingRule.id, ruleData);
      } else {
        response = await allocationApi.rules.createRule(ruleData);
      }

      if (response.success) {
        message.success(editingRule ? '规则更新成功' : '规则创建成功');
        setIsRuleModalVisible(false);
        ruleForm.resetFields();
        setEditingRule(null);
        loadRules();
      } else {
        // 显示详细的错误信息
        const errorMsg = response.error || '保存失败';
        const detailMsg = response.details ? ` (${response.details})` : '';
        message.error(`${errorMsg}${detailMsg}`);
      }
    } catch (error) {
      console.error('[RuleModal] 保存规则失败 →', error);
      message.error(`保存失败: ${(error as Error).message}`);
    }
  };

  // 测试分配
  const handleTestAllocation = async (values: any) => {
    try {
      setLoading(true);
      const response = await allocationApi.rules.testAllocation({
        source: values.source,
        leadtype: values.leadtype,
        community: values.community,
        test_mode: true
      });

      if (response?.success && response?.data) {
        // 加载分配到的销售信息
        if (response.data.assigned_user_id) {
          await loadUserProfiles([response.data.assigned_user_id]);
        }

        setTestResult({
          success: true,
          assigned_user_id: response.data.assigned_user_id,
          allocation_method: response.data.allocation_method,
          rule_name: response.data.rule_name,
          processing_details: {
            matched_rule: response.data.matched_rule,
            allocation_steps: response.data.allocation_steps || [],
            final_group: response.data.final_group,
            conditions_matched: response.data.conditions_matched
          }
        });
        message.success('分配测试完成');
      } else {
        setTestResult({
          success: false,
          message: response?.error || '分配测试失败',
          details: response?.details
        });
        message.error('分配测试失败');
      }
    } catch (error) {
      console.error('测试分配失败:', error);
      setTestResult({
        success: false,
        message: '测试执行异常',
        details: error instanceof Error ? error.message : '未知错误'
      });
      message.error('测试执行异常');
    } finally {
      setLoading(false);
    }
  };

  // 新增：全员信息状态
  const [allUsers, setAllUsers] = useState<{ id: string; nickname: string }[]>([]);

  // 新增：加载所有在职销售
  const loadAllUsers = async () => {
    try {
      // 假设有supabase客户端
      const { data } = await supabase
        .from('users_profile')
        .select('id, nickname')
        .eq('status', 'active');
      setAllUsers(data || []);
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  // 页面加载时自动加载
  useEffect(() => {
    loadAllUsers();
  }, []);

  // 部门和成员分组状态
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [groupedUsers, setGroupedUsers] = useState<
    { deptId: string; deptName: string; members: { id: string; nickname: string }[] }[]
  >([]);
  // TreeSelect数据状态
  const [treeData, setTreeData] = useState<any[]>([]);
  // 1. TreeSelect成员选择器相关状态
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // 加载部门树和成员
  const loadDeptTreeData = async () => {
    const { data: orgs } = await supabase.from('organizations').select('id, name, parent_id');
    const { data: users } = await supabase
      .from('users_profile')
      .select('id, nickname, organization_id')
      .eq('status', 'active');

    // 递归组装部门树
    const buildTree = (parentId: string | null): any[] => {
      return (orgs || [])
        .filter(dep => dep.parent_id === parentId)
        .map(dep => ({
          title: dep.name,
          value: `dept_${dep.id}`,
          key: `dept_${dep.id}`,
          children: [
            // 部门下成员
            ...(users || [])
              .filter(u => u.organization_id === dep.id)
              .map(u => ({
                title: u.nickname,
                value: String(u.id),
                key: String(u.id),
                isLeaf: true
              })),
            // 递归子部门
            ...buildTree(dep.id)
          ]
        }));
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
        title: '未分配部门',
        value: 'dept_none',
        key: 'dept_none',
        children: ungrouped
      });
    }
    
    setTreeData(tree);
  };

  useEffect(() => { loadDeptTreeData(); }, []);

  // 编辑时同步选中成员
  useEffect(() => {
    if (editingGroup && editingGroup.list) {
      setSelectedUsers((editingGroup.list || []).map(id => String(id)));
    } else {
      setSelectedUsers([]);
    }
  }, [editingGroup, isGroupModalVisible]);

  // 部门全选/取消全选
  const handleDeptSelect = (deptId: string, members: { id: string }[]) => {
    const memberIds = members.map(m => m.id);
    const allSelected = memberIds.every(id => selectedUsers.some(u => u === id));
    let newSelected;
    if (allSelected) {
      newSelected = selectedUsers.filter(u => !memberIds.includes(u));
    } else {
      newSelected = Array.from(new Set([...selectedUsers, ...members.map(m => String(m.id))]));
    }
    setSelectedUsers(newSelected);
    groupForm.setFieldsValue({ list: newSelected });
  };

  // 搜索过滤
  const filterOption = (input: string, option: any) => {
    return (
      (option.label && option.label.toLowerCase().includes(input.toLowerCase())) ||
      (option.deptname && option.deptname.toLowerCase().includes(input.toLowerCase()))
    );
  };

  // 新增：销售组管理标签页内容
  const salesGroupTabContent = (
    <Card
      title={<Title level={4} style={{ margin: 0, textAlign: 'left' }}>销售组管理</Title>}
      styles={{
        header: {
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0'
        }
      }}
      extra={
        <Space>
          <Input.Search
            placeholder="搜索组名称或成员昵称"
            allowClear
            style={{ width: 240 }}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingGroup(null);
              groupForm.resetFields();
              setIsGroupModalVisible(true);
            }}
          >
            新增销售组
          </Button>
        </Space>
      }
    >
      <Table
        columns={groupColumns}
        dataSource={filteredUserGroups}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
      />
    </Card>
  );

  // 修改测试分配结果显示
  const renderTestResult = () => {
    if (!testResult) return null;

    return (
      <Alert
        message={testResult.success ? '分配测试结果' : '分配失败'}
        description={
          testResult.success ? (
            <div>
              <Row gutter={[0, 8]}>
                <Col span={24}>
                  <Space>
                    <Text type="secondary">分配给销售：</Text>
                    <Tag icon={<UserOutlined />} color="blue">
                      {testResult.assigned_user_id ? 
                        (userProfileCache[testResult.assigned_user_id]?.nickname || `用户${testResult.assigned_user_id}`)
                        : '未分配'
                      }
                    </Tag>
                  </Space>
                </Col>
                <Col span={24}>
                  <Space>
                    <Text type="secondary">分配方式：</Text>
                    <Tag color="purple">
                      {ALLOCATION_METHODS.find(m => m.value === testResult.allocation_method)?.label || testResult.allocation_method}
                    </Tag>
                  </Space>
                </Col>
                {testResult.rule_name && (
                  <Col span={24}>
                    <Space>
                      <Text type="secondary">使用规则：</Text>
                      <Tag color="green">{testResult.rule_name}</Tag>
                    </Space>
                  </Col>
                )}
                {testResult.processing_details && (
                  <Col span={24}>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">处理详情：</Text>
                      <div style={{ marginLeft: 16, marginTop: 4 }}>
                        {testResult.processing_details.allocation_steps?.map((step: any, index: number) => (
                          <div key={index} style={{ marginBottom: 4 }}>
                            <Text type="secondary">{index + 1}. {step.step}</Text>
                            {step.result && (
                              <div style={{ marginLeft: 16, fontSize: '12px', color: '#666' }}>
                                {typeof step.result === 'object' ? 
                                  <pre style={{ margin: 0 }}>{JSON.stringify(step.result, null, 2)}</pre>
                                  : step.result
                                }
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Col>
                )}
              </Row>
            </div>
          ) : (
            <div>
              <Text type="danger">{testResult.message}</Text>
              {testResult.details && (
                <div style={{ marginTop: 8 }}>
                  <pre>{JSON.stringify(testResult.details, null, 2)}</pre>
                </div>
              )}
            </div>
          )
        }
        type={testResult.success ? 'success' : 'error'}
        showIcon
      />
    );
  };

  // 在组件顶部声明Form实例（移除重复声明）
  const cardStyles = {
    header: {
      borderBottom: '1px solid #f0f0f0',
      padding: '16px 24px'
    }
  };

  // 在组件内部修改 Card 的使用
  return (
    <div className="allocation-management">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: '1',
            label: (
              <span>
                <BranchesOutlined />
                分配流程
              </span>
            ),
            children: (
              <AllocationFlowChart
                rules={rules}
                userGroups={userGroups}
                sourceOptions={sourceOptions}
                communityOptions={communityOptions}
                onRuleEdit={handleEditRule}
                onRuleDelete={handleDeleteRule}
                onRuleTest={handleTestAllocation}
                onRuleCreate={async (rule) => {
                  try {
                    const response = await allocationApi.rules.createRule(rule);
                    if (response.success) {
                      message.success('规则创建成功');
                      loadRules();
                    } else {
                      message.error(response.error || '创建失败');
                    }
                  } catch (error) {
                    console.error('创建规则失败:', error);
                    message.error('创建失败');
                  }
                }}
                onRuleUpdate={async (ruleId, rule) => {
                  try {
                    const response = await allocationApi.rules.updateRule(ruleId, rule);
                    if (response.success) {
                      message.success('规则更新成功');
                      loadRules();
                    } else {
                      message.error(response.error || '更新失败');
                    }
                  } catch (error) {
                    console.error('更新规则失败:', error);
                    message.error('更新失败');
                  }
                }}
                onRulesReorder={async (reorderedRules) => {
                  // 批量更新规则优先级
                  try {
                    // 过滤掉默认分配规则，确保其优先级始终为0
                    const nonDefaultRules = reorderedRules.filter(rule => rule.name !== '默认分配规则');
                    const defaultRule = reorderedRules.find(rule => rule.name === '默认分配规则');
                    
                    // 先更新本地状态
                    setRules(reorderedRules);
                    
                    // 然后异步更新服务器
                    const updatePromises = nonDefaultRules.map((rule, index) => 
                      allocationApi.rules.updateRule(rule.id, { 
                        ...rule, 
                        priority: index + 1 
                      })
                    );
                    
                    // 确保默认分配规则优先级为0
                    if (defaultRule) {
                      updatePromises.push(
                        allocationApi.rules.updateRule(defaultRule.id, { 
                          ...defaultRule, 
                          priority: 0 
                        })
                      );
                    }
                    
                    await Promise.all(updatePromises);
                    message.success('规则顺序已更新');
                  } catch (error) {
                    console.error('更新规则顺序失败:', error);
                    message.error('更新顺序失败');
                    // 如果更新失败，重新加载数据
                    loadRules();
                  }
                }}
              />
            )
          },
          {
            key: '3',
            label: (
              <span>
                <TeamOutlined />
                销售组
              </span>
            ),
            children: salesGroupTabContent
          },
          {
            key: '4',
            label: (
              <span>
                <PlayCircleOutlined />
                分配测试
              </span>
            ),
            children: (
              <Card title="分配测试">
                <Form
                  form={testForm}
                  layout="vertical"
                  onFinish={handleTestAllocation}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="source"
                        label="来源"
                        rules={[{ required: true, message: '请选择来源' }]}
                      >
                        <Select placeholder="选择来源">
                          {sourceOptions.map(source => (
                            <Option key={source} value={source}>{source}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                      <Form.Item
                        name="leadtype"
                        label="线索类型"
                      >
                        <Select placeholder="选择类型" allowClear>
                          <Option value="意向客户">意向客户</Option>
                          <Option value="潜在客户">潜在客户</Option>
                          <Option value="高意向客户">高意向客户</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    
                    <Col span={8}>
                      <Form.Item
                        name="community"
                        label="社区"
                      >
                        <Select placeholder="选择社区" allowClear>
                          {communityOptions.map(community => (
                            <Option key={community} value={community}>{community}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />}>
                      开始测试
                    </Button>
                  </Form.Item>
                </Form>
                
                {renderTestResult()}
              </Card>
            )
          },
          {
            key: '5',
            label: (
              <span>
                <ClockCircleOutlined />
                分配历史
              </span>
            ),
            children: (
              <Card 
                title="分配历史记录"
                extra={
                  <Button 
                    icon={<ReloadOutlined />}
                    onClick={loadAllocationLogs}
                  >
                    刷新
                  </Button>
                }
              >
                <Table
                  columns={logColumns}
                  dataSource={allocationLogs}
                  rowKey="id"
                  scroll={{ x: 1300 }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => 
                      `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                  }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* 规则编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑分配规则' : '新增分配规则'}
        open={isRuleModalVisible}
        onCancel={() => {
          setIsRuleModalVisible(false);
          setEditingRule(null);
          ruleForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          onFinish={handleSaveRule}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.user_groups) {
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="规则名称"
                rules={[{ required: true, message: '请输入规则名称' }]}
              >
                <Input placeholder="请输入规则名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级">
                <InputNumber 
                  min={1} 
                  max={100} 
                  placeholder="优先级" 
                  disabled={editingRule?.name === '默认分配规则'}
                  addonAfter={editingRule?.name === '默认分配规则' ? '固定为0' : ''}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="规则描述">
            <Input.TextArea placeholder="请输入规则描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
               <Form.Item name="sources" label="来源条件">
                 <Select 
                   mode="multiple" 
                   placeholder="不选择则匹配所有来源"
                   allowClear
                   maxTagCount="responsive"
                 >
                   {sourceOptions.map(source => (
                     <Option key={source} value={source}>{source}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
               <Form.Item name="communities" label="社区条件">
                 <Select 
                   mode="multiple" 
                   placeholder="不选择则匹配所有社区"
                   allowClear
                   maxTagCount="responsive"
                 >
                   {communityOptions.map(community => (
                     <Option key={community} value={community}>{community}</Option>
                   ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

           <Form.Item name="lead_types" label="线索类型条件">
             <Select 
               mode="multiple" 
               placeholder="不选择则匹配所有类型"
               allowClear
               maxTagCount="responsive"
             >
               <Option value="意向客户">意向客户</Option>
               <Option value="潜在客户">潜在客户</Option>
               <Option value="高意向客户">高意向客户</Option>
             </Select>
           </Form.Item>
          
            <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="time_start" label="开始时间">
                <TimePicker format="HH:mm" placeholder="选择开始时间" />
                </Form.Item>
              </Col>
            <Col span={12}>
              <Form.Item name="time_end" label="结束时间">
                <TimePicker format="HH:mm" placeholder="选择结束时间" />
                </Form.Item>
              </Col>
          </Row>
          
          <Form.Item name="weekdays" label="工作日">
            <Select mode="multiple" placeholder="选择工作日">
                    {WEEKDAY_OPTIONS.map(day => (
                      <Option key={day.value} value={day.value}>{day.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
          
          <Form.Item name="user_groups" label="销售组" rules={[{ required: true, message: '请选择销售组' }]}>
            <Select 
              mode="multiple" 
              placeholder="选择销售组"
              showSearch
              filterOption={(input, option) =>
                String(option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
              onSelect={(value) => {
              }}
              onDeselect={(value) => {
              }}
            >
              {userGroups.map(group => (
                <Option key={group.id} value={group.id}>{group.groupname}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="allocation_method" label="分配方式">
                <Select placeholder="选择分配方式">
                  {ALLOCATION_METHODS.map(method => (
                    <Option key={method.value} value={method.value}>
                      {method.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enable_permission_check" label="启用权限检查" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="is_active" label="启用规则" valuePropName="checked">
            <Switch />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
              >
                {editingRule ? '更新规则' : '创建规则'}
              </Button>
              <Button onClick={() => {
                setIsRuleModalVisible(false);
                setEditingRule(null);
                ruleForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 销售组编辑弹窗 */}
      <Modal
        title={editingGroup ? '编辑销售组' : '新增销售组'}
        open={isGroupModalVisible}
        onCancel={() => {
          setIsGroupModalVisible(false);
          setEditingGroup(null);
          groupForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              // 使用验证工具函数处理表单数据
              const groupData = validateGroupForm(values);
              
              let response;
              if (editingGroup) {
                response = await allocationApi.groups.updateGroup(editingGroup.id, groupData);
              } else {
                response = await allocationApi.groups.createGroup(groupData);
              }
              
              if (response.success) {
                message.success(editingGroup ? '销售组更新成功' : '销售组创建成功');
                setIsGroupModalVisible(false);
                groupForm.resetFields();
                setEditingGroup(null);
                loadUserGroups();
              } else {
                const errorMsg = response.error || '保存失败';
                const detailMsg = response.details ? ` (${response.details})` : '';
                message.error(`${errorMsg}${detailMsg}`);
              }
            } catch (error) {
              console.error('保存销售组失败:', error);
              message.error(`保存失败: ${(error as Error).message}`);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="groupname"
                label="组名称"
                rules={[{ required: true, message: '请输入组名称' }]}
              >
                <Input placeholder="请输入组名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="allocation" label="分配方式">
                <Select placeholder="选择分配方式">
                  {ALLOCATION_METHODS.map(method => (
                    <Option key={method.value} value={method.value}>
                        {method.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入组描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="daily_lead_limit" label="日限制">
                <InputNumber
                  min={1}
                  placeholder="最大分配"
                  style={{ width: '100%' }}
                  disabled={!groupForm.getFieldValue('enable_quality_control')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conversion_rate_requirement" label="转化率(%)">
                <InputNumber
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="最低转化率"
                  style={{ width: '100%' }}
                  disabled={!groupForm.getFieldValue('enable_quality_control')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_pending_leads" label="最大待处理">
                <InputNumber
                  min={1}
                  placeholder="最大待处理数量"
                  style={{ width: '100%' }}
                  disabled={!groupForm.getFieldValue('enable_quality_control')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="list"
            label="成员ID列表"
            rules={[{ required: true, message: '请选择成员' }]}
          >
            <TreeSelect
              treeData={treeData}
              value={selectedUsers}
              onChange={(val, labelList, extra) => {
                const onlyLeafValues = (val as any[])
                  .filter((value: any) => {
                    // 排除部门ID（以dept_开头）
                    if (typeof value === 'string' && value.startsWith('dept_')) {
                      return false;
                    }
                    // 只保留数字ID（成员ID）
                    return typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)));
                  })
                  .map((value: any) => String(value));
                
                setSelectedUsers(onlyLeafValues);
                groupForm.setFieldsValue({ list: onlyLeafValues });
              }}
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              placeholder="请选择成员"
              showSearch
              filterTreeNode={(input, node) =>
                (node.title as string).toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
                <Form.Item
                name="enable_quality_control"
                label="启用质量控制"
                valuePropName="checked"
              >
                <Switch />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item
                name="enable_community_matching"
                label="启用社区匹配"
                valuePropName="checked"
              >
                <Switch />
                </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingGroup ? '更新销售组' : '创建销售组'}
              </Button>
              <Button onClick={() => {
                setIsGroupModalVisible(false);
                setEditingGroup(null);
                groupForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}; 

export default AllocationManagement;