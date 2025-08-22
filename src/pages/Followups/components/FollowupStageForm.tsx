import React from 'react';
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
    return '丢单原因';
  }
  return labelMap[field] || field;
};

// 查找级联选择器的路径
const findCascaderPath = (options: any[], value: string): string[] => {
  if (!value || !options) return [];
  
  for (const option of options) {
    if (option.value === value) {
      return [option.value];
    }
    if (option.children) {
      const childPath = findCascaderPath(option.children, value);
      if (childPath.length > 0) {
        return [option.value, ...childPath];
      }
    }
  }
  return [];
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
  // 已到店阶段和赢单阶段不显示表单，因为它们在抽屉组件中单独处理
  if (stage === '已到店' || stage === '赢单') {
    return null;
  }
  
  // 如果阶段为空字符串或未定义，不渲染任何内容（等待状态更新）
  if (!stage || stage === '') {
    return null;
  }
  
  // 获取当前阶段需要的字段
  const currentFields = stageFields[stage] || [];
  
  // 如果没有字段，显示提示信息
  if (currentFields.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
        <p>当前阶段无需填写额外信息</p>
        <p>点击"下一步"继续推进</p>
      </div>
    );
  }

  // 处理表单值变化，确保日期字段为 dayjs 对象
  const handleValuesChange = (changed: any) => {
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
  };

  // 渲染单个字段
  const renderField = (field: string) => {
    const label = getFieldLabel(field, stage);
    
    // 确认需求阶段的所有字段都是必填项，除了入住时间
    let isRequired = false;
    if (stage === '确认需求') {
      isRequired = field !== 'moveintime'; // 入住时间非必填，其他字段必填
    } else {
      // 其他阶段保持原有逻辑
      isRequired = ['customerprofile', 'userrating', 'scheduledcommunity', 'majorcategory', 'followupresult'].includes(field);
    }

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
        // 🆕 邀约到店阶段的 scheduledcommunity 字段在特殊布局中处理，这里跳过
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

      // 移除 assigned_showingsales 字段，因为它在 followups 表中不存在

      case 'worklocation':
        return (
          <Form.Item {...formItemProps}>
            <Cascader
              options={metroStationOptions}
              placeholder={`请选择${label}`}
              showSearch
              changeOnSelect={false}
              allowClear
              disabled={isFieldDisabled()}
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
            {majorCategoryOptions && majorCategoryOptions.length > 0 ? (
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

      // 移除已到店阶段字段，因为它们在 followups 表中不存在

      // 移除 remark 字段，因为它在 followups 表中不存在

      // 移除赢单阶段字段，因为它们在 followups 表中不存在

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
  };

  // 根据阶段渲染不同的布局
  const renderStageFields = () => {
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
  };

  // 🆕 渲染邀约到店阶段的特殊布局（包含分配模式切换）
  const renderInviteToStoreFields = () => {
    if (stage !== '邀约到店') return null;
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
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
  };

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
