import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Typography, InputNumber, Select, DatePicker, Cascader, Input, Tooltip, message } from 'antd';
import { CopyOutlined, UserOutlined } from '@ant-design/icons';
import type { FollowupRecord, PaginationState, ColumnFilters, EnumOption, MetroStationOption, MajorCategoryOption } from '../types';
import { getFollowupsTableFilters } from './TableFilterConfig';
import CommunityRecommendations from '../../../components/Followups/components/CommunityRecommendations';
// import CommuteTimeButton from '../../../components/CommuteTimeButton'; // 取消单独的计算按钮
import { supabase } from '../../../supaClient';
import { useCommuteTimeRealtime } from '../../../hooks/useCommuteTimeRealtime';
import locale from 'antd/es/date-picker/locale/zh_CN';
import dayjs from 'dayjs';

const { Paragraph } = Typography;

// 推荐标签组件
const RecommendationTag: React.FC<{ 
  record: FollowupRecord; 
  isExpanded?: boolean; 
  onToggleExpand?: () => void; 
}> = ({ record, isExpanded, onToggleExpand }) => {
  const [topRecommendation, setTopRecommendation] = useState<{ community: string; score: number; reasons: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 使用优化的通勤时间计算 hook
  const { startCalculation, isCalculating } = useCommuteTimeRealtime();

  // 计算通勤时间 - 使用优化的realtime hook
  const calculateCommuteTimes = useCallback(async () => {
    if (!record.worklocation) {
      message.warning('工作地点缺失，无法计算通勤时间');
      return;
    }
    
    await startCalculation(
      record.id,
      record.worklocation,
      // 成功回调
      (result) => {
        console.log('✅ 通勤时间计算成功:', result);
        // 重新加载推荐数据
        loadTopRecommendation();
      },
      // 错误回调
      (error) => {
        console.error('❌ 通勤时间计算失败:', error);
      }
    );
  }, [record.id, record.worklocation, startCalculation]);



  // 加载推荐数据
  const loadTopRecommendation = async () => {
    // 只有在有通勤时间数据或用户预算时才加载推荐
    const hasCommuteTimes = record.extended_data?.commute_times && 
      Object.keys(record.extended_data.commute_times).length > 0;
    const hasBudget = Number(record.userbudget) > 0;
    
    if (!(hasCommuteTimes || hasBudget)) {
      return;
    }

    setLoading(true);
    try {
      // 调用真实的推荐服务获取数据
      const recommendationService = (await import('../../../services/CommunityRecommendationService')).default.getInstance();
      
      const recommendations = await recommendationService.getRecommendationsWithCommuteTimes({
        worklocation: record.worklocation || '',
        userbudget: Number(record.userbudget) || 0,
        customerprofile: record.customerprofile || '',
        followupId: Number(record.id),
        commuteTimes: record.extended_data?.commute_times || {}
      });
      
      if (recommendations && recommendations.length > 0) {
        // 按分数排序，取第一
        const sorted = recommendations.sort((a: any, b: any) => b.score - a.score);
        const topRec = sorted[0];
        
        // 分析推荐理由
        const reasons = [];
        // 只有在有实际通勤时间数据时才推荐通勤相关的标签（包括0分钟）
        if (topRec.commuteTime >= 0) {
          if (topRec.commuteTime <= 30) reasons.push('通勤近');
          else if (topRec.commuteTime <= 60) reasons.push('通勤适中');
        }
        if (topRec.budgetScore >= 90) reasons.push('预算匹配');
        if (topRec.historicalScore >= 85) reasons.push('成交率高');
        
        setTopRecommendation({
          community: topRec.community,
          score: topRec.score,
          reasons: reasons
        });
      }
    } catch (error) {
      console.error('加载推荐失败:', error);
      // 如果推荐服务失败，尝试从 extended_data 中获取缓存的推荐
      if (record.extended_data?.community_recommendations) {
        try {
          const cachedRecommendations = record.extended_data.community_recommendations;
          if (Array.isArray(cachedRecommendations) && cachedRecommendations.length > 0) {
            const sorted = cachedRecommendations.sort((a: any, b: any) => b.score - a.score);
            const topRec = sorted[0];
            
            // 分析缓存数据的推荐理由
            const reasons = [];
            // 只有在有实际通勤时间数据时才推荐通勤相关的标签（包括0分钟）
            if (topRec.commuteTime >= 0) {
              if (topRec.commuteTime <= 30) reasons.push('通勤近');
              else if (topRec.commuteTime <= 60) reasons.push('通勤适中');
            }
            if (topRec.budgetScore >= 90) reasons.push('预算匹配');
            if (topRec.historicalScore >= 85) reasons.push('成交率高');
            
            setTopRecommendation({
              community: topRec.community,
              score: topRec.score,
              reasons: reasons
            });
          }
        } catch (cacheError) {
          console.error('读取缓存推荐失败:', cacheError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopRecommendation();
  }, [record.worklocation, record.userbudget, record.customerprofile, record.extended_data?.commute_times]);

  // 如果没有必要信息，不显示标签
  const hasCommuteTimes = record.extended_data?.commute_times && 
    Object.keys(record.extended_data.commute_times).length > 0;
  const hasBudget = Number(record.userbudget) > 0;
  
  if (!(hasCommuteTimes || hasBudget)) {
    return null;
  }

  if (loading || isCalculating(record.id)) {
    return (
      <div style={{ 
        padding: '6px 8px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <span>{isCalculating(record.id) ? '计算通勤中...' : '计算推荐中...'}</span>
      </div>
    );
  }

  if (!topRecommendation) {
    // 检查是否有通勤时间数据
    const hasCommuteTimes = record.extended_data?.commute_times && 
      Object.keys(record.extended_data.commute_times).length > 0;
    

    
    return (
      <div style={{ 
        padding: '6px 8px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <span>推荐社区</span>
        <Button
          type="link"
          size="small"
          onClick={calculateCommuteTimes}
          style={{ padding: '0', height: 'auto', fontSize: '12px' }}
        >
          计算通勤
        </Button>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        padding: '6px 8px', 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
        borderRadius: '4px',
        cursor: onToggleExpand ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (onToggleExpand) {
          e.currentTarget.style.background = '#f0f0f0';
        }
      }}
      onMouseLeave={(e) => {
        if (onToggleExpand) {
          e.currentTarget.style.background = '#fafafa';
        }
      }}
      onClick={() => {
        if (onToggleExpand) {
          onToggleExpand();
        }
      }}
    >
      <div style={{ flex: 1 }}>
                {/* 推荐社区名称 - 第一行 */}
        <div style={{ 
          fontSize: '13px', 
          fontWeight: '500', 
          color: '#333',
          marginBottom: '6px',
          lineHeight: '1.2'
        }}>
          {topRecommendation.community}
        </div>
        
        {/* 推荐理由标签 - 第二行 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
          {topRecommendation.reasons && topRecommendation.reasons.map((reason, index) => (
            <Tag 
              key={index}
              color={reason === '通勤近' ? 'green' : 
                     reason === '通勤适中' ? 'cyan' :
                     reason === '预算匹配' ? 'orange' : 
                     reason === '历史成交好' ? 'purple' : 'blue'}
              style={{ fontSize: '10px', margin: 0, lineHeight: '1.2' }}
            >
              {reason}
            </Tag>
          ))}
          

        </div>
      </div>
      
      {/* 右侧操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        {/* 通勤时间相关按钮 - 已移除地铁站icon按钮 */}
      </div>
    </div>
  );
};

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
      onBlur={() => {
        // 使用当前输入值进行比较和保存
        const currentValue = inputValue;
        const originalValue = value ? Number(value) : undefined;
        
        // 检查值是否发生变化（考虑类型转换）
        const hasChanged = currentValue !== originalValue && 
                          (currentValue !== undefined || originalValue !== undefined);
        
        if (hasChanged) {
          // 转换为字符串保存，与数据库字段类型保持一致
          const stringValue = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';
          console.log('🔄 [EditableInputNumber] 预算值变化，触发保存:', {
            original: originalValue,
            current: currentValue,
            stringValue: stringValue
          });
          onSave(stringValue);
        }
      }}
      onPressEnter={() => {
        // 回车键也可以触发保存
        const currentValue = inputValue;
        const originalValue = value ? Number(value) : undefined;
        
        // 检查值是否发生变化（考虑类型转换）
        const hasChanged = currentValue !== originalValue && 
                          (currentValue !== undefined || originalValue !== undefined);
        
        if (hasChanged) {
          const stringValue = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';
          console.log('🔄 [EditableInputNumber] 预算值变化（回车），触发保存:', {
            original: originalValue,
            current: currentValue,
            stringValue: stringValue
          });
          onSave(stringValue);
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
  userbudgetFilters?: any[]; // 现在使用范围筛选器，可选
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
  followupresultFilters,
  majorcategoryFilters,
  scheduledcommunityFilters,
  interviewsalesUserList,
  interviewsalesUserLoading,
  findCascaderPath
}) => {
  // 展开行状态管理
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  
  // 优化的展开/收起处理函数
  const handleToggleExpand = useCallback((recordId: React.Key) => {
    setExpandedRowKeys(prev => {
      if (prev.includes(recordId)) {
        return prev.filter(key => key !== recordId);
      } else {
        return [...prev, recordId];
      }
    });
  }, []);
  
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
    followupresultFilters,
    majorcategoryFilters,
    scheduledcommunityFilters
  ]);

  // 表格列配置
  const columns = useMemo(() => [
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      ellipsis: true,
      filterDropdown: tableFilters.leadid,
      filteredValue: columnFilters.leadid ?? null,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 120, maxWidth: 180 } }),
      render: (text: string, record: FollowupRecord) => {
        return text ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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

          </div>
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
      title: '推荐社区',
      dataIndex: 'recommendation',
      key: 'recommendation',
      fixed: 'left' as const,
      width: 'auto',
      ellipsis: false,
      onCell: () => ({ style: { minWidth: 160, maxWidth: 'none', whiteSpace: 'nowrap' } }),
      render: (_: any, record: FollowupRecord) => {
        const isExpanded = expandedRowKeys.includes(record.id);
        const hasCommuteTimes = record.extended_data?.commute_times && 
          Object.keys(record.extended_data.commute_times).length > 0;
        const hasBudget = Number(record.userbudget) > 0;
        const canExpand = !!(hasCommuteTimes || hasBudget);
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <RecommendationTag 
              record={record} 
              isExpanded={isExpanded}
              onToggleExpand={canExpand ? () => handleToggleExpand(record.id) : undefined}
            />
          </div>
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
                // 🆕 修复：确保保存的是站点名称，不是带"站"字的完整名称
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
      title: '跟进结果',
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
  ], [
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
    forceUpdate,
    tableFilters,
    findCascaderPath
  ]);

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
      // 添加可展开行功能
      expandable={{
        expandedRowKeys: expandedRowKeys,
        expandedRowRender: (record) => (
          <div style={{ padding: '16px', background: '#fafafa', margin: '0 -16px' }}>
            <CommunityRecommendations
              worklocation={record.worklocation || ''}
              userbudget={Number(record.userbudget) || 0}
              customerprofile={record.customerprofile || ''}
              record={record}
              compact={true}
            />
          </div>
        ),
        rowExpandable: (record) => {
          // 有通勤时间数据或用户预算的记录才可展开
          const hasCommuteTimes = record.extended_data?.commute_times && 
            Object.keys(record.extended_data.commute_times).length > 0;
          const hasBudget = Number(record.userbudget) > 0;
          return !!(hasCommuteTimes || hasBudget);
        },
        expandRowByClick: false, // 禁用点击行展开，只能点击展开图标
        expandIcon: () => {
          // 隐藏默认展开图标，使用推荐社区列的自定义展开按钮
          return null;
        },
        onExpandedRowsChange: (expandedKeys) => {
          setExpandedRowKeys([...expandedKeys]);
        },
        indentSize: 0, // 隐藏展开列的缩进
        showExpandColumn: false, // 隐藏展开列

      }}
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