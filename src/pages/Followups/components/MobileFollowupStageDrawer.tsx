import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Popup, 
  Button, 
  Form, 
  Toast, 
  NavBar,
  Space,
  Tag
} from 'antd-mobile';
import { supabase } from '../../../supaClient';
import dayjs from 'dayjs';
import type { FollowupRecord } from '../types';
import { ContractDealsTable } from '../../../components/Followups/ContractDealsTable';
import { MobileFollowupStageForm } from './MobileFollowupStageForm';
import './FollowupStageDrawer.css';

// 枚举数据类型定义
interface EnumOption {
  label: string;
  value: string | number;
}

interface MajorCategoryOption {
  label: string;
  value: string | number;
  children?: MajorCategoryOption[];
}

interface MetroStationOption {
  name: string;
  value: string | number;
  children?: MetroStationOption[];
}

interface MobileFollowupStageDrawerProps {
  open: boolean;
  onClose: () => void;
  record: FollowupRecord | null;
  onSave?: (record: FollowupRecord, updatedFields: Record<string, unknown>) => void;
  isFieldDisabled?: () => boolean;
  forceUpdate?: number;
  // 枚举数据
  communityEnum: EnumOption[];
  followupstageEnum: EnumOption[];
  customerprofileEnum: EnumOption[];
  userratingEnum: EnumOption[];
  majorCategoryOptions: MajorCategoryOption[];
  metroStationOptions: MetroStationOption[];
  // 禁用自动保存
  disableAutoSave?: boolean;
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

// 手机号脱敏
const maskPhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

// 微信号脱敏
const maskWechat = (wechat: string): string => {
  if (!wechat) return '';
  return wechat.length > 6 ? wechat.substring(0, 3) + '***' + wechat.substring(wechat.length - 3) : wechat;
};

// 🆕 处理级联选择器值，只保留最后一层字段值（与表格原位编辑逻辑保持一致）
const processCascaderValue = (value: any, field: string): any => {
  if (!value || !Array.isArray(value)) return value;
  
  // 对于工作地点和主分类字段，只保留最后一层值
  if (field === 'worklocation' || field === 'majorcategory') {
    if (value.length > 1) {
      // 如果有两级选择，只保存第二级（最后一层）
      return value[1];
    } else if (value.length === 1) {
      // 如果只有一级选择，保存第一级
      return value[0];
    }
  }
  
  // 其他字段保持原值
  return value;
};

// 🆕 比较两个值是否发生变化（包括从有值变为空值的情况）
const hasValueChanged = (originalValue: any, currentValue: any): boolean => {
  // 如果两个值都是空值（null, undefined, 空字符串），则认为没有变化
  if (!originalValue && !currentValue) {
    return false;
  }
  
  // 如果原始值存在但当前值不存在，或者相反，则认为有变化
  if (!!originalValue !== !!currentValue) {
    return true;
  }
  
  // 如果两个值都存在，比较它们是否相等
  if (originalValue && currentValue) {
    // 处理日期比较
    if (originalValue instanceof Date && currentValue instanceof Date) {
      return originalValue.getTime() !== currentValue.getTime();
    }
    
    // 处理dayjs对象比较
    if (originalValue && typeof originalValue.format === 'function' && 
        currentValue && typeof currentValue.format === 'function') {
      return originalValue.format('YYYY-MM-DD HH:mm:ss') !== currentValue.format('YYYY-MM-DD HH:mm:ss');
    }
    
    // 🆕 修复：处理数字和字符串的比较（特别是预算字段）
    if (typeof originalValue === 'number' || typeof currentValue === 'number') {
      const numOriginal = Number(originalValue);
      const numCurrent = Number(currentValue);
      return numOriginal !== numCurrent;
    }
    
    // 普通值比较
    return originalValue !== currentValue;
  }
  
  return false;
};

// 🆕 处理表单值，确保级联选择器只保存最后一层值
const processFormValues = (values: any): any => {
  const processedValues = { ...values };
  
  // 处理级联选择器字段
  ['worklocation', 'majorcategory'].forEach(field => {
    if (processedValues[field] && Array.isArray(processedValues[field])) {
      processedValues[field] = processCascaderValue(processedValues[field], field);
    }
  });
  
  // 🆕 修复：处理预算字段，保持字符串类型以与数据库字段类型一致
  if (processedValues.userbudget !== undefined && processedValues.userbudget !== '') {
    // 确保是字符串类型，与数据库字段类型保持一致
    processedValues.userbudget = String(processedValues.userbudget);
  }
  
  return processedValues;
};

/**
 * 移动端跟进阶段抽屉组件
 * 
 * 🆕 滚动功能修复说明：
 * 1. 添加了移动端触摸滚动支持 (WebkitOverflowScrolling: 'touch')
 * 2. 优化了滚动区域的CSS样式和布局
 * 3. 确保内容区域可以正常滚动
 * 4. 添加了触摸反馈效果
 * 5. 优化了移动端性能
 * 
 * 使用方法：
 * - 在移动端设备上，内容区域支持上下滑动
 * - 头部导航和客户信息区域固定不滚动
 * - 表单内容区域可以滚动查看
 */
export const MobileFollowupStageDrawer: React.FC<MobileFollowupStageDrawerProps> = ({
  open,
  onClose,
  record,
  onSave,
  isFieldDisabled = () => false,
  forceUpdate = 0,
  communityEnum,
  followupstageEnum,
  customerprofileEnum,
  userratingEnum,
  majorCategoryOptions,
  metroStationOptions,
  disableAutoSave = false,
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // 发放带看单相关状态
  const [assignShowingLoading, setAssignShowingLoading] = useState(false);
  
  // 签约记录相关状态
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  
  // 防止重复保存的状态
  const hasAutoSavedRef = useRef(false);
  const isClosingRef = useRef(false);
  const hasManualSavedRef = useRef(false);

  // 🆕 统一的乐观更新函数，消除重复代码
  const triggerOptimisticUpdate = useCallback((record: FollowupRecord, updateObj: any, saveType: 'auto' | 'manual' | 'stage') => {
    if (onSave) {
      const updateData = {
        ...updateObj,
        _optimisticUpdate: true,
        _saveType: saveType
      };
      
      // 根据保存类型添加特定标记
      if (saveType === 'auto') {
        updateData._autoSaveOnClose = true;
      } else if (saveType === 'manual') {
        updateData._manualSave = true;
      } else if (saveType === 'stage') {
        updateData._stageChange = true;
      }
      
      console.log('🔍 [MobileFollowupStageDrawer] 触发乐观更新', {
        recordId: record.id,
        saveType,
        updateData
      });
      
      onSave(record, updateData);
    }
  }, [onSave]);

  // 获取签约记录列表
  const fetchDealsList = useCallback(async () => {
    if (!record?.leadid) return;
    
    setDealsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('leadid', record.leadid)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDealsList(data?.map(item => ({
        ...item,
        isEditing: false,
        isNew: false
      })) || []);
    } catch (error: any) {
      console.error('获取签约记录失败:', error);
      Toast.show({
        content: '获取签约记录失败: ' + error.message,
        position: 'center'
      });
    } finally {
      setDealsLoading(false);
    }
  }, [record?.leadid]);

  // 当记录变化时，重置表单和步骤
  useEffect(() => {
    if (record && open) {
      const stageIndex = followupStages.findIndex(stage => stage === record.followupstage);
      setCurrentStep(Math.max(0, stageIndex));
      setCurrentStage(record.followupstage || '待接收');
      
      fetchDealsList();
      hasAutoSavedRef.current = false;
      isClosingRef.current = false;
      hasManualSavedRef.current = false;
    }
  }, [record, open, fetchDealsList]);

  // 监听form实例变化，确保表单正确初始化
  useEffect(() => {
    
    if (form && record && open) {
      
      const timer = setTimeout(() => {
        // 🆕 1. 记录卡片原始数据
        console.log('🔍 [MobileFollowupStageDrawer] 卡片原始数据', {
          recordId: record.id,
          currentStage: currentStage,
          recordStage: record.followupstage,
          recordData: {
            customerprofile: record.customerprofile,
            worklocation: record.worklocation,
            userbudget: record.userbudget,
            moveintime: record.moveintime,
            userrating: record.userrating,
            majorcategory: record.majorcategory,
            followupresult: record.followupresult,
            scheduledcommunity: record.scheduledcommunity,
            scheduletime: record.scheduletime
          }
        });
        
        const formValues: any = {
          id: record.id,
          leadid: record.leadid,
          followupstage: currentStage || record.followupstage, // 🆕 使用当前阶段
          phone: record.phone,
          wechat: record.wechat,
          source: record.source,
          created_at: record.created_at,
          customerprofile: record.customerprofile,
          worklocation: record.worklocation,
          userbudget: record.userbudget,
          moveintime: record.moveintime,
          userrating: record.userrating,
          majorcategory: record.majorcategory,
          followupresult: record.followupresult,
          scheduledcommunity: record.scheduledcommunity,
          scheduletime: record.scheduletime
        };
        
        // 🆕 2. 记录切换阶段后的初始化数据
        console.log('🔍 [MobileFollowupStageDrawer] 切换阶段后的初始化数据', {
          recordId: record.id,
          targetStage: currentStage || record.followupstage,
          stageFields: stageFields[currentStage || record.followupstage] || [],
          formValues: formValues,
          hasUserCleared: false // 重置用户清空标记
        });
        
        // 处理日期字段
        ['moveintime', 'scheduletime'].forEach(field => {
          if (formValues[field]) {
            formValues[field] = dayjs(formValues[field]);
          }
        });
        
        // 确保所有字段都有值
        const currentFields = stageFields[currentStage || record.followupstage] || [];
        currentFields.forEach(field => {
          if (!formValues[field]) {
            if (field === 'budget' || field === 'renttime') {
              formValues[field] = 0;
            } else if (field === 'viewresult') {
              formValues[field] = '待填写';
            } else {
              formValues[field] = '';
            }
          }
        });
        
        // 🆕 记录字段初始化后的最终值
        console.log('🔍 [MobileFollowupStageDrawer] 字段初始化完成', {
          recordId: record.id,
          targetStage: currentStage || record.followupstage,
          finalFormValues: formValues,
          currentFields: currentFields
        });
        
        form.setFieldsValue(formValues);
        
        // 🆕 新增：验证表单值是否正确设置
        setTimeout(() => {
          const actualValues = form.getFieldsValue();
          console.log('🔍 [MobileFollowupStageDrawer] 表单值设置验证', {
            recordId: record.id,
            targetStage: currentStage || record.followupstage,
            expected: {
              userrating: formValues.userrating,
              customerprofile: formValues.customerprofile,
              followupstage: formValues.followupstage
            },
            actual: {
              userrating: actualValues.userrating,
              customerprofile: actualValues.customerprofile,
              followupstage: actualValues.followupstage
            },
            validationPassed: 
              actualValues.userrating === formValues.userrating &&
              actualValues.customerprofile === formValues.customerprofile &&
              actualValues.followupstage === formValues.followupstage
          });
        }, 100);
        
        hasAutoSavedRef.current = false;
        hasManualSavedRef.current = false;
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      
    }
  }, [form, record, open, currentStage, fetchDealsList]); // 🆕 添加 currentStage 依赖

  // 🆕 统一的关闭处理函数 - 包含自动保存逻辑
  const handleUnifiedClose = async () => {
    
    
    if (isClosingRef.current) {
      
      return;
    }
    isClosingRef.current = true;
    
    try {
      // 关闭前自动保存当前表单数据
      
      
      if (record && form && !disableAutoSave) {
        
        
        // 获取当前表单值，不进行验证（避免必填字段验证失败）
        // 🆕 修复：强制同步表单值，确保获取到最新数据
        form.validateFields().catch(() => {}); // 触发字段验证但不处理错误
        
        // 🆕 修复：等待一小段时间确保表单值同步完成
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const values = form.getFieldsValue();
        
        
        // 🆕 处理表单值，确保级联选择器只保存最后一层值
        const processedValues = processFormValues(values);
        
        console.log('🔍 [MobileFollowupStageDrawer] 自动保存 - 表单值获取', {
          recordId: record.id,
          rawValues: values,
          processedValues,
          originalRecord: {
            userbudget: record.userbudget,
            moveintime: record.moveintime
          }
        });
        
        // 🆕 新增：详细检查预算字段的变化
        if (processedValues.userbudget !== undefined) {
          console.log('🔍 [MobileFollowupStageDrawer] 预算字段详细检查', {
            originalUserbudget: record.userbudget,
            currentUserbudget: processedValues.userbudget,
            originalType: typeof record.userbudget,
            currentType: typeof processedValues.userbudget,
            hasChanged: hasValueChanged(record.userbudget, processedValues.userbudget)
          });
        }
        
        
        // 检查是否有实际的数据变化 - 比较原始记录和当前表单值
        let hasChanges = false;
        const changedFields: string[] = [];
        const originalValues = {
          customerprofile: record.customerprofile,
          worklocation: record.worklocation,
          userbudget: record.userbudget,
          moveintime: record.moveintime,
          userrating: record.userrating,
          majorcategory: record.majorcategory,
          followupresult: record.followupresult,
          scheduledcommunity: record.scheduledcommunity,
          scheduletime: record.scheduletime
        };
        
        Object.keys(processedValues).forEach(key => {
          const currentValue = processedValues[key];
          const originalValue = originalValues[key as keyof typeof originalValues];
          
          // 检查值是否发生变化（包括从有值变为空值的情况）
          const hasFieldChanged = hasValueChanged(originalValue, currentValue);
          if (hasFieldChanged) {
            hasChanges = true;
            changedFields.push(key);
            
          }
        });
        
        
        
        if (hasChanges) {
          
          
          // 构建更新对象，包含所有发生变化的字段（包括空值）
          const updateObj: any = {};
          Object.keys(processedValues).forEach(key => {
            const currentValue = processedValues[key];
            const originalValue = originalValues[key as keyof typeof originalValues];
            
            // 如果字段发生了变化，就包含在更新对象中（包括空值）
            if (hasValueChanged(originalValue, currentValue)) {
              updateObj[key] = currentValue;
              
            }
          });
          
          
          
          // 处理日期字段
          ['moveintime', 'scheduletime'].forEach(field => {
            if (updateObj[field] && typeof updateObj[field]?.format === 'function') {
              updateObj[field] = updateObj[field].format('YYYY-MM-DD HH:mm:ss');
              
            }
          });
          
          
          
          // 保存到数据库
          const { error } = await supabase
            .from('followups')
            .update(updateObj)
            .eq('id', record.id);
          
          if (error) {
            
            Toast.show({ content: '数据保存失败，请检查网络连接', position: 'center' });
          } else {

            // 🆕 使用统一的乐观更新函数，传递更新后的记录
            const updatedRecord = { ...record, ...updateObj };
            console.log('🔍 [MobileFollowupStageDrawer] 自动保存完成，触发乐观更新', {
              recordId: record.id,
              updateObj,
              updatedRecord
            });
            triggerOptimisticUpdate(updatedRecord, updateObj, 'auto');
          }
        } else {
          
        }
      } else {
        
      }
    } catch (error: any) {
      
      Toast.show({ content: '自动保存失败，请检查网络连接', position: 'center' });
    } finally {
      
      
      // 重置组件状态
      setCurrentStep(0);
      setCurrentStage('');
      setDealsList([]);
      setDealsLoading(false);
      setAssignShowingLoading(false);
      
      
      // 直接调用父组件的onClose
      onClose();
      
      // 延迟重置关闭状态
      setTimeout(() => {
        isClosingRef.current = false;
      }, 300);
    }
  };



  // 🆕 处理保存 - 参考原页面逻辑，移除不属于followups表的字段
  const handleSave = async (updatedFields: any = {}) => {
    if (!record) {
      Toast.show({ content: '无当前记录，无法保存', position: 'center' });
      return { success: false, error: '无当前记录' };
    }

    try {
      setLoading(true);
      
      // 验证表单
      const values = await form.validateFields();
      
      // 🆕 修复：等待一小段时间确保表单值同步完成
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🆕 处理表单值，确保级联选择器只保存最后一层值
      const processedValues = processFormValues(values);
      
      console.log('🔍 [MobileFollowupStageDrawer] 手动保存 - 表单值获取', {
        recordId: record.id,
        rawValues: values,
        processedValues,
        originalRecord: {
          userbudget: record.userbudget,
          moveintime: record.moveintime
        }
      });
      
      // 🆕 新增：详细检查预算字段的变化
      if (processedValues.userbudget !== undefined) {
        console.log('🔍 [MobileFollowupStageDrawer] 手动保存 - 预算字段详细检查', {
          originalUserbudget: record.userbudget,
          currentUserbudget: processedValues.userbudget,
          originalType: typeof record.userbudget,
          currentType: typeof processedValues.userbudget,
          hasChanged: hasValueChanged(record.userbudget, processedValues.userbudget)
        });
      }
      
      // 格式化日期字段
      ['moveintime', 'scheduletime'].forEach(field => {
        if (processedValues[field] && typeof processedValues[field]?.format === 'function') {
          processedValues[field] = processedValues[field].format('YYYY-MM-DD HH:mm:ss');
        }
      });

      // 从processedValues中移除不属于followups表的字段
      const { ...followupValues } = processedValues;
      
      // 合并额外字段（如阶段推进）
      const updateObj = { ...followupValues, ...updatedFields };

      // 保存到数据库
      const { error } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', record.id);

      if (error) {
        throw error;
      }
      
      // 🆕 标记已手动保存，避免关闭时重复提示
      hasManualSavedRef.current = true;
      
      // 🆕 使用统一的乐观更新函数，传递更新后的记录
      // 确保包含所有最新的表单数据
      const updatedRecord = { ...record, ...updateObj };
      console.log('🔍 [MobileFollowupStageDrawer] 手动保存完成，触发乐观更新', {
        recordId: record.id,
        updateObj,
        updatedRecord
      });
      triggerOptimisticUpdate(updatedRecord, updateObj, 'manual');
      
      Toast.show({ content: '保存成功', position: 'center' });
      return { success: true };
      
    } catch (error: any) {
      console.error('保存失败:', error);
      Toast.show({ 
        content: '保存失败: ' + (error.message || '未知错误'), 
        position: 'center' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // 处理发放带看单
  const handleAssignShowing = async () => {
    if (!record) {
      Toast.show({ content: '无当前记录，无法分配', position: 'center' });
      return;
    }

    try {
      setAssignShowingLoading(true);
      
      // 🆕 记录阶段切换前的状态
      const targetStage = '已到店';
      console.log('🔍 [MobileFollowupStageDrawer] 阶段切换 - 发放带看单', {
        recordId: record?.id,
        fromStage: currentStage,
        toStage: targetStage,
        currentStep: currentStep,
        targetStep: currentStep + 1,
        currentData: {
          followupstage: currentStage,
          customerprofile: record?.customerprofile,
          userrating: record?.userrating,
          userbudget: record?.userbudget
        }
      });
      
      // 这里可以添加发放带看单的逻辑
      // 暂时只是推进到下一阶段
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        console.log('🔍 [MobileFollowupStageDrawer] 阶段切换成功 - 发放带看单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
        
        setCurrentStep(currentStep + 1);
        setCurrentStage(targetStage);
        Toast.show({ content: '已推进到已到店阶段', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 发放带看单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
      }
      
    } catch (error: any) {
      console.error('❌ [MobileFollowupStageDrawer] 阶段切换异常 - 发放带看单', {
        recordId: record?.id,
        fromStage: currentStage,
        error: error.message
      });
      Toast.show({ 
        content: '发放带看单失败: ' + (error.message || '未知错误'), 
        position: 'center' 
      });
    } finally {
      setAssignShowingLoading(false);
    }
  };

  // 处理确认丢单
  const handleConfirmDropout = async () => {
    if (!record) return;
    
    try {
      setLoading(true);
      
      // 🆕 记录阶段切换前的状态
      const targetStage = '丢单';
      console.log('🔍 [MobileFollowupStageDrawer] 阶段切换 - 确认丢单', {
        recordId: record?.id,
        fromStage: currentStage,
        toStage: targetStage,
        currentStep: currentStep,
        currentData: {
          followupstage: currentStage,
          customerprofile: record?.customerprofile,
          userrating: record?.userrating,
          userbudget: record?.userbudget
        }
      });
      
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        console.log('🔍 [MobileFollowupStageDrawer] 阶段切换成功 - 确认丢单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
        Toast.show({ content: '已确认丢单', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 确认丢单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
      }
    } catch (error: any) {
      console.error('❌ [MobileFollowupStageDrawer] 阶段切换异常 - 确认丢单', {
        recordId: record?.id,
        fromStage: currentStage,
        error: error.message
      });
      Toast.show({ 
        content: '确认丢单失败: ' + (error.message || '未知错误'), 
        position: 'center' 
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理恢复状态
  const handleRestoreStatus = async () => {
    if (!record) return;
    
    try {
      setLoading(true);
      
      // 🆕 记录阶段切换前的状态
      const targetStage = '待接收';
      console.log('🔍 [MobileFollowupStageDrawer] 阶段切换 - 恢复状态', {
        recordId: record?.id,
        fromStage: currentStage,
        toStage: targetStage,
        currentStep: currentStep,
        targetStep: 0,
        currentData: {
          followupstage: currentStage,
          customerprofile: record?.customerprofile,
          userrating: record?.userrating,
          userbudget: record?.userbudget
        }
      });
      
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        console.log('🔍 [MobileFollowupStageDrawer] 阶段切换成功 - 恢复状态', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
        
        setCurrentStep(0);
        setCurrentStage(targetStage);
        Toast.show({ content: '已恢复状态', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 恢复状态', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result
        });
      }
    } catch (error: any) {
      console.error('❌ [MobileFollowupStageDrawer] 阶段切换异常 - 恢复状态', {
        recordId: record?.id,
        fromStage: currentStage,
        error: error.message
      });
      Toast.show({ 
        content: '恢复状态失败: ' + (error.message || '未知错误'), 
        position: 'center' 
      });
    } finally {
      setLoading(false);
    }
  };



  // 渲染表单
  const renderForm = () => {
    if (currentStage === '已到店' || currentStage === '赢单') {
      return null;
    }

    if (!currentStage || currentStage === '') {
      return null;
    }

    const currentFields = stageFields[currentStage] || [];
    
    if (currentFields.length === 0) {
      return (
        <div className="border-0 divide-y-0" style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
          <p>当前阶段无需填写额外信息</p>
          <p>点击"下一步"继续推进</p>
        </div>
      );
    }

    return (
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        className="border-0 divide-y-0"
      >
        <MobileFollowupStageForm
          form={form}
          stage={currentStage}
          record={record}
          isFieldDisabled={isFieldDisabled}
          forceUpdate={forceUpdate}
          communityEnum={communityEnum}
          followupstageEnum={followupstageEnum}
          customerprofileEnum={customerprofileEnum}
          userratingEnum={userratingEnum}
          majorCategoryOptions={majorCategoryOptions}
          metroStationOptions={metroStationOptions}
          // 🆕 新增：预算字段变化回调
          onBudgetChange={(value) => {
            console.log('🔍 [MobileFollowupStageDrawer] 预算字段变化', { value });
            // 直接更新表单值，确保自动保存时能获取到最新值
            form.setFieldValue('userbudget', value);
            form.setFieldsValue({ userbudget: value });
            
            // 🆕 新增：强制触发表单值变化事件，确保值同步
            setTimeout(() => {
              form.setFieldsValue({ userbudget: value });
            }, 0);
          }}
        />
      </Form>
    );
  };

  return (
    <Popup
      visible={open}
      onMaskClick={handleUnifiedClose}
      bodyStyle={{
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        minHeight: '80vh',
        maxHeight: '90vh',
        overflow: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        willChange: 'transform'
      }}
      destroyOnClose={false}
      closeOnMaskClick={true}
      className="mobile-followup-drawer"
      maskStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)'
      }}
      position="bottom"
      showCloseButton={false}
    >
      {/* 🆕 修复：恢复必要的flex布局容器 */}
      <div className="border-0 divide-y-0" style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <NavBar
          onBack={handleUnifiedClose}
          className="border-b-0"
          style={{
            flexShrink: 0,
            minHeight: '44px'
          }}
        >
          跟进阶段进度
        </NavBar>

        {/* 🆕 修复：确保滚动区域正确工作 */}
        <div 
          className="content-scroll-area border-0 divide-y-0"
          style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: '0 16px',
            WebkitOverflowScrolling: 'touch',
            minHeight: 0,
            paddingBottom: '20px'
          }}
        >
          {/* 🆕 优化：直接渲染内容，减少包装div */}
          {currentStage === '已到店' && (
            <ContractDealsTable
              dealsList={dealsList}
              dealsLoading={dealsLoading}
              onAdd={() => {
                const newRow: any = {
                  id: `new_${Date.now()}`,
                  leadid: record?.leadid || '',
                  contractdate: dayjs().format('YYYY-MM-DD'),
                  community: '',
                  contractnumber: '',
                  roomnumber: '',
                  created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                  isNew: true,
                  isEditing: true,
                };
                setDealsList((prev: any[]) => [newRow, ...prev]);
              }}
              onEdit={async (dealRecord) => {
                if (dealRecord.isEditing) {
                  if (dealRecord.isNew) {
                    const dealData = {
                      leadid: record?.leadid,
                      contractdate: dealRecord.contractdate || dayjs().format('YYYY-MM-DD'),
                      community: dealRecord.community,
                      contractnumber: dealRecord.contractnumber,
                      roomnumber: dealRecord.roomnumber
                    };
                    const { data: newDeal, error } = await supabase
                      .from('deals')
                      .insert([dealData])
                      .select()
                      .single();
                    if (error) {
                      Toast.show({ content: '创建签约记录失败: ' + error.message, position: 'center' });
                      return;
                    }
                    setDealsList(prev => prev.map(item =>
                      item.id === dealRecord.id
                        ? { ...newDeal, isEditing: false }
                        : item
                    ));
                    Toast.show({ content: '签约记录已保存', position: 'center' });
                    
                    // 推进到赢单阶段
                    const result = await handleSave({ followupstage: '赢单' });
                    if (result && result.success) {
                      setCurrentStep(currentStep + 1);
                      setCurrentStage('赢单');
                      Toast.show({ content: '已推进到赢单阶段', position: 'center' });
                    }
                  } else {
                    const { error } = await supabase
                      .from('deals')
                      .update({
                        contractdate: dealRecord.contractdate,
                        community: dealRecord.community,
                        contractnumber: dealRecord.contractnumber,
                        roomnumber: dealRecord.roomnumber
                      })
                      .eq('id', dealRecord.id);
                    if (error) {
                      Toast.show({ content: '更新签约记录失败: ' + error.message, position: 'center' });
                      return;
                    }
                    setDealsList(prev => prev.map(item =>
                      item.id === dealRecord.id
                        ? { ...item, isEditing: false }
                        : item
                    ));
                    Toast.show({ content: '签约记录已更新', position: 'center' });
                  }
                } else {
                  setDealsList(prev => prev.map(item =>
                    item.id === dealRecord.id
                      ? { ...item, isEditing: true }
                      : item
                  ));
                }
              }}
              onDelete={(dealRecord) => {
                if (dealRecord.isNew) {
                  setDealsList(prev => prev.filter(item => item.id !== dealRecord.id));
                } else {
                  setDealsList(prev => prev.map(item =>
                    item.id === dealRecord.id
                      ? { ...item, isEditing: false }
                      : item
                  ));
                }
              }}
              currentRecord={record}
              communityEnum={communityEnum}
              setDealsList={setDealsList}
            />
          )}
          
          {/* 🆕 修复：确保表单可以正常滚动 */}
          {renderForm()}
        </div>
        
        {/* 🆕 固定底部按钮组 */}
        <div 
          className="fixed-footer border-0 divide-y-0"
          style={{
            flexShrink: 0,
            padding: '16px',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: 'white',
            boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Space direction="vertical" block className="button-group border-0 divide-y-0">
            {/* 🆕 上一步按钮 - 使用统一的保存逻辑 */}
            {currentStage !== '丢单' && currentStep > 0 && (
              <Button
                block
                onClick={async () => {
                  try {
                    if (!record) {
                      Toast.show({ content: '无当前记录，无法保存', position: 'center' });
                      return;
                    }
                    
                    // 🆕 记录阶段切换前的状态
                    const targetStage = followupStages[currentStep - 1];
                    console.log('🔍 [MobileFollowupStageDrawer] 阶段切换 - 上一步', {
                      recordId: record?.id,
                      fromStage: currentStage,
                      toStage: targetStage,
                      currentStep: currentStep,
                      targetStep: currentStep - 1,
                      currentData: {
                        followupstage: currentStage,
                        customerprofile: record?.customerprofile,
                        userrating: record?.userrating,
                        userbudget: record?.userbudget
                      }
                    });
                    
                    // 🆕 使用统一的保存逻辑
                    const result = await handleSave({ followupstage: targetStage });
                    
                    if (result && result.success) {
                      console.log('🔍 [MobileFollowupStageDrawer] 阶段切换成功 - 上一步', {
                        recordId: record?.id,
                        fromStage: currentStage,
                        toStage: targetStage,
                        saveResult: result
                      });
                      
                      setCurrentStep(currentStep - 1);
                      setCurrentStage(targetStage);
                      Toast.show({ content: '已回退到上一阶段', position: 'center' });
                    } else {
                      console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 上一步', {
                        recordId: record?.id,
                        fromStage: currentStage,
                        toStage: targetStage,
                        saveResult: result
                      });
                    }
                    
                  } catch (error: any) {
                    console.error('❌ [MobileFollowupStageDrawer] 阶段切换异常 - 上一步', {
                      recordId: record?.id,
                      fromStage: currentStage,
                      error: error.message
                    });
                    Toast.show({ 
                      content: '保存失败: ' + (error.message || '未知错误'), 
                      position: 'center' 
                    });
                  }
                }}
                className="touch-feedback border-0 divide-y-0"
              >
                上一步
              </Button>
            )}

            {/* 发放带看单按钮 */}
            {currentStage === '邀约到店' && (
              <Button
                block
                color="primary"
                onClick={handleAssignShowing}
                loading={assignShowingLoading}
                disabled={assignShowingLoading}
                className="touch-feedback border-0 divide-y-0"
              >
                {assignShowingLoading ? '分配中...' : '发放带看单'}
              </Button>
            )}

            {/* 丢单阶段的特殊按钮 */}
            {currentStage === '丢单' && (
              <Space direction="vertical" block className="border-0 divide-y-0">
                <Button
                  block
                  color="danger"
                  onClick={handleConfirmDropout}
                  disabled={isFieldDisabled()}
                  className="touch-feedback border-0 divide-y-0"
                >
                  确认丢单
                </Button>
                <Button
                  block
                  onClick={handleRestoreStatus}
                  disabled={isFieldDisabled()}
                  className="touch-feedback border-0 divide-y-0"
                >
                  恢复状态
                </Button>
              </Space>
            )}

            {/* 🆕 下一步按钮 - 使用统一的保存逻辑 */}
            {currentStep < followupStages.length - 1 && 
             currentStage !== '已到店' && 
             currentStage !== '丢单' && (
              <Button
                block
                color="primary"
                loading={loading}
                onClick={async () => {
                  try {
                    if (!record) {
                      Toast.show({ content: '无当前记录，无法保存', position: 'center' });
                      return;
                    }
                    
                    // 🆕 记录阶段切换前的状态
                    const targetStage = followupStages[currentStep + 1];
                    console.log('🔍 [MobileFollowupStageDrawer] 阶段切换 - 下一步', {
                      recordId: record?.id,
                      fromStage: currentStage,
                      toStage: targetStage,
                      currentStep: currentStep,
                      targetStep: currentStep + 1,
                      currentData: {
                        followupstage: currentStage,
                        customerprofile: record?.customerprofile,
                        userrating: record?.userrating,
                        userbudget: record?.userbudget
                      }
                    });
                    
                    // 🆕 使用统一的保存逻辑
                    const result = await handleSave({ followupstage: targetStage });
                    
                    if (result && result.success) {
                      console.log('🔍 [MobileFollowupStageDrawer] 阶段切换成功 - 下一步', {
                        recordId: record?.id,
                        fromStage: currentStage,
                        toStage: targetStage,
                        saveResult: result
                      });
                      
                      setCurrentStep(currentStep + 1);
                      setCurrentStage(targetStage);
                      Toast.show({ content: '已推进到下一阶段', position: 'center' });
                    } else {
                      console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 下一步', {
                        recordId: record?.id,
                        fromStage: currentStage,
                        toStage: targetStage,
                        saveResult: result
                      });
                    }
                    
                  } catch (error: any) {
                    console.error('❌ [MobileFollowupStageDrawer] 阶段切换异常 - 下一步', {
                      recordId: record?.id,
                      fromStage: currentStage,
                      error: error.message
                    });
                    Toast.show({ 
                      content: '推进失败: ' + (error.message || '请完整填写所有必填项'), 
                      position: 'center' 
                    });
                  }
                }}
                className="touch-feedback border-0 divide-y-0"
              >
                下一步
              </Button>
            )}

            {/* 完成按钮 */}
            {currentStep === followupStages.length - 1 && (
              <Button
                block
                color="primary"
                onClick={() => {
                  Toast.show({ content: '跟进阶段管理完成', position: 'center' });
                  handleUnifiedClose();
                }}
                className="touch-feedback border-0 divide-y-0"
              >
                完成
              </Button>
              )}
          </Space>
        </div>
      </div>
    </Popup>
  );
};
