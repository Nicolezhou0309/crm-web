import React from 'react';
import { Button, Input } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const { Search } = Input;

interface MobileHeaderProps {
  keywordSearch?: string;
  onKeywordChange: (value: string) => void;
  onKeywordSearch: (value: string) => void;
  onKeywordClear: () => void;
  onFilterClick: () => void;
  showBackButton?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  keywordSearch,
  onKeywordChange,
  onKeywordSearch,
  onKeywordClear,
  onFilterClick,
  showBackButton = true
}) => {
  return (
    <div 
      className="mobile-header"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'nowrap',
        width: '100%'
      }}
    >
      <div 
        className="header-search"
        style={{
          flex: 1,
          minWidth: '120px',
          margin: 0,
          padding: 0
        }}
      >
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
          style={{ width: '100%' }}
        />
      </div>
      
      <div 
        className="header-actions"
        style={{
          flexShrink: 0,
          minWidth: '60px',
          margin: 0,
          padding: 0
        }}
      >
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
