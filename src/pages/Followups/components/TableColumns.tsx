import React, { useMemo } from 'react';
import { Button, Tag, Tooltip, Typography, InputNumber, Select, DatePicker, Cascader, Checkbox, Input } from 'antd';
import { CopyOutlined, UserOutlined } from '@ant-design/icons';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import type { FollowupRecord, ColumnFilters, EnumOption, MetroStationOption, MajorCategoryOption } from '../types';
import locale from 'antd/es/date-picker/locale/zh_CN';

const { Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface TableColumnsProps {
  columnFilters: ColumnFilters;
  communityEnum: EnumOption[];
  followupstageEnum: EnumOption[];
  customerprofileEnum: EnumOption[];
  sourceEnum: EnumOption[];
  userratingEnum: EnumOption[];
  majorCategoryOptions: MajorCategoryOption[];
  metroStationOptions: MetroStationOption[];
  onLeadDetailClick: (leadid: string) => void;
  onStageClick: (record: FollowupRecord) => void;
  onRollbackClick: (record: FollowupRecord) => void;
  onRowEdit: (record: FollowupRecord, field: keyof FollowupRecord, value: any) => void;
  isFieldDisabled: () => boolean;
  forceUpdate: number;
}

export const useTableColumns = ({
  columnFilters,
  communityEnum,
  followupstageEnum,
  customerprofileEnum,
  sourceEnum,
  userratingEnum,
  majorCategoryOptions,
  metroStationOptions,
  onLeadDetailClick,
  onStageClick,
  onRollbackClick,
  onRowEdit,
  isFieldDisabled,
  forceUpdate
}: TableColumnsProps) => {
  // 数据脱敏工具函数
  const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
  };

  const maskWechat = (wechat: string): string => {
    if (!wechat || wechat.length < 4) return wechat;
    return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
  };

  // 获取筛选选项
  const getFilters = (idKey: keyof FollowupRecord, nameKey: keyof FollowupRecord, data: FollowupRecord[]) => {
    const map = new Map();
    data.forEach(item => {
      const id = item[idKey];
      const name = item[nameKey];
      
      if (idKey === 'interviewsales_user_id' || idKey === 'showingsales_user_id') {
        if (typeof id === 'number' && !isNaN(id) && id !== 0) {
          map.set(id, name || String(id));
        }
      } else {
        if (typeof id === 'string') {
          if (id && id.trim()) {
            let displayText = name || id;
            if (idKey === 'phone') {
              displayText = maskPhone(id);
            } else if (idKey === 'wechat') {
              displayText = maskWechat(id);
            }
            map.set(id, displayText);
          } else if (id === '' || id === null || id === undefined) {
            map.set('', name || '为空');
          }
        } else if (id === null || id === undefined) {
          map.set('', '为空');
        }
      }
    });

    const filters = Array.from(map.entries()).map(([id, name]) => ({
      text: name || String(id),
      value: id === '' ? null : id,
    }));

    // 增加"未分配/为空"选项
    const hasNullOption = filters.some(f => f.value === null);
    if (!hasNullOption) {
      filters.push({
        text: (idKey === 'interviewsales_user_id' || idKey === 'showingsales_user_id') ? '未分配' : '为空',
        value: null,
      });
    }

    return filters;
  };

  // 创建筛选下拉框
  const createFilterDropdown = (
    filterType: 'search' | 'select' | 'dateRange',
    options?: any[],
    placeholder?: string
  ) => {
    return ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
      <div style={{ padding: 8 }}>
        {filterType === 'search' && (
          <Input.Search
            placeholder={placeholder || "输入关键词"}
            value={selectedKeys[0] || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onSearch={(value: string) => {
              setSelectedKeys(value ? [value] : []);
              confirm();
            }}
            style={{ width: 200, marginBottom: 8 }}
          />
        )}
        
        {filterType === 'select' && (
          <Select
            mode="multiple"
            placeholder={placeholder || "选择选项"}
            value={selectedKeys}
            onChange={setSelectedKeys}
            options={options || []}
            allowClear
            style={{ width: 200, marginBottom: 8 }}
          />
        )}
        
        {filterType === 'dateRange' && (
          <RangePicker
            value={selectedKeys as any}
            onChange={(dates) => setSelectedKeys(dates as any)}
            locale={locale}
            style={{ width: 200, marginBottom: 8 }}
          />
        )}
        
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
            筛选
          </Button>
          <Button size="small" onClick={() => { 
            setSelectedKeys([]);
            if (clearFilters) clearFilters(); 
          }}>
            重置
          </Button>
        </div>
      </div>
    );
  };

  // 表格列配置
  const columns = useMemo(() => [
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      ellipsis: true,
      filterDropdown: createFilterDropdown('search', undefined, '输入线索编号关键词'),
      filteredValue: columnFilters.leadid ?? null,
      render: (text: string, record: FollowupRecord) => {
        return text ? (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 15, color: '#1677ff', fontWeight: 'normal', display: 'inline-block', whiteSpace: 'nowrap' }}
              onClick={() => onLeadDetailClick(record.leadid)}
            >
              {text}
            </Button>
            <Paragraph
              copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }}
              style={{ margin: 0, marginLeft: 4, display: 'inline-block', whiteSpace: 'nowrap' }}
            />
          </span>
        ) : <span style={{ color: '#bbb' }}>-</span>;
      }
    },
    {
      title: '跟进阶段',
      dataIndex: 'followupstage',
      key: 'followupstage',
      fixed: 'left' as const,
      ellipsis: true,
      filterDropdown: createFilterDropdown('select', followupstageEnum, '选择跟进阶段'),
      filteredValue: columnFilters.followupstage ?? null,
      render: (text: string, record: FollowupRecord) => {
        const item = followupstageEnum.find(i => i.value === text);
        const stageColorMap: Record<string, string> = {
          '丢单': '#ff4d4f', '待接收': '#bfbfbf', '确认需求': '#1677ff', '邀约到店': '#fa8c16', '已到店': '#52c41a', '赢单': '#faad14',
        };
        const color = stageColorMap[item?.label || text] || '#1677ff';
        
        return (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 14, color, fontWeight: 'normal', display: 'inline-block', whiteSpace: 'nowrap' }}
            onClick={() => onStageClick(record)}
            disabled={isFieldDisabled()}
          >
            {item?.label || text || '-'}
          </Button>
        );
      }
    },
    {
      title: '约访管家',
      dataIndex: 'interviewsales_user_id',
      key: 'interviewsales_user_id',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        const filters = getFilters('interviewsales_user_id', 'interviewsales_user_name', []);
        return (
          <div style={{ padding: 8 }}>
            <Select
              mode="multiple"
              placeholder="选择约访管家"
              value={selectedKeys}
              onChange={setSelectedKeys}
              options={filters}
              allowClear
              style={{ width: 200, marginBottom: 8 }}
            />
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { 
                setSelectedKeys([]);
                if (clearFilters) clearFilters(); 
              }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
      filteredValue: columnFilters.interviewsales_user_id ?? null,
      render: (_: any, record: FollowupRecord) => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <UserOutlined style={{ color: '#bfbfbf', marginRight: 6, fontSize: 18}} />
          {record.interviewsales_user_name || record.interviewsales_user || '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: FollowupRecord) => (
        <Button 
          size="small" 
          type="default" 
          danger
          onClick={() => onRollbackClick(record)}
          disabled={record.invalid}
        >
          {record.invalid ? '已回退' : '回退'}
        </Button>
      ),
    },
  ], [
    columnFilters,
    followupstageEnum,
    sourceEnum,
    onLeadDetailClick,
    onStageClick,
    onRollbackClick,
    forceUpdate,
    isFieldDisabled
  ]);

  return columns;
};
