import React from 'react';
import type { GroupData } from '../types';
import { QuickDateFilter } from './QuickDateFilter';

interface GroupPanelProps {
  groupPanelOpen: boolean;
  groupTotal: number;
  groupData: GroupData[];
  selectedGroup: string;
  quickDateKey: string | null;
  onGroupClick: (groupKey: string | number | null | undefined) => void;
  onQuickDateChange: (key: string | null) => void;
}

export const GroupPanel: React.FC<GroupPanelProps> = ({
  groupPanelOpen,
  groupTotal,
  groupData,
  selectedGroup,
  quickDateKey,
  onGroupClick,
  onQuickDateChange
}) => {
  if (!groupPanelOpen) {
    return null;
  }

  // 渲染分组按钮
  const renderGroupButtons = () => {
    return groupData.map(group => {
      // 约访管家和带看管家分组时展示昵称
      let groupLabel = group.groupText || group.key;
      
      // 处理预约社区字段的NULL值显示
      if (group.key === null || group.key === 'null' || group.key === '' || group.groupText === '未分组') {
        groupLabel = '未分配';
      }

      // 统一未分配分组的选中判断逻辑
      const isNullOrEmpty = (val: any) =>
        val === null ||
        val === undefined ||
        String(val).toLowerCase() === 'null' ||
        String(val) === '' ||
        val === '未分组';

      const isSelected =
        (isNullOrEmpty(group.key) && (selectedGroup === 'null' || isNullOrEmpty(selectedGroup))) ||
        String(selectedGroup) === String(group.key);

      return (
        <div
          key={`group_${group.key}`}
          onClick={() => onGroupClick(group.key)}
          className={`group-btn${isSelected ? ' group-btn-selected' : ''}`}
        >
          <span className="group-btn-title">{groupLabel}</span>
          <span className="group-btn-count">{group.count} 条</span>
        </div>
      );
    });
  };

  return (
    <div className={`group-panel-sidebar ${groupPanelOpen ? 'open' : 'closed'}`}>
      {/* 总记录数卡片 */}
      <div className="group-total-section">
        <span className="group-card-title">总记录数</span>
        <span className="group-card-count">{groupTotal}</span>
      </div>
      
      {/* 快捷日期筛选 */}
      <QuickDateFilter
        quickDateKey={quickDateKey}
        onQuickDateChange={onQuickDateChange}
      />
      
      {/* 分组按钮列表 */}
      <div className="group-btn-list">
        {renderGroupButtons()}
      </div>
    </div>
  );
};
