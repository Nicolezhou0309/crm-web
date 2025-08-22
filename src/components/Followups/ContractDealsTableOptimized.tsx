import React from 'react';
import { Table, Button, DatePicker, Select, Input, Tag } from 'antd';
import type { Deal } from './followupTypes';
import dayjs from 'dayjs';

// 表格头部组件
interface TableHeaderProps {
  dealsCount: number;
  isReadOnly: boolean;
  onAdd: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ dealsCount, isReadOnly, onAdd }) => (
  <div
    style={{
      background: 'transparent',
      borderRadius: 0,
      padding: '8px 0',
      minHeight: 'auto',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: 'none',
      flex: '0 0 auto',
    }}
  >
    <div style={{ fontWeight: 500, fontSize: 14, color: '#666', display: 'flex', alignItems: 'center' }}>
      <span style={{ marginRight: 8 }}>📊 签约记录</span>
      <span style={{ fontSize: 14, color: '#999', fontWeight: 400 }}>(共 {dealsCount} 条记录)</span>
    </div>
    {!isReadOnly && (
      <Button
        type="primary"
        size="small"
        style={{ height: 28, borderRadius: 4, fontWeight: 500, marginRight: 0, fontSize: 14 }}
        onClick={onAdd}
      >
        新增
      </Button>
    )}
  </div>
);