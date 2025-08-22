import React, { useCallback, memo } from 'react';

interface QuickDateFilterProps {
  quickDateKey: string | null;
  onQuickDateChange: (key: string | null) => void;
}

export const QuickDateFilter: React.FC<QuickDateFilterProps> = memo(({
  quickDateKey,
  onQuickDateChange
}) => {
  const quickDateOptions = [
    { key: 'thisWeek', label: '本周' },
    { key: 'lastWeek', label: '上周' },
    { key: 'thisMonth', label: '本月' },
    { key: 'lastMonth', label: '上月' },
  ];

  const handleQuickDateClick = useCallback((key: string) => {
    
    if (quickDateKey === key) {
      // 如果点击的是当前选中的，则取消选择
      onQuickDateChange(null);
    } else {
      // 否则选择新的日期范围
      onQuickDateChange(key);
    }
  }, [quickDateKey, onQuickDateChange]);


  return (
    <div className="quick-date-bar">
      {quickDateOptions.map(({ key, label }) => (
        <button
          key={key}
          className={`quick-date-btn${quickDateKey === key ? ' active' : ''}`}
          onClick={() => handleQuickDateClick(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

QuickDateFilter.displayName = 'QuickDateFilter';
