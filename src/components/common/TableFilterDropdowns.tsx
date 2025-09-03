import React, { useState, useMemo } from 'react';
import { Button, Input, Select, DatePicker, InputNumber, Cascader, Checkbox } from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import UserTreeSelect from '../UserTreeSelect';

import locale from 'antd/es/date-picker/locale/zh_CN';

const { RangePicker } = DatePicker;
const { Search } = Input;

// 通用筛选器下拉框组件
export interface FilterDropdownPropsExtended extends FilterDropdownProps {
  filterType: 'search' | 'select' | 'dateRange' | 'numberRange' | 'cascader' | 'checkbox' | 'hierarchicalLocation' | 'userTree' | 'hierarchicalCategory';
  options?: Array<{ label: string; value: any }>;
  placeholder?: string;
  width?: number;
  onReset?: () => void;
  onConfirm?: () => void;
  // 🆕 新增：非空条件支持
  notNullField?: string; // 对应的非空参数字段名
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
  onConfirm,
  notNullField
}) => {
  const [notNullChecked, setNotNullChecked] = useState(false);

  const handleConfirm = () => {
    // 如果选择了非空条件，需要特殊处理
    if (notNullChecked && notNullField) {
      // 将非空条件添加到筛选器中
      const currentKeys = Array.isArray(selectedKeys) ? selectedKeys : [];
      // 🆕 修复：确保类型安全，使用any类型避免类型冲突
      setSelectedKeys([...currentKeys, { notNull: true, field: notNullField }] as any);
    }
    confirm();
    onConfirm?.();
  };

  return (
    <div style={{ padding: 8 }}>
      <RangePicker
        value={selectedKeys as any}
        onChange={(dates) => setSelectedKeys(dates as any)}
        locale={locale}
        style={{ width, marginBottom: 8 }}
        placeholder={['开始日期', '结束日期']}
      />
      <div style={{ marginBottom: 8 }}>
        <Checkbox
          checked={notNullChecked}
          onChange={(e) => setNotNullChecked(e.target.checked)}
        >
          仅显示非空记录
        </Checkbox>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button 
          type="primary" 
          size="small" 
          style={{ flex: 1 }}
          onClick={handleConfirm}
        >
          筛选
        </Button>
        <Button 
          size="small" 
          style={{ flex: 1 }}
          onClick={() => { 
            setSelectedKeys([]);
            setNotNullChecked(false);
            if (clearFilters) clearFilters();
            onReset?.();
          }}
        >
          重置
        </Button>
      </div>
    </div>
  );
};

// 数字范围筛选器
export const NumberRangeFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  onReset,
  onConfirm
}) => {
  // 类型安全的设置函数
  const setMinValue = (value: number | null) => {
    setSelectedKeys([value, selectedKeys[1] || null].filter(v => v !== null) as any);
  };
  
  const setMaxValue = (value: number | null) => {
    setSelectedKeys([selectedKeys[0] || null, value].filter(v => v !== null) as any);
  };
  
  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <InputNumber
          placeholder="最小值"
          value={selectedKeys[0] as number}
          onChange={setMinValue}
          style={{ flex: 1 }}
        />
        <InputNumber
          placeholder="最大值"
          value={selectedKeys[1] as number}
          onChange={setMaxValue}
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
};

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
  
  // 🆕 优化：获取所有站点选项（不依赖线路选择）
  const allStationOptions = useMemo(() => {
    const stations: Array<{ label: string; value: string }> = [];
    options.forEach((line: any) => {
      if (line.children) {
        line.children.forEach((station: any) => {
          // 确保站点名称不包含"站"字
                  const stationName = station.value;
        const stationLabel = station.label;
          stations.push({
            label: stationLabel,
            value: stationName
          });
        });
      }
    });
    return stations;
  }, [options]);
  
  // 获取选中线路下的站点选项
  const lineStationOptions = selectedLine 
    ? (options.find((line: any) => line.value === selectedLine) as any)?.children || []
    : [];
  
  // 处理筛选确认
  const handleConfirm = () => {
    const finalKeys: string[] = [];
    
    // 🆕 优化：同时选择路线和站点时，以站点选择为准
    if (selectedStations.length > 0) {
      // 如果选择了具体站点，优先使用站点选择
      selectedStations.forEach(station => {
        // 🆕 修复：确保传递的是站点名称，不是带"站"字的完整名称
        const stationName = station;
        finalKeys.push(stationName);
      });
      
      console.log('🔍 [HierarchicalLocationFilterDropdown] 使用站点选择:', {
        selectedStations,
        finalKeys,
        reason: '用户选择了具体站点，优先使用站点选择'
      });
    } else if (selectedLine) {
      // 🆕 优化：如果没有选择具体站点，但选择了线路，则选择该线路下的所有站点
      const line = options.find((line: any) => line.value === selectedLine) as any;
      if (line && line.children) {
        line.children.forEach((station: any) => {
          // 🆕 修复：确保传递的是站点名称，不是带"站"字的完整名称
          const stationName = station.value;
          finalKeys.push(stationName);
        });
        
        console.log('🔍 [HierarchicalLocationFilterDropdown] 使用线路选择（所有站点）:', {
          selectedLine,
          finalKeys,
          reason: '用户选择了线路但未选择具体站点，自动选择该线路下的所有站点'
        });
      }
    }
    
    // 🆕 添加工作地点筛选日志
    console.log('🔍 [HierarchicalLocationFilterDropdown] 工作地点筛选确认:', {
      selectedLine,
      selectedStations,
      finalKeys,
      timestamp: new Date().toISOString()
    });
    
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
      
      {/* 🆕 优化：按站点筛选 - 支持单独筛选站点 */}
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
          placeholder={selectedLine ? "选择该线路下的站点" : "选择任意站点"}
          value={selectedStations}
          onChange={setSelectedStations}
          options={selectedLine ? lineStationOptions : allStationOptions}
          style={{ width: '100%' }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          // 🆕 移除禁用状态，允许单独筛选站点
          // disabled={!selectedLine}
        />
        {!selectedLine && (
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: 4,
            fontStyle: 'italic'
          }}>
            提示：未选择线路时，可以从所有站点中选择
          </div>
        )}
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

// 🆕 新增：主分类分级筛选器（使用与工作地点列相同的筛选逻辑）
export const HierarchicalCategoryFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  confirm,
  clearFilters,
  options = [],
  width = 300,
  onReset,
  onConfirm
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  // 获取所有一级分类选项
  const categoryOptions = options.map((category: any) => ({
    value: category.value,
    label: category.label
  }));
  
  // 🆕 优化：获取所有二级分类选项（不依赖一级分类选择）
  const allSubcategoryOptions = useMemo(() => {
    const subcategories: Array<{ label: string; value: string }> = [];
    options.forEach((category: any) => {
      if (category.children) {
        category.children.forEach((subcategory: any) => {
          subcategories.push({
            label: subcategory.label,
            value: subcategory.value
          });
        });
      }
    });
    return subcategories;
  }, [options]);
  
  // 获取选中一级分类下的二级分类选项
  const categorySubcategoryOptions = selectedCategory 
    ? (options.find((category: any) => category.value === selectedCategory) as any)?.children || []
    : [];
  
  // 处理筛选确认
  const handleConfirm = () => {
    const finalKeys: string[] = [];
    
    // 🆕 优化：同时选择一级分类和二级分类时，以二级分类选择为准
    if (selectedSubcategories.length > 0) {
      // 如果选择了具体二级分类，优先使用二级分类选择
      selectedSubcategories.forEach(subcategory => {
        finalKeys.push(subcategory);
      });
      
      console.log('🔍 [HierarchicalCategoryFilterDropdown] 使用二级分类选择:', {
        selectedSubcategories,
        finalKeys,
        reason: '用户选择了具体二级分类，优先使用二级分类选择'
      });
    } else if (selectedCategory) {
      // 🆕 优化：如果没有选择具体二级分类，但选择了一级分类，则选择该一级分类下的所有二级分类
      const category = options.find((category: any) => category.value === selectedCategory) as any;
      if (category && category.children) {
        category.children.forEach((subcategory: any) => {
          finalKeys.push(subcategory.value);
        });
        
        console.log('🔍 [HierarchicalCategoryFilterDropdown] 使用一级分类选择（所有二级分类）:', {
          selectedCategory,
          finalKeys,
          reason: '用户选择了一级分类但未选择具体二级分类，自动选择该一级分类下的所有二级分类'
        });
      }
    }
    
    // 🆕 添加主分类筛选日志
    console.log('🔍 [HierarchicalCategoryFilterDropdown] 主分类筛选确认:', {
      selectedCategory,
      selectedSubcategories,
      finalKeys,
      timestamp: new Date().toISOString()
    });
    
    setSelectedKeys(finalKeys);
    confirm();
    onConfirm?.();
  };
  
  // 处理重置
  const handleReset = () => {
    setSelectedCategory('');
    setSelectedSubcategories([]);
    setSelectedKeys([]);
    if (clearFilters) clearFilters();
    onReset?.();
  };
  
  return (
    <div style={{ padding: 16, width }}>
      {/* 🆕 优化：按一级分类筛选 - 与工作地点筛选器保持一致的UI风格 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#000', 
          marginBottom: 8,
          fontSize: '14px'
        }}>
          按一级分类筛选
        </div>
        <Select
          placeholder="选择一级分类"
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
          style={{ width: '100%' }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </div>
      
      {/* 🆕 优化：按二级分类筛选 - 与工作地点筛选器保持一致的UI风格 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#000', 
          marginBottom: 8,
          fontSize: '14px'
        }}>
          按二级分类筛选
        </div>
        <Select
          mode="multiple"
          placeholder={selectedCategory ? "选择该一级分类下的二级分类" : "选择任意二级分类"}
          value={selectedSubcategories}
          onChange={setSelectedSubcategories}
          options={selectedCategory ? categorySubcategoryOptions : allSubcategoryOptions}
          style={{ width: '100%' }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          // 🆕 移除禁用状态，允许单独筛选二级分类
          // disabled={!selectedCategory}
        />
        {!selectedCategory && (
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: 4,
            fontStyle: 'italic'
          }}>
            提示：未选择一级分类时，可以从所有二级分类中选择
          </div>
        )}
      </div>
      
      {/* 🆕 优化：操作按钮 - 与工作地点筛选器保持一致的布局 */}
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

// UserTree筛选器
export const UserTreeFilterDropdown: React.FC<FilterDropdownPropsExtended> = ({
  setSelectedKeys,
  confirm,
  clearFilters,
  width = 300,
  onReset,
  onConfirm
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const handleConfirm = () => {
    // 过滤掉部门节点，只保留用户节点
    const userIds = selectedUsers.filter(id => !String(id).startsWith('dept_'));
    setSelectedKeys(userIds);
    confirm();
    onConfirm?.();
  };

  const handleReset = () => {
    setSelectedUsers([]);
    setSelectedKeys([]);
    if (clearFilters) clearFilters();
    onReset?.();
  };

  return (
    <div style={{ padding: 8 }}>
      <UserTreeSelect
        value={selectedUsers}
        onChange={(value) => setSelectedUsers(value)}
        placeholder="请选择约访管家"
        style={{ width, marginBottom: 8 }}
        multiple={true}
        showSearch={true}
        treeDefaultExpandAll={false}
        maxTagCount={3}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button 
          type="primary" 
          size="small" 
          style={{ flex: 1 }}
          onClick={handleConfirm}
        >
          筛选
        </Button>
        <Button 
          size="small" 
          style={{ flex: 1 }}
          onClick={handleReset}
        >
          重置
        </Button>
      </div>
    </div>
  );
};

// 工厂函数：根据类型创建对应的筛选器
export const createFilterDropdown = (
  filterType: 'search' | 'select' | 'dateRange' | 'numberRange' | 'cascader' | 'checkbox' | 'hierarchicalLocation' | 'hierarchicalCategory' | 'userTree',
  options?: Array<{ label: string; value: any }>,
  placeholder?: string,
  width?: number,
  onReset?: () => void,
  onConfirm?: () => void,
  notNullField?: string // 🆕 新增：非空参数字段
) => {
  const commonProps = {
    filterType,
    options,
    placeholder,
    width,
    onReset,
    onConfirm,
    notNullField // 🆕 传递非空字段参数
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
    case 'hierarchicalCategory':
      return (props: FilterDropdownProps) => (
        <HierarchicalCategoryFilterDropdown {...props} {...commonProps} />
      );
    case 'userTree':
      return (props: FilterDropdownProps) => (
        <UserTreeFilterDropdown {...props} {...commonProps} />
      );
    default:
      return (props: FilterDropdownProps) => (
        <SearchFilterDropdown {...props} {...commonProps} />
      );
  }
};


