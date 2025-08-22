import React, { useState, useEffect } from 'react';
import { Drawer, Steps, Form, Button, message, Typography, Space, Divider, Tag } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { supabase } from '../../../supaClient';
import dayjs from 'dayjs';
// import { useUser } from '../../../context/UserContext';
import type { FollowupRecord } from '../types';
import { FollowupStageForm } from './FollowupStageForm';
import { ContractDealsTable } from '../../../components/Followups/ContractDealsTable';
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
  const [currentStage, setCurrentStage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // 🆕 发放带看单相关状态
  const [assignShowingLoading, setAssignShowingLoading] = useState(false);
  const [enableManualAssign, setEnableManualAssign] = useState(false);
  
  // 🆕 签约记录相关状态 - 参考原页面逻辑
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  // 当记录变化时，重置表单和步骤
  useEffect(() => {
    if (record && open) {
      // 设置当前阶段和步骤
      const stageIndex = followupStages.findIndex(stage => stage === record.followupstage);
      setCurrentStep(Math.max(0, stageIndex));
      setCurrentStage(record.followupstage || '待接收');
      
      // 🆕 获取签约记录 - 参考原页面逻辑
      fetchDealsList();
    }
  }, [record, open]); // 移除form依赖，避免无限循环

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
        
        console.log('延迟设置表单初始值:', formValues);
        form.setFieldsValue(formValues);
      }, 300); // 进一步增加延迟时间，确保表单组件完全渲染和字段绑定
      
      return () => clearTimeout(timer);
    }
  }, [form, record, open]);

  // 移除重复的useEffect，避免竞争条件

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
          
          console.log('步骤切换时设置的表单值:', formValues);
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
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('leadid', record.leadid)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('获取签约记录失败:', error);
        message.error('获取签约记录失败');
        return;
      }
      
      setDealsList(data || []);
    } catch (error) {
      console.error('获取签约记录失败:', error);
      message.error('获取签约记录失败');
    } finally {
      setDealsLoading(false);
    }
  };

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
          console.warn('⚠️ [带看分配] 获取用户昵称失败，使用ID作为昵称:', error);
        }
        
        // 手动分配模式下，直接使用指定的人员ID
        const assignedUserIdResult = assignedUserId;
        
        // 验证人员ID
        if (!assignedUserIdResult) {
          console.error('❌ [带看分配] 手动分配失败：无效的带看人员ID');
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
          console.error('❌ [带看分配] 分配带看人员失败', {
            error: error?.message,
            assignedUserId,
            community
          });
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
      
      // 格式化日期字段
      ['moveintime', 'scheduletime'].forEach(field => {
        if (values[field] && typeof values[field]?.format === 'function') {
          values[field] = values[field].format('YYYY-MM-DD HH:mm:ss');
        }
      });

      // 从values中移除不属于followups表的字段
      const { assigned_showingsales, ...followupValues } = values;
      
      // 合并额外字段（如阶段推进）
      const updateObj = { ...followupValues, ...additionalFields };

      // 保存到数据库
      const { error } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', record.id);

      if (error) {
        throw error;
      }

      message.success('保存成功');
      
      // 通知父组件更新
      if (onSave) {
        onSave(record, updateObj);
      }
      
      // 如果没有额外字段，则关闭抽屉
      if (!additionalFields) {
        onClose();
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('保存失败:', error);
      const errorMessage = error.message || '未知错误';
      message.error('保存失败: ' + errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // 处理关闭
  const handleClose = async () => {
    try {
      // 关闭前自动保存当前表单数据
      if (record && form) {
        // 获取当前表单值，不进行验证（避免必填字段验证失败）
        const values = form.getFieldsValue();
        console.log('关闭前自动保存的表单值:', values);
        
        // 检查是否有实际的数据变化
        let hasChanges = false;
        Object.keys(values).forEach(key => {
          if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          // 构建更新对象，只包含有值的字段
          const updateObj: any = {};
          Object.keys(values).forEach(key => {
            if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
              updateObj[key] = values[key];
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
            console.error('关闭前自动保存失败:', error);
            message.warning('数据保存失败，请检查网络连接');
          } else {
            console.log('关闭前自动保存成功:', updateObj);
            message.success('数据已自动保存');
            
            // 通知父组件更新
            if (onSave) {
              onSave(record, updateObj);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('关闭前自动保存过程中发生错误:', error);
      message.warning('自动保存失败，请检查网络连接');
    } finally {
      // 无论保存成功与否，都重置表单状态
      form.resetFields();
      form.setFieldsValue({});
      
      // 重置组件状态
      setCurrentStep(0);
      setCurrentStage('');
      setDealsList([]);
      setDealsLoading(false);
      setAssignShowingLoading(false);
      setEnableManualAssign(false);
      
      // 关闭抽屉
      onClose();
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
      console.error('恢复状态失败:', error);
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
      onClose={handleClose}
      destroyOnClose
      height="60vh"
      className="followup-stage-drawer"
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={handleClose}>
            取消
          </Button>
          
          {/* 上一步按钮 */}
          {currentStage !== '丢单' && currentStep > 0 && (
            <Button
              disabled={currentStep === 0}
              onClick={async () => {
                // 上一步前保存当前数据
                try {
                  if (!record) {
                    message.error('无当前记录，无法保存');
                    return;
                  }
                  
                  // 先获取当前表单值，不进行验证（避免必填字段验证失败）
                  const values = form.getFieldsValue();
                  console.log('当前表单值:', values);
                  
                  // 构建更新对象，只包含有值的字段
                  const updateObj: any = {};
                  Object.keys(values).forEach(key => {
                    if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
                      updateObj[key] = values[key];
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
                  
                  console.log('准备保存的数据:', updateObj);
                  
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
                    
                    console.log('上一步后设置的表单值:', formValues);
                    form.setFieldsValue(formValues);
                  }, 100);
                  
                  message.success('已回退到上一阶段');
                  
                } catch (error: any) {
                  console.error('上一步操作失败:', error);
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
              >
                确认丢单
              </Button>
              <Button
                onClick={handleRestoreStatus}
                disabled={isFieldDisabled()}
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
                    
                    console.log('邀约到店阶段推进数据:', updateObj);
                    
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
                      
                      console.log('邀约到店推进后设置的表单值:', formValues);
                      form.setFieldsValue(formValues);
                    }, 100);
                    
                    message.success('已推进到已到店阶段');
                    return;
                  }
                  
                  // 其他阶段的原有逻辑
                  // 验证表单（下一步需要验证必填字段）
                  const values = await form.validateFields();
                  console.log('下一步表单验证通过:', values);
                  
                  // 获取表单当前值，确保数据完整性
                  const currentFormValues = form.getFieldsValue();
                  console.log('表单当前值:', currentFormValues);
                  
                  // 只包含 followups 表中实际存在的字段，避免字段不存在错误
                  const safeUpdateObj: any = {
                    // 基本字段
                    id: record.id,
                    leadid: record.leadid,
                    followupstage: followupStages[currentStep + 1],
                    // 当前阶段需要的字段
                    customerprofile: values.customerprofile || record.customerprofile,
                    worklocation: values.worklocation || record.worklocation,
                    userbudget: values.userbudget || record.userbudget,
                    moveintime: values.moveintime || record.moveintime,
                    userrating: values.userrating || record.userrating,
                    majorcategory: values.majorcategory || record.majorcategory,
                    followupresult: values.followupresult || record.followupresult,
                    scheduledcommunity: values.scheduledcommunity || record.scheduledcommunity,
                    scheduletime: values.scheduletime || record.scheduletime
                    // 移除可能不存在的字段：remark, leadtype, invalid
                  };
                  
                  // 格式化日期字段
                  ['moveintime', 'scheduletime'].forEach(field => {
                    if (safeUpdateObj[field] && typeof safeUpdateObj[field]?.format === 'function') {
                      safeUpdateObj[field] = safeUpdateObj[field].format('YYYY-MM-DD HH:mm:ss');
                    }
                  });
                  
                  console.log('下一步准备保存的数据:', safeUpdateObj);
                  
                  // 保存到数据库
                  const { error } = await supabase
                    .from('followups')
                    .update(safeUpdateObj)
                    .eq('id', record.id);
                  
                  if (error) {
                    console.error('下一步保存失败:', error);
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
                    
                    console.log('下一步后设置的表单值:', formValues);
                    form.setFieldsValue(formValues);
                  }, 100);
                  
                  message.success('已推进到下一阶段');
                  
                } catch (error: any) {
                  console.error('下一步操作失败:', error);
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
            >
              完成
            </Button>
          )}
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
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
          <Steps
            current={currentStep}
            items={followupStages.map((stage, idx) => ({ 
              title: stage, 
              disabled: idx !== 0,
              subTitle: null,
              description: null
            }))}
            onChange={handleStepChange}
            style={{ marginBottom: '16px', flexShrink: 0 }}
            data-current={currentStep}
            size="small"
          />
          
          <Divider style={{ margin: '8px 0', flexShrink: 0 }} />
          
          <div 
            className="form-scroll-area"
            style={{ 
              flex: 1,
              minHeight: 0,
              paddingBottom: '12px'
            }}
          >
            {/* 已到店阶段显示签约信息表格 */}
            {currentStage === '已到店' && (
              <div style={{ marginBottom: '24px' }}>
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
                    // 如果记录正在编辑中，执行保存逻辑
                    if (dealRecord.isEditing) {
                      if (dealRecord.isNew) {
                        // 新增记录
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
                          message.error('创建签约记录失败: ' + error.message);
                          return;
                        }
                        setDealsList(prev => prev.map(item =>
                          item.id === dealRecord.id
                            ? { ...newDeal, isEditing: false }
                            : item
                        ));
                        message.success('签约记录已保存');
                        // 推进到赢单阶段
                        const result = await handleSave({ followupstage: '赢单' });
                        if (result && result.success) {
                          setCurrentStep(currentStep + 1);
                          setCurrentStage('赢单');
                          message.success('已推进到赢单阶段');
                        } else {
                          message.error('推进阶段失败: ' + (result?.error || '未知错误'));
                        }
                      } else {
                        // 更新现有记录
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
                          message.error('更新签约记录失败: ' + error.message);
                          return;
                        }
                        setDealsList(prev => prev.map(item =>
                          item.id === dealRecord.id
                            ? { ...item, isEditing: false }
                            : item
                        ));
                        message.success('签约记录已更新');
                      }
                    } else {
                      // 如果记录不在编辑状态，设置为编辑状态
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
              </div>
            )}
            
            {/* 赢单阶段显示成交记录信息 */}
            {currentStage === '赢单' && (
              <div style={{ marginBottom: '24px' }}>
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
                    // 如果记录正在编辑中，执行保存逻辑
                    if (dealRecord.isEditing) {
                      if (dealRecord.isNew) {
                        // 新增记录
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
                          message.error('创建签约记录失败: ' + error.message);
                          return;
                        }
                        setDealsList(prev => prev.map(item =>
                          item.id === dealRecord.id
                            ? { ...newDeal, isEditing: false }
                            : item
                        ));
                        message.success('签约记录已保存');
                        // 赢单阶段不需要自动推进，已经是最终阶段
                        message.success('恭喜成交！');
                      } else {
                        // 更新现有记录
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
                          message.error('更新签约记录失败: ' + error.message);
                          return;
                        }
                        setDealsList(prev => prev.map(item =>
                          item.id === dealRecord.id
                            ? { ...item, isEditing: false }
                            : item
                        ));
                        message.success('签约记录已更新');
                      }
                    } else {
                      // 如果记录不在编辑状态，设置为编辑状态
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
              </div>
            )}
            
            {/* 只在需要填写表单的阶段显示表单组件 */}
            {currentStage !== '已到店' && currentStage !== '赢单' && (
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
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
