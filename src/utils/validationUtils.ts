import type { AllocationRuleForm, UserGroup } from '../types/allocation';
import dayjs from 'dayjs';

// 格式化社区备注信息
export const formatCommunityRemark = (community: string | undefined, remark: string | undefined): string => {
  if (!community && !remark) return '';
  
  // 构建社区标记
  const communityMark = community ? `[COMMUNITY:${community}]` : '';
  
  // 如果只有社区没有备注，只返回社区标记
  if (!remark) return communityMark;
  
  // 如果有备注，将社区标记放在备注前面
  return communityMark ? `${communityMark}\n${remark}` : remark;
};

// 验证分配规则表单数据
export const validateRuleForm = (values: any): AllocationRuleForm => {
  // 基础字段验证
  if (!values.name) {
    throw new Error('规则名称不能为空');
  }

  // 处理时间范围
  const timeRanges = {
    start: values.time_start ? dayjs(values.time_start).format('HH:mm') : undefined,
    end: values.time_end ? dayjs(values.time_end).format('HH:mm') : undefined,
    weekdays: values.weekdays
  };

  // 构建条件对象
  const conditions = {
    sources: values.sources || [],
    communities: values.communities || [],
    lead_types: values.lead_types || [],
    time_ranges: timeRanges
  };

  // 返回格式化后的数据
  return {
    name: values.name,
    description: values.description,
    conditions,
    user_groups: values.user_groups || [],
    allocation_method: values.allocation_method || 'round_robin',
    priority: values.priority || 0,
    is_active: values.is_active ?? true
  };
};

// 验证销售组表单数据
export const validateGroupForm = (values: any): Partial<UserGroup> => {
  // 基础字段验证
  if (!values.groupname) {
    throw new Error('组名称不能为空');
  }

  if (!values.list || !values.list.length) {
    throw new Error('请选择组成员');
  }

  // 转换成员ID为 bigint 数组，确保类型正确
  const list = values.list
    .filter((id: any) => id !== null && id !== undefined && id !== '')
    .map((id: string | number) => {
      const numId = Number(id);
      if (isNaN(numId)) {
        throw new Error(`无效的用户ID: ${id}`);
      }
      return numId;
    });

  // 返回格式化后的数据
  return {
    groupname: values.groupname,
    description: values.description,
    list, // 这是 bigint[] 类型
    allocation: values.allocation || 'round_robin',
    enable_quality_control: values.enable_quality_control ?? false,
    daily_lead_limit: values.daily_lead_limit,
    conversion_rate_requirement: values.conversion_rate_requirement,
    max_pending_leads: values.max_pending_leads,
    enable_community_matching: values.enable_community_matching ?? true
  };
}; 