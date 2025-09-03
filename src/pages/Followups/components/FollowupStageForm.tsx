import React, { useMemo, useCallback } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Cascader, Switch, Space } from 'antd';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';
import type { FormInstance } from 'antd';
import type { FollowupRecord } from '../types';
import UserTreeSelect from '../../../components/UserTreeSelect';

interface FollowupStageFormProps {
  form: FormInstance;
  stage: string;
  record: FollowupRecord | null;
  isFieldDisabled?: () => boolean;
  forceUpdate?: number;
  // 枚举数据
  communityEnum: any[];
  followupstageEnum: any[];
  customerprofileEnum: any[];
  userratingEnum: any[];
  majorCategoryOptions: any[];
  metroStationOptions: any[];
  // 🆕 分配模式相关
  enableManualAssign?: boolean;
  onAllocationModeChange?: (checked: boolean) => void;
}

// 各阶段需要的字段配置 - 只包含 followups 表中实际存在的字段
const stageFields: Record<string, string[]> = {
  '丢单': ['majorcategory', 'followupresult'],
  '待接收': [],
  '确认需求': [
    'customerprofile',
    'worklocation',
    'userbudget',
    'moveintime',
    'userrating',
    'majorcategory',
    'followupresult'
  ],
  '邀约到店': ['scheduletime', 'scheduledcommunity'],
  '已到店': [],
  '赢单': []
};

// 字段标签映射 - 只包含 followups 表中实际存在的字段
const getFieldLabel = (field: string, currentStage?: string): string => {
  console.log('🔍 [getFieldLabel] 函数调用:', { field, currentStage });
  const labelMap: Record<string, string> = {
    customerprofile: '用户画像',
    worklocation: '工作地点',
    userbudget: '用户预算',
    moveintime: '入住时间',
    userrating: '来访意向',
    majorcategory: '跟进结果',
    followupresult: '跟进备注',
    scheduletime: '预约到店时间',
    scheduledcommunity: '预约社区',
    followupstage: '跟进阶段',
    // 移除 remark 字段，因为它在 followups 表中不存在
    leadtype: '线索类型',
    invalid: '是否无效'
  };
  
  // 根据当前阶段动态调整字段标签
  if (currentStage === '丢单' && field === 'followupresult') {
    console.log('🔍 [getFieldLabel] 返回丢单原因');
    return '丢单原因';
  }
  const result = labelMap[field] || field;
  console.log('🔍 [getFieldLabel] 返回结果:', { field, result });
  return result;
};



export const FollowupStageForm: React.FC<FollowupStageFormProps> = ({
  form,
  stage,
  record, // 需要传递当前阶段信息
  isFieldDisabled = () => false,
  forceUpdate = 0,
  communityEnum,
  followupstageEnum,
  customerprofileEnum,
  userratingEnum,
  majorCategoryOptions,
  metroStationOptions,
  // 🆕 分配模式相关
  enableManualAssign = false,
  onAllocationModeChange,
}) => {
  // 添加调试信息
  console.log('🔍 [FollowupStageForm] 组件开始渲染:', { stage, record: record?.id });
  
  // 早期错误检查 - 必须在所有 Hooks 之前
  if (!form) {
    console.error('❌ [FollowupStageForm] form 参数为空');
    return <div>表单参数错误</div>;
  }
  
  if (!stage) {
    console.warn('⚠️ [FollowupStageForm] stage 参数为空');
    return <div>阶段参数为空</div>;
  }

  // 检查数据是否已加载 - 使用更安全的方式避免循环引用
  const isDataLoaded = useMemo(() => {
    return {
      community: Array.isArray(communityEnum) && communityEnum.length > 0,
      followupstage: Array.isArray(followupstageEnum) && followupstageEnum.length > 0,
      customerprofile: Array.isArray(customerprofileEnum) && customerprofileEnum.length > 0,
      userrating: Array.isArray(userratingEnum) && userratingEnum.length > 0,
      majorCategory: Array.isArray(majorCategoryOptions) && majorCategoryOptions.length > 0,
      metroStation: Array.isArray(metroStationOptions) && metroStationOptions.length > 0
    };
  }, [
    communityEnum, 
    followupstageEnum, 
    customerprofileEnum, 
    userratingEnum, 
    majorCategoryOptions, 
    metroStationOptions
  ]);

  // 获取当前阶段需要的字段
  const currentFields = useMemo(() => stageFields[stage] || [], [stage]);
  
  // 检查当前阶段是否需要特定数据
  const needsCommunityData = currentFields.includes('scheduledcommunity');
  const needsCustomerProfileData = currentFields.includes('customerprofile');
  const needsUserRatingData = currentFields.includes('userrating');
  const needsMajorCategoryData = currentFields.includes('majorcategory');
  const needsMetroStationData = currentFields.includes('worklocation');
  
  // 根据当前阶段需要的字段检查数据是否已加载
  const requiredDataLoaded = (!needsCommunityData || isDataLoaded.community) &&
                             (!needsCustomerProfileData || isDataLoaded.customerprofile) &&
                             (!needsUserRatingData || isDataLoaded.userrating) &&
                             (!needsMajorCategoryData || isDataLoaded.majorCategory) &&
                             (!needsMetroStationData || isDataLoaded.metroStation);

  // 处理表单值变化，确保日期字段为 dayjs 对象
  const handleValuesChange = useCallback((changed: any) => {
    const dateFields = ['moveintime', 'scheduletime'];
    let needSet = false;
    const patch: any = {};
    
    dateFields.forEach(field => {
      if (field in changed) {
        const v = changed[field];
        if (!v || v === '' || v === null) {
          patch[field] = undefined;
          needSet = true;
        } else if (!dayjs.isDayjs(v)) {
          patch[field] = dayjs(v);
          needSet = true;
        }
      }
    });
    
    if (needSet) {
      form.setFieldsValue(patch);
    }
  }, [form]);

  // 渲染桌面端字段
  const renderDesktopField = useCallback((field: string, label: string, isRequired: boolean) => {
    const formItemProps = {
      name: field,
      label,
      rules: isRequired ? [{ required: true, message: `请填写${label}` }] : undefined,
    };

    switch (field) {
      case 'followupstage':
        return (
          <Form.Item {...formItemProps}>
            <Select 
              options={followupstageEnum} 
              placeholder={`请选择${label}`}
              loading={followupstageEnum.length === 0}
              disabled={followupstageEnum.length === 0 || isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'customerprofile':
        return (
          <Form.Item {...formItemProps}>
            <Select 
              options={customerprofileEnum} 
              placeholder={`请选择${label}`}
              loading={customerprofileEnum.length === 0}
              disabled={customerprofileEnum.length === 0 || isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'userrating':
        return (
          <Form.Item {...formItemProps}>
            <Select 
              options={userratingEnum} 
              placeholder={`请选择${label}`}
              loading={userratingEnum.length === 0}
              disabled={userratingEnum.length === 0 || isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'scheduledcommunity':
        if (stage === '邀约到店') {
          return null;
        }
        return (
          <Form.Item {...formItemProps}>
            <Select 
              options={communityEnum} 
              placeholder={`请选择${label}`}
              loading={communityEnum.length === 0}
              disabled={communityEnum.length === 0 || isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'worklocation':
        return (
          <Form.Item {...formItemProps}>
            <Cascader
              options={Array.isArray(metroStationOptions) ? metroStationOptions : []}
              placeholder={`请选择${label}`}
              showSearch
              changeOnSelect={false}
              allowClear
              disabled={isFieldDisabled()}
              onChange={(_value, selectedOptions) => {
                let selectedText = '';
                if (selectedOptions && selectedOptions.length > 1) {
                  // 只保存站点名称，不保存线路信息（与表格保持一致）
                  selectedText = selectedOptions[1].label;
                } else if (selectedOptions && selectedOptions.length === 1) {
                  // 只有一级选项时，保存线路名称
                  selectedText = selectedOptions[0].label;
                }
                
                if (selectedText) {
                  form.setFieldValue(field, selectedText);
                }
              }}
            />
          </Form.Item>
        );

      case 'userbudget':
        return (
          <Form.Item {...formItemProps}>
            <InputNumber
              style={{ width: '100%' }}
              placeholder={`请输入${label}`}
              min={0}
              precision={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') || 0) as any}
              disabled={isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'moveintime':
      case 'scheduletime':
        return (
          <Form.Item {...formItemProps}>
            <DatePicker
              showTime
              locale={locale}
              style={{ width: '100%' }}
              placeholder={`请选择${label}`}
              disabled={isFieldDisabled()}
            />
          </Form.Item>
        );

      case 'majorcategory':
        return (
          <Form.Item {...formItemProps}>
            {Array.isArray(majorCategoryOptions) && majorCategoryOptions.length > 0 ? (
              <Cascader
                options={majorCategoryOptions}
                placeholder={`请选择${label}`}
                showSearch
                changeOnSelect={false}
                allowClear
                disabled={isFieldDisabled()}
              />
            ) : (
              <Input 
                placeholder={`${label}选项加载中...`} 
                disabled 
              />
            )}
          </Form.Item>
        );

      case 'followupresult':
        return (
          <Form.Item {...formItemProps}>
            <Input.TextArea
              placeholder={`请输入${label}`}
              rows={4}
              maxLength={500}
              showCount
              disabled={isFieldDisabled()}
            />
          </Form.Item>
        );

      default:
        return (
          <Form.Item {...formItemProps}>
            <Input
              placeholder={`请输入${label}`}
              disabled={isFieldDisabled()}
            />
          </Form.Item>
        );
    }
  }, [followupstageEnum, customerprofileEnum, userratingEnum, majorCategoryOptions, metroStationOptions, isFieldDisabled, stage, form]);

  // 渲染单个字段
  const renderField = useCallback((field: string) => {
    console.log('🔍 [FollowupStageForm] renderField 调用:', { field, stage });
    const label = getFieldLabel(field, stage);
    console.log('🔍 [FollowupStageForm] getFieldLabel 结果:', { field, stage, label });
    
    // 确认需求阶段的所有字段都是必填项，除了入住时间
    let isRequired = false;
    if (stage === '确认需求') {
      isRequired = field !== 'moveintime'; // 入住时间非必填，其他字段必填
    } else {
      // 其他阶段保持原有逻辑
      isRequired = ['customerprofile', 'userrating', 'scheduledcommunity', 'majorcategory', 'followupresult'].includes(field);
    }

    // 使用桌面端组件
    return renderDesktopField(field, label, isRequired);
  }, [stage, renderDesktopField]);

  // 根据阶段渲染不同的布局
  const renderStageFields = useCallback(() => {
    // 根据阶段使用不同布局
    if (stage === '确认需求') {
      // 确认需求阶段使用三栏布局
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {currentFields.map((field) => (
            <div key={field}>
              {renderField(field)}
            </div>
          ))}
        </div>
      );
    } else if (stage === '邀约到店' || stage === '丢单' || stage === '已到店' || stage === '赢单') {
      // 其他阶段使用双栏布局
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {currentFields.map((field) => (
            <div key={field}>
              {renderField(field)}
            </div>
          ))}
        </div>
      );
    } else {
      // 使用单栏布局
      return (
        <div>
          {currentFields.map((field) => (
            <div key={field}>
              {renderField(field)}
            </div>
          ))}
        </div>
      );
    }
  }, [stage, currentFields, renderField]);

  // 🆕 渲染邀约到店阶段的特殊布局（包含分配模式切换）
  const renderInviteToStoreFields = useCallback(() => {
    if (stage !== '邀约到店') return null;
    
    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px' 
      }}>
        {/* 左侧：分配模式切换和带看人员选择 */}
        <div>
          {/* 分配模式切换 */}
          <Form.Item
            label={
              <Space>
                <span>{enableManualAssign ? '手动分配' : '自动分配'}</span>
                <Switch
                  checked={enableManualAssign}
                  onChange={onAllocationModeChange}
                  size="small"
                />
              </Space>
            }
          >
            {enableManualAssign ? (
              <Form.Item
                name="assigned_showingsales"
                rules={[
                  {
                    required: enableManualAssign,
                    message: '请选择带看人员'
                  }
                ]}
                style={{ marginBottom: 0 }}
              >
                <UserTreeSelect
                  placeholder="请选择带看人员"
                  disabled={isFieldDisabled()}
                  multiple={false} // 单选模式
                  showSearch={true}
                  allowClear={true}
                  treeDefaultExpandAll={false}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="scheduledcommunity"
                rules={[{ required: true, message: '请选择预约社区' }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="请选择预约社区"
                  options={communityEnum}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            )}
          </Form.Item>
        </div>
        
        {/* 右侧：预约到店时间 */}
        <div>
          <Form.Item
            name="scheduletime"
            label="预约到店时间"
            rules={[{ required: true, message: '请选择预约到店时间' }]}
          >
            <DatePicker
              showTime
              locale={locale}
              style={{ width: '100%' }}
              placeholder="请选择预约到店时间"
              disabled={isFieldDisabled()}
            />
          </Form.Item>
        </div>
      </div>
    );
  }, [stage, enableManualAssign, onAllocationModeChange, isFieldDisabled, communityEnum]);

  // 如果关键数据未加载完成，显示加载状态
  if (!requiredDataLoaded) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px', 
        color: '#999' 
      }}>
        <p>正在加载表单数据...</p>
        <p>请稍候</p>
      </div>
    );
  }
  
  // 如果没有字段，显示提示信息
  if (currentFields.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px', 
        color: '#999' 
      }}>
        <p>当前阶段无需填写额外信息</p>
        <p>点击"下一步"继续推进</p>
      </div>
    );
  }

  // 如果是不需要表单的阶段，返回空的Form组件
  if (stage === '已到店' || stage === '赢单') {
    return (
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        {/* 空内容，但Form组件存在以连接form实例 */}
      </Form>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
      preserve={false}
    >
      {/* 邀约到店阶段使用特殊布局 */}
      {stage === '邀约到店' ? renderInviteToStoreFields() : renderStageFields()}
    </Form>
  );
};
