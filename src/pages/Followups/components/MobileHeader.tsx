import React, { useState } from 'react';
import { Button, Input, Tag, SearchBar } from 'antd-mobile';
import { FilterOutlined } from '@ant-design/icons';



interface MobileHeaderProps {
  keywordSearch?: string;
  onKeywordChange: (value: string) => void;
  onKeywordSearch: (value: string) => void;
  onKeywordClear: () => void;
  onFilterClick: () => void;
  onQuickFilter?: (rating: number | null, moveInFilter: string | null) => void;
  showBackButton?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  keywordSearch,
  onKeywordChange,
  onKeywordSearch,
  onKeywordClear,
  onFilterClick,
  onQuickFilter,
  showBackButton = true
}) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedMoveInFilter, setSelectedMoveInFilter] = useState<string | null>(null);

  const handleRatingClick = (rating: number) => {
    if (selectedRating === rating) {
      // 如果点击的是已选中的评分，则取消选择
      setSelectedRating(null);
      onQuickFilter?.(null, selectedMoveInFilter);
    } else {
      // 否则选择新的评分
      setSelectedRating(rating);
      onQuickFilter?.(rating, selectedMoveInFilter);
    }
  };

  const handleMoveInFilterClick = (filter: string) => {
    if (selectedMoveInFilter === filter) {
      // 如果点击的是已选中的筛选，则取消选择
      setSelectedMoveInFilter(null);
      onQuickFilter?.(selectedRating, null);
    } else {
      // 否则选择新的筛选
      setSelectedMoveInFilter(filter);
      onQuickFilter?.(selectedRating, filter);
    }
  };

  return (
    <div className="mobile-header">
      {/* 搜索栏和筛选按钮行 */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'nowrap',
          width: '100%',
          marginBottom: '12px'
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
          <SearchBar
            placeholder="编号、联系方式或管家..."
            value={keywordSearch || ''}
            onChange={(value) => {
              onKeywordChange(value);
            }}
            onSearch={(value) => {
              onKeywordSearch(value);
            }}
            onClear={onKeywordClear}
            style={{
              '--background': '#ffffff',
              '--border-radius': '12px',
              '--height': '36px',
              '--padding-left': '12px'
            }}
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
            onClick={onFilterClick}
            size="small"
            fill="outline"
            color="default"
            style={{
              '--border-radius': '8px',
              '--border-color': '#d1d5db',
              '--height': '36px'
            } as React.CSSProperties & Record<string, string>}
          >
            筛选
          </Button>
        </div>
      </div>

      {/* 快速筛选按钮行 */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '8px',
          padding: 0,
          flexWrap: 'wrap'
        }}
      >
        <Tag
          color={selectedRating === 3 ? 'primary' : 'default'}
          fill={selectedRating === 3 ? 'solid' : 'outline'}
          onClick={() => handleRatingClick(3)}
          style={{
            cursor: 'pointer',
            padding: '1px 3px',
            margin: '0',
            fontSize: '7px',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'none',
            height: '22px',
            '--border-radius': '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: selectedRating === 3 ? '1px solid #1890ff' : 'none'
          } as React.CSSProperties & Record<string, string>}
        >
          <span style={{ 
            fontSize: '12px', 
            color: '#faad14',
            lineHeight: '1',
            letterSpacing: '1px'
          }}>
            ★★★
          </span>
        </Tag>

        <Tag
          color={selectedRating === 2 ? 'primary' : 'default'}
          fill={selectedRating === 2 ? 'solid' : 'outline'}
          onClick={() => handleRatingClick(2)}
          style={{
            cursor: 'pointer',
            padding: '1px 3px',
            margin: '0',
            fontSize: '7px',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'none',
            height: '22px',
            '--border-radius': '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: selectedRating === 2 ? '1px solid #1890ff' : 'none'
          } as React.CSSProperties & Record<string, string>}
        >
          <span style={{ 
            fontSize: '12px', 
            color: '#faad14',
            lineHeight: '1',
            letterSpacing: '1px'
          }}>
            ★★☆
          </span>
        </Tag>

        <Tag
          color={selectedRating === 1 ? 'primary' : 'default'}
          fill={selectedRating === 1 ? 'solid' : 'outline'}
          onClick={() => handleRatingClick(1)}
          style={{
            cursor: 'pointer',
            padding: '1px 3px',
            margin: '0',
            fontSize: '7px',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'none',
            height: '22px',
            '--border-radius': '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: selectedRating === 1 ? '1px solid #1890ff' : 'none'
          } as React.CSSProperties & Record<string, string>}
        >
          <span style={{ 
            fontSize: '12px', 
            color: '#faad14',
            lineHeight: '1',
            letterSpacing: '1px'
          }}>
            ★☆☆
          </span>
        </Tag>

        {/* 月内入住标签 */}
        <Tag
          color={selectedMoveInFilter === 'current' ? 'primary' : 'default'}
          fill={selectedMoveInFilter === 'current' ? 'solid' : 'outline'}
          onClick={() => handleMoveInFilterClick('current')}
          style={{
            cursor: 'pointer',
            padding: '1px 3px',
            margin: '0',
            fontSize: '7px',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'none',
            height: '22px',
            '--border-radius': '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: selectedMoveInFilter === 'current' ? '1px solid #1890ff' : 'none'
          } as React.CSSProperties & Record<string, string>}
        >
          <span style={{ 
            fontSize: '10px', 
            color: '#666',
            lineHeight: '1'
          }}>
            月内入住
          </span>
        </Tag>

        {/* 下月入住标签 */}
        <Tag
          color={selectedMoveInFilter === 'next' ? 'primary' : 'default'}
          fill={selectedMoveInFilter === 'next' ? 'solid' : 'outline'}
          onClick={() => handleMoveInFilterClick('next')}
          style={{
            cursor: 'pointer',
            padding: '1px 3px',
            margin: '0',
            fontSize: '7px',
            width: 'fit-content',
            minWidth: 'unset',
            maxWidth: 'none',
            height: '22px',
            '--border-radius': '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: selectedMoveInFilter === 'next' ? '1px solid #1890ff' : 'none'
          } as React.CSSProperties & Record<string, string>}
        >
          <span style={{ 
            fontSize: '10px', 
            color: '#666',
            lineHeight: '1'
          }}>
            下月入住
          </span>
        </Tag>
      </div>
    </div>
  );
};

export default MobileHeader;
