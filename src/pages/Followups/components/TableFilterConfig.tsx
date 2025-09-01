import React from 'react';
import { createFilterDropdown } from '../../../components/common/TableFilterDropdowns';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import type { EnumOption, MajorCategoryOption, MetroStationOption } from '../types';

// 筛选器配置接口
export interface FilterConfig {
  type: 'search' | 'select' | 'dateRange' | 'numberRange' | 'cascader' | 'checkbox';
  options?: Array<{ label: string; value: any }>;
  placeholder?: string;
  width?: number;
  onReset?: () => void;
  onConfirm?: () => void;
}

// 跟进记录表头筛选器配置
export const getFollowupsTableFilters = (
  // 枚举数据
  communityEnum: EnumOption[],
  followupstageEnum: EnumOption[],
  customerprofileEnum: EnumOption[],
  sourceEnum: EnumOption[],
  userratingEnum: EnumOption[],
  majorCategoryOptions: MajorCategoryOption[],
  metroStationOptions: MetroStationOption[],
  // 筛选选项
  leadtypeFilters: any[],
  remarkFilters: any[],
  worklocationFilters: any[],
  followupresultFilters: any[],
  majorcategoryFilters: any[],
  scheduledcommunityFilters: any[],
  // 回调函数
  onFilterReset?: (field: string) => void,
  onFilterConfirm?: (field: string) => void
) => {
  // 创建筛选器重置回调
  const createResetCallback = (field: string) => () => {
    onFilterReset?.(field);
  };

  // 创建筛选器确认回调
  const createConfirmCallback = (field: string) => () => {
    onFilterConfirm?.(field);
  };

  return {
    // 线索编号 - 搜索筛选器
    leadid: createFilterDropdown(
      'search',
      undefined,
      '输入线索编号关键词',
      200,
      createResetCallback('leadid'),
      createConfirmCallback('leadid')
    ),

    // 线索来源 - 多选筛选器
    leadtype: createFilterDropdown(
      'select',
      leadtypeFilters,
      '选择线索来源',
      200,
      createResetCallback('leadtype'),
      createConfirmCallback('leadtype')
    ),

    // 约访管家 - UserTree筛选器
    interviewsales_user_id: createFilterDropdown(
      'userTree',
      undefined,
      '选择约访管家',
      300,
      createResetCallback('interviewsales_user_id'),
      createConfirmCallback('interviewsales_user_id')
    ),

    // 跟进阶段 - 多选筛选器
    followupstage: createFilterDropdown(
      'select',
      followupstageEnum,
      '选择跟进阶段',
      200,
      createResetCallback('followupstage'),
      createConfirmCallback('followupstage')
    ),

    // 用户画像 - 多选筛选器
    customerprofile: createFilterDropdown(
      'select',
      customerprofileEnum,
      '选择用户画像',
      200,
      createResetCallback('customerprofile'),
      createConfirmCallback('customerprofile')
    ),

    // 工作地点 - 分级筛选器（支持分别筛选线路和站点）
    worklocation: createFilterDropdown(
      'hierarchicalLocation',
      metroStationOptions,
      '选择工作地点',
      300,
      createResetCallback('worklocation'),
      createConfirmCallback('worklocation')
    ),

    // 用户预算 - 范围筛选器
    userbudget: createFilterDropdown(
      'numberRange',
      undefined,
      '输入预算范围',
      240,
      createResetCallback('userbudget'),
      createConfirmCallback('userbudget')
    ),

    // 入住时间 - 日期范围筛选器
    moveintime: createFilterDropdown(
      'dateRange',
      undefined,
      '选择入住时间范围',
      240,
      createResetCallback('moveintime'),
      createConfirmCallback('moveintime'),
      'p_moveintime_not_null' // 🆕 新增：非空参数字段
    ),

    // 来访意向 - 多选筛选器
    userrating: createFilterDropdown(
      'select',
      userratingEnum,
      '选择来访意向',
      200,
      createResetCallback('userrating'),
      createConfirmCallback('userrating')
    ),

    // 主分类 - 🆕 优化：分级筛选器（支持分别筛选一级分类和二级分类）
    majorcategory: createFilterDropdown(
      'hierarchicalCategory',
      majorCategoryOptions,
      '选择跟进结果',
      300,
      createResetCallback('majorcategory'),
      createConfirmCallback('majorcategory')
    ),

    // 跟进备注 - 多选筛选器
    followupresult: createFilterDropdown(
      'select',
      followupresultFilters,
      '选择跟进备注',
      200,
      createResetCallback('followupresult'),
      createConfirmCallback('followupresult')
    ),

    // 预约到店时间 - 日期范围筛选器
    scheduletime: createFilterDropdown(
      'dateRange',
      undefined,
      '选择预约时间范围',
      240,
      createResetCallback('scheduletime'),
      createConfirmCallback('scheduletime'),
      'p_scheduletime_not_null' // 🆕 新增：非空参数字段
    ),

    // 预约社区 - 多选筛选器
    scheduledcommunity: createFilterDropdown(
      'select',
      communityEnum,
      '选择预约社区',
      200,
      createResetCallback('scheduledcommunity'),
      createConfirmCallback('scheduledcommunity')
    ),

    // 带看管家 - UserTree筛选器
    showingsales_user: createFilterDropdown(
      'userTree',
      undefined,
      '选择带看管家',
      300,
      createResetCallback('showingsales_user'),
      createConfirmCallback('showingsales_user')
    ),

    // 创建时间 - 日期范围筛选器
    created_at: createFilterDropdown(
      'dateRange',
      undefined,
      '选择创建时间范围',
      240,
      createResetCallback('created_at'),
      createConfirmCallback('created_at'),
      'p_created_at_not_null' // 🆕 新增：非空参数字段
    ),

    // 来源 - 多选筛选器
    source: createFilterDropdown(
      'select',
      sourceEnum,
      '选择来源',
      200,
      createResetCallback('source'),
      createConfirmCallback('source')
    ),

    // 备注 - 多选筛选器
    remark: createFilterDropdown(
      'select',
      remarkFilters,
      '选择备注类型',
      200,
      createResetCallback('remark'),
      createConfirmCallback('remark')
    ),

    // 社区 - 多选筛选器
    community: createFilterDropdown(
      'select',
      communityEnum,
      '选择社区',
      200,
      createResetCallback('community'),
      createConfirmCallback('community')
    ),

    // 地铁站 - 级联选择筛选器
    metro_station: createFilterDropdown(
      'cascader',
      metroStationOptions,
      '选择地铁站',
      240,
      createResetCallback('metro_station'),
      createConfirmCallback('metro_station')
    ),

    // 主分类 - 级联选择筛选器
    major_category: createFilterDropdown(
      'cascader',
      majorCategoryOptions,
      '选择主分类',
      240,
      createResetCallback('major_category'),
      createConfirmCallback('major_category')
    ),

    // 子分类 - 多选筛选器
    subcategory: createFilterDropdown(
      'select',
      [], // 这里需要根据主分类动态生成
      '选择子分类',
      200,
      createResetCallback('subcategory'),
      createConfirmCallback('subcategory')
    ),

    // 微信 - 搜索筛选器
    wechat: createFilterDropdown(
      'search',
      undefined,
      '输入微信号',
      200,
      createResetCallback('wechat'),
      createConfirmCallback('wechat')
    ),

    // 手机号 - 搜索筛选器
    phone: createFilterDropdown(
      'search',
      undefined,
      '输入手机号',
      200,
      createResetCallback('phone'),
      createConfirmCallback('phone')
    ),

    // 关键词 - 搜索筛选器
    keyword: createFilterDropdown(
      'search',
      undefined,
      '输入关键词',
      200,
      createResetCallback('keyword'),
      createConfirmCallback('keyword')
    )
  };
};

// 导出筛选器配置类型
export type FollowupsTableFilters = ReturnType<typeof getFollowupsTableFilters>;
