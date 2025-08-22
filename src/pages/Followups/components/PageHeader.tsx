import React from 'react';
import { Space, Button, Select, Input, Typography, Switch, Dropdown } from 'antd';
import { ReloadOutlined, SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined } from '@ant-design/icons';
import type { EnumOption } from '../types';

const { Search } = Input;
const { Title } = Typography;

interface PageHeaderProps {
  title: string;
  keywordSearch: string;
  groupField?: string;
  groupFieldOptions: EnumOption[];
  groupPanelOpen: boolean;
  onKeywordSearch: (value: string) => void;
  onKeywordChange: (value: string) => void; // 新增：关键词状态更新
  onKeywordClear: () => void;
  onGroupFieldChange: (value: string) => void;
  onRefresh: () => void;
  onGroupPanelToggle: (open: boolean) => void;
  onMoreActions?: () => void;
  rollbackMenu?: {
    items: Array<{
      key: string;
      label: string;
      onClick: () => void;
    }>;
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  keywordSearch,
  groupField,
  groupFieldOptions,
  groupPanelOpen,
  onKeywordSearch,
  onKeywordChange,
  onKeywordClear,
  onGroupFieldChange,
  onRefresh,
  onGroupPanelToggle,
  onMoreActions,
  rollbackMenu
}) => {
  return (
    <div className="page-header">
      <Title level={4} className="m-0 font-bold text-gray-800">
        {title}
      </Title>
      <Space size="middle">
        {/* 关键词搜索 */}
        <Input
          placeholder="编号、联系方式或管家..."
          allowClear
          value={keywordSearch}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            // 只更新本地状态，不触发搜索
            onKeywordChange(e.target.value);
          }}
          onPressEnter={(e) => {
            // 回车时触发搜索
            const value = (e.target as HTMLInputElement).value;
            onKeywordSearch(value);
          }}
          onBlur={(e) => {
            // 失焦时触发搜索
            const value = e.target.value;
            onKeywordSearch(value);
          }}
          style={{ width: '280px' }}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          onClear={onKeywordClear}
        />

        {/* 分组选择器 */}
        <Select
          placeholder="选择分组字段"
          value={groupField}
          onChange={onGroupFieldChange}
          style={{ width: 140 }}
          options={groupFieldOptions}
        />

        {/* 分组面板切换按钮 */}
        {groupField && (
          <Button
            type={groupPanelOpen ? "primary" : "default"}
            icon={groupPanelOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => onGroupPanelToggle(!groupPanelOpen)}
            title={groupPanelOpen ? "收起分组面板" : "展开分组面板"}
            style={{ minWidth: 'auto' }}
          >
            {groupPanelOpen ? "收起" : "展开"}
          </Button>
        )}

        {/* 刷新按钮 */}
        <Button 
          icon={<ReloadOutlined />} 
          onClick={onRefresh} 
          className="rounded-md font-medium"
        >
          刷新
        </Button>

        {/* 更多操作按钮（可选） */}
        {onMoreActions && (
          <Button
            icon={<SearchOutlined className="ml-0 rotate-90" />}
            className="border-none shadow-none bg-transparent text-lg outline-none flex items-center justify-center"
            tabIndex={0}
            style={{ height: '32px', width: '32px' }}
            onClick={onMoreActions}
          />
        )}

        {/* 回退菜单按钮 */}
        {rollbackMenu && (
          <Dropdown menu={rollbackMenu}>
            <Button
              icon={<MoreOutlined className="ml-0 rotate-90" />}
              className="border-none shadow-none bg-transparent text-lg outline-none flex items-center justify-center"
              tabIndex={0}
              style={{ height: '32px', width: '32px' }}
            />
          </Dropdown>
        )}
      </Space>
    </div>
  );
};
