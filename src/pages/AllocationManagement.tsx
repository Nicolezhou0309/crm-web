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
  CopyOutlined,
  TrophyOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { allocationApi } from '../utils/allocationApi';
import { pointsAllocationApi, type PointsCostRule } from '../utils/pointsAllocationApi';
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
  const [pointsRuleForm] = Form.useForm();
  const [communityForm] = Form.useForm();
  
  const [activeTab, setActiveTab] = useState('1');
  const [rules, setRules] = useState<SimpleAllocationRule[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [allocationLogs, setAllocationLogs] = useState<SimpleAllocationLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 枚举值状态
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [communityOptions, setCommunityOptions] = useState<string[]>([]);
  const [allocationMethodOptions, setAllocationMethodOptions] = useState<string[]>([]);
  
  // 弹窗状态
  const [isRuleModalVisible, setIsRuleModalVisible] = useState(false);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<SimpleAllocationRule | null>(null);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  
  // 测试相关
  const [testResult, setTestResult] = useState<any>(null);
  
  // 积分分配规则相关状态
  const [pointsCostRules, setPointsCostRules] = useState<PointsCostRule[]>([]);
  const [isPointsRuleModalVisible, setIsPointsRuleModalVisible] = useState(false);
  const [editingPointsRule, setEditingPointsRule] = useState<PointsCostRule | null>(null);

  // 社区匹配相关状态
  const [communityKeywords, setCommunityKeywords] = useState<any[]>([]);
  const [isCommunityModalVisible, setIsCommunityModalVisible] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<any | null>(null);

  // 加载数据
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadRules(),
      loadUserGroups(),
      loadAllocationLogs(),
      loadEnumOptions(),
      loadPointsCostRules(),
      loadCommunityKeywords()
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
  const [userProfileCache, setUserProfileCache] = useState<Record<string, { nickname: string; status: string }>>({});

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
        [String(user.id)]: { nickname: user.nickname || `用户${user.id}`, status: user.status }
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
      // 并发获取来源、社区和分配方式枚举
      const [sourceResponse, communityResponse, allocationMethodResponse] = await Promise.all([
        allocationApi.enums.getSourceTypes(),
        allocationApi.enums.getCommunityTypes(),
        allocationApi.enums.getAllocationMethods()
      ]);

      if (sourceResponse.success && sourceResponse.data) {
        setSourceOptions(sourceResponse.data);
      }
      if (communityResponse.success && communityResponse.data) {
        setCommunityOptions(communityResponse.data);
      }
      if (allocationMethodResponse.success && allocationMethodResponse.data) {
        setAllocationMethodOptions(allocationMethodResponse.data);
      }
    } catch (error) {
      console.error('加载枚举选项失败:', error);
    }
  };

  const loadPointsCostRules = async () => {
    try {
      const response = await pointsAllocationApi.costRules.getRules();
      if (response.success && response.data) {
        setPointsCostRules(response.data);
      }
    } catch (error) {
      console.error('加载积分成本规则失败:', error);
    }
  };

  const loadCommunityKeywords = async () => {
    try {
      const response = await allocationApi.communityKeywords.getKeywords();
      if (response.success && response.data) {
        setCommunityKeywords(response.data);
      }
    } catch (error) {
      console.error('加载社区关键词失败:', error);
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

  // 积分分配规则表格列
  const pointsRuleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PointsCostRule) => (
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
      title: '基础积分成本',
      dataIndex: 'base_points_cost',
      key: 'base_points_cost',
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {value} 积分
        </Text>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (value: number) => (
        <Tag color={value >= 200 ? 'red' : value >= 150 ? 'orange' : 'blue'}>
          {value}
        </Tag>
      )
    },
    {
      title: '条件配置',
      dataIndex: 'conditions',
      key: 'conditions',
      render: (conditions: any) => {
        const conditionTexts = [];
        if (conditions?.sources?.length > 0) {
          conditionTexts.push(`来源: ${conditions.sources.join(', ')}`);
        }
        if (conditions?.lead_types?.length > 0) {
          conditionTexts.push(`类型: ${conditions.lead_types.join(', ')}`);
        }
        if (conditions?.communities?.length > 0) {
          conditionTexts.push(`社区: ${conditions.communities.join(', ')}`);
        }
        return conditionTexts.length > 0 ? (
          <Tooltip title={conditionTexts.join('; ')}>
            <Text type="secondary">
              {conditionTexts.length} 个条件
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">无特殊条件</Text>
        );
      }
    },
    {
      title: '动态调整',
      dataIndex: 'dynamic_cost_config',
      key: 'dynamic_cost_config',
      render: (config: any) => {
        const adjustments = [];
        if (config?.source_adjustments) {
          adjustments.push(`来源调整: ${Object.keys(config.source_adjustments).length} 项`);
        }
        if (config?.keyword_adjustments) {
          adjustments.push(`关键词调整: ${Object.keys(config.keyword_adjustments).length} 项`);
        }
        if (config?.time_adjustments) {
          adjustments.push(`时间调整: ${Object.keys(config.time_adjustments).length} 项`);
        }
        return adjustments.length > 0 ? (
          <Tooltip title={adjustments.join('; ')}>
            <Text type="secondary">
              {adjustments.length} 项调整
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">无动态调整</Text>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: PointsCostRule) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEditPointsRule(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个积分成本规则吗？"
            onConfirm={() => handleDeletePointsRule(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 新增：检查销售组使用状态的辅助函数
  const getGroupUsageInfo = (groupId: number) => {
    const usedRules = rules.filter(rule => 
      rule.user_groups && rule.user_groups.includes(groupId)
    );
    
    return {
      isUsed: usedRules.length > 0,
      usedRules: usedRules,
      ruleNames: usedRules.map(rule => rule.name).join('、')
    };
  };

  // 修改：销售组表格列配置
  const groupColumns = [
    {
      title: '组名称',
      dataIndex: 'groupname',
      key: 'groupname',
      render: (text: string, record: UserGroup) => {
        const usageInfo = getGroupUsageInfo(record.id);
        
        return (
          <Space direction="vertical" size={4}>
            <Text strong>{text}</Text>
            {usageInfo.isUsed && (
              <Tooltip 
                title={`该销售组正在被以下分配规则使用：${usageInfo.ruleNames}`}
                placement="top"
              >
                <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                  已绑定
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      }
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
        // 使用动态枚举值，如果不在枚举中则显示原始值
        const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
        const isEnumValue = allocationMethodOptions.includes(method);
        return (
          <Tooltip title={methodInfo?.description || `分配方式: ${method}`}>
            <Tag color={isEnumValue ? "blue" : "orange"}>{methodInfo?.label || method}</Tag>
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
      render: (text: string, record: UserGroup) => {
        const usageInfo = getGroupUsageInfo(record.id);
        
        return (
          <Space direction="vertical" size={0}>
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEditGroup(record)}>
              编辑
            </Button>
            <Button type="link" icon={<CopyOutlined />} onClick={() => handleCopyGroup(record)}>
              复制
            </Button>
            {usageInfo.isUsed ? (
              <Tooltip 
                title={`该销售组正在被以下分配规则使用：${usageInfo.ruleNames}。请先从分配规则中移除该销售组，然后再删除。`}
                placement="left"
              >
                <Button 
                  type="link" 
                  danger 
                  icon={<DeleteOutlined />}
                  disabled
                  style={{ 
                    color: '#d9d9d9',
                    cursor: 'not-allowed',
                    opacity: 0.6
                  }}
                >
                  删除
                </Button>
              </Tooltip>
            ) : (
              <Popconfirm
                title="确定删除这个销售组吗？"
                onConfirm={() => handleDeleteGroup(record.id)}
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
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
        const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
        const isEnumValue = allocationMethodOptions.includes(method);
        return (
          <Tag color={isEnumValue ? "purple" : "orange"}>{methodInfo?.label || method}</Tag>
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
      width:100,
      render: (text: string, record: SimpleAllocationLog) => {
        const details = record.processing_details;
        if (!details) return <Text type="secondary">无处理详情</Text>;



        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {/* 显示规则名称 */}
            {details.rule_name && (
              <div>
                <Text type="secondary">使用规则：</Text>
                <Tag color="blue">{details.rule_name}</Tag>
              </div>
            )}
            
            {/* 显示匹配条件 */}
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
            
            {/* 显示销售组信息 */}
            {details.group_info && (
              <div>
                <Text type="secondary">销售组：</Text>
                <Tag color="purple">{details.group_info.groupname}</Tag>
              </div>
            )}
            
            {/* 显示分配步骤 */}
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
            
            {/* 显示调试信息 */}
            {details.debug_info && (
              <div>
                <Text type="secondary">调试信息：</Text>
                <div style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
                  <pre style={{ margin: 0, maxHeight: '100px', overflow: 'auto' }}>
                    {JSON.stringify(details.debug_info, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {/* 如果没有具体内容，显示原始数据 */}
            {!details.rule_name && !details.conditions && !details.group_info && !details.allocation_steps && (
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
    // 确保所有字段都正确设置
    groupForm.setFieldsValue({
      ...group,
      enable_quality_control: group.enable_quality_control || false,
      enable_community_matching: group.enable_community_matching || false,
      list: group.list || []
    });
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
      // 检查销售组是否被分配规则使用
      const usageInfo = getGroupUsageInfo(id);
      
      if (usageInfo.isUsed) {
        message.error(
          `无法删除销售组，该销售组已被以下分配规则使用：${usageInfo.ruleNames}。请先从分配规则中移除该销售组，然后再删除。`
        );
        return;
      }
      
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
    const newGroup = { 
      ...group, 
      groupname: group.groupname + '（复制）',
      enable_quality_control: group.enable_quality_control || false,
      enable_community_matching: group.enable_community_matching || false,
      list: group.list || []
    };
    setEditingGroup(null);
    groupForm.setFieldsValue(newGroup);
    setIsGroupModalVisible(true);
  };

  // 积分分配规则处理函数
  const handleEditPointsRule = (rule: PointsCostRule) => {
    setEditingPointsRule(rule);
    pointsRuleForm.setFieldsValue({
      name: rule.name,
      description: rule.description,
      base_points_cost: rule.base_points_cost,
      priority: rule.priority,
      is_active: rule.is_active,
      conditions: JSON.stringify(rule.conditions, null, 2),
      dynamic_cost_config: JSON.stringify(rule.dynamic_cost_config, null, 2)
    });
    setIsPointsRuleModalVisible(true);
  };

  const handleDeletePointsRule = async (id: string) => {
    try {
      const response = await pointsAllocationApi.costRules.deleteRule(id);
      if (response.success) {
        message.success('积分成本规则已删除');
        loadPointsCostRules();
      } else {
        message.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除积分成本规则失败:', error);
      message.error('删除失败');
    }
  };

  const handleSavePointsRule = async (values: any) => {
    try {
      // 解析JSON字段
      const processedValues = {
        ...values,
        conditions: values.conditions ? JSON.parse(values.conditions) : {},
        dynamic_cost_config: values.dynamic_cost_config ? JSON.parse(values.dynamic_cost_config) : {}
      };

      let response;
      if (editingPointsRule) {
        response = await pointsAllocationApi.costRules.updateRule(editingPointsRule.id, processedValues);
      } else {
        response = await pointsAllocationApi.costRules.createRule(processedValues);
      }

      if (response.success) {
        message.success(editingPointsRule ? '积分成本规则更新成功' : '积分成本规则创建成功');
        setIsPointsRuleModalVisible(false);
        pointsRuleForm.resetFields();
        setEditingPointsRule(null);
        loadPointsCostRules();
      } else {
        message.error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存积分成本规则失败:', error);
      message.error('保存失败，请检查JSON格式是否正确');
    }
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
    try {
      const { data: orgs } = await supabase.from('organizations').select('id, name, parent_id');
      const { data: users } = await supabase
        .from('users_profile')
        .select('id, nickname, organization_id')
        .eq('status', 'active');

      // 同时加载用户信息到缓存
      if (users && users.length > 0) {
        const newCache = users.reduce((acc, user) => ({
          ...acc,
          [String(user.id)]: { nickname: user.nickname || `用户${user.id}`, status: 'active' }
        }), {});
        setUserProfileCache(prev => ({ ...prev, ...newCache }));
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
                // 部门下成员
                ...deptUsers.map(u => ({
                  title: u.nickname,
                  value: String(u.id),
                  key: String(u.id),
                  isLeaf: true
                })),
                // 递归子部门
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
    } catch (error) {
      console.error('加载部门树数据失败:', error);
    }
  };

  useEffect(() => { loadDeptTreeData(); }, []);

  // 编辑时同步选中成员
  useEffect(() => {
    if (editingGroup && editingGroup.list) {
      const userIds = (editingGroup.list || []).map(id => String(id));
      setSelectedUsers(userIds);
      
      // 确保所有选中用户的nickname信息都已加载
      const missingUserIds = userIds.filter(id => !userProfileCache[id]);
      if (missingUserIds.length > 0) {
        loadUserProfiles(missingUserIds.map(id => Number(id)));
      }
      
      // 确保表单数据也同步设置
      groupForm.setFieldsValue({ 
        list: userIds,
        enable_quality_control: editingGroup.enable_quality_control,
        enable_community_matching: editingGroup.enable_community_matching
      });
    } else {
      setSelectedUsers([]);
    }
  }, [editingGroup, isGroupModalVisible, userProfileCache]);

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

  // 积分分配规则标签页内容
  const pointsAllocationTabContent = (
    <Card
      title={<Title level={4} style={{ margin: 0, textAlign: 'left' }}>积分分配规则</Title>}
      styles={{
        header: {
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0'
        }
      }}
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingPointsRule(null);
            pointsRuleForm.resetFields();
            setIsPointsRuleModalVisible(true);
          }}
        >
          新增积分规则
        </Button>
      }
    >
      <Table
        columns={pointsRuleColumns}
        dataSource={pointsCostRules}
        rowKey="id"
        scroll={{ x: 1200 }}
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
              setSelectedUsers([]);
              groupForm.resetFields();
              // 设置默认值
              groupForm.setFieldsValue({
                enable_quality_control: false,
                enable_community_matching: false,
                list: []
              });
              setIsGroupModalVisible(true);
            }}
          >
            新增销售组
          </Button>
        </Space>
      }
    >
      {/* 新增：使用统计信息 */}
      <div style={{ marginBottom: 16 }}>
        <Alert
          message={
            <Space>
              <Text>销售组使用统计：</Text>
              <Text strong>{userGroups.length}</Text>
              <Text>个销售组，其中</Text>
              <Text strong style={{ color: '#1890ff' }}>
                {userGroups.filter(group => getGroupUsageInfo(group.id).isUsed).length}
              </Text>
              <Text>个正在被分配规则使用</Text>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </div>
      
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
                        (userProfileCache[String(testResult.assigned_user_id)]?.nickname || `用户${testResult.assigned_user_id}`)
                        : '未分配'
                      }
                    </Tag>
                  </Space>
                </Col>
                <Col span={24}>
                  <Space>
                    <Text type="secondary">分配方式：</Text>
                    <Tag color={allocationMethodOptions.includes(testResult.allocation_method) ? "purple" : "orange"}>
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

  // 分配历史筛选相关 state
  const [logFilters, setLogFilters] = useState({
    leadid: '',
    allocationMethod: '',
    assignedUserId: '', // 新增：分配销售
    ruleName: '', // 新增：使用规则
    page: 1,
    pageSize: 10,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [logLoading, setLogLoading] = useState(false);
  const [logData, setLogData] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);

  // supabase 查询日志
  const queryLogsBySupabase = async (filters = logFilters) => {
    let query = supabase
      .from('simple_allocation_logs')
      .select('*', { count: 'exact' });
    
    // 基础筛选条件
    if (filters.leadid) query = query.ilike('leadid', `%${filters.leadid}%`);
    if (filters.allocationMethod) query = query.ilike('allocation_method', `%${filters.allocationMethod}%`);
    
    // 新增筛选条件
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
    
    // 处理数据，确保 processing_details 正确解析
    const processedData = data?.map(log => {
      const rule = rules.find(r => r.id === log.rule_id);
      
      // 确保 processing_details 是对象格式
      let processingDetails = log.processing_details;
      if (typeof processingDetails === 'string') {
        try {
          processingDetails = JSON.parse(processingDetails);
        } catch (e) {
          console.warn('解析 processing_details 失败:', e);
          processingDetails = {};
        }
      }
      
      return {
        ...log,
        processing_details: processingDetails || {},
        rule_name: rule?.name || '默认分配'
      };
    }) || [];
    
    // 如果设置了规则名称筛选，在内存中过滤
    let filteredData = processedData;
    if (filters.ruleName) {
      filteredData = processedData.filter(log => 
        log.rule_name.toLowerCase().includes(filters.ruleName.toLowerCase())
      );
    }
    
    return {
      data: filteredData,
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil((count || 0) / filters.pageSize)
    };
  };

  // 查询函数
  const fetchLogs = async (filters = logFilters) => {
    setLogLoading(true);
    try {
      const res = await queryLogsBySupabase(filters);
      setLogData(res.data);
      setLogTotal(res.total);
      setLogFilters(f => ({ ...f, page: res.page, pageSize: res.pageSize }));
    } catch (error) {
      message.error('日志查询失败');
    } finally {
      setLogLoading(false);
    }
  };

  // 副作用自动加载
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, [logFilters.leadid, logFilters.allocationMethod, logFilters.assignedUserId, logFilters.ruleName, logFilters.page, logFilters.pageSize, logFilters.sortBy, logFilters.sortOrder]);

  // 筛选表单提交
  const onLogFilterSubmit = (values: any) => {
    setLogFilters(f => ({
      ...f,
      ...values,
      page: 1 // 筛选后重置到第一页
    }));
  };

  // 分配历史标签页内容
  const allocationHistoryTabContent = (
      <Card 
      title="分配历史记录"
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => fetchLogs()}
            >
              刷新
            </Button>
            <Button 
              type="dashed"
              onClick={() => {
                console.log('当前日志数据:', logData);
                console.log('用户缓存:', userProfileCache);
                console.log('规则数据:', rules);
                message.info('调试信息已输出到控制台');
              }}
            >
              调试数据
            </Button>
          </Space>
      }
    >
      <Form layout="inline" onFinish={onLogFilterSubmit} initialValues={logFilters} style={{ marginBottom: 16 }}>
        <Form.Item name="leadid" label="线索编号">
          <Input allowClear placeholder="请输入线索编号" />
        </Form.Item>
        <Form.Item name="allocationMethod" label="分配方式">
          <Select allowClear style={{ width: 120 }} placeholder="选择分配方式">
            {ALLOCATION_METHODS.map(m => (
              <Option key={m.value} value={m.value}>{m.label}</Option>
            ))}
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
              <Option key={userId} value={userId}>
                {userInfo.nickname || `用户${userId}`}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="ruleName" label="使用规则">
          <Select 
            allowClear 
            style={{ width: 150 }} 
            placeholder="选择规则"
            showSearch
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {rules.map(rule => (
              <Option key={rule.id} value={rule.name}>
                {rule.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">筛选</Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={() => {
            setLogFilters({
              leadid: '',
              allocationMethod: '',
              assignedUserId: '',
              ruleName: '',
              page: 1,
              pageSize: 10,
              sortBy: 'created_at',
              sortOrder: 'desc'
            });
          }}>重置</Button>
        </Form.Item>
      </Form>
        <Table
        columns={logColumns}
        dataSource={logData}
        loading={logLoading}
          rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          current: logFilters.page,
          pageSize: logFilters.pageSize,
          total: logTotal,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => {
            setLogFilters(f => ({ ...f, page, pageSize }));
          }
        }}
        onChange={(pagination, filters, sorter: any) => {
          setLogFilters(f => ({
            ...f,
            page: pagination.current || 1,
            pageSize: pagination.pageSize || 10,
            sortBy: (sorter.field as 'created_at' | 'leadid' | 'assigned_user_id' | 'allocation_method') || 'created_at',
            sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc'
          }));
        }}
        />
      </Card>
  );

  // 社区关键词表格列
  const communityColumns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      render: (keywords: string[]) => (
        <Space size={[0, 4]} wrap>
          {keywords.map((keyword, index) => (
            <Tag key={index} color="blue">{keyword}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '对应社区',
      dataIndex: 'community',
      key: 'community',
      render: (community: string) => (
        <Tag color="green">{community}</Tag>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Tag color={priority >= 100 ? 'red' : priority >= 50 ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: any) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEditCommunity(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个社区关键词映射吗？"
            onConfirm={() => handleDeleteCommunity(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 社区关键词处理函数
  const handleEditCommunity = (community: any) => {
    setEditingCommunity(community);
    communityForm.setFieldsValue({
      keyword: community.keyword,
      community: community.community,
      priority: community.priority
    });
    setIsCommunityModalVisible(true);
  };

  const handleDeleteCommunity = async (id: number) => {
    try {
      const response = await allocationApi.communityKeywords.deleteKeyword(id);
      if (response.success) {
        message.success('社区关键词映射已删除');
        loadCommunityKeywords();
      } else {
        message.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除社区关键词失败:', error);
      message.error('删除失败');
    }
  };

  const handleSaveCommunity = async (values: any) => {
    try {
      let response;
      if (editingCommunity) {
        response = await allocationApi.communityKeywords.updateKeyword(editingCommunity.id, values);
      } else {
        response = await allocationApi.communityKeywords.createKeyword(values);
      }

      if (response.success) {
        message.success(editingCommunity ? '社区关键词映射更新成功' : '社区关键词映射创建成功');
        setIsCommunityModalVisible(false);
        communityForm.resetFields();
        setEditingCommunity(null);
        loadCommunityKeywords();
      } else {
        message.error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存社区关键词失败:', error);
      message.error('保存失败');
    }
  };

  // 社区匹配标签页内容
  const communityMatchingTabContent = (
    <Card
      title={<Title level={4} style={{ margin: 0, textAlign: 'left' }}>社区关键词匹配</Title>}
      styles={{
        header: {
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0'
        }
      }}
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingCommunity(null);
            communityForm.resetFields();
            setIsCommunityModalVisible(true);
          }}
        >
          新增社区映射
        </Button>
      }
    >
      <Table
        columns={communityColumns}
        dataSource={communityKeywords}
        rowKey="id"
        scroll={{ x: 800 }}
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                    console.log('收到重新排序的规则:', reorderedRules);
                    
                    // 过滤掉默认分配规则，确保其优先级始终为0
                    const nonDefaultRules = reorderedRules.filter(rule => rule.name !== '默认分配规则');
                    const defaultRule = reorderedRules.find(rule => rule.name === '默认分配规则');
                    
                    // 先更新本地状态
                    setRules(reorderedRules);
                    
                    // 然后异步更新服务器 - 使用传入的优先级值
                    const updatePromises = nonDefaultRules.map((rule) => 
                      allocationApi.rules.updateRule(rule.id, { 
                        ...rule, 
                        priority: rule.priority // 使用传入的优先级值
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TeamOutlined />
                销售组
              </span>
            ),
            children: salesGroupTabContent
          },
          {
            key: '6',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TrophyOutlined />
                积分规则
              </span>
            ),
            children: pointsAllocationTabContent
          },
          {
            key: '4',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ClockCircleOutlined />
                分配历史
              </span>
            ),
            children: allocationHistoryTabContent
          },
          {
            key: '7',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <EnvironmentOutlined />
                社区匹配
              </span>
            ),
            children: communityMatchingTabContent
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
              {userGroups.map(group => {
                const usageInfo = getGroupUsageInfo(group.id);
                const isCurrentRule = editingRule && editingRule.user_groups && editingRule.user_groups.includes(group.id);
                
                return (
                  <Option key={group.id} value={group.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{group.groupname}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {usageInfo.isUsed && !isCurrentRule && (
                          <Tag color="orange" style={{ fontSize: '10px', lineHeight: '12px' }}>
                            已被使用
                          </Tag>
                        )}
                        {isCurrentRule && (
                          <Tag color="blue" style={{ fontSize: '10px', lineHeight: '12px' }}>
                            当前规则
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="allocation_method" label="分配方式">
                <Select placeholder="选择分配方式">
                  {allocationMethodOptions.length > 0 ? (
                    // 使用动态枚举值
                    allocationMethodOptions.map(method => {
                      const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
                      return (
                        <Option key={method} value={method}>
                          {methodInfo?.label || method}
                        </Option>
                      );
                    })
                  ) : (
                    // 如果枚举加载失败，使用静态常量
                    ALLOCATION_METHODS.map(method => (
                      <Option key={method.value} value={method.value}>
                        {method.label}
                      </Option>
                    ))
                  )}
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
          setSelectedUsers([]);
          groupForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={groupForm}
          layout="vertical"
          onValuesChange={(changedValues, allValues) => {
            // 当质量控制开关变化时，确保相关字段的禁用状态正确更新
            if (changedValues.hasOwnProperty('enable_quality_control')) {
              // 强制重新渲染质量控制相关字段
              groupForm.setFieldsValue({
                daily_lead_limit: allValues.daily_lead_limit,
                conversion_rate_requirement: allValues.conversion_rate_requirement,
                max_pending_leads: allValues.max_pending_leads
              });
            }
          }}
          onFinish={async (values) => {
            try {
              // 将字符串ID转换为数字ID提交给后端
              const processedValues = {
                ...values,
                list: (values.list || []).map((id: any) => Number(id))
              };
              
              // 使用验证工具函数处理表单数据
              const groupData = validateGroupForm(processedValues);
              
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
                
                // 强制刷新销售组数据
                
                // 先清空现有数据
                setUserGroups([]);
                setGroupMembersCache({});
                
                // 重新加载数据
                await loadUserGroups();
              } else {
                const errorMsg = response.error || '保存失败';
                const detailMsg = response.details ? ` (${response.details})` : '';
                console.error('销售组保存失败:', response);
                message.error(`${errorMsg}${detailMsg}`);
              }
            } catch (error) {
              console.error('保存销售组异常:', error);
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
                  {allocationMethodOptions.length > 0 ? (
                    // 使用动态枚举值
                    allocationMethodOptions.map(method => {
                      const methodInfo = ALLOCATION_METHODS.find(m => m.value === method);
                      return (
                        <Option key={method} value={method}>
                          {methodInfo?.label || method}
                        </Option>
                      );
                    })
                  ) : (
                    // 如果枚举加载失败，使用静态常量
                    ALLOCATION_METHODS.map(method => (
                      <Option key={method.value} value={method.value}>
                        {method.label}
                      </Option>
                    ))
                  )}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入组描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item 
                name="daily_lead_limit" 
                label="日限制"
                dependencies={['enable_quality_control']}
              >
                <InputNumber
                  min={1}
                  placeholder="最大分配"
                  style={{ width: '100%' }}
                  disabled={!groupForm.getFieldValue('enable_quality_control')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="conversion_rate_requirement" 
                label="转化率(%)"
                dependencies={['enable_quality_control']}
              >
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
              <Form.Item 
                name="max_pending_leads" 
                label="最大待处理"
                dependencies={['enable_quality_control']}
              >
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
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              treeCheckStrictly={false}
              onSelect={(value, node) => {
                // 如果是部门节点，处理全选/全不选
                if (String(value).startsWith('dept_')) {
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
                    
                    // 递归获取所有子部门的用户
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
                  
                  // 检查该部门是否已经全部选中
                  const allSelected = deptUsers.length > 0 && deptUsers.every((id: string) => selectedUsers.includes(id));
                  
                  let newSelectedUsers = [...selectedUsers];
                  
                  if (allSelected) {
                    // 如果部门已全部选中，则全不选
                    newSelectedUsers = newSelectedUsers.filter(id => !deptUsers.includes(id));
                  } else {
                    // 如果部门未全部选中，则全选
                    deptUsers.forEach((id: string) => {
                      if (!newSelectedUsers.includes(id)) {
                        newSelectedUsers.push(id);
                      }
                    });
                  }
                  
                  setSelectedUsers(newSelectedUsers);
                  groupForm.setFieldsValue({ list: newSelectedUsers });
                  return; // 阻止默认的onChange处理
                }
              }}
              onDeselect={(value, node) => {
                // 如果是部门节点，处理全不选
                if (String(value).startsWith('dept_')) {
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
                    
                    // 递归获取所有子部门的用户
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
                  groupForm.setFieldsValue({ list: newSelectedUsers });
                  return; // 阻止默认的onChange处理
                }
              }}
              onChange={(val, labelList, extra) => {
                const values = Array.isArray(val) ? val : [];
                console.log('【TreeSelect onChange】原始val:', val);
                console.log('【TreeSelect onChange】values:', values);
                
                // 递归获取部门下所有成员id（字符串）
                const getAllUsersInDept = (deptKey: string): string[] => {
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
                  const directUsers = dept.children?.filter((child: any) => child.isLeaf).map((child: any) => child.key) || [];
                  allUsers.push(...directUsers);
                  const subDepts = dept.children?.filter((child: any) => !child.isLeaf) || [];
                  subDepts.forEach((subDept: any) => {
                    const subUsers = getAllUsersInDept(subDept.key);
                    allUsers.push(...subUsers);
                  });
                  return allUsers;
                };
                
                // 使用新增逻辑 + 递归全选/全不选
                
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
                  
                  // 递归获取所有子部门的用户
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
                
                // 分离处理：部门选择和人员选择
                let finalSelectedUsers: string[] = [];
                
                // 分离部门选择和人员选择
                const deptSelections = values.filter((value: any) => String(value).startsWith('dept_'));
                const userSelections = values.filter((value: any) => !String(value).startsWith('dept_'));
                
                // 1. 处理部门选择：只有全选/全不选
                deptSelections.forEach(deptId => {
                  const deptUsers = getAllUsersInDeptRecursive(deptId);
                  
                  // 全选该部门的所有成员
                  deptUsers.forEach(id => {
                    if (!finalSelectedUsers.includes(id)) {
                      finalSelectedUsers.push(id);
                    }
                  });
                });
                
                // 2. 处理人员选择：单独处理
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
                groupForm.setFieldsValue({ list: finalSelectedUsers });
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
              styles={{
                popup: {
                  root: {
                    maxHeight: 400,
                    overflow: 'auto'
                  }
                }
              }}
              popupMatchSelectWidth={false}
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
                setSelectedUsers([]);
                groupForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 积分分配规则编辑弹窗 */}
      <Modal
        title={editingPointsRule ? '编辑积分成本规则' : '新增积分成本规则'}
        open={isPointsRuleModalVisible}
        onCancel={() => {
          setIsPointsRuleModalVisible(false);
          setEditingPointsRule(null);
          pointsRuleForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={pointsRuleForm}
          layout="vertical"
          onFinish={handleSavePointsRule}
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
              <Form.Item
                name="base_points_cost"
                label="基础积分成本"
                rules={[{ required: true, message: '请输入基础积分成本' }]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  placeholder="请输入积分成本"
                  style={{ width: '100%' }}
                  addonAfter="积分"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="规则描述">
            <Input.TextArea placeholder="请输入规则描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue={100}>
                <InputNumber
                  min={0}
                  max={999}
                  placeholder="数字越大优先级越高"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="是否启用" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="conditions" label="触发条件">
            <Input.TextArea 
              placeholder="请输入JSON格式的触发条件，例如：{'sources': ['抖音'], 'lead_types': ['普通']}"
              rows={4}
            />
          </Form.Item>

          <Form.Item name="dynamic_cost_config" label="动态调整配置">
            <Input.TextArea 
              placeholder="请输入JSON格式的动态调整配置，例如：{'source_adjustments': {'抖音': 15}}"
              rows={4}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
              >
                {editingPointsRule ? '更新规则' : '创建规则'}
              </Button>
              <Button onClick={() => {
                setIsPointsRuleModalVisible(false);
                setEditingPointsRule(null);
                pointsRuleForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 社区关键词编辑弹窗 */}
      <Modal
        title={editingCommunity ? '编辑社区关键词映射' : '新增社区关键词映射'}
        open={isCommunityModalVisible}
        onCancel={() => {
          setIsCommunityModalVisible(false);
          setEditingCommunity(null);
          communityForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={communityForm}
          layout="vertical"
          onFinish={handleSaveCommunity}
        >
          <Form.Item
            name="keyword"
            label="关键词"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <Select
              mode="tags"
              placeholder="请输入关键词，可添加多个"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="community"
            label="对应社区"
            rules={[{ required: true, message: '请选择对应社区' }]}
          >
            <Select placeholder="请选择社区">
              {communityOptions.map(community => (
                <Option key={community} value={community}>{community}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            initialValue={0}
          >
            <InputNumber
              min={0}
              max={999}
              placeholder="数字越大优先级越高"
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
              >
                {editingCommunity ? '更新映射' : '创建映射'}
              </Button>
              <Button onClick={() => {
                setIsCommunityModalVisible(false);
                setEditingCommunity(null);
                communityForm.resetFields();
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