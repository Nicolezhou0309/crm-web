import React from 'react';
import { Tag, Space, Button } from 'antd';
import type { FilterState } from '../types';

interface FilterPanelProps {
  filters: FilterState;
  onFilterRemove: (key: string, value?: any) => void;
  onFilterReset: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterRemove,
  onFilterReset
}) => {
  // 获取筛选条件数量
  const getFilterCount = (): number => {
    return Object.keys(filters).length;
  };

  // 渲染筛选标签
  const renderFilterTags = () => {
    const tags: React.ReactNode[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value == null || (Array.isArray(value) && value.length === 0)) {
        return;
      }

      // 跳过特殊字段
      if (['p_keyword', 'p_created_at_start', 'p_created_at_end', 'p_moveintime_start', 'p_moveintime_end'].includes(key)) {
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
        if (key === 'p_interviewsales_user_id' || key === 'p_showingsales_user_id') {
          if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
            displayText = '未分配';
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
