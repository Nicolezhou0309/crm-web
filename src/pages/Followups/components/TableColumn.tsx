import React from 'react';
import { Button, Tag, Typography } from 'antd';
import { CopyOutlined, UserOutlined } from '@ant-design/icons';
import type { FollowupRecord } from '../types';

const { Paragraph } = Typography;

interface TableColumnProps {
  type: 'leadid' | 'followupstage' | 'user' | 'action';
  record: FollowupRecord;
  value?: any;
  options?: any[];
  onLeadDetailClick?: (leadid: string) => void;
  onStageClick?: (record: FollowupRecord) => void;
  onRollbackClick?: (record: FollowupRecord) => void;
  isFieldDisabled?: () => boolean;
}

export const TableColumn: React.FC<TableColumnProps> = ({
  type,
  record,
  value,
  options,
  onLeadDetailClick,
  onStageClick,
  onRollbackClick,
  isFieldDisabled
}) => {
  switch (type) {
    case 'leadid':
      return value ? (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 15, color: '#1677ff', fontWeight: 'normal', display: 'inline-block', whiteSpace: 'nowrap' }}
            onClick={() => onLeadDetailClick?.(record.leadid)}
          >
            {value}
          </Button>
          <Paragraph
            copyable={{ text: value, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }}
            style={{ margin: 0, marginLeft: 4, display: 'inline-block', whiteSpace: 'nowrap' }}
          />
        </span>
      ) : <span style={{ color: '#bbb' }}>-</span>;

    case 'followupstage':
      const item = options?.find((i: any) => i.value === value);
      const stageColorMap: Record<string, string> = {
        '丢单': '#ff4d4f', '待接收': '#bfbfbf', '确认需求': '#1677ff', '邀约到店': '#fa8c16', '已到店': '#52c41a', '赢单': '#faad14',
      };
      const color = stageColorMap[item?.label || value] || '#1677ff';
      
      return (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto', fontSize: 14, color, fontWeight: 'normal', display: 'inline-block', whiteSpace: 'nowrap' }}
          onClick={() => onStageClick?.(record)}
          disabled={isFieldDisabled?.()}
        >
          {item?.label || value || '-'}
        </Button>
      );

    case 'user':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <UserOutlined style={{ color: '#bfbfbf', marginRight: 6, fontSize: 18}} />
          {value || '-'}
        </span>
      );

    case 'action':
      return (
        <Button 
          size="small" 
          type="default" 
          danger
          onClick={() => onRollbackClick?.(record)}
          disabled={record.invalid}
        >
          {record.invalid ? '已回退' : '回退'}
        </Button>
      );

    default:
      return <span>{value || '-'}</span>;
  }
};