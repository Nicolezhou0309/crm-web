import React, { useState, useEffect } from 'react';
import { Tag } from 'antd';
import type { FilterState } from '../types';
import { supabase } from '../../../supaClient';

interface FilterPanelProps {
  filters: FilterState;
  onFilterRemove: (key: string, value?: any) => void;
  onFilterReset: () => void;
}

interface UserInfo {
  id: string;
  nickname: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterRemove,
  onFilterReset
}) => {
  const [userCache, setUserCache] = useState<Record<string, string>>({});

  // 获取筛选条件数量
  const getFilterCount = (): number => {
    return Object.keys(filters).length;
  };

  // 获取用户昵称
  const getUserNickname = async (userId: string): Promise<string> => {
    // 如果缓存中已有，直接返回
    if (userCache[userId]) {
      return userCache[userId];
    }

    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('nickname')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return userId; // 如果获取失败，返回用户ID
      }

      const nickname = data.nickname || `用户${userId}`;
      
      // 更新缓存
      setUserCache(prev => ({
        ...prev,
        [userId]: nickname
      }));

      return nickname;
    } catch (error) {
      console.error('获取用户昵称失败:', error);
      return userId; // 如果出错，返回用户ID
    }
  };

  // 批量获取用户昵称
  const batchGetUserNicknames = async (userIds: string[]) => {
    const uncachedIds = userIds.filter(id => !userCache[id]);
    
    if (uncachedIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('id, nickname')
        .in('id', uncachedIds);

      if (error || !data) return;

      const newCache: Record<string, string> = {};
      data.forEach(user => {
        newCache[String(user.id)] = user.nickname || `用户${user.id}`;
      });

      setUserCache(prev => ({
        ...prev,
        ...newCache
      }));
    } catch (error) {
      console.error('批量获取用户昵称失败:', error);
    }
  };

  // 监听筛选条件变化，自动获取用户昵称
  useEffect(() => {
    const userIds: string[] = [];
    
    // 收集所有用户ID
    Object.entries(filters).forEach(([key, value]) => {
      if (['p_interviewsales_user_id', 'p_showingsales_user_id', 'p_showingsales_user'].includes(key)) {
        if (value && Array.isArray(value)) {
          value.forEach(v => {
            if (v && v !== null && v !== undefined && String(v) !== 'null' && !isNaN(Number(v))) {
              userIds.push(String(v));
            }
          });
        } else if (value && value !== null && value !== undefined && String(value) !== 'null' && !isNaN(Number(value))) {
          userIds.push(String(value));
        }
      }
    });

    // 批量获取用户昵称
    if (userIds.length > 0) {
      batchGetUserNicknames(userIds);
    }
  }, [filters]);

  // 渲染筛选标签
  const renderFilterTags = () => {
    const tags: React.ReactNode[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value == null || (Array.isArray(value) && value.length === 0)) {
        return;
      }

      // 跳过特殊字段
      if (['p_keyword', 'p_created_at_start', 'p_created_at_end', 'p_moveintime_start', 'p_moveintime_end', 
           'p_scheduletime_start', 'p_scheduletime_end', 'p_scheduletime_not_null'].includes(key)) {
        return;
      }

      const fieldLabelMap: Record<string, string> = {
        p_leadid: '线索编号',
        p_leadtype: '线索来源',
        p_interviewsales_user_id: '约访管家',
        p_showingsales_user_id: '带看管家',
        p_followupstage: '阶段',
        p_customerprofile: '用户画像',
        p_worklocation: '工作地点',
        p_userbudget: '用户预算',
        p_userrating: '来访意向',
        p_majorcategory: '跟进结果',
        p_followupresult: '跟进备注',
        p_showingsales_user: '带看管家',
        p_scheduledcommunity: '预约社区',
        p_source: '渠道',
        p_remark: '客服备注',
        p_phone: '手机号',
        p_wechat: '微信号',
      };

      const label = fieldLabelMap[key] || key.replace(/^p_/, '');
      const values = Array.isArray(value) ? value : [value];

      values.forEach((v: any, idx: number) => {
        let displayText = v;
        
        // 特殊字段处理
        if (key === 'p_interviewsales_user_id' || key === 'p_showingsales_user_id' || key === 'p_showingsales_user') {
          if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
            displayText = '未分配';
          } else {
            // 显示用户昵称而不是用户ID
            displayText = userCache[String(v)] || `用户${v}`;
          }
        } else if (key === 'p_scheduledcommunity' && (v === null || v === undefined || String(v) === 'null' || String(v) === '')) {
          displayText = '未分配';
        } else if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
          displayText = '为空';
        }

        tags.push(
          <Tag
            key={`filter_${key}_${String(v)}_${idx}`}
            closable
            className="filter-tag"
            onClose={() => {
              console.log('🔍 [FilterPanel] 关闭筛选标签:', { key, value: v, label, displayText });
              onFilterRemove(key, v);
            }}
            style={{ marginRight: 8, marginBottom: 8 }}
          >
            {`${label}: ${displayText}`}
          </Tag>
        );
      });
    });

    return tags;
  };

  // 渲染日期筛选标签
  const renderDateFilterTags = () => {
    const dateTags: React.ReactNode[] = [];

    // 创建日期区间标签
    if (filters.p_created_at_start && filters.p_created_at_end) {
      dateTags.push(
        <Tag
          key="created_at_range"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭创建日期筛选标签');
            onFilterRemove('p_created_at_start');
            onFilterRemove('p_created_at_end');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          创建日期: {new Date(filters.p_created_at_start).toLocaleDateString()} ~ {new Date(filters.p_created_at_end).toLocaleDateString()}
        </Tag>
      );
    }

    // 创建日期非空标签
    if (filters.p_created_at_not_null && filters.p_created_at_not_null[0] === true) {
      dateTags.push(
        <Tag
          key="created_at_not_null"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭创建日期非空筛选标签');
            onFilterRemove('p_created_at_not_null');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          创建日期: 非空
        </Tag>
      );
    }

    // 入住日期区间标签
    if (filters.p_moveintime_start && filters.p_moveintime_end) {
      dateTags.push(
        <Tag
          key="moveintime_range"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭入住日期筛选标签');
            onFilterRemove('p_moveintime_start');
            onFilterRemove('p_moveintime_end');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          入住日期: {new Date(filters.p_moveintime_start).toLocaleDateString()} ~ {new Date(filters.p_moveintime_end).toLocaleDateString()}
        </Tag>
      );
    }

    // 入住日期非空标签
    if (filters.p_moveintime_not_null && filters.p_moveintime_not_null[0] === true) {
      dateTags.push(
        <Tag
          key="moveintime_not_null"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭入住日期非空筛选标签');
            onFilterRemove('p_moveintime_not_null');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          入住日期: 非空
        </Tag>
      );
    }

    // 预约时间区间标签
    if (filters.p_scheduletime_start && filters.p_scheduletime_end) {
      dateTags.push(
        <Tag
          key="scheduletime_range"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭预约时间筛选标签');
            onFilterRemove('p_scheduletime_start');
            onFilterRemove('p_scheduletime_end');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          预约时间: {new Date(filters.p_scheduletime_start).toLocaleDateString()} ~ {new Date(filters.p_scheduletime_end).toLocaleDateString()}
        </Tag>
      );
    }

    // 预约时间非空标签
    if (filters.p_scheduletime_not_null && filters.p_scheduletime_not_null[0] === true) {
      dateTags.push(
        <Tag
          key="scheduletime_not_null"
          closable
          className="filter-tag"
          onClose={() => {
            console.log('🔍 [FilterPanel] 关闭预约时间非空筛选标签');
            onFilterRemove('p_scheduletime_not_null');
          }}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          预约时间: 非空
        </Tag>
      );
    }

    return dateTags;
  };

  // 渲染关键词筛选标签
  const renderKeywordFilterTag = () => {
    if (!filters.p_keyword) return null;

    return (
      <Tag
        key="keyword_filter"
        closable
        className="filter-tag"
        onClose={() => {
          console.log('🔍 [FilterPanel] 关闭关键词筛选标签:', filters.p_keyword);
          onFilterRemove('p_keyword');
        }}
        style={{ marginRight: 8, marginBottom: 8 }}
      >
        关键词: {filters.p_keyword}
      </Tag>
    );
  };

  if (getFilterCount() === 0) {
    return null;
  }

  return (
    <div className="filter-panel">
      <div className="filter-tags-container">
        {/* 筛选标签 */}
        {renderDateFilterTags()}
        {renderKeywordFilterTag()}
        {renderFilterTags()}
        
        {/* 重置所有筛选按钮 */}
        {getFilterCount() > 0 && (
          <Tag
            className="filter-tag clear-all-tag"
            onClick={onFilterReset}
          >
            清除全部
          </Tag>
        )}
      </div>
    </div>
  );
};
