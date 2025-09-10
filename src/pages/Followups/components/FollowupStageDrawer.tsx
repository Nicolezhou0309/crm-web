import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Steps, Form, Button, message, Typography, Space, Divider, Tag } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { supabase } from '../../../supaClient';
import dayjs from 'dayjs';
import { toBeijingDateStr, toBeijingDateTimeStr } from '../../../utils/timeUtils';
// import { useUser } from '../../../context/UserContext';
import type { FollowupRecord } from '../types';
import { FollowupStageForm } from './FollowupStageForm';
import { ContractDealsTable } from '../../../components/Followups/ContractDealsTable';
import { ContractSelectionModal } from '../../../components/Followups/ContractSelectionModal';
import { createDealFromContract, testDealsTable, reassociateDeal } from '../../../api/dealsApi';
import './FollowupStageDrawer.css';

const { Paragraph } = Typography;

interface FollowupStageDrawerProps {
  open: boolean;
  onClose: () => void;
  record: FollowupRecord | null;
  onSave?: (record: FollowupRecord, updatedFields: any) => void;
  isFieldDisabled?: () => boolean;
  forceUpdate?: number;
  // 枚举数据
  communityEnum: any[];
  followupstageEnum: any[];
  customerprofileEnum: any[];
  userratingEnum: any[];
  majorCategoryOptions: any[];
  metroStationOptions: any[];
  // 禁用自动保存
  disableAutoSave?: boolean;
}

// 跟进阶段配置 - 参考旧页面逻辑
const followupStages = ['丢单', '待接收', '确认需求', '邀约到店', '已到店', '赢单'];

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

// 🆕 处理表单值，确保级联选择器只保存最后一层值
const processFormValues = (values: any): any => {
  const processedValues = { ...values };
  
  // 处理级联选择器字段
  ['worklocation', 'majorcategory'].forEach(field => {
    if (processedValues[field] && Array.isArray(processedValues[field])) {
      processedValues[field] = processCascaderValue(processedValues[field], field);
    }
  });
  
  return processedValues;
};

// 🆕 验证更新对象，确保数据有效性
const validateUpdateObject = (updateObj: any, recordId: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // 检查 ID 是否存在
  if (!recordId) {
    errors.push('记录ID不能为空');
  }
  
  // 检查更新对象是否为空
  if (!updateObj || Object.keys(updateObj).length === 0) {
    errors.push('更新对象不能为空');
  }
  
  // 检查每个字段的值
  Object.entries(updateObj).forEach(([key, value]) => {
    // 检查是否有循环引用
    try {
      JSON.stringify(value);
    } catch (e) {
      errors.push(`字段 ${key} 包含循环引用`);
    }
    
    // 检查日期字段格式
    if (key === 'moveintime' || key === 'scheduletime') {
      if (value && typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`字段 ${key} 的日期格式无效: ${value}`);
        }
      }
    }
    
    // 检查数字字段
    if (key === 'userbudget') {
      if (value !== null && value !== undefined && value !== '' && isNaN(Number(value))) {
        errors.push(`字段 ${key} 必须是数字: ${value}`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const FollowupStageDrawer: React.FC<FollowupStageDrawerProps> = ({
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
}) => {
  // const { profile } = useUser(); // 暂时不使用
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>(followupStages[1]); // 默认为'待接收'
  const [loading, setLoading] = useState(false);
  
  // 🆕 发放带看单相关状态
  const [assignShowingLoading, setAssignShowingLoading] = useState(false);
  const [enableManualAssign, setEnableManualAssign] = useState(false);
  
  // 🆕 签约记录相关状态 - 参考原页面逻辑
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  
  // 🆕 签约选择弹窗状态
  const [contractSelectionOpen, setContractSelectionOpen] = useState(false);
  
  // 🆕 防止重复关闭的状态
  const [isClosing, setIsClosing] = useState(false);
  
  // 🆕 防止重复保存的状态 - 使用useRef避免重新渲染时丢失
  const hasAutoSavedRef = useRef(false);
  
  // 🆕 统一的关闭处理状态
  const isClosingRef = useRef(false);
  
  // 🆕 手动保存状态 - 用于避免重复的保存成功提示
  const hasManualSavedRef = useRef(false);

  // 当记录变化时，重置表单和步骤
  useEffect(() => {
    if (record && open) {
      // 设置当前阶段和步骤
      const stageIndex = followupStages.findIndex(stage => stage === record.followupstage);
      setCurrentStep(Math.max(0, stageIndex));
      setCurrentStage(record.followupstage || '待接收');
      
      // 只在已到店和赢单阶段获取签约记录
      if (record.followupstage === '已到店' || record.followupstage === '赢单') {
        fetchDealsList();
      } else {
        // 其他阶段清空成交数据
        setDealsList([]);
      }
      
      // 🆕 重置自动保存标记，确保每次打开都能正常保存
      hasAutoSavedRef.current = false;
      
      // 🆕 重置统一关闭标记
      isClosingRef.current = false;
      
      // 🆕 重置手动保存标记
      hasManualSavedRef.current = false;
    }
  }, [record, open]); // 移除form依赖，避免无限循环

  // 监听阶段变化，在需要时获取成交数据
  useEffect(() => {
    if (record && open && (currentStage === '已到店' || currentStage === '赢单')) {
      fetchDealsList();
    } else if (record && open) {
      // 其他阶段清空成交数据
      setDealsList([]);
    }
  }, [currentStage, record, open]);

  // 监听form实例变化，确保表单正确初始化
  useEffect(() => {
    if (form && record && open) {
      // 延迟设置表单值，确保form实例已完全初始化
      const timer = setTimeout(() => {
        // 设置表单初始值，只包含 followups 表中实际存在的字段
        const formValues: any = {
          // 基本字段
          id: record.id,
          leadid: record.leadid,
          followupstage: record.followupstage,
          phone: record.phone,
          wechat: record.wechat,
          source: record.source,
          created_at: record.created_at,
          // 当前阶段需要的字段
          customerprofile: record.customerprofile,
          worklocation: record.worklocation,
          userbudget: record.userbudget,
          moveintime: record.moveintime,
          userrating: record.userrating,
          majorcategory: record.majorcategory,
          followupresult: record.followupresult,
          scheduledcommunity: record.scheduledcommunity,
          scheduletime: record.scheduletime
          // 移除可能不存在的字段：remark, leadtype, invalid
        };
        
        // 处理日期字段
        ['moveintime', 'scheduletime'].forEach(field => {
          if (formValues[field]) {
            formValues[field] = dayjs(formValues[field]);
          }
        });
        
        // 确保所有字段都有值，避免验证失败
        const currentFields = stageFields[record.followupstage] || [];
        currentFields.forEach(field => {
          if (!formValues[field]) {
            // 根据字段类型设置默认值
            if (field === 'budget' || field === 'renttime') {
              formValues[field] = 0;
            } else if (field === 'viewresult') {
              formValues[field] = '待填写';
            } else {
              formValues[field] = '';
            }
          }
        });
        
        form.setFieldsValue(formValues);
        
        // 🆕 表单初始化完成后，重置自动保存标记
        hasAutoSavedRef.current = false;
        
        // 🆕 表单初始化完成后，重置手动保存标记
        hasManualSavedRef.current = false;
      }, 300); // 进一步增加延迟时间，确保表单组件完全渲染和字段绑定
      
      return () => clearTimeout(timer);
    }
  }, [form, record, open]);

  // 移除重复的useEffect，避免竞争条件
  
  // 🆕 移除复杂的表单监听逻辑，直接在handleClose中处理
  
  // 🆕 统一的关闭处理函数 - 包含自动保存逻辑
  const handleUnifiedClose = async () => {
    
    try {
      // 关闭前自动保存当前表单数据
      if (record && form) {
        
        // 获取当前表单值，不进行验证（避免必填字段验证失败）
        const values = form.getFieldsValue();
        
        // 🆕 处理表单值，确保级联选择器只保存最后一层值
        const processedValues = processFormValues(values);
        
        // 检查是否有实际的数据变化
        let hasChanges = false;
        Object.keys(processedValues).forEach(key => {
          if (processedValues[key] !== undefined && processedValues[key] !== null && processedValues[key] !== '') {
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          
          // 构建更新对象，只包含有值的字段
          const updateObj: any = {};
          Object.keys(processedValues).forEach(key => {
            if (processedValues[key] !== undefined && processedValues[key] !== null && processedValues[key] !== '') {
              updateObj[key] = processedValues[key];
            }
          });
          
          // 处理日期字段
          ['moveintime', 'scheduletime'].forEach(field => {
            if (updateObj[field] && typeof updateObj[field]?.format === 'function') {
              updateObj[field] = updateObj[field].format('YYYY-MM-DD HH:mm:ss');
            }
          });
          
          // 🆕 检查工作地点是否更新，如果更新则自动触发通勤时间计算
          const originalWorklocation = record.worklocation;
          const newWorklocation = updateObj.worklocation;
          const worklocationChanged = newWorklocation && newWorklocation !== originalWorklocation;
          
          // 验证更新对象
          const validation = validateUpdateObject(updateObj, record.id);
          if (!validation.isValid) {
            console.error('❌ [自动保存数据验证失败] 更新对象验证失败:', validation.errors);
            message.warning(`数据验证失败: ${validation.errors.join(', ')}`);
            return;
          }
          
          // 保存到数据库，添加详细错误日志
          console.log('🔍 [调试] 自动保存请求参数:', {
            table: 'followups',
            id: record.id,
            updateObj: updateObj,
            updateObjKeys: Object.keys(updateObj)
          });
          
          const { error, data } = await supabase
            .from('followups')
            .update(updateObj)
            .eq('id', record.id)
            .select();
          
          if (error) {
            console.error('❌ [自动保存错误] 详细错误信息:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
              requestParams: {
                table: 'followups',
                id: record.id,
                updateObj: updateObj
              }
            });
            message.warning('数据保存失败，请检查网络连接');
          } else {
            console.log('✅ [自动保存成功] 更新成功:', data);
            // 只有在没有手动保存过的情况下才显示自动保存提示
            if (!hasManualSavedRef.current) {
              message.success('数据已自动保存');
            } else {
            }
            
            // 🆕 如果工作地点更新，自动触发通勤时间计算
            if (worklocationChanged) {
              console.log(`🚀 [FollowupStageDrawer] 关闭抽屉时工作地点更新，开始自动通勤时间计算`);
              
              // 延迟1秒后触发通勤时间计算，确保数据库更新完成
              setTimeout(async () => {
                try {
                  const { error: commuteError } = await supabase.rpc('calculate_commute_times_for_worklocation', {
                    p_followup_id: record.id,
                    p_worklocation: newWorklocation
                  });
                  
                  if (commuteError) {
                    console.error('❌ [FollowupStageDrawer] 关闭抽屉时自动通勤时间计算失败:', commuteError);
                  } else {
                    console.log('✅ [FollowupStageDrawer] 关闭抽屉时自动通勤时间计算已触发');
                  }
                } catch (error) {
                  console.error('❌ [FollowupStageDrawer] 关闭抽屉时自动通勤时间计算异常:', error);
                }
              }, 1000);
            }
            
            // 通知父组件数据已更新，但不触发额外保存
            // 只刷新数据，不再次保存
            if (onSave) {
              // 传递一个标记，告诉父组件这是关闭时的自动保存，不需要再次保存
              onSave(record, { ...updateObj, _autoSaveOnClose: true });
            }
          }
        } else {
        }
      } else {
      }
    } catch (error: any) {
      message.warning('自动保存失败，请检查网络连接');
    } finally {
      
      // 重置组件状态
      setCurrentStep(0);
      setCurrentStage('');
      setDealsList([]);
      setDealsLoading(false);
      setAssignShowingLoading(false);
      setEnableManualAssign(false);
      
      // 直接调用父组件的onClose
      onClose();
    }
  };

  // 处理步骤切换 - 参考旧页面逻辑，只允许回到第一步
  const handleStepChange = (step: number) => {
    if (step === 0) {
      setCurrentStep(step);
      setCurrentStage(followupStages[step]);
      if (record) {
        // 延迟设置表单值，确保表单组件完全渲染
        const timer = setTimeout(() => {
          // 只设置基本字段，避免字段不存在的问题
          const formValues: any = {
            id: record.id,
            leadid: record.leadid,
            followupstage: followupStages[step],
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
            // 移除可能不存在的字段：remark, leadtype, invalid
          };
          
          ['moveintime', 'scheduletime'].forEach(field => {
            if (formValues[field]) {
              formValues[field] = dayjs(formValues[field]);
            }
          });
          
          form.setFieldsValue(formValues);
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  };

  // 🆕 处理分配模式切换 - 参考旧页面逻辑
  const handleAllocationModeChange = (checked: boolean) => {
    setEnableManualAssign(checked);
    if (checked) {
      // 手动分配模式：清空带看人员选择，保留其他字段
      form.setFieldsValue({ assigned_showingsales: undefined });
    } else {
      // 自动分配模式：清空带看人员选择
      form.setFieldsValue({ assigned_showingsales: undefined });
    }
  };

  // 🆕 获取签约记录 - 参考原页面逻辑
  const fetchDealsList = async () => {
    if (!record?.leadid) return;
    
    setDealsLoading(true);
    try {
      // 先测试 deals 表是否存在
      const tableTest = await testDealsTable();
      if (!tableTest.exists) {
        console.error('deals 表不存在或无法访问:', tableTest.error);
        message.error('deals 表不存在或无法访问');
        return;
      }

      // 查询指定 leadid 的记录
      const { data, error } = await supabase
        .from('deals')
        .select('id, leadid, contract_records')
        .eq('leadid', record.leadid)
        .limit(10);
      
      if (error) {
        console.error('获取签约记录失败:', error);
        console.error('错误详情:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        message.error('获取签约记录失败: ' + error.message);
        return;
      }
      
      console.log('获取到的签约记录:', data);
      setDealsList(data || []);
    } catch (error) {
      console.error('获取签约记录异常:', error);
      message.error('获取签约记录失败');
    } finally {
      setDealsLoading(false);
    }
  };

  // 🆕 处理签约记录选择（支持批量创建和重新关联）
  const handleContractSelection = async (contractRecords: any[]) => {
    if (!record?.leadid) {
      message.error('缺少线索ID');
      return;
    }

    if (!contractRecords || contractRecords.length === 0) {
      message.warning('请选择至少一条签约记录');
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      if (reassociatingDealId) {
        // 重新关联模式：只选择一条记录
        if (contractRecords.length > 1) {
          message.warning('重新关联只能选择一条记录');
          return;
        }

        const contractRecord = contractRecords[0];
        try {
          // 使用专门的重新关联函数
          const updatedDeal = await reassociateDeal(reassociatingDealId, contractRecord.id);
          
          message.success('重新关联成功');
          // 刷新签约记录列表
          await fetchDealsList();
          // 重置重新关联状态
          setReassociatingDealId(null);
        } catch (error) {
          console.error('❌ [重新关联] 重新关联异常:', error);
          const errorMessage = error instanceof Error ? error.message : '重新关联失败';
          message.error(`重新关联失败: ${errorMessage}`);
        }
      } else {
        // 批量创建模式
        for (const contractRecord of contractRecords) {
          try {
            const newDeal = await createDealFromContract(contractRecord, record.leadid);
            if (newDeal) {
              successCount++;
            }
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : '创建失败';
            errors.push(`业务编号 ${contractRecord.business_number}: ${errorMessage}`);
          }
        }

        // 显示结果
        if (successCount > 0) {
          message.success(`成功创建 ${successCount} 条签约记录`);
          // 刷新签约记录列表
          await fetchDealsList();
        }

        if (errorCount > 0) {
          message.error(`创建失败 ${errorCount} 条记录: ${errors.join('; ')}`);
        }
      }

    } catch (error) {
      console.error('处理签约记录失败:', error);
      message.error('处理签约记录失败');
    }
  };

  // 🆕 处理重新关联成交记录
  const handleReassociateDeal = (dealRecord: any) => {
    // 打开签约记录选择弹窗，用于重新关联
    setContractSelectionOpen(true);
    // 保存当前要重新关联的记录ID，用于后续处理
    setReassociatingDealId(dealRecord.id);
  };

  // 🆕 处理编辑成交记录
  const handleEditDeal = (dealRecord: any) => {
    // 使用重新关联功能作为编辑功能
    // 未来可以创建专门的编辑弹窗
    handleReassociateDeal(dealRecord);
  };

  // 🆕 重新关联的deals记录ID状态
  const [reassociatingDealId, setReassociatingDealId] = useState<string | null>(null);

  // 🆕 发放带看单 - 手动分配模式下不需要预约社区
  const handleAssignShowing = async () => {
    if (isFieldDisabled()) return;
    if (!record) return;
    
    // 防止重复点击
    if (assignShowingLoading) {
      return;
    }
    
    setAssignShowingLoading(true);
    
    try {
      const values = await form.validateFields();
      
      if (enableManualAssign) {
        // 手动分配模式 - 只需要带看人员和预约时间
        const assignedUserId = values.assigned_showingsales;
        if (!assignedUserId) {
          message.error('请选择带看人员');
          return;
        }
        
        // 手动分配模式下，预约社区可选，用于记录目的
        const community = values.scheduledcommunity || null;
        
        // 获取选中人员的昵称
        let nickname = String(assignedUserId);
        try {
          const { data: userData } = await supabase
            .from('users_profile')
            .select('nickname')
            .eq('id', assignedUserId)
            .single();
          nickname = userData?.nickname || String(assignedUserId);
        } catch (error) {
        }
        
        // 手动分配模式下，直接使用指定的人员ID
        const assignedUserIdResult = assignedUserId;
        
        // 验证人员ID
        if (!assignedUserIdResult) {
          message.error('带看人员选择无效');
          return;
        }
        
        // 新增showings记录
        const insertParams = {
          leadid: record.leadid,
          scheduletime: values.scheduletime ? dayjs(values.scheduletime).toISOString() : null,
          community,
          showingsales: assignedUserIdResult,
          // 添加默认值
          viewresult: '待填写',
          budget: 0,
          moveintime: dayjs().add(1, 'month').toISOString(),
          remark: '',
          renttime: 12
        };
        
        const { error: insertError } = await supabase.from('showings').insert(insertParams).select();
        if (insertError) {
          message.error('发放带看单失败: ' + insertError.message);
          return;
        }
        
        // 推进到"已到店"阶段
        const result = await handleSave({ followupstage: '已到店' });
        
        if (result && result.success) {
          setCurrentStep(currentStep + 1);
          setCurrentStage('已到店');
          message.success(`带看单已发放，分配给 ${nickname}`);
        } else {
          message.error('推进阶段失败: ' + (result?.error || '未知错误'));
        }
      } else {
        // 自动分配模式 - 需要预约社区
        const community = values.scheduledcommunity || null;
        if (!community) {
          message.error('请先选择预约社区');
          return;
        }
        
        // 1. 调用分配函数
        const { data: assignedUserId, error } = await supabase.rpc('assign_showings_user', { p_community: community });
        
        if (error || !assignedUserId) {
          message.error('分配带看人员失败: ' + (error?.message || '无可用人员'));
          return;
        }
        
        // 2. 查询成员昵称
        let nickname = '';
        if (assignedUserId) {
          const { data: userData } = await supabase
            .from('users_profile')
            .select('nickname')
            .eq('id', assignedUserId)
            .single();
          nickname = userData?.nickname || String(assignedUserId);
        }
        
        // 3. 新增showings记录
        const insertParams = {
          leadid: record.leadid,
          scheduletime: values.scheduletime ? dayjs(values.scheduletime).toISOString() : null,
          community,
          showingsales: assignedUserId,
        };
        
        const { error: insertError } = await supabase.from('showings').insert(insertParams).select();
        if (insertError) {
          message.error('发放带看单失败: ' + insertError.message);
          return;
        }
        
        // 4. 推进到"已到店"阶段
        const result = await handleSave({ followupstage: '已到店' });
        
        if (result && result.success) {
          setCurrentStep(currentStep + 1);
          setCurrentStage('已到店');
          message.success(`带看单已发放，分配给 ${nickname}`);
        } else {
          message.error('推进阶段失败: ' + (result?.error || '未知错误'));
        }
      }
    } catch (error: any) {
      console.error('❌ [带看分配] 分配过程中发生错误', error);
      message.error('分配过程中发生错误: ' + (error.message || '未知错误'));
    } finally {
      setAssignShowingLoading(false);
    }
  };

  // 处理保存 - 参考原页面逻辑，移除不属于followups表的字段
  const handleSave = async (additionalFields?: any) => {
    if (!record) return;
    
    try {
      setLoading(true);
      
      // 验证表单
      const values = await form.validateFields();
      
      // 🆕 处理表单值，确保级联选择器只保存最后一层值
      const processedValues = processFormValues(values);
      
      // 格式化日期字段
      ['moveintime', 'scheduletime'].forEach(field => {
        if (processedValues[field] && typeof processedValues[field]?.format === 'function') {
          processedValues[field] = processedValues[field].format('YYYY-MM-DD HH:mm:ss');
        }
      });

      // 从processedValues中移除不属于followups表的字段
      const { assigned_showingsales, ...followupValues } = processedValues;
      
      // 合并额外字段（如阶段推进）
      const updateObj = { ...followupValues, ...additionalFields };
      
      // 🆕 检查是否是阶段推进操作
      const isStageChange = additionalFields && additionalFields.followupstage;
      if (isStageChange) {
        updateObj._stageChange = true;
      }

      // 🆕 检查工作地点是否更新，如果更新则自动触发通勤时间计算
      const originalWorklocation = record.worklocation;
      const newWorklocation = updateObj.worklocation;
      const worklocationChanged = newWorklocation && newWorklocation !== originalWorklocation;

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
      
      // 通知父组件更新 - 使用乐观更新
      if (onSave) {
        onSave(record, updateObj);
      }
      
      // 🆕 如果工作地点更新，自动触发通勤时间计算
      if (worklocationChanged) {
        console.log(`🚀 [FollowupStageDrawer] 保存成功，开始自动通勤时间计算`);
        
        // 延迟1秒后触发通勤时间计算，确保数据库更新完成
        setTimeout(async () => {
          try {
            const { error: commuteError } = await supabase.rpc('calculate_commute_times_for_worklocation', {
              p_followup_id: record.id,
              p_worklocation: newWorklocation
            });
            
            if (commuteError) {
              console.error('❌ [FollowupStageDrawer] 自动通勤时间计算失败:', commuteError);
            } else {
              console.log('✅ [FollowupStageDrawer] 自动通勤时间计算已触发');
            }
          } catch (error) {
            console.error('❌ [FollowupStageDrawer] 自动通勤时间计算异常:', error);
          }
        }, 1000);
      }
      
      // 如果没有额外字段，则不自动关闭抽屉
      // 让调用者决定是否关闭，避免重复保存
      // if (!additionalFields) {
      //   onClose();
      // }
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || '未知错误';
      message.error('保存失败: ' + errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // 🆕 处理需要保存的关闭场景（如确认丢单、恢复状态等）
  const handleClose = async () => {
    // 防止重复调用
    if (isClosing) return;

    
    try {
      setIsClosing(true);
      
      // 这里可以添加特定的保存逻辑，如果需要的话
      // 目前直接调用统一关闭处理函数
      
    } catch (error: any) {
      console.error('❌ [handleClose] 执行过程中发生错误:', error);
    } finally {
      
      // 重置关闭状态
      setIsClosing(false);
      
      // 调用统一关闭处理函数
      handleUnifiedClose();
    }
  };

  // 🆕 确认丢单处理函数 - 参考旧页面逻辑
  const handleConfirmDropout = async () => {
    if (!record) return;
    
    try {
      // 验证表单（丢单需要填写丢单原因）
      await form.validateFields();
      const result = await handleSave({ followupstage: '丢单' });
      
      if (result && result.success) {
        handleClose();
        message.success('已确认丢单');
      } else {
        message.error('确认丢单失败: ' + (result?.error || '未知错误'));
      }
    } catch (error) {
      message.error('请完整填写所有必填项');
    }
  };

  // 🆕 恢复状态处理函数 - 参考旧页面逻辑，不验证表单字段
  const handleRestoreStatus = async () => {
    if (!record) return;
    
    try {
      setLoading(true);
      
      // 直接更新状态到待接收，不验证表单字段
      const updateObj = { followupstage: '待接收' };

      // 保存到数据库
      const { error } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', record.id);

      if (error) {
        throw error;
      }

      // 通知父组件更新
      if (onSave) {
        onSave(record, updateObj);
      }
      
      handleClose();
      message.success('已恢复状态');
      
    } catch (error: any) {
      message.error('恢复状态失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title="跟进阶段进度"
      placement="bottom"
      open={open}
      onClose={handleUnifiedClose}
      destroyOnHidden
      height="60vh"
      className="followup-stage-drawer"
      maskClosable={true}
      footer={
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row',
          gap: '8px',
          justifyContent: 'flex-end'
        }}>
          {/* 取消按钮 */}
          <Button onClick={handleUnifiedClose}>
            取消
          </Button>
          
          {/* 上一步按钮 */}
          {currentStage !== '丢单' && currentStep > 0 && (
            <Button
              disabled={currentStep === 0}
              size="middle"
              onClick={async () => {
                // 上一步前保存当前数据
                try {
                  if (!record) {
                    message.error('无当前记录，无法保存');
                    return;
                  }
                  
                  // 先获取当前表单值，不进行验证（避免必填字段验证失败）
                  const values = form.getFieldsValue();
                  
                  // 🆕 处理表单值，确保级联选择器只保存最后一层值
                  const processedValues = processFormValues(values);
                  
                  // 构建更新对象，只包含有值的字段
                  const updateObj: any = {};
                  Object.keys(processedValues).forEach(key => {
                    if (processedValues[key] !== undefined && processedValues[key] !== null && processedValues[key] !== '') {
                      updateObj[key] = processedValues[key];
                    }
                  });
                  
                  // 处理日期字段
                  ['moveintime', 'scheduletime'].forEach(field => {
                    if (updateObj[field] && typeof updateObj[field]?.format === 'function') {
                      updateObj[field] = updateObj[field].format('YYYY-MM-DD HH:mm:ss');
                    }
                  });
                  
                  // 更新阶段
                  updateObj.followupstage = followupStages[currentStep - 1];
                  
                  
                  // 保存到数据库
                  const { error } = await supabase
                    .from('followups')
                    .update(updateObj)
                    .eq('id', record.id);
                  
                  if (error) {
                    console.error('上一步保存失败:', error);
                    throw error;
                  }
                  
                  // 更新步骤和阶段
                  setCurrentStep(currentStep - 1);
                  setCurrentStage(followupStages[currentStep - 1]);
                  
                  // 通知父组件更新
                  if (onSave) {
                    onSave(record, updateObj);
                  }
                  
                  // 延迟设置表单值，确保表单组件完全渲染
                  const timer = setTimeout(() => {
                    const formValues: any = {
                      id: record.id,
                      leadid: record.leadid,
                      followupstage: followupStages[currentStep - 1],
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
                    
                    ['moveintime', 'scheduletime'].forEach(field => {
                      if (formValues[field]) {
                        formValues[field] = dayjs(formValues[field]);
                      }
                    });
                    
                    form.setFieldsValue(formValues);
                  }, 100);
                  
                  message.success('已回退到上一阶段');
                  
                } catch (error: any) {
                  message.error('保存失败: ' + (error.message || '未知错误'));
                }
              }}
            >
              上一步
            </Button>
          )}
          
          {/* 🆕 发放带看单按钮 - 仅在邀约到店阶段显示 */}
          {currentStage === '邀约到店' && (
            <Button
              type="primary"
              onClick={handleAssignShowing}
              loading={assignShowingLoading}
              disabled={assignShowingLoading}
              size="middle"
            >
              {assignShowingLoading ? '分配中...' : '发放带看单'}
            </Button>
          )}

          {/* 🆕 丢单阶段的特殊按钮 - 参考旧页面逻辑 */}
          {currentStage === '丢单' && (
            <>
              <Button
                danger
                onClick={handleConfirmDropout}
                disabled={isFieldDisabled()}
                size="middle"
              >
                确认丢单
              </Button>
              <Button
                onClick={handleRestoreStatus}
                disabled={isFieldDisabled()}
                size="middle"
              >
                恢复状态
              </Button>
            </>
          )}

          {/* 下一步按钮 */}
          {currentStep < followupStages.length - 1 && 
           currentStage !== '已到店' && 
           currentStage !== '丢单' && (
            <Button
              type="primary"
              loading={loading}
              size="middle"
              onClick={async () => {
                // 下一步前自动保存并校验表单
                try {
                  if (!record) {
                    message.error('无当前记录，无法保存');
                    return;
                  }
                  
                  // 邀约到店阶段特殊处理：只需要预约到店时间
                  if (currentStage === '邀约到店') {
                    const scheduletime = form.getFieldValue('scheduletime');
                    if (!scheduletime) {
                      message.error('请先选择预约到店时间');
                      return;
                    }
                    
                    // 构建更新对象，只包含预约时间
                    const updateObj = {
                      scheduletime: dayjs(scheduletime).toISOString(),
                      followupstage: followupStages[currentStep + 1]
                    };
                    
                    
                    // 保存到数据库
                    const { error } = await supabase
                      .from('followups')
                      .update(updateObj)
                      .eq('id', record.id);
                    
                    if (error) {
                      console.error('邀约到店阶段推进失败:', error);
                      throw error;
                    }
                    
                    // 更新步骤和阶段
                    setCurrentStep(currentStep + 1);
                    setCurrentStage(followupStages[currentStep + 1]);
                    
                    // 通知父组件更新
                    if (onSave) {
                      onSave(record, updateObj);
                    }
                    
                    // 延迟设置表单值，确保表单组件完全渲染
                    const timer = setTimeout(() => {
                      const formValues: any = {
                        id: record.id,
                        leadid: record.leadid,
                        followupstage: followupStages[currentStep + 1],
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
                      
                      ['moveintime', 'scheduletime'].forEach(field => {
                        if (formValues[field]) {
                          formValues[field] = dayjs(formValues[field]);
                        }
                      });
                      
                      form.setFieldsValue(formValues);
                    }, 100);
                    
                    message.success('已推进到已到店阶段');
                    return;
                  }
                  
                  // 其他阶段的原有逻辑
                  // 验证表单（下一步需要验证必填字段）
                  const values = await form.validateFields();
                  
                  // 🆕 处理表单值，确保级联选择器只保存最后一层值
                  const processedValues = processFormValues(values);
                  
                  // 获取表单当前值，确保数据完整性
                  const currentFormValues = form.getFieldsValue();
                  
                  // 只包含 followups 表中实际存在的字段，避免字段不存在错误
                  const safeUpdateObj: any = {
                    // 基本字段
                    id: record.id,
                    leadid: record.leadid,
                    followupstage: followupStages[currentStep + 1],
                    // 当前阶段需要的字段
                    customerprofile: processedValues.customerprofile || record.customerprofile,
                    worklocation: processedValues.worklocation || record.worklocation,
                    userbudget: processedValues.userbudget || record.userbudget,
                    moveintime: processedValues.moveintime || record.moveintime,
                    userrating: processedValues.userrating || record.userrating,
                    majorcategory: processedValues.majorcategory || record.majorcategory,
                    followupresult: processedValues.followupresult || record.followupresult,
                    scheduledcommunity: processedValues.scheduledcommunity || record.scheduledcommunity,
                    scheduletime: processedValues.scheduletime || record.scheduletime
                    // 移除可能不存在的字段：remark, leadtype, invalid
                  };
                  
                  // 格式化日期字段
                  ['moveintime', 'scheduletime'].forEach(field => {
                    if (safeUpdateObj[field] && typeof safeUpdateObj[field]?.format === 'function') {
                      safeUpdateObj[field] = safeUpdateObj[field].format('YYYY-MM-DD HH:mm:ss');
                    }
                  });
                  
                  
                  // 🆕 检查工作地点是否更新，如果更新则自动触发通勤时间计算
                  const originalWorklocation = record.worklocation;
                  const newWorklocation = safeUpdateObj.worklocation;
                  const worklocationChanged = newWorklocation && newWorklocation !== originalWorklocation;
                  
                  if (worklocationChanged) {
                    console.log(`🚀 [FollowupStageDrawer] 工作地点更新，自动触发通勤时间计算:`, {
                      recordId: record.id,
                      oldWorklocation: originalWorklocation,
                      newWorklocation: newWorklocation
                    });
                  }

                  // 保存到数据库，添加重试机制和详细错误日志
                  let retryCount = 0;
                  const maxRetries = 3;
                  let error: any = null;
                  
                  // 验证更新对象
                  const validation = validateUpdateObject(safeUpdateObj, record.id);
                  if (!validation.isValid) {
                    console.error('❌ [数据验证失败] 更新对象验证失败:', validation.errors);
                    throw new Error(`数据验证失败: ${validation.errors.join(', ')}`);
                  }
                  
                  // 记录请求参数用于调试
                  console.log('🔍 [调试] 数据库更新请求参数:', {
                    table: 'followups',
                    id: record.id,
                    updateObj: safeUpdateObj,
                    updateObjKeys: Object.keys(safeUpdateObj),
                    updateObjValues: Object.values(safeUpdateObj).map(v => 
                      typeof v === 'object' && v !== null ? '[Object]' : v
                    )
                  });
                  
                  while (retryCount < maxRetries) {
                    try {
                      const { error: updateError, data } = await supabase
                        .from('followups')
                        .update(safeUpdateObj)
                        .eq('id', record.id)
                        .select(); // 添加 select 以获取更详细的错误信息
                      
                      if (updateError) {
                        console.error('❌ [数据库错误] 详细错误信息:', {
                          code: updateError.code,
                          message: updateError.message,
                          details: updateError.details,
                          hint: updateError.hint,
                          requestParams: {
                            table: 'followups',
                            id: record.id,
                            updateObj: safeUpdateObj
                          }
                        });
                        throw updateError;
                      }
                      
                      console.log('✅ [数据库成功] 更新成功:', data);
                      // 成功保存，跳出重试循环
                      error = null;
                      break;
                    } catch (retryError: any) {
                      error = retryError;
                      retryCount++;
                      
                      console.error(`❌ [数据库重试] 第${retryCount}次尝试失败:`, {
                        error: retryError,
                        code: retryError.code,
                        message: retryError.message,
                        details: retryError.details,
                        hint: retryError.hint
                      });
                      
                      // 如果是超时错误且还有重试次数，等待后重试
                      if (retryError.code === '57014' && retryCount < maxRetries) {
                        console.warn(`⏰ [数据库超时] 第${retryCount}次重试...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
                        continue;
                      }
                      
                      // 其他错误或重试次数用完，直接抛出
                      throw retryError;
                    }
                  }
                  
                  if (error) {
                    console.error('❌ [最终失败] 下一步保存失败:', error);
                    throw error;
                  }
                  
                  // 更新步骤和阶段
                  setCurrentStep(currentStep + 1);
                  setCurrentStage(followupStages[currentStep + 1]);
                  
                  // 通知父组件更新
                  if (onSave) {
                    onSave(record, safeUpdateObj);
                  }
                  
                  // 延迟设置表单值，确保表单组件完全渲染
                  const timer = setTimeout(() => {
                    const formValues: any = {
                      id: record.id,
                      leadid: record.leadid,
                      followupstage: followupStages[currentStep + 1],
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
                    
                    ['moveintime', 'scheduletime'].forEach(field => {
                      if (formValues[field]) {
                        formValues[field] = dayjs(formValues[field]);
                      }
                    });
                    
                    form.setFieldsValue(formValues);
                  }, 100);
                  
                  message.success('已推进到下一阶段');
                  
                } catch (error: any) {
                  message.error('推进失败: ' + (error.message || '请完整填写所有必填项'));
                }
              }}
            >
              下一步
            </Button>
          )}
          
          {/* 完成按钮 - 在最后一步显示 */}
          {currentStep === followupStages.length - 1 && (
            <Button
              type="primary"
              onClick={() => {
                message.success('跟进阶段管理完成');
                handleClose();
              }}
              size="middle"
            >
              完成
            </Button>
          )}
        </div>
      }
    >
      <div 
        style={{ 
          display: 'flex', 
          gap: '24px', 
          height: '100%',
          flexDirection: 'row'
        }}
      >
        {/* 左侧线索信息 */}
        <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{ background: '#fafafa', padding: '16px', borderRadius: '8px' }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>线索编号：</span>
                {record?.leadid ? (
                  <Paragraph 
                    copyable={{ 
                      text: record.leadid, 
                      tooltips: ['复制', '已复制'], 
                      icon: <CopyOutlined style={{ color: '#1677ff' }} /> 
                    }} 
                    style={{ 
                      margin: 0, 
                      color: '#1677ff', 
                      fontWeight: 600, 
                      display: 'inline-block', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {record.leadid}
                  </Paragraph>
                ) : <span style={{ color: '#999' }}>-</span>}
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>手机号：</span>
                {record?.phone ? (
                  <Paragraph 
                    copyable={{ 
                      text: record.phone, 
                      tooltips: ['复制', '已复制'], 
                      icon: <CopyOutlined style={{ color: '#1677ff' }} /> 
                    }} 
                    style={{ 
                      margin: 0, 
                      display: 'inline-block', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {maskPhone(record.phone)}
                  </Paragraph>
                ) : <span style={{ color: '#999' }}>-</span>}
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>微信号：</span>
                {record?.wechat ? (
                  <Paragraph 
                    copyable={{ 
                      text: record.wechat, 
                      tooltips: ['复制', '已复制'], 
                      icon: <CopyOutlined style={{ color: '#1677ff' }} /> 
                    }} 
                    style={{ 
                      margin: 0, 
                      display: 'inline-block', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {maskWechat(record.wechat)}
                  </Paragraph>
                ) : <span style={{ color: '#999' }}>-</span>}
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>渠道：</span>
                <Tag color="blue">{record?.source || '-'}</Tag>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>创建时间：</span>
                <span style={{ fontSize: '13px' }}>
                  {record?.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : '-'}
                </span>
              </div>
            </div>
          </div>
        
        {/* 右侧步骤条和表单 */}
        <div style={{ 
          flex: 1, 
          minWidth: 0, 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* 步骤条容器 */}
          <>
            <div>
              <Steps
                current={currentStep}
                items={followupStages.map((stage, idx) => ({ 
                  title: stage, 
                  disabled: idx !== 0,
                  subTitle: null,
                  description: null
                }))}
                onChange={handleStepChange}
                style={{ 
                  marginBottom: '16px', 
                  flexShrink: 0
                }}
                data-current={currentStep}
                size="small"
                direction="horizontal"
              />
            </div>
            
            <Divider style={{ margin: '8px 0', flexShrink: 0 }} />
          </>
          
          <div 
            className="form-scroll-area"
            style={{ 
              flex: 1,
              overflow: 'auto',
              paddingBottom: '12px',
              minHeight: 0
            }}
          >
            {/* 签约记录表格 - 只在已到店和赢单阶段显示 */}
            {(currentStage === '已到店' || currentStage === '赢单') && (
              <ContractDealsTable
              dealsList={dealsList}
              dealsLoading={dealsLoading}
              onAdd={() => setContractSelectionOpen(true)}
              onEdit={handleEditDeal}
              onReassociate={handleReassociateDeal}
              onDelete={async (dealRecord) => {
                // 硬删除：直接从数据库删除
                try {
                  const { error } = await supabase
                    .from('deals')
                    .delete()
                    .eq('id', dealRecord.id);
                  
                  if (error) {
                    message.error('删除失败: ' + error.message);
                    return;
                  }
                  
                  // 从列表中移除
                  setDealsList(prev => prev.filter(item => item.id !== dealRecord.id));
                  message.success('删除成功');
                } catch (error: any) {
                  message.error('删除失败: ' + (error.message || '未知错误'));
                }
              }}
              showEditActions={true}
              currentRecord={record}
              communityEnum={communityEnum}
              setDealsList={setDealsList}
              />
            )}
            
            {/* 表单组件 - 始终渲染但根据阶段显示不同内容 */}
            <FollowupStageForm
                form={form}
                stage={currentStage}
                record={record}
                isFieldDisabled={isFieldDisabled}
                forceUpdate={forceUpdate} // 使用传入的forceUpdate，避免表单重复渲染
                communityEnum={communityEnum}
                followupstageEnum={followupstageEnum}
                customerprofileEnum={customerprofileEnum}
                userratingEnum={userratingEnum}
                majorCategoryOptions={majorCategoryOptions}
                metroStationOptions={metroStationOptions}
                // 🆕 分配模式相关
                enableManualAssign={enableManualAssign}
                onAllocationModeChange={handleAllocationModeChange}
              />
          </div>
        </div>
      </div>
      
      {/* 签约记录选择弹窗 */}
      <ContractSelectionModal
        open={contractSelectionOpen}
        onClose={() => setContractSelectionOpen(false)}
        onSelect={handleContractSelection}
        leadid={record?.leadid || ''}
      />
    </Drawer>
  );
};
