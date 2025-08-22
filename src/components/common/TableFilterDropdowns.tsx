import React, { useState } from 'react';
import { Button, Input, Select, DatePicker, InputNumber, Cascader, Checkbox } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import locale from 'antd/es/date-picker/locale/zh_CN';

const { RangePicker } = DatePicker;
const { Search } = Input;

// 通用筛选器下拉框组件
export interface FilterDropdownPropsExtended extends FilterDropdownProps {
  filterType: 'search' | 'select' | 'dateRange' | 'numberRange' | 'cascader' | 'checkbox' | 'hierarchicalLocation';
  options?: Array<{ label: string; value: any }>;
  placeholder?: string;
  width?: number;
  onReset?: () => void;
  onConfirm?: () => void;
}

// 搜索筛选器
export const SearchFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  placeholder = "输入关键词",
  width = 200,
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <Search
      placeholder={placeholder}
      value={selectedKeys[0] || ''}
      onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
      onSearch={(value) => {
        setSelectedKeys(value ? [value] : []);
        confirm();
        onConfirm?.();
      }}
      style={{ width, marginBottom: 8 }}
    />
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 多选筛选器
export const SelectFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  options = [],
  placeholder = "选择选项",
  width = 200,
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <Select
      mode="multiple"
      placeholder={placeholder}
      value={selectedKeys}
      onChange={setSelectedKeys}
      options={options}
      allowClear
      style={{ width, marginBottom: 8 }}
    />
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 日期范围筛选器
export const DateRangeFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  width = 200,
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <RangePicker
      value={selectedKeys as any}
      onChange={(dates) => setSelectedKeys(dates as any)}
      locale={locale}
      style={{ width, marginBottom: 8 }}
      placeholder={['开始日期', '结束日期']}
    />
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 数字范围筛选器
export const NumberRangeFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <InputNumber
          placeholder="最小值"
          value={selectedKeys[0] as number}
          onChange={(value) => setSelectedKeys([value, selectedKeys[1] || null])}
          style={{ flex: 1 }}
        />
        <InputNumber
          placeholder="最大值"
          value={selectedKeys[1] as number}
          onChange={(value) => setSelectedKeys([selectedKeys[0] || null, value])}
          style={{ flex: 1 }}
        />
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 级联选择筛选器
export const CascaderFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  options = [],
  placeholder = "选择级联选项",
  width = 200,
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <Cascader
      placeholder={placeholder}
      value={selectedKeys}
      onChange={setSelectedKeys}
      options={options}
      allowClear
      style={{ width, marginBottom: 8 }}
    />
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 复选框筛选器
export const CheckboxFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  options = [],
  onReset,
  onConfirm
}) => (
  <div style={{ padding: 8 }}>
    <div style={{ marginBottom: 8, maxHeight: 200, overflowY: 'auto' }}>
      {options.map((option) => (
        <div key={option.value} style={{ marginBottom: 4 }}>
          <Checkbox
            checked={selectedKeys.includes(option.value)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedKeys([...selectedKeys, option.value]);
              } else {
                setSelectedKeys(selectedKeys.filter(key => key !== option.value));
              }
            }}
          >
            {option.label}
          </Checkbox>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button 
        type="primary" 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => {
          confirm();
          onConfirm?.();
        }}
      >
        筛选
      </Button>
      <Button 
        size="small" 
        style={{ flex: 1 }}
        onClick={() => { 
          setSelectedKeys([]);
          if (clearFilters) clearFilters();
          onReset?.();
        }}
      >
        重置
      </Button>
    </div>
  </div>
);

// 分级筛选器（支持分别筛选线路和站点）
export const HierarchicalLocationFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  confirm,
  clearFilters,
  options = [],
  width = 300,
  onReset,
  onConfirm
}) => {
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  
  // 获取所有线路选项
  const lineOptions = options.map((line: any) => ({
    value: line.value,
    label: line.label
  }));
  
  // 获取选中线路下的站点选项
  const stationOptions = selectedLine 
    ? (options.find((line: any) => line.value === selectedLine) as any)?.children || []
    : [];
  
  // 处理筛选确认
  const handleConfirm = () => {
    const finalKeys: string[] = [];
    
    // 如果选择了线路，添加该线路下的所有站点
    if (selectedLine) {
      const line = options.find((line: any) => line.value === selectedLine) as any;
      if (line && line.children) {
        line.children.forEach((station: any) => {
          finalKeys.push(station.value);
        });
      }
    }
    
    // 如果选择了具体站点，添加这些站点
    if (selectedStations.length > 0) {
      selectedStations.forEach(station => {
        if (!finalKeys.includes(station)) {
          finalKeys.push(station);
        }
      });
    }
    
    setSelectedKeys(finalKeys);
    confirm();
    onConfirm?.();
  };
  
  // 处理重置
  const handleReset = () => {
    setSelectedLine('');
    setSelectedStations([]);
    setSelectedKeys([]);
    if (clearFilters) clearFilters();
    onReset?.();
  };
  
  return (
    <div style={{ padding: 16, width }}>
      {/* 按线路筛选 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#000', 
          marginBottom: 8,
          fontSize: '14px'
        }}>
          按线路筛选
        </div>
        <Select
          placeholder="选择地铁线路"
          value={selectedLine}
          onChange={setSelectedLine}
          options={lineOptions}
          style={{ width: '100%' }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </div>
      
      {/* 按站点筛选 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#000', 
          marginBottom: 8,
          fontSize: '14px'
        }}>
          按站点筛选
        </div>
        <Select
          mode="multiple"
          placeholder="选择具体站点"
          value={selectedStations}
          onChange={setSelectedStations}
          options={stationOptions}
          style={{ width: '100%' }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          disabled={!selectedLine}
        />
      </div>
      
      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button 
          size="small" 
          style={{ flex: 1 }}
          onClick={handleReset}
        >
          重置
        </Button>
        <Button 
          type="primary" 
          size="small" 
          style={{ flex: 1 }}
          onClick={handleConfirm}
        >
          筛选
        </Button>
      </div>
    </div>
  );
};

// 工厂函数：根据类型创建对应的筛选器
export const createFilterDropdown = (
  filterType: 'search' | 'select' | 'dateRange' | 'numberRange' | 'cascader' | 'checkbox' | 'hierarchicalLocation',
  options?: Array<{ label: string; value: any }>,
  placeholder?: string,
  width?: number,
  onReset?: () => void,
  onConfirm?: () => void
) => {
  const commonProps = {
    filterType,
    options,
    placeholder,
    width,
    onReset,
    onConfirm
  };

  switch (filterType) {
    case 'search':
      return (props: FilterDropdownProps) => (
        <SearchFilterDropdown {...props} {...commonProps} />
      );
    case 'select':
      return (props: FilterDropdownProps) => (
        <SelectFilterDropdown {...props} {...commonProps} />
      );
    case 'dateRange':
      return (props: FilterDropdownProps) => (
        <DateRangeFilterDropdown {...props} {...commonProps} />
      );
    case 'numberRange':
      return (props: FilterDropdownProps) => (
        <NumberRangeFilterDropdown {...props} {...commonProps} />
      );
    case 'cascader':
      return (props: FilterDropdownProps) => (
        <CascaderFilterDropdown {...props} {...commonProps} />
      );
    case 'checkbox':
      return (props: FilterDropdownProps) => (
        <CheckboxFilterDropdown {...props} {...commonProps} />
      );
    case 'hierarchicalLocation':
      return (props: FilterDropdownProps) => (
        <HierarchicalLocationFilterDropdown {...props} {...commonProps} />
      );
    default:
      return (props: FilterDropdownProps) => (
        <SearchFilterDropdown {...props} {...commonProps} />
      );
  }
};


