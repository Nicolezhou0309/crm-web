# 数据透视表解决方案指南

## 概述

本文档提供了多种可直接复制使用的开源数据透视表方案，适用于 React 项目。

## 方案对比

| 方案 | 优点 | 缺点 | 适用场景 | 安装复杂度 |
|------|------|------|----------|------------|
| React-Pivot | 轻量级，易集成 | 功能相对简单 | 基础透视表需求 | ⭐⭐ |
| PivotTable.js | 功能全面，高度可定制 | 学习曲线陡峭 | 复杂数据分析 | ⭐⭐⭐ |
| AG-Grid | 企业级，性能优秀 | 体积较大 | 大型项目 | ⭐⭐ |
| Handsontable | Excel风格，易用 | 商业版收费 | 表格编辑需求 | ⭐⭐ |

## 方案一：React-Pivot (推荐)

### 安装

```bash
npm install react-pivot
```

### 基础使用

```tsx
import React from 'react';
import Pivot from 'react-pivot';

const PivotTable = () => {
  const data = [
    { source: '网站', leadtype: '自然流量', followupstage: '已跟进', count: 10 },
    { source: '网站', leadtype: '自然流量', followupstage: '未跟进', count: 5 },
    { source: '电话', leadtype: '转介绍', followupstage: '已跟进', count: 8 },
    // ... 更多数据
  ];

  return (
    <Pivot
      data={data}
      rows={['source', 'leadtype']}
      cols={['followupstage']}
      aggregatorName="Count"
      vals={['count']}
      rendererName="Table"
    />
  );
};
```

### 高级配置

```tsx
import React, { useState } from 'react';
import Pivot from 'react-pivot';

const AdvancedPivotTable = () => {
  const [config, setConfig] = useState({
    rows: ['source'],
    cols: ['followupstage'],
    aggregatorName: 'Count',
    vals: ['count']
  });

  return (
    <div>
      <Pivot
        data={data}
        rows={config.rows}
        cols={config.cols}
        aggregatorName={config.aggregatorName}
        vals={config.vals}
        rendererName="Table"
        onChange={setConfig}
      />
    </div>
  );
};
```

## 方案二：PivotTable.js

### 安装

```bash
npm install pivottable
npm install @types/pivottable  # TypeScript 支持
```

### 基础使用

```tsx
import React, { useEffect, useRef } from 'react';
import $ from 'jquery';
import 'pivottable';

const PivotTableJS = () => {
  const pivotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pivotRef.current && data.length > 0) {
      $(pivotRef.current).pivot(data, {
        rows: ['source', 'leadtype'],
        cols: ['followupstage'],
        aggregatorName: 'Count',
        vals: ['count']
      });
    }
  }, [data]);

  return <div ref={pivotRef} />;
};
```

### 自定义聚合器

```tsx
// 自定义聚合函数
const customAggregator = () => {
  return {
    init: () => ({ sum: 0, count: 0 }),
    add: (state, value) => {
      state.sum += value;
      state.count += 1;
      return state;
    },
    result: (state) => state.sum / state.count,
    format: (value) => value.toFixed(2)
  };
};

// 使用自定义聚合器
$(pivotRef.current).pivot(data, {
  rows: ['source'],
  cols: ['followupstage'],
  aggregatorName: 'Custom Average',
  aggregators: {
    'Custom Average': customAggregator
  },
  vals: ['count']
});
```

## 方案三：AG-Grid (企业级)

### 安装

```bash
npm install ag-grid-react ag-grid-community
```

### 基础使用

```tsx
import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const AGGridPivot = () => {
  const columnDefs = [
    { field: 'source', rowGroup: true },
    { field: 'leadtype', rowGroup: true },
    { field: 'followupstage', pivot: true },
    { field: 'count', aggFunc: 'sum' }
  ];

  const defaultColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
  };

  return (
    <div className="ag-theme-alpine" style={{ height: 400 }}>
      <AgGridReact
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={data}
        pivotMode={true}
        groupDefaultExpanded={-1}
      />
    </div>
  );
};
```

## 方案四：Handsontable

### 安装

```bash
npm install handsontable
```

### 基础使用

```tsx
import React, { useEffect, useRef } from 'react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.css';

const HandsontablePivot = () => {
  const hotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hotRef.current) {
      const hot = new Handsontable(hotRef.current, {
        data: data,
        colHeaders: true,
        rowHeaders: true,
        licenseKey: 'non-commercial-and-evaluation'
      });
    }
  }, [data]);

  return <div ref={hotRef} />;
};
```

## 集成到现有项目

### 1. 创建透视表组件

```tsx
// src/components/PivotTable.tsx
import React from 'react';
import Pivot from 'react-pivot';

interface PivotTableProps {
  data: any[];
  rows: string[];
  cols: string[];
  aggregatorName?: string;
  vals?: string[];
}

const PivotTable: React.FC<PivotTableProps> = ({
  data,
  rows,
  cols,
  aggregatorName = 'Count',
  vals = ['count']
}) => {
  return (
    <Pivot
      data={data}
      rows={rows}
      cols={cols}
      aggregatorName={aggregatorName}
      vals={vals}
      rendererName="Table"
    />
  );
};

export default PivotTable;
```

### 2. 在页面中使用

```tsx
// src/pages/DataAnalysis.tsx
import PivotTable from '../components/PivotTable';

// 在现有组件中添加
const [pivotConfig, setPivotConfig] = useState({
  rows: ['source'],
  cols: ['followupstage'],
  aggregatorName: 'Count',
  vals: ['count']
});

// 在 JSX 中添加
<PivotTable
  data={data}
  rows={pivotConfig.rows}
  cols={pivotConfig.cols}
  aggregatorName={pivotConfig.aggregatorName}
  vals={pivotConfig.vals}
/>
```

## 性能优化建议

### 1. 数据预处理

```tsx
// 预处理数据以提高性能
const preprocessData = (rawData: any[]) => {
  return rawData.map(item => ({
    ...item,
    // 添加计算字段
    month: new Date(item.created_at).getMonth() + 1,
    year: new Date(item.created_at).getFullYear(),
    // 标准化字段值
    source: item.source || '未知',
    leadtype: item.leadtype || '未知'
  }));
};
```

### 2. 虚拟化处理大数据

```tsx
// 使用虚拟化处理大量数据
import { FixedSizeList as List } from 'react-window';

const VirtualizedPivotTable = ({ data }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      {/* 渲染行数据 */}
    </div>
  );

  return (
    <List
      height={400}
      itemCount={data.length}
      itemSize={35}
    >
      {Row}
    </List>
  );
};
```

### 3. 缓存计算结果

```tsx
import { useMemo } from 'react';

const PivotTableWithCache = ({ data, config }) => {
  const pivotResult = useMemo(() => {
    // 计算透视表结果
    return calculatePivot(data, config);
  }, [data, config]);

  return <PivotTable data={pivotResult} />;
};
```

## 导出功能

### CSV 导出

```tsx
const exportToCSV = (data: any[], filename: string) => {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csvContent = [headers, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
```

### Excel 导出

```tsx
// 需要安装 xlsx
// npm install xlsx

import * as XLSX from 'xlsx';

const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
};
```

## 推荐方案

基于您的项目需求，推荐使用 **React-Pivot** 方案：

1. **轻量级**：体积小，加载快
2. **易集成**：与现有 Ant Design 组件兼容
3. **功能完整**：支持基础透视表功能
4. **活跃维护**：社区支持好

### 快速开始

```bash
# 安装依赖
npm install react-pivot

# 在组件中使用
import Pivot from 'react-pivot';

// 添加到现有页面
<Pivot
  data={yourData}
  rows={['source', 'leadtype']}
  cols={['followupstage']}
  aggregatorName="Count"
  vals={['count']}
  rendererName="Table"
/>
```

## 注意事项

1. **数据格式**：确保数据格式统一，避免空值
2. **性能考虑**：大数据量时考虑分页或虚拟化
3. **用户体验**：添加加载状态和错误处理
4. **响应式设计**：确保在不同屏幕尺寸下正常显示
5. **浏览器兼容性**：测试主流浏览器兼容性

## 相关资源

- [React-Pivot GitHub](https://github.com/plotly/react-pivot)
- [PivotTable.js 文档](https://pivottable.js.org/examples/)
- [AG-Grid 文档](https://www.ag-grid.com/react-data-grid/)
- [Handsontable 文档](https://handsontable.com/docs/javascript-data-grid/) 