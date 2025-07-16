import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Typography,
  Tooltip,
  Switch,
  TimePicker
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  TeamOutlined,
  BranchesOutlined,
  PlayCircleOutlined} from '@ant-design/icons';
import { arrayMoveImmutable } from 'array-move';
import type { SimpleAllocationRule, UserGroup } from '../types/allocation';
import { ALLOCATION_METHODS, WEEKDAY_OPTIONS } from '../types/allocation';
import dayjs from 'dayjs';
import { supabase } from '../supaClient';

const { Text, Title } = Typography;
const { Option } = Select;

interface AllocationFlowChartProps {
  rules: SimpleAllocationRule[];
  userGroups: UserGroup[];
  sourceOptions?: string[];
  communityOptions?: string[];
  onRuleEdit?: (rule: SimpleAllocationRule) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleTest?: (rule: SimpleAllocationRule) => void;
  onRuleCreate?: (rule: any) => void;
  onRuleUpdate?: (ruleId: string, rule: any) => void;
  onRulesReorder?: (rules: SimpleAllocationRule[]) => void;
}

// 触发条件节点类型
interface TriggerNode {
  id: string;
  title: string;
  priority: number;
  enabled: boolean;
  locked: boolean;
  data: SimpleAllocationRule;
}

// 人员清单节点类型
interface ListNode {
  id: string;
  title: string;
  groupId: number;
  groupName: string;
  data: UserGroup;
  insertIndex?: number; // 新增属性，用于指示插入位置
}

// 链路类型
interface AllocationChain {
  triggerId: string;
  lists: ListNode[];
}

const AllocationFlowChart: React.FC<AllocationFlowChartProps> = ({
  rules,
  userGroups,
  sourceOptions = [],
  communityOptions = [],
  onRuleDelete,
  onRuleTest,
  onRuleCreate,
  onRuleUpdate,
  onRulesReorder
}) => {
  const [triggers, setTriggers] = useState<TriggerNode[]>([]);
  const [chains, setChains] = useState<AllocationChain[]>([]);
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null);
  const [originalDragRowIdx, setOriginalDragRowIdx] = useState<number | null>(null);
  const [dragListIdx, setDragListIdx] = useState<{row: number, from: number} | null>(null);
  
  // 弹窗状态
  const [isTriggerModal, setIsTriggerModal] = useState(false);
  const [isListModal, setIsListModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerNode | null>(null);
  const [editingList, setEditingList] = useState<ListNode | null>(null);
  const [triggerForm] = Form.useForm();
  const [listForm] = Form.useForm();

  // 添加成员信息状态
  const [groupMembers, setGroupMembers] = useState<Record<number, Array<{id: string; nickname: string}>>>({});

  // 加载销售组成员信息
  useEffect(() => {
    const loadGroupMembers = async () => {
      try {
        // 收集所有需要查询的用户ID
        const allUserIds = userGroups.reduce<number[]>((acc, group) => {
          if (group.list && group.list.length > 0) {
            acc.push(...group.list);
          }
          return acc;
        }, []);

        if (allUserIds.length === 0) return;

        // 批量查询所有用户信息
        const { data, error } = await supabase
          .from('users_profile')
          .select('id, nickname')
          .in('id', allUserIds);

        if (error) throw error;

        // 按组整理用户信息
        const membersByGroup = userGroups.reduce<Record<number, Array<{id: string; nickname: string}>>>((acc, group) => {
          if (group.list && group.list.length > 0) {
            acc[group.id] = group.list
              .map(userId => data?.find(u => u.id === userId))
              .filter((user): user is {id: string; nickname: string} => !!user);
          }
          return acc;
        }, {});

        setGroupMembers(membersByGroup);
      } catch (error) {
        console.error('加载销售组成员失败:', error);
        message.error('加载成员信息失败');
      }
    };
    
    loadGroupMembers();
  }, [userGroups]);

  // 根据规则生成触发器和链路
  useEffect(() => {
    // 将规则按优先级排序，默认规则（优先级0）放在最后
    const sortedRules = [...rules].sort((a, b) => {
      if (a.priority === 0) return 1;
      if (b.priority === 0) return -1;
      return b.priority - a.priority; // 优先级高的在前
    });

    const newTriggers: TriggerNode[] = sortedRules.map((rule) => ({
      id: rule.id,
      title: rule.name,
      priority: rule.priority,
      enabled: rule.is_active,
      locked: rule.priority === 0, // 默认规则锁定
      data: rule
    }));

    const newChains: AllocationChain[] = sortedRules.map(rule => ({
      triggerId: rule.id,
      lists: (rule.user_groups || []).map((groupId, index) => {
        const group = userGroups.find(g => g.id === groupId);
        return {
          id: `${rule.id}_${groupId}_${index}`,
          title: group?.groupname || `销售组${groupId}`,
          groupId: groupId,
          groupName: group?.groupname || `销售组${groupId}`,
          data: group || {} as UserGroup
        };
      }).filter(list => list.data.id)
    }));

    setTriggers(newTriggers);
    setChains(newChains);
  }, [rules, userGroups]);

  // 优化条件详情格式化函数
  const formatConditionDetail = (rule: SimpleAllocationRule) => {
    const { conditions } = rule;
    const details = [];

    if (conditions.sources && conditions.sources.length > 0) {
      details.push(`来源：${conditions.sources.join('、')}`);
    }

    if (conditions.communities && conditions.communities.length > 0) {
      details.push(`社区：${conditions.communities.join('、')}`);
    }

    if (conditions.lead_types && conditions.lead_types.length > 0) {
      details.push(`类型：${conditions.lead_types.join('、')}`);
    }

    if (conditions.time_ranges) {
      const { start, end, weekdays } = conditions.time_ranges;
      const timeRange = start && end ? `${start}-${end}` : '全天';
      const weekdayNames = weekdays?.map(day => 
        WEEKDAY_OPTIONS.find(opt => opt.value === day)?.label || day
      ).join('、');
      
      details.push(`时间：${timeRange}`);
      if (weekdayNames) {
        details.push(`工作日：${weekdayNames}`);
      }
    }

    return details.join('\n'); // 使用双换行符分隔不同类型的条件
  };

  // 优化简短条件显示函数
  const formatConditionShort = (rule: SimpleAllocationRule) => {
    let totalConditions = 0;
    
    // 计算已设置的条件数量
    if (rule.conditions.sources?.length) totalConditions++;
    if (rule.conditions.communities?.length) totalConditions++;
    if (rule.conditions.lead_types?.length) totalConditions++;
    if (rule.conditions.time_ranges?.start || rule.conditions.time_ranges?.end || rule.conditions.time_ranges?.weekdays?.length) totalConditions++;
    
    if (totalConditions === 0) {
      return '匹配全部';
    } else {
      return `已设置 ${totalConditions} 个条件`;
    }
  };

  // 格式化销售组成员列表
  const formatGroupMembers = (list: ListNode) => {
    const members = groupMembers[list.groupId] || [];
    if (members.length === 0) {
      return '暂无成员';
    }
    return members.map(member => member.nickname || `成员${member.id}`).join('\n');
  };

  // 拖拽处理
  const handleRowDragStart = (idx: number) => {
    const trigger = triggers[idx];
    if (trigger.priority === 0) {
      message.warning('默认分配规则不可移动');
      return;
    }
    setDragRowIdx(idx);
    setOriginalDragRowIdx(idx);
  };
  
  const handleRowDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragRowIdx !== null && dragRowIdx !== idx) {
      const targetTrigger = triggers[idx];
      // 不允许拖动到默认规则的位置
      if (targetTrigger.priority === 0) {
        return;
      }

      // 重新排序触发器
      const newTriggers = arrayMoveImmutable(triggers, dragRowIdx, idx);
      const newChains = arrayMoveImmutable(chains, dragRowIdx, idx);
      
      setTriggers(newTriggers);
      setChains(newChains);
      setDragRowIdx(idx);
    }
  };

  // 修改拖拽结束后的优先级更新逻辑
  const handleRowDragEnd = () => {
    // 保存规则优先级排序到数据库
    if (originalDragRowIdx !== null && onRulesReorder) {
      // 使用当前triggers的顺序（已经通过拖拽重新排序）来设置优先级
      const reorderedRules = triggers.map((t, index) => ({
        ...t.data,
        priority: t.priority === 0 ? 0 : triggers.length - index // 从高到低设置优先级，默认规则保持0
      }));

      // 异步保存到数据库
      setTimeout(async () => {
        try {
          await onRulesReorder(reorderedRules);
          message.success('规则优先级排序已保存');
        } catch (error) {
          message.error('保存排序失败');
        }
      }, 200);
    }
    
    setDragRowIdx(null);
    setOriginalDragRowIdx(null);
  };

  const handleListDragStart = (row: number, lidx: number) => {
    setDragListIdx({row, from: lidx});
  };
  
  const handleListDragOver = (e: React.DragEvent, row: number, to: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragListIdx && dragListIdx.row === row && dragListIdx.from !== to) {
      const newChains = [...chains];
      const chain = newChains[row];
      
      // 使用 arrayMoveImmutable 重新排序
      const reorderedLists = arrayMoveImmutable(chain.lists, dragListIdx.from, to);
      chain.lists = reorderedLists;
      
      setChains(newChains);
      setDragListIdx({row, from: to});
    }
  };
  
  const handleListDragEnd = () => {
    // 保存人员组排序到数据库
    if (dragListIdx && onRuleUpdate) {
      const { row } = dragListIdx;
      const chain = chains[row];
      const trigger = triggers[row];
      
      // 获取重新排序后的销售组ID列表
      const reorderedUserGroups = chain.lists.map(list => list.groupId);
      
      // 检查是否有实际的顺序变化
      const originalUserGroups = trigger.data.user_groups;
      const hasOrderChanged = !reorderedUserGroups.every((id, index) => id === originalUserGroups[index]);
      
      if (hasOrderChanged) {
        // 更新规则的销售组顺序
        const updatedRule = {
          ...trigger.data,
          user_groups: reorderedUserGroups
        };
        
        // 异步保存到数据库
        setTimeout(async () => {
          try {
            await onRuleUpdate(trigger.id, updatedRule);
            message.success(`规则 "${trigger.title}" 的人员组排序已保存`);
          } catch (error) {
            message.error('保存排序失败');
          }
        }, 200);
      }
    }
    
    // 延迟一点时间清除拖拽状态，避免立即触发点击事件
    setTimeout(() => {
      setDragListIdx(null);
    }, 100);
  };

  // 触发器操作
  const handleEditTrigger = (trigger: TriggerNode) => {
    // 检查数据完整性，但允许编辑默认分配规则
    if (!trigger.data) {
      message.warning('规则数据不完整，无法编辑');
      return;
    }

    setEditingTrigger(trigger);
    
    // 安全地设置表单值，避免undefined导致错误
    const safeConditions = trigger.data.conditions || {};
    const safeTimeRanges = safeConditions.time_ranges || {};
    
    triggerForm.setFieldsValue({
      title: trigger.title || '',
      sources: safeConditions.sources || [],
      communities: safeConditions.communities || [],
      lead_types: safeConditions.lead_types || [],
      time_start: safeTimeRanges.start ? dayjs(safeTimeRanges.start, 'HH:mm') : undefined,
      time_end: safeTimeRanges.end ? dayjs(safeTimeRanges.end, 'HH:mm') : undefined,
      weekdays: safeTimeRanges.weekdays || [],
      allocation_method: trigger.data.allocation_method || 'round_robin',
      enable_permission_check: trigger.data.enable_permission_check || false
    });
    setIsTriggerModal(true);
  };

  const handleSaveTrigger = async (values: any) => {
    const buildConditions = (v: any) => {
      const cond: any = {};
      if (Array.isArray(v.sources) && v.sources.length > 0) cond.sources = v.sources;
      if (Array.isArray(v.communities) && v.communities.length > 0) cond.communities = v.communities;
      if (Array.isArray(v.lead_types) && v.lead_types.length > 0) cond.lead_types = v.lead_types;
      if (v.time_start || v.time_end || (Array.isArray(v.weekdays) && v.weekdays.length > 0)) {
        cond.time_ranges = {
          start: v.time_start ? dayjs(v.time_start).format('HH:mm') : undefined,
          end: v.time_end ? dayjs(v.time_end).format('HH:mm') : undefined,
          weekdays: v.weekdays && v.weekdays.length > 0 ? v.weekdays : undefined
        };
      }
      return cond;
    };

    const ruleData = {
      name: values.title,
      description: editingTrigger?.data?.description || '',
      is_active: true,
      priority: editingTrigger?.data?.priority || triggers.length + 1,
      conditions: buildConditions(values),
      user_groups: editingTrigger?.data?.user_groups || [],
      allocation_method: values.allocation_method || 'round_robin',
      enable_permission_check: values.enable_permission_check || false
    };

    try {
      // 检查是否是新建触发器
      const isNewTrigger = !editingTrigger || editingTrigger.id.startsWith('trigger_');
      
      if (isNewTrigger && onRuleCreate) {
        await onRuleCreate(ruleData);
      } else if (onRuleUpdate && editingTrigger) {
        await onRuleUpdate(editingTrigger.id, ruleData);
      }
      
      setIsTriggerModal(false);
      setEditingTrigger(null);
      triggerForm.resetFields();
      message.success('触发条件已保存');
    } catch (error) {
      console.error('保存触发条件失败:', error);
      message.error('保存失败');
    }
  };

  const handleDeleteTrigger = (triggerId: string) => {
    if (onRuleDelete) {
      onRuleDelete(triggerId);
    }
    message.success('触发条件已删除');
  };


  // 人员清单操作
  const handleEditList = (list: ListNode) => {
    setEditingList(list);
    listForm.setFieldsValue({
      title: list.title,
      groupId: list.groupId
    });
    setIsListModal(true);
  };

  // 处理销售组保存
  const handleSaveList = async (values: any) => {
    if (!editingList) return;
    
    const { groupId } = values;
    const selectedGroup = userGroups.find(g => g.id === groupId);
    
    if (!selectedGroup) {
      message.error('请选择有效的销售组');
      return;
    }

    try {
      // 构建新的销售组数据
      const newList = {
        ...editingList,
        title: selectedGroup.groupname,
        groupId: selectedGroup.id,
        groupName: selectedGroup.groupname,
        data: selectedGroup
      };

      // 找到对应的规则
      const triggerId = editingList.id.split('_')[0];
      const trigger = triggers.find(t => t.id === triggerId);
      
      if (!trigger) {
        message.error('找不到对应的分配规则');
        return;
      }

      // 更新规则的 user_groups 数组
      const currentUserGroups = trigger.data.user_groups || [];
      let updatedUserGroups = [...currentUserGroups];

      if (editingList.insertIndex !== undefined) {
        // 插入操作
        updatedUserGroups.splice(editingList.insertIndex, 0, selectedGroup.id);
      } else {
        // 编辑操作 - 替换现有的销售组
        const existingIndex = updatedUserGroups.indexOf(editingList.groupId);
        if (existingIndex !== -1) {
          updatedUserGroups[existingIndex] = selectedGroup.id;
        } else {
          updatedUserGroups.push(selectedGroup.id);
        }
      }

      // 更新规则到数据库
      const updatedRule = {
        ...trigger.data,
        user_groups: updatedUserGroups
      };


      if (onRuleUpdate) {
        await onRuleUpdate(triggerId, updatedRule);
        message.success('销售组已保存到分配规则');
      }

      // 更新本地状态
      if (editingList.insertIndex !== undefined) {
        const chainIndex = chains.findIndex(chain => chain.triggerId === triggerId);
        if (chainIndex !== -1) {
          const newChains = [...chains];
          newChains[chainIndex].lists.splice(editingList.insertIndex, 0, newList);
          setChains(newChains);
        }
      } else {
        // 如果是编辑现有销售组
        const updatedChains = chains.map(chain => ({
          ...chain,
          lists: chain.lists.map(list => 
            list.id === editingList.id ? newList : list
          )
        }));
        setChains(updatedChains);
      }

      // 关闭弹窗并重置状态
      setIsListModal(false);
      setEditingList(null);
      listForm.resetFields();
      
    } catch (error) {
      console.error('保存销售组失败:', error);
      message.error(`保存失败: ${(error as Error).message}`);
    }
  };

  // 处理添加销售组
  const handleAddList = (chainId: string) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const newList = {
      id: `${chainId}_${timestamp}_${randomId}`,
      title: '新建人员清单',
      groupId: 0,
      groupName: '未配置',
      data: {} as UserGroup
    };
    
    // 直接打开编辑窗口，不更新状态
    setEditingList(newList);
    listForm.setFieldsValue({ title: newList.title, groupId: undefined });
    setIsListModal(true);
  };

  // 处理取消编辑
  const handleCancelList = () => {
    setIsListModal(false);
    setEditingList(null);
    listForm.resetFields();
  };

  const handleDeleteList = (triggerId: string, listId: string) => {
    // 找到要删除的清单信息
    const chain = chains.find(c => c.triggerId === triggerId);
    const listToDelete = chain?.lists.find(l => l.id === listId);
    
    if (!chain || !listToDelete) {
      message.error('找不到要删除的清单');
      return;
    }
    
    if (chain.lists.length <= 1) {
      message.warning('每条链路至少保留一个人员清单');
      return;
    }
    
    // 更新本地状态
    setChains(prev => prev.map(chain => {
      if (chain.triggerId !== triggerId) return chain;
      return {
        ...chain,
        lists: chain.lists.filter(list => list.id !== listId)
      };
    }));
    
    // 同步更新对应规则的user_groups数组
    const updatedRules = rules.map(rule => {
      if (rule.id === triggerId) {
        return {
          ...rule,
          user_groups: rule.user_groups.filter(groupId => groupId !== listToDelete.groupId)
        };
      }
      return rule;
    });
    
    // 保存更新到数据库
    const updatedRule = updatedRules.find(r => r.id === triggerId);
    if (updatedRule && onRuleUpdate) {
      onRuleUpdate(triggerId, updatedRule);
      message.success('已移除销售组绑定');
    }
  };

  const handleAddTrigger = () => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const newTrigger: TriggerNode = {
      id: `trigger_${timestamp}_${randomId}`,
      title: '新建触发条件',
      priority: triggers.length + 1,
      enabled: true,
      locked: false,
      data: {
        id: `trigger_${timestamp}_${randomId}`,
        name: '新建触发条件',
        description: '',
        is_active: true,
        priority: triggers.length + 1,
        conditions: {},
        user_groups: [],
        allocation_method: 'round_robin',
        enable_permission_check: false
      }
    };

    setEditingTrigger(newTrigger);
    triggerForm.setFieldsValue({
      title: newTrigger.title,
      sources: [],
      communities: [],
      lead_types: [],
      weekdays: [],
      allocation_method: 'round_robin',
      enable_permission_check: false
    });
    setIsTriggerModal(true);
  };

  // 渲染销售组卡片
  const renderListCard = (list: ListNode, chain: string, idx: number, lidx: number) => (
    <Tooltip
      title={formatGroupMembers(list)}
      placement="right"
      styles={{ 
        root: { 
          maxWidth: '300px', 
          whiteSpace: 'pre-line',
          fontSize: '12px'
        }
      }}
    >
      <div 
        className={`flow-list-card ${
          dragListIdx?.row === idx && dragListIdx?.from === lidx ? 'dragging' : ''
        }`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          handleListDragStart(idx, lidx);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleListDragOver(e, idx, lidx);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          handleListDragEnd();
        }}
        onClick={() => handleEditList(list)}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-header">
          <TeamOutlined className="card-icon" />
          <span className="card-title">{list.groupName}</span>
          <div className="card-actions">
            <Button 
              type="text" 
              size="small" 
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteList(chain, list.id);
              }}
              title="移除"
              className="card-action-btn"
            />
          </div>
        </div>
        <div className="card-content">
          <div className="config-item">
            <span className="config-label">成员数：</span>
            <span className="config-value">{groupMembers[list.groupId]?.length || 0}人</span>
          </div>
          <div className="config-item">
            <span className="config-label">分配：</span>
            <Tag color="blue">
              {ALLOCATION_METHODS.find(m => m.value === list.data.allocation)?.label || '轮流分配'}
                      </Tag>
          </div>
        </div>
      </div>
    </Tooltip>
  );

  // 渲染箭头和插入按钮

  // 渲染流程
  const renderAllocationFlow = () => {
    if (triggers.length === 0) {
                    return (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <BranchesOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
          <Title level={4} type="secondary">暂无分配规则</Title>
          <Text type="secondary">请先创建分配规则以查看流程图</Text>
          <div className="add-trigger-section" style={{ marginTop: '24px' }}>
            <Button 
              type="dashed" 
              icon={<PlusOutlined />} 
              onClick={handleAddTrigger}
              size="large"
              block
            >
              新增触发条件
            </Button>
                        </div>
                      </div>
                    );
    }

    // 修改插入销售组的处理函数
    const handleInsertList = (chainId: string, insertIndex: number) => {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const newList = {
        id: `${chainId}_${timestamp}_${randomId}`,
        title: '新建人员清单',
        groupId: 0,
        groupName: '未配置',
        data: {} as UserGroup,
        insertIndex: insertIndex + 1 // 保存插入位置信息
      };
      
      // 直接打开编辑窗口，不更新状态
      setEditingList(newList);
      listForm.setFieldsValue({ title: newList.title, groupId: undefined });
      setIsListModal(true);
    };

    return (
      <div className="allocation-flow-container">
        {chains.map((chain, idx) => {
          const trigger = triggers[idx];
          if (!trigger) return null;
          
          return (
            <div 
              key={chain.triggerId} 
              className={`allocation-flow-row ${dragRowIdx === idx ? 'dragging' : ''}`}
              draggable={trigger.priority !== 0}
              onDragStart={(e) => {
                if (trigger.priority === 0) {
                  e.preventDefault();
                  return;
                }
                e.stopPropagation();
                handleRowDragStart(idx);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRowDragOver(e, idx);
              }}
              onDragEnd={(e) => {
                e.stopPropagation();
                handleRowDragEnd();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                // 只有在没有拖拽时才触发点击事件
                if (!dragRowIdx) {
                  e.stopPropagation();
                }
              }}
              style={{ 
                opacity: dragRowIdx === idx ? 0.8 : 1,
                transform: dragRowIdx === idx ? 'scale(1.02)' : 'scale(1)',
                transition: dragRowIdx === idx ? 'none' : 'all 0.2s ease',
                cursor: trigger.priority === 0 ? 'not-allowed' : (dragRowIdx === idx ? 'grabbing' : 'grab'),
                userSelect: 'none'
              }}
            >
              {/* 优先级标识 */}
              <div className="flow-priority">
                <div className="priority-number">
                  {trigger.title === '默认分配规则' ? 0 : trigger.priority}
                </div>
                <div className="priority-label">优先级</div>
                {trigger.title === '默认分配规则' && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#999', 
                    marginTop: '2px' 
                  }}>
                    不可修改
                </div>
              )}
              </div>

              {/* 触发条件卡片 */}
              {renderTriggerCard(trigger)}

              {/* 箭头连接线 */}
              <div className="flow-arrow">
                <ArrowRightOutlined />
                </div>

              {/* 人员清单链路 */}
              <div className="flow-lists-chain">
                {chain.lists.map((list, lidx) => (
                  <React.Fragment key={list.id}>
                    {renderListCard(list, chain.triggerId, idx, lidx)}
                    {lidx < chain.lists.length - 1 && (
                      <FlowArrow
                        onInsert={() => handleInsertList(chain.triggerId, lidx)}
                      />
                    )}
                  </React.Fragment>
                ))}
                
                {/* 添加销售组按钮 */}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddList(chain.triggerId)}
                  style={{ marginLeft: 8 }}
                >
                  添加销售组
                </Button>
              </div>
            </div>
          );
        })}
        
        {/* 添加新增触发条件按钮 */}
        <div className="add-trigger-section">
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            onClick={handleAddTrigger}
            size="large"
            block
          >
            新增触发条件
          </Button>
        </div>
      </div>
    );
  };

  // 渲染触发器卡片
  const renderTriggerCard = (trigger: TriggerNode) => {
    const isDefaultRule = trigger.priority === 0;
    
    return (
      <Tooltip 
        title={formatConditionDetail(trigger.data)}
        placement="right"
        styles={{ 
          root: { 
            maxWidth: '400px',
            whiteSpace: 'pre-line',
            fontSize: '12px'
          }
        }}
      >
        <div 
          className={`flow-trigger-card ${!trigger.enabled ? 'disabled' : ''} ${isDefaultRule ? 'default-rule' : ''}`}
          onClick={(e) => {
            // 只有在没有拖拽时才触发点击事件
            if (!dragRowIdx && !isDefaultRule) {
              e.stopPropagation();
              handleEditTrigger(trigger);
            }
          }}
          style={isDefaultRule ? { cursor: 'not-allowed', opacity: 0.8 } : undefined}
        >
          <div className="card-header">
            <BranchesOutlined className="card-icon" />
            <span className="card-title">{trigger.title}</span>
            <div className="card-actions">
              {!isDefaultRule && (
                <>
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<PlayCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRuleTest?.(trigger.data);
                    }}
                    title="测试"
                    className="card-action-btn"
                  />
                  {triggers.length > 1 && (
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrigger(trigger.id);
                      }}
                      title="删除"
                      className="card-action-btn"
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="card-content">
            <div className="config-item">
              <span className="config-label">条件：</span>
              <span className="config-value">{formatConditionShort(trigger.data)}</span>
            </div>
            <div className="config-item">
              <span className="config-label">方式：</span>
              <Tag color="blue">
                {ALLOCATION_METHODS.find(m => m.value === trigger.data.allocation_method)?.label}
              </Tag>
            </div>
          </div>
        </div>
      </Tooltip>
    );
  };

  // 统一的箭头组件
  const FlowArrow: React.FC<{
    onInsert?: () => void;
    showInsertButton?: boolean;
  }> = ({ onInsert, showInsertButton = true }) => (
    <div className="flow-arrow">
      <ArrowRightOutlined />
      {showInsertButton && onInsert && (
        <Button
          type="primary"
          size="small"
          shape="circle"
          icon={<PlusOutlined />}
          className="insert-btn"
          onClick={onInsert}
        />
      )}
    </div>
  );

  return (
    <div className="allocation-flow">
      {/* 渲染流程图 */}
      {renderAllocationFlow()}

      {/* 触发器编辑弹窗 */}
      <Modal
        title={editingTrigger ? '编辑触发器' : '新增触发器'}
        open={isTriggerModal}
        onCancel={() => { 
          setIsTriggerModal(false); 
          setEditingTrigger(null); 
          triggerForm.resetFields(); 
        }}
        footer={null}
        width={800}
      >
        <Form form={triggerForm} layout="vertical" onFinish={handleSaveTrigger}>
          <Form.Item name="title" label="条件名称" rules={[{ required: true, message: '请输入条件名称' }]}> 
            <Input /> 
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
              <Form.Item name="weekdays" label="工作日">
                <Select mode="multiple" placeholder="选择工作日">
                  {WEEKDAY_OPTIONS.map(day => (
                    <Option key={day.value} value={day.value}>{day.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="时间区间">
                <Input.Group compact>
                  <Form.Item name="time_start" noStyle>
                    <TimePicker format="HH:mm" placeholder="开始时间" style={{ width: 100 }} />
                  </Form.Item>
                  <span style={{ margin: '0 8px', lineHeight: '32px' }}>至</span>
                  <Form.Item name="time_end" noStyle>
                    <TimePicker format="HH:mm" placeholder="结束时间" style={{ width: 100 }} />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
            </Col>
          </Row>

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

          <Form.Item> 
              <Space>
              <Button type="primary" htmlType="submit">保存</Button> 
              <Button onClick={() => {
                setIsTriggerModal(false);
                setEditingTrigger(null);
                triggerForm.resetFields();
              }}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 销售组列表弹窗 */}
      <Modal
        title={editingList ? '编辑销售组' : '新增销售组'}
        open={isListModal}
        onCancel={handleCancelList}
        footer={null}
        width={500}
      >
        <Form
          form={listForm}
          layout="vertical"
          onFinish={handleSaveList}
        >
          <Form.Item
            name="groupId"
            label="选择销售组"
            rules={[{ required: true, message: '请选择销售组' }]}
          >
            <Select
              placeholder="请选择销售组"
              showSearch
              filterOption={(input: string, option?: { value: string; children: string }) =>
                (option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {userGroups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.groupname}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
              <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={handleCancelList}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AllocationFlowChart; 