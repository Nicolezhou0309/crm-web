import React from 'react';
import { Button, Input, Segmented } from 'antd';
import { FilterOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';

const { Search } = Input;

interface MobileHeaderProps {
  keywordSearch?: string;
  onKeywordChange: (value: string) => void;
  onKeywordSearch: (value: string) => void;
  onKeywordClear: () => void;
  onFilterClick: () => void;
  showBackButton?: boolean;
  // 视图切换相关
  viewMode?: 'list' | 'waterfall';
  onViewModeChange?: (mode: 'list' | 'waterfall') => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  keywordSearch,
  onKeywordChange,
  onKeywordSearch,
  onKeywordClear,
  onFilterClick,
  showBackButton = true,
  viewMode = 'list',
  onViewModeChange
}) => {
  return (
    <div className="mobile-header">
      <div className="header-search">
        <Search
          placeholder="编号、联系方式或管家..."
          value={keywordSearch || ''}
          onChange={(e) => {
            onKeywordChange(e.target.value);
          }}
          onSearch={(value) => {
            onKeywordSearch(value);
          }}
          onPressEnter={(e) => {
            const value = (e.target as HTMLInputElement).value;
            onKeywordSearch(value);
          }}
          onBlur={(e) => {
            const value = e.target.value;
            onKeywordSearch(value);
          }}
          onClear={onKeywordClear}
          size="small"
          allowClear
        />
      </div>
      
      {/* 视图切换 */}
      {onViewModeChange && (
        <div className="header-view-switch">
          <Segmented
            value={viewMode}
            onChange={onViewModeChange}
            size="small"
            options={[
              {
                label: '列表',
                value: 'list',
                icon: <UnorderedListOutlined />
              },
              {
                label: '瀑布流',
                value: 'waterfall',
                icon: <AppstoreOutlined />
              }
            ]}
          />
        </div>
      )}
      
      <div className="header-actions">
        <Button
          icon={<FilterOutlined />}
          onClick={onFilterClick}
          size="small"
          type="primary"
        >
          筛选
        </Button>
      </div>
    </div>
  );
};

export default MobileHeader;
