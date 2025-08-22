import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, Tag, Tooltip, Typography, InputNumber, Select, DatePicker, Cascader, Checkbox, Spin, Input } from 'antd';
import { CopyOutlined, UserOutlined, MoreOutlined } from '@ant-design/icons';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import type { FollowupRecord, PaginationState, ColumnFilters, EnumOption, MetroStationOption, MajorCategoryOption } from '../types';
import locale from 'antd/es/date-picker/locale/zh_CN';
import dayjs from 'dayjs';
import { getFollowupsTableFilters } from './TableFilterConfig';
import { useTableColumns } from './TableColumns';

const { Paragraph } = Typography;
const { RangePicker } = DatePicker;

// 独立的输入组件，避免在render函数中使用hooks
const EditableInput: React.FC<{
  value: string;
  placeholder: string;
  style: any;
  onSave: (value: string) => void;
  disabled: boolean;
  allowClear?: boolean;
}> = ({ value, placeholder, style, onSave, disabled, allowClear }) => {
  const [inputValue, setInputValue] = useState(value);
  
  useEffect(() => {
    setInputValue(value);
  }, [value]);
  
  return (
    <Input
      value={inputValue}
      placeholder={placeholder}
      style={style}
      onChange={e => setInputValue(e.target.value)}
      onBlur={e => {
        const newValue = e.target.value;
        if (newValue !== value) {
          onSave(newValue);
        }
      }}
      disabled={disabled}
      allowClear={allowClear}
    />
  );
};

const EditableInputNumber: React.FC<{
  value: string;
  placeholder: string;
  style: any;
  onSave: (value: string) => void;
  disabled: boolean;
  formatter?: (value: any) => string;
  parser?: (value: any) => number;
  min?: number;
  precision?: number;
}> = ({ value, placeholder, style, onSave, disabled, formatter, parser, min, precision }) => {
  const [inputValue, setInputValue] = useState<number | undefined>(value ? Number(value) : undefined);
  
  useEffect(() => {
    setInputValue(value ? Number(value) : undefined);
  }, [value]);
  
  return (
    <InputNumber
      value={inputValue}
      placeholder={placeholder}
      style={style}
      onChange={newValue => setInputValue(newValue || undefined)}
      onBlur={e => {
        const newValue = e.target.value;
        if (newValue !== value) {
          onSave(newValue);
        }
      }}
      disabled={disabled}
      formatter={formatter}
      parser={parser}
      min={min}
      precision={precision}
    />
  );
};

interface FollowupsTableCompleteProps {
  data: FollowupRecord[];
  loading: boolean;
  pagination: PaginationState;
  columnFilters: ColumnFilters;
  communityEnum: EnumOption[];
  followupstageEnum: EnumOption[];
  customerprofileEnum: EnumOption[];
  sourceEnum: EnumOption[];
  userratingEnum: EnumOption[];
  majorCategoryOptions: MajorCategoryOption[];
  metroStationOptions: MetroStationOption[];
  onTableChange: (pagination: any, filters: any) => void;
  onRowEdit: (record: FollowupRecord, field: keyof FollowupRecord, value: any) => void;
  onLeadDetailClick: (leadid: string) => void;
  onStageClick: (record: FollowupRecord) => void;
  onRollbackClick: (record: FollowupRecord) => void;
  isFieldDisabled: () => boolean;
  forceUpdate: number;
  // 新增的筛选选项
  leadtypeFilters: any[];
  remarkFilters: any[];
  worklocationFilters: any[];
  userbudgetFilters: any[];
  followupresultFilters: any[];
  majorcategoryFilters: any[];
  scheduledcommunityFilters: any[];
  // 新增的枚举数据
  interviewsalesUserList: Array<{id: number, name: string}>;
  interviewsalesUserLoading: boolean;
  // 新增的工具函数
  findCascaderPath: (options: any[], value: string) => string[];
}

// 完整版本的Table组件，包含所有字段，用于新的跟进页面
export const FollowupsTable: React.FC<FollowupsTableCompleteProps> = ({
  data,
  loading,
  pagination,
  columnFilters,
  communityEnum,
  followupstageEnum,
  customerprofileEnum,
  sourceEnum,
  userratingEnum,
  majorCategoryOptions,
  metroStationOptions,
  onTableChange,
  onRowEdit,
  onLeadDetailClick,
  onStageClick,
  onRollbackClick,
  isFieldDisabled,
  forceUpdate,
  leadtypeFilters,
  remarkFilters,
  worklocationFilters,
  userbudgetFilters,
  followupresultFilters,
  majorcategoryFilters,
  scheduledcommunityFilters,
  interviewsalesUserList,
  interviewsalesUserLoading,
  findCascaderPath
}) => {
  // 确保 data 始终是数组类型
  const safeData = Array.isArray(data) ? data : [];

  // 数据脱敏工具函数
  const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
  };

  const maskWechat = (wechat: string): string => {
    if (!wechat || wechat.length < 4) return wechat;
    return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
  };

  // 统一的单元格样式
  const defaultCellStyle = {
    minWidth: 140,
    maxWidth: 180,
    paddingLeft: 12,
    paddingRight: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  // 获取表头筛选器配置
  const tableFilters = useMemo(() => {
    return getFollowupsTableFilters(
      communityEnum,
      followupstageEnum,
      customerprofileEnum,
      sourceEnum,
      userratingEnum,
      majorCategoryOptions,
      metroStationOptions,
      leadtypeFilters,
      remarkFilters,
      worklocationFilters,
      userbudgetFilters,
      followupresultFilters,
      majorcategoryFilters,
      scheduledcommunityFilters,
      // 筛选器重置回调
      (field: string) => {
        console.log('筛选器重置:', field);
        // 这里可以添加重置逻辑
      },
      // 筛选器确认回调
      (field: string) => {
        console.log('筛选器确认:', field);
        // 这里可以添加确认逻辑
      }
    );
  }, [
    communityEnum,
    followupstageEnum,
    customerprofileEnum,
    sourceEnum,
    userratingEnum,
    majorCategoryOptions,
    metroStationOptions,
    leadtypeFilters,
    remarkFilters,
    worklocationFilters,
    userbudgetFilters,
    followupresultFilters,
    majorcategoryFilters,
    scheduledcommunityFilters
  ]);

  // 完整的列配置，包含所有字段
  const columns = [
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      width: 140,
      ellipsis: true,
      filterDropdown: tableFilters.leadid,
      filteredValue: columnFilters.leadid ?? null,
      onCell: () => ({ style: { minWidth: 120, maxWidth: 180 } }),
      render: (text: string, record: FollowupRecord) => {
        return text ? (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 15, color: '#1677ff', fontWeight: 'normal' }}
              onClick={() => onLeadDetailClick(record.leadid)}
            >
              {text}
            </Button>
            <Paragraph
              copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }}
              style={{ margin: 0, marginLeft: 4, display: 'inline-block' }}
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
      width: 100,
      ellipsis: true,
      filterDropdown: tableFilters.followupstage,
      filteredValue: columnFilters.followupstage ?? null,
      onCell: () => ({ style: { minWidth: 100 } }),
      render: (text: string, record: FollowupRecord) => {
        const item = followupstageEnum.find(i => i.value === text);
        const stageColorMap: Record<string, string> = {
          '丢单': '#ff4d4f', '待接收': '#bfbfbf', '确认需求': '#1677ff', 
          '邀约到店': '#fa8c16', '已到店': '#52c41a', '赢单': '#faad14',
        };
        const color = stageColorMap[item?.label || text] || '#1677ff';
        
        return (
          <Button
            type="primary"
            size="small"
            style={{
              background: color,
              borderColor: color,
              color: '#fff',
              boxShadow: 'none',
              minWidth: 60,
              padding: '0 8px',
            }}
            onClick={() => onStageClick(record)}
          >
            {item?.label || text}
          </Button>
        );
      }
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      ellipsis: true,
      filterDropdown: tableFilters.phone,
      filteredValue: columnFilters.phone ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        const maskedText = maskPhone(text);
        
        return (
          <Tooltip title={text}>
            <Paragraph copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{maskedText}</Paragraph>
          </Tooltip>
        );
      }
    },
    {
      title: '微信号',
      dataIndex: 'wechat',
      key: 'wechat',
      width: 140,
      ellipsis: true,
      filterDropdown: tableFilters.wechat,
      filteredValue: columnFilters.wechat ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        const maskedText = maskWechat(text);
        
        return (
          <Tooltip title={text}>
            <Paragraph copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{maskedText}</Paragraph>
          </Tooltip>
        );
      }
    },
    {
      title: '创建日期',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      ellipsis: true,
      filterDropdown: tableFilters.created_at,
      filteredValue: columnFilters.created_at ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string) => {
        const full = text ? new Date(text).toLocaleString('zh-CN') : '';
        return (
          <Tooltip title={full} placement="topLeft">
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{full}</div>
          </Tooltip>
        );
      },
      sorter: (a: FollowupRecord, b: FollowupRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    },
    {
      title: '渠道',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      ellipsis: true,
      filterDropdown: tableFilters.source,
      filteredValue: columnFilters.source ?? null,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 60, maxWidth: 100 } }),
      render: (text: string) => {
        const item = sourceEnum.find(i => i.value === text);
        return <Tag color="blue">{item?.label || text}</Tag>;
      }
    },
    {
      title: '线索来源',
      dataIndex: 'leadtype',
      key: 'leadtype',
      width: 120,
      ellipsis: true,
      filterDropdown: tableFilters.leadtype,
      filteredValue: columnFilters.leadtype ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string) => text ? <span>{text}</span> : <span style={{ color: '#bbb' }}>-</span>
    },
    {
      title: '约访管家',
      dataIndex: 'interviewsales_user_id',
      key: 'interviewsales_user_id',
      width: 120,
      ellipsis: true,
      filterDropdown: tableFilters.interviewsales_user_id,
      filteredValue: columnFilters.interviewsales_user_id ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (_: any, record: FollowupRecord) => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <UserOutlined style={{ color: '#bfbfbf', marginRight: 6, fontSize: 18}} />
          {(record as any).interviewsales_user_name || (record as any).interviewsales_user || '-'}
        </span>
      ),
    },
    {
      title: '用户画像',
      dataIndex: 'customerprofile',
      key: 'customerprofile',
      width: 160,
      ellipsis: true,
      filterDropdown: tableFilters.customerprofile,
      filteredValue: columnFilters.customerprofile ?? null,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 140, maxWidth: 200 } }),
      render: (text: string, record: FollowupRecord) => (
        <Select
          value={text}
          options={customerprofileEnum}
          style={{ minWidth: 140, maxWidth: 200 }}
          onChange={val => {
            if (val !== text) {
              onRowEdit(record, 'customerprofile', val);
            }
          }}
          onBlur={() => {
            // 失焦时触发保存，确保数据已更新
            if (text !== record.customerprofile) {
              onRowEdit(record, 'customerprofile', record.customerprofile);
            }
          }}
          disabled={isFieldDisabled()}
          key={forceUpdate}
          placeholder="选择用户画像"
        />
      )
    },
    {
      title: '工作地点',
      dataIndex: 'worklocation',
      key: 'worklocation',
      width: 180,
      ellipsis: true,
      filterDropdown: tableFilters.worklocation,
      filteredValue: columnFilters.worklocation ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => (
        <Tooltip title={text || '未设置工作地点'}>
          <Cascader
            options={metroStationOptions}
            value={text ? findCascaderPath(metroStationOptions, text) : undefined}
            onChange={async (_value, selectedOptions) => {
              let selectedText = '';
              if (selectedOptions && selectedOptions.length > 1) {
                // 只保存站点名称，不保存线路信息（与旧页面保持一致）
                selectedText = selectedOptions[1].label;
              } else if (selectedOptions && selectedOptions.length === 1) {
                // 只有一级选项时，保存线路名称
                selectedText = selectedOptions[0].label;
              }
              
              if (selectedText !== text && selectedText) {
                onRowEdit(record, 'worklocation', selectedText);
              }
            }}
            placeholder="请选择工作地点"
            style={{ width: '100%', maxWidth: 160 }}
            showSearch
            changeOnSelect={false}
            allowClear
            disabled={isFieldDisabled()}
            key={forceUpdate}
          />
        </Tooltip>
      )
    },
    {
      title: '用户预算',
      dataIndex: 'userbudget',
      key: 'userbudget',
      width: 120,
      ellipsis: true,
      filterDropdown: tableFilters.userbudget,
      filteredValue: columnFilters.userbudget ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => (
        <EditableInputNumber
          value={text}
          placeholder="输入预算金额"
          style={{ minWidth: 100, maxWidth: 140 }}
          onSave={value => onRowEdit(record, 'userbudget', value)}
          disabled={isFieldDisabled()}
          formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => Number(value!.replace(/\¥\s?|(,*)/g, ''))}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: '入住日期',
      dataIndex: 'moveintime',
      key: 'moveintime',
      width: 150,
      ellipsis: true,
      filterDropdown: tableFilters.moveintime,
      filteredValue: columnFilters.moveintime ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => {
        return (
          <DatePicker
            locale={locale}
            style={{ minWidth: 120, maxWidth: 180 }}
            placeholder="请选择入住日期"
            value={text ? dayjs(text) : undefined}
            format="YYYY-MM-DD"
            onChange={async v => {
              if (v) {
                const val = v.format('YYYY-MM-DD') + ' 00:00:00';
                onRowEdit(record, 'moveintime', val);
              }
            }}
            disabled={isFieldDisabled()}
            key={forceUpdate}
          />
        );
      }
    },
    {
      title: '来访意向',
      dataIndex: 'userrating',
      key: 'userrating',
      width: 120,
      ellipsis: true,
      filterDropdown: tableFilters.userrating,
      filteredValue: columnFilters.userrating ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => (
        <Select
          value={text}
          options={userratingEnum}
          style={{ minWidth: 100, maxWidth: 140 }}
          onChange={val => {
            if (val !== text) {
              onRowEdit(record, 'userrating', val);
            }
          }}
          onBlur={() => {
            // 失焦时触发保存，确保数据已更新
            if (text !== record.userrating) {
              onRowEdit(record, 'userrating', record.userrating);
            }
          }}
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      )
    },
    {
      title: '主分类',
      dataIndex: 'majorcategory',
      key: 'majorcategory',
      width: 220,
      ellipsis: true,
      filterDropdown: tableFilters.majorcategory,
      filteredValue: columnFilters.majorcategory ?? null,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 180, maxWidth: 260 } }),
      render: (text: string, record: FollowupRecord) => (
        <Cascader
          options={majorCategoryOptions}
          value={findCascaderPath(majorCategoryOptions, text)}
          onChange={async (_value, selectedOptions) => {
            const selectedText = selectedOptions && selectedOptions.length > 1 ? selectedOptions[1].label : '';
            if (selectedText !== text) {
              onRowEdit(record, 'majorcategory', selectedText);
            }
          }}
          placeholder="请选择跟进结果"
          style={{ minWidth: 180, maxWidth: 260 }}
          showSearch
          changeOnSelect={false}
          allowClear
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      )
    },
    {
      title: '跟进备注',
      dataIndex: 'followupresult',
      key: 'followupresult',
      width: 180,
      ellipsis: true,
      filterDropdown: tableFilters.followupresult,
      filteredValue: columnFilters.followupresult ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => (
        <EditableInput
          value={text}
          placeholder="输入跟进备注"
          style={{ minWidth: 120, maxWidth: 180 }}
          onSave={value => onRowEdit(record, 'followupresult', value)}
          disabled={isFieldDisabled()}
          allowClear
        />
      )
    },
    {
      title: '预约到店时间',
      dataIndex: 'scheduletime',
      key: 'scheduletime',
      width: 160,
      ellipsis: true,
      filterDropdown: tableFilters.scheduletime,
      filteredValue: columnFilters.scheduletime ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (text: string, record: FollowupRecord) => {
        return (
          <DatePicker
            locale={locale}
            style={{ minWidth: 120, maxWidth: 180 }}
            placeholder="请选择预约时间"
            value={text ? dayjs(text) : undefined}
            format="YYYY-MM-DD HH:mm"
            showTime={{ format: 'HH:mm' }}
            onChange={async v => {
              if (v) {
                const val = v.format('YYYY-MM-DD HH:mm:ss');
                onRowEdit(record, 'scheduletime', val);
              }
            }}
            disabled={isFieldDisabled()}
            key={forceUpdate}
          />
        );
      }
    },
    {
      title: '预约社区',
      dataIndex: 'scheduledcommunity',
      key: 'scheduledcommunity',
      width: 180,
      ellipsis: true,
      filterDropdown: tableFilters.scheduledcommunity,
      filteredValue: columnFilters.scheduledcommunity ?? null,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 160, maxWidth: 220 } }),
      render: (text: string, record: FollowupRecord) => (
        <Select
          value={text}
          options={communityEnum}
          style={{ minWidth: 160, maxWidth: 220 }}
          onChange={val => {
            if (val !== text) {
              onRowEdit(record, 'scheduledcommunity', val);
            }
          }}
          onBlur={() => {
            // 失焦时触发保存，确保数据已更新
            if (text !== record.scheduledcommunity) {
              onRowEdit(record, 'scheduledcommunity', record.scheduledcommunity);
            }
          }}
          disabled={isFieldDisabled()}
          key={forceUpdate}
          placeholder="选择预约社区"
        />
      )
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
          disabled={(record as any).invalid}
        >
          {(record as any).invalid ? '已回退' : '回退'}
        </Button>
      ),
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={safeData}
      rowKey="id"
      loading={loading}
      pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        onChange: (page, size) => {
          onTableChange({ current: page, pageSize: size, total: pagination.total }, {});
        },
      }}
      scroll={{ x: 'max-content', y: 600 }}
      size="small"
      bordered={false}
      className="rounded-lg overflow-hidden"
      rowClassName={() => 'compact-table-row'}
      tableLayout="fixed"
      sticky
      // 添加自定义空状态
      locale={{
        emptyText: (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
              {loading ? '加载中...' : '暂无跟进记录'}
            </div>
            {!loading && (
              <div style={{ fontSize: '14px', color: '#999' }}>
                尝试调整筛选条件或刷新数据
              </div>
            )}
          </div>
        )
      }}
      onChange={(pagination, filters, sorter) => {
        // 处理筛选器变化
        if (filters && Object.keys(filters).length > 0) {
          // 将筛选器转换为RPC参数格式
          const rpcFilters: any = {};
          Object.entries(filters).forEach(([key, value]) => {
            if (value && Array.isArray(value) && value.length > 0) {
              rpcFilters[key] = value;
            }
          });
          
          // 调用父组件的onTableChange，传递筛选器参数
          onTableChange(pagination, rpcFilters);
        } else {
          // 没有筛选器变化，只处理分页
          onTableChange(pagination, {});
        }
      }}
    />
  );
};