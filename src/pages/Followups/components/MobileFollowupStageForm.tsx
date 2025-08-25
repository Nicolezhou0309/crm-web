import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Form, Input, Selector, TextArea, CascadePicker, Button, CalendarPicker, List, NumberKeyboard, DatePicker } from 'antd-mobile';
import dayjs from 'dayjs';
import type { FollowupRecord } from '../types';

// 🆕 通用Selector组件，处理单选逻辑
interface CommonSelectorProps {
  options: any[];
  value?: any;
  onChange: (value: any) => void;
  placeholder?: string;
  loading?: boolean;
}

const CommonSelector: React.FC<CommonSelectorProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "请选择",
  loading = false 
}) => {
  const getDisplayValue = () => {
    // 🆕 修复：确保值处理逻辑正确
    if (!value || value === '') return [];
    
    if (Array.isArray(value)) {
      return value.length > 0 ? [value[0]] : [];
    } else {
      return [value];
    }
  };

  const handleChange = (selectedValue: any) => {
    let finalValue = '';
    
    if (selectedValue && Array.isArray(selectedValue) && selectedValue.length > 0) {
      finalValue = selectedValue[0];
    } else if (selectedValue && typeof selectedValue === 'string') {
      finalValue = selectedValue;
    } else if (selectedValue && typeof selectedValue === 'number') {
      finalValue = String(selectedValue);
    }

    onChange(finalValue);
  };

  // 🆕 新增：调试信息
  const displayValue = getDisplayValue();

  if (loading || options.length === 0) {
    return (
      <div style={{ 
        padding: '12px', 
        border: '1px solid #d9d9d9', 
        borderRadius: '6px',
        backgroundColor: '#f5f5f5',
        color: '#00000040'
      }}>
        加载中...
      </div>
    );
  }

  return (
    <Selector
      options={options}
      value={displayValue}
      multiple={false}
      onChange={handleChange}
    />
  );
};

interface MobileFollowupStageFormProps {
  form: any;
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
  // 🆕 新增：预算字段变化回调
  onBudgetChange?: (value: string) => void;
}

// 跟进阶段配置
const followupStages = ['丢单', '待接收', '确认需求', '邀约到店', '已到店', '赢单'];

// 各阶段需要的字段配置
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

// 字段标签映射
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
    leadtype: '线索类型',
    invalid: '是否无效'
  };
  
  if (currentStage === '丢单' && field === 'followupresult') {
    return '丢单原因';
  }
  return labelMap[field] || field;
};

// 工作地点级联选择器组件
interface WorkLocationPickerProps {
  options: any[];
  value?: any;
  onChange: (value: any) => void;
  placeholder: string;
}

const WorkLocationPicker: React.FC<WorkLocationPickerProps> = ({ options, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  
  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return placeholder;
    
    // 根据选中的值查找对应的标签
    // 由于工作地点保存的是站点名称（最后一级），需要在整个选项中查找
    const findLabel = (items: any[], targetValue: any): string => {
      for (const item of items) {
        if (item.value === targetValue) {
          return item.label;
        }
        if (item.children) {
          const childLabel = findLabel(item.children, targetValue);
          if (childLabel) return childLabel;
        }
      }
      return '';
    };
    
    const label = findLabel(options, value);
    return label || placeholder;
  };

  return (
    <>
      <div
        style={{
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          color: value ? 'inherit' : '#999'
        }}
        onClick={() => setVisible(true)}
      >
        {getDisplayText()}
      </div>
      <CascadePicker
        title="选择工作地点"
        options={options}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(val, extend) => {
          try {
            if (val && val.length > 0) {
              // 工作地点级联选择器的值结构：[线路, 站点]
              // 根据业务逻辑，保存站点名称（最后一级）
              const selectedValue = val[val.length - 1];
              
              // 验证选中的值是否有效
              if (selectedValue && typeof selectedValue === 'string') {
                onChange(selectedValue);
              } else {
                console.warn('⚠️ [WorkLocationPicker] 选中的工作地点值无效:', selectedValue);
              }
            }
          } catch (error) {
            console.error('❌ [WorkLocationPicker] 工作地点选择确认失败:', error);
          }
          setVisible(false);
        }}
      />
    </>
  );
};

// 跟进结果级联选择器组件
interface MajorCategoryPickerProps {
  options: any[];
  value?: any;
  onChange: (value: any) => void;
  placeholder: string;
}

const MajorCategoryPicker: React.FC<MajorCategoryPickerProps> = ({ options, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  
  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return placeholder;
    
    // 根据选中的值查找对应的标签
    const findLabel = (items: any[], targetValue: any): string => {
      for (const item of items) {
        if (item.value === targetValue) {
          return item.label;
        }
        if (item.children) {
          const childLabel = findLabel(item.children, targetValue);
          if (childLabel) return childLabel;
        }
      }
      return '';
    };
    
    const label = findLabel(options, value);
    return label || placeholder;
  };

  return (
    <>
      <div
        style={{
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          color: value ? 'inherit' : '#999'
        }}
        onClick={() => setVisible(true)}
      >
        {getDisplayText()}
      </div>
      <CascadePicker
        title="选择跟进结果"
        options={options}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(val, extend) => {
          try {
            if (val && val.length > 0) {
              // 获取最后一级的值
              const selectedValue = val[val.length - 1];
              onChange(selectedValue);
            }
          } catch (error) {
            console.error('跟进结果选择确认失败:', error);
          }
          setVisible(false);
        }}
      />
    </>
  );
};

// 入住时间选择器组件
interface MoveInTimePickerProps {
  value?: any;
  onChange: (value: any) => void;
  placeholder: string;
}

const MoveInTimePicker: React.FC<MoveInTimePickerProps> = ({ value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  
  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return placeholder;
    
    try {
      if (dayjs.isDayjs(value)) {
        return value.format('YYYY-MM-DD');
      } else if (value instanceof Date) {
        return dayjs(value).format('YYYY-MM-DD');
      } else if (typeof value === 'string' && value.trim()) {
        const parsed = dayjs(value);
        if (parsed.isValid()) {
          return parsed.format('YYYY-MM-DD');
        }
      }
    } catch (e) {
      console.warn('入住时间值解析失败:', e);
    }
    
    return placeholder;
  };

  // 获取默认值
  const getDefaultValue = (): Date => {
    if (value) {
      try {
        if (dayjs.isDayjs(value)) {
          return value.toDate();
        } else if (value instanceof Date) {
          return value;
        } else if (typeof value === 'string' && value.trim()) {
          const parsed = dayjs(value);
          if (parsed.isValid()) {
            return parsed.toDate();
          }
        }
      } catch (e) {
        console.warn('入住时间默认值解析失败:', e);
      }
    }
    return new Date();
  };

  return (
    <>
      <div
        style={{
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          color: value ? 'inherit' : '#999'
        }}
        onClick={() => setVisible(true)}
      >
        {getDisplayText()}
      </div>
      <CalendarPicker
        title="选择入住时间"
        visible={visible}
        selectionMode="single"
        defaultValue={getDefaultValue()}
        onClose={() => setVisible(false)}
        onMaskClick={() => setVisible(false)}
        onChange={(val) => {
          try {
            if (val && Array.isArray(val) && val.length > 0) {
              // CalendarPicker 返回的是 Date 数组，取第一个
              const selectedDate = dayjs(val[0]);
              if (selectedDate.isValid()) {
                onChange(selectedDate);
              }
            }
          } catch (error) {
          }
          setVisible(false);
        }}
      />
    </>
  );
};

// 预约时间选择器组件 - 使用DatePicker，精度为年-月-日-时-分（北京时间）
interface ScheduleTimePickerWithDatePickerProps {
  value?: any;
  onChange: (value: any) => void;
  placeholder: string;
}

const ScheduleTimePickerWithDatePicker: React.FC<ScheduleTimePickerWithDatePickerProps> = ({ value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  
  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return placeholder;
    
    try {
      if (dayjs.isDayjs(value)) {
        return value.format('YYYY-MM-DD HH:mm');
      } else if (value instanceof Date) {
        return dayjs(value).format('YYYY-MM-DD HH:mm');
      } else if (typeof value === 'string' && value.trim()) {
        const parsed = dayjs(value);
        if (parsed.isValid()) {
          return parsed.format('YYYY-MM-DD HH:mm');
        }
      }
    } catch (e) {
      console.warn('预约时间值解析失败:', e);
    }
    
    return placeholder;
  };

  // 获取默认值
  const getDefaultValue = (): Date => {
    if (value) {
      try {
        if (dayjs.isDayjs(value)) {
          return value.toDate();
        } else if (value instanceof Date) {
          return value;
        } else if (typeof value === 'string' && value.trim()) {
          const parsed = dayjs(value);
          if (parsed.isValid()) {
            return parsed.toDate();
          }
        }
      } catch (e) {
        console.warn('预约时间默认值解析失败:', e);
      }
    }
    return new Date();
  };

  // 自定义标签渲染器，使用中文标签
  const labelRenderer = useCallback((type: string, data: number) => {
    switch (type) {
      case 'year':
        return data + '年';
      case 'month':
        return data + '月';
      case 'day':
        return data + '日';
      case 'hour':
        return data + '时';
      case 'minute':
        return data + '分';
      default:
        return data;
    }
  }, []);

  return (
    <>
      <div
        style={{
          padding: '12px',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          backgroundColor: 'white',
          cursor: 'pointer',
          color: value ? 'inherit' : '#999'
        }}
        onClick={() => setVisible(true)}
      >
        {getDisplayText()}
      </div>
      <DatePicker
        title="选择预约到店时间"
        visible={visible}
        precision="minute"
        defaultValue={getDefaultValue()}
        onClose={() => setVisible(false)}
        renderLabel={labelRenderer}
        onConfirm={(val) => {
          try {
            if (val) {
              // DatePicker返回的是dayjs对象
              const selectedDate = dayjs(val);
              if (selectedDate.isValid()) {
                onChange(selectedDate);
              }
            }
          } catch (error) {
          }
          setVisible(false);
        }}
      />
    </>
  );
};

export const MobileFollowupStageForm: React.FC<MobileFollowupStageFormProps> = ({
  form,
  stage,
  record,
  isFieldDisabled = () => false,
  forceUpdate = 0,
  communityEnum,
  followupstageEnum,
  customerprofileEnum,
  userratingEnum,
  majorCategoryOptions,
  metroStationOptions,
  onBudgetChange,
}) => {
  // 🆕 优化：数字键盘状态管理
  const [visible, setVisible] = useState<string>('');
  const [userbudgetValue, setUserbudgetValue] = useState<string>('');
  
  // 🆕 新增：标记用户是否主动清空了预算字段
  const [hasUserCleared, setHasUserCleared] = useState<boolean>(false);
  
  // 🆕 重新设计：预算字段状态管理 - 确保与表单值同步，但尊重用户的清空操作
  useEffect(() => {
    if (record && form && !hasUserCleared) {
      const recordBudget = record.userbudget;
      const formBudget = form.getFieldValue('userbudget');
      
      // 优先使用表单值，如果没有则使用记录值
      const targetValue = formBudget || recordBudget;
      
      // 🆕 修复：只有当本地状态为空且不是用户主动清空时才同步
      if (targetValue && targetValue !== userbudgetValue && userbudgetValue === '') {
        setUserbudgetValue(String(targetValue));
      }
    } else if (record && form && hasUserCleared) {
    }
  }, [record?.id, record?.userbudget, form, userbudgetValue, hasUserCleared]);
  
  // 🆕 移除有问题的表单值变化监听，避免状态冲突
  
  // 🆕 简化调试日志，避免过多输出
  useEffect(() => {
    if (record?.id) {
      
              // 🆕 新增：当记录变化时，重置清空标记，允许重新初始化
        setHasUserCleared(false);
    }
  }, [record?.id, record?.userbudget]);
  
  // 检查数据是否已加载
  const isDataLoaded = useMemo(() => {
    return {
      community: communityEnum && communityEnum.length > 0,
      followupstage: followupstageEnum && followupstageEnum.length > 0,
      customerprofile: customerprofileEnum && customerprofileEnum.length > 0,
      userrating: userratingEnum && userratingEnum.length > 0,
      majorCategory: majorCategoryOptions && majorCategoryOptions.length > 0,
      metroStation: metroStationOptions && metroStationOptions.length > 0
    };
  }, [communityEnum, followupstageEnum, customerprofileEnum, userratingEnum, majorCategoryOptions, metroStationOptions]);

  // 使用useMemo缓存选项，使用更简单的key生成策略
  const followupstageOptions = useMemo(() => {
    if (!followupstageEnum || followupstageEnum.length === 0) return [];
    
    const seen = new Set();
    return followupstageEnum
      .filter(item => {
        const value = item.value || item.label;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .map((item, index) => ({
        label: item.label || String(item.value),
        value: item.value || `value_${index}`,
        key: `followupstage_${index}_${item.value || index}`
      }));
  }, [followupstageEnum]);

  const customerprofileOptions = useMemo(() => {
    if (!customerprofileEnum || customerprofileEnum.length === 0) return [];
    
    const seen = new Set();
    return customerprofileEnum
      .filter(item => {
        const value = item.value || item.label;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .map((item, index) => ({
        label: item.label || String(item.value),
        value: item.value || `value_${index}`,
        key: `customerprofile_${index}_${item.value || index}`
      }));
  }, [customerprofileEnum]);

  const userratingOptions = useMemo(() => {
    if (!userratingEnum || userratingEnum.length === 0) return [];
    
    const seen = new Set();
    const options = userratingEnum
      .filter(item => {
        const value = item.value || item.label;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .map((item, index) => ({
        label: item.label || String(item.value),
        value: item.value || `value_${index}`,
        key: `userrating_${index}_${item.value || index}`
      }));
 
    return options;
  }, [userratingEnum]);

  const communityOptions = useMemo(() => {
    if (!communityEnum || communityEnum.length === 0) return [];
    
    const seen = new Set();
    return communityEnum
      .filter(item => {
        const value = item.value || item.label;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .map((item, index) => ({
        label: item.label || String(item.value),
        value: item.value || `value_${index}`,
        key: `community_${index}_${item.value || index}`
      }));
  }, [communityEnum]);

  const worklocationOptions = useMemo(() => {
    // 直接使用 metroStationOptions，它已经是正确的级联选择器格式
    if (!metroStationOptions || metroStationOptions.length === 0) return [];
    
    // metroStationOptions 的数据结构：
    // [
    //   {
    //     value: "1号线",
    //     label: "1号线", 
    //     children: [
    //       { value: "苹果园", label: "苹果园" },
    //       { value: "古城", label: "古城" }
    //     ]
    //   }
    // ]
    
    return metroStationOptions;
  }, [metroStationOptions]);

  const majorcategoryOptions = useMemo(() => {
    if (!majorCategoryOptions || majorCategoryOptions.length === 0) return [];
    
    const allOptions: any[] = [];
    let optionIndex = 0;
    const seen = new Set();
    
    majorCategoryOptions.forEach((cat, catIndex) => {
      if (cat.children) {
        cat.children.forEach((child: any, childIndex: number) => {
          const value = child.value || `value_${catIndex}_${childIndex}`;
          if (!seen.has(value)) {
            seen.add(value);
            allOptions.push({
              label: child.label || String(child.value),
              value,
              key: `majorcategory_${optionIndex++}_${value}`
            });
          }
        });
      } else {
        const value = cat.value || `value_${catIndex}`;
        if (!seen.has(value)) {
          seen.add(value);
          allOptions.push({
            label: cat.label || String(cat.value),
            value,
            key: `majorcategory_${optionIndex++}_${value}`
          });
        }
      }
    });
    
    return allOptions;
  }, [majorCategoryOptions]);

  // 已到店阶段和赢单阶段不显示表单
  if (stage === '已到店' || stage === '赢单') {
    return null;
  }
  
  // 如果阶段为空字符串或未定义，不渲染任何内容
  if (!stage || stage === '') {
    return null;
  }
  
  // 检查关键数据是否已加载
  const requiredDataLoaded = isDataLoaded.followupstage && isDataLoaded.customerprofile && 
                             isDataLoaded.userrating && isDataLoaded.community && 
                             isDataLoaded.majorCategory && isDataLoaded.metroStation;
  
  // 如果关键数据未加载完成，显示加载状态
  if (!requiredDataLoaded) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
        <p>正在加载表单数据...</p>
        <p>请稍候</p>
      </div>
    );
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

  // 渲染移动端字段
  const renderMobileField = (field: string, label: string, isRequired: boolean) => {
    
    const formItemProps = {
      name: field,
      label,
      rules: isRequired ? [{ required: true, message: `请填写${label}` }] : [],
      className: "border-b-0 border-t-0",
    };

    // 使用 try-catch 包装整个字段渲染，防止任何组件错误
    try {
      switch (field) {
        case 'followupstage':
          return (
            <Form.Item {...formItemProps}>
              <CommonSelector
                options={followupstageOptions}
                value={form.getFieldValue(field) || record?.[field]}
                onChange={(value) => {
                  try {
                    form.setFieldValue(field, value);
                    form.setFieldsValue({ [field]: value });
                  } catch (error) {
                    console.error('❌ [MobileFollowupStageForm] 设置跟进阶段失败:', error);
                  }
                }}
                loading={followupstageOptions.length === 0}
              />
            </Form.Item>
          );

        case 'customerprofile':
          return (
            <Form.Item {...formItemProps}>
              <CommonSelector
                options={customerprofileOptions}
                value={form.getFieldValue(field) || record?.[field]}
                onChange={(value) => {
                  try {
                    form.setFieldValue(field, value);
                    form.setFieldsValue({ [field]: value });
                  } catch (error) {
                    console.error('❌ [MobileFollowupStageForm] 设置用户画像失败:', error);
                  }
                }}
                loading={customerprofileOptions.length === 0}
              />
            </Form.Item>
          );

        case 'userrating':
          return (
            <Form.Item {...formItemProps}>
              <CommonSelector
                options={userratingOptions}
                value={form.getFieldValue(field) || record?.[field]}
                onChange={(value) => {
                  try {
                    form.setFieldValue(field, value);
                    form.setFieldsValue({ [field]: value });
                  } catch (error) {
                    console.error('❌ [MobileFollowupStageForm] 设置来访意向失败:', error);
                  }
                }}
                loading={userratingOptions.length === 0}
              />
            </Form.Item>
          );

        case 'scheduledcommunity':
          return (
            <Form.Item {...formItemProps}>
              <CommonSelector
                options={communityOptions}
                value={form.getFieldValue(field) || record?.[field]}
                onChange={(value) => {
                  try {
                    form.setFieldValue(field, value);
                    form.setFieldsValue({ [field]: value });
                  } catch (error) {
                    console.error('❌ [MobileFollowupStageForm] 设置预约社区失败:', error);
                  }
                }}
                loading={communityOptions.length === 0}
              />
            </Form.Item>
          );

        case 'worklocation': 
          
          return (
            <Form.Item {...formItemProps}>
              {worklocationOptions.length > 0 ? (
                <WorkLocationPicker
                  options={worklocationOptions}
                  value={form.getFieldValue(field)}
                  onChange={(value) => {
                    try { 
                      // 先设置到form实例
                      form.setFieldValue(field, value);
                      // 再强制触发form的onValuesChange
                      form.setFieldsValue({ [field]: value });
                    } catch (error) { 
                    }
                  }}
                  placeholder="请选择工作地点"
                />
              ) : (
                <div style={{ 
                  padding: '12px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  backgroundColor: '#f5f5f5',
                  color: '#00000040'
                }}>
                  加载中...
                </div>
              )}
            </Form.Item>
          );

        case 'userbudget':
          // 🆕 简化：直接显示用户输入的值，不做复杂处理
          const formatBudgetValue = (value: string | number) => {
            // 空值直接返回空字符串
            if (value === '' || value === null || value === undefined) return '';
            
            // 其他情况直接返回原值，保持用户输入的原始格式
            return String(value);
          };
          
          // 🆕 修复：优先使用表单值，确保与表单状态同步
          const formValue = form.getFieldValue(field);
          // 🆕 修复：当用户已清空时，优先使用空值，不回退到记录值
          const displayValue = hasUserCleared ? userbudgetValue : (userbudgetValue !== '' ? userbudgetValue : (formValue || record?.userbudget || ''));
          const formattedValue = formatBudgetValue(displayValue);
          return (
            <Form.Item {...formItemProps}>
              <div style={{ position: 'relative' }}>
                {/* 🆕 修复：简化点击区域，确保事件处理正确 */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1,
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 🆕 修复：确保本地状态与表单值同步
                    const currentFormValue = form.getFieldValue(field);
                    if (currentFormValue !== userbudgetValue) {
                      setUserbudgetValue(String(currentFormValue || ''));
                    }
                    
                    setVisible('userbudget');
                  }}
                />
                <Input
                  placeholder={displayValue ? '' : `点击输入${label}`}
                  value={formattedValue}
                  readOnly
                  clearable
                  onClear={() => {
                    setUserbudgetValue('');
                    setHasUserCleared(true); // 标记用户已清空
                    form.setFieldValue(field, '');
                    form.setFieldsValue({ [field]: '' });                   
                    // 通知父组件预算字段变化
                    if (onBudgetChange) {
                      onBudgetChange('');
                    }
                  }}
                />
                {displayValue && (
                  <span style={{ 
                    position: 'absolute', 
                    right: '40px', 
 top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#999', 
                    fontSize: '12px',
                    pointerEvents: 'none'
                  }}>
                    元
                  </span>
                )}
              </div>
            </Form.Item>
          );

        case 'moveintime':
          
          
          return (
            <Form.Item {...formItemProps}>
              <MoveInTimePicker
                value={form.getFieldValue(field)}
                                  onChange={(value) => {
                    try {
                      
                      // 先设置到form实例
                      form.setFieldValue(field, value);
                      // 再强制触发form的onValuesChange
                      form.setFieldsValue({ [field]: value });
                      
                    } catch (error) { 
                    }
                  }}
                placeholder="请选择入住时间"
              />
            </Form.Item>
          );

        case 'scheduletime':
          
          return (
            <Form.Item {...formItemProps}>
              <ScheduleTimePickerWithDatePicker
                value={form.getFieldValue(field)}
                onChange={(value) => {
                  try {

                    // 先设置到form实例
                    form.setFieldValue(field, value);
                    
                    // 再强制触发form的onValuesChange
                    form.setFieldsValue({ [field]: value });
                    
                  } catch (error) {
                    console.error('❌ [MobileFollowupStageForm] 设置预约时间失败:', error);
                  }
                }}
                placeholder="请选择预约时间"
              />
            </Form.Item>
          );

        case 'majorcategory':
          return (
            <Form.Item {...formItemProps}>
              {majorcategoryOptions.length > 0 ? (
                <MajorCategoryPicker
                  options={majorCategoryOptions}
                  value={form.getFieldValue(field)}
                  onChange={(value) => {
                    try {
                      // 使用form.setFieldValue确保值正确设置到form实例
                      form.setFieldValue(field, value);
                      // 强制触发form的onValuesChange
                      form.setFieldsValue({ [field]: value });
                    } catch (error) {
                      console.error('设置跟进结果失败:', error);
                    }
                  }}
                  placeholder="请选择跟进结果"
                />
              ) : (
                <div style={{ 
                  padding: '12px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  backgroundColor: '#f5f5f5',
                  color: '#00000040'
                }}>
                  加载中...
                </div>
              )}
            </Form.Item>
          );

        case 'followupresult':
          return (
            <Form.Item {...formItemProps}>
              <TextArea
                placeholder={`请输入${label}`}
                rows={4}
                maxLength={500}
                showCount
              />
            </Form.Item>
          );

        default:
          return (
            <Form.Item {...formItemProps}>
              <Input
                placeholder={`请输入${label}`}
                clearable
              />
            </Form.Item>
          );
      }
    } catch (error) {
      console.error('渲染字段错误:', error, { field, label, isRequired });
      return (
        <Form.Item {...formItemProps}>
          <div style={{ 
            padding: '12px', 
            border: '1px solid #ff4d4f', 
            borderRadius: '6px',
            backgroundColor: '#fff2f0',
            color: '#ff4d4f'
          }}>
            字段渲染错误，请刷新页面重试
          </div>
        </Form.Item>
      );
    }
  };

  // 渲染单个字段
  const renderField = (field: string) => {
    const label = getFieldLabel(field, stage);
    
    // 确认需求阶段的所有字段都是必填项，除了入住时间
    let isRequired = false;
    if (stage === '确认需求') {
      isRequired = field !== 'moveintime';
    } else {
      isRequired = ['customerprofile', 'userrating', 'scheduledcommunity', 'majorcategory', 'followupresult'].includes(field);
    }

    return renderMobileField(field, label, isRequired);
  };
  
  return (
    <>
      {/* 🆕 优化：直接渲染字段，减少包装div，去除分割线 */}
      {currentFields.map((field, index) => (
        <div key={field} className="border-b-0 border-t-0">
          {renderField(field)}
        </div>
      ))}
      
      {/* 用户预算数字键盘 */}
      <NumberKeyboard
        visible={visible === 'userbudget'}
        onClose={() => {
          setVisible('');
        }}
        onInput={(key: string) => {
          // 限制最大输入长度，避免数字过长
          if (userbudgetValue.length >= 10) {
            return;
          }
          
          // 更新本地状态
          const newValue = userbudgetValue + key;
          setUserbudgetValue(newValue);
          
          // 🆕 修复：实时更新表单值，确保同步
          form.setFieldValue('userbudget', newValue);
          form.setFieldsValue({ userbudget: newValue });
          
          // 🆕 新增：用户开始输入时，重置清空标记
          setHasUserCleared(false);
          
          // 通知父组件预算字段变化
          if (onBudgetChange) {
            onBudgetChange(newValue);
          }
        }}
        onDelete={() => {
          // 删除最后一个字符
          const newValue = userbudgetValue.slice(0, userbudgetValue.length - 1);
          setUserbudgetValue(newValue);
          
          // 🆕 修复：更新表单值，确保同步
          form.setFieldValue('userbudget', newValue);
          form.setFieldsValue({ userbudget: newValue });
          
          // 🆕 新增：如果删除后变成空字符串，设置清空标记
          if (newValue === '') {
            setHasUserCleared(true);
          }
          
          // 通知父组件预算字段变化
          if (onBudgetChange) {
            onBudgetChange(newValue);
          }
        }}
        onConfirm={() => {
          // 确认输入
          const finalValue = userbudgetValue || '';
          
          // 🆕 修复：确保表单值正确设置
          form.setFieldValue('userbudget', finalValue);
          form.setFieldsValue({ userbudget: finalValue });
          
          // 🆕 新增：如果确认的是空值，设置清空标记
          if (finalValue === '') {
            setHasUserCleared(true);
          }
          
          // 通知父组件预算字段变化
          if (onBudgetChange) {
            onBudgetChange(finalValue);
          }
          
          // 关闭数字键盘
          setVisible('');
        }}
        showCloseButton={false}
        confirmText='确定'
        title='输入预算金额'
        customKey='.'
        style={{
          zIndex: 1001
        }}
      />
    </>
  );
};