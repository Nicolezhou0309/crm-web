import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Popup, 
  Button, 
  Form, 
  Toast, 
  NavBar,
  Space,
  Tag,
  Modal,
  Input,
  CalendarPicker,
  Picker,
  DatePicker
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
 * 🆕 新增：向下滑动关闭功能
 * 1. 添加触摸手势检测
 * 2. 计算滑动距离和方向
 * 3. 实现滑动关闭逻辑
 * 4. 添加视觉反馈效果
 * 
 * 使用方法：
 * - 在移动端设备上，内容区域支持上下滑动
 * - 头部导航和客户信息区域固定不滚动
 * - 表单内容区域可以滚动查看
 * - 向下滑动超过阈值可以关闭弹窗
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
  
  // 🆕 新增签约记录弹窗状态
  const [addDealModalVisible, setAddDealModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [dealForm] = Form.useForm();
  
  // 防止重复保存的状态
  const hasAutoSavedRef = useRef(false);
  const isClosingRef = useRef(false);
  const hasManualSavedRef = useRef(false);

  // 🆕 新增：滑动关闭相关状态和引用
  const [isDragging, setIsDragging] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [shouldClose, setShouldClose] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false); // 🆕 新增：是否在顶部状态
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 🆕 滑动关闭配置
  const SWIPE_CLOSE_THRESHOLD = 120; // 滑动关闭阈值（像素）
  const SWIPE_CLOSE_VELOCITY = 0.5; // 滑动关闭速度阈值（像素/毫秒）
  const MAX_DRAG_DISTANCE = 200; // 最大拖拽距离
  const SWIPE_DOWN_THRESHOLD = 100; // 下滑关闭阈值（像素）
  const MAX_DOWN_DISTANCE = 150; // 最大下滑距离
  const SWIPE_DOWN_VELOCITY = 0.5; // 下滑关闭速度阈值（像素/毫秒）

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

  // 🆕 新增：检查滚动位置的函数
  const checkScrollPosition = useCallback(() => {
    if (drawerRef.current) {
      const scrollTop = drawerRef.current.scrollTop;
      const isTop = scrollTop <= 5; // 允许5px的误差
      setIsAtTop(isTop);
      
      // 🆕 新增：记录滚动位置日志，帮助调试
      console.log('🔍 [MobileFollowupStageDrawer] 滚动位置检查:', {
        scrollTop,
        isTop,
        currentStage,
        timestamp: new Date().toISOString()
      });
    }
  }, [currentStage]);

  // 🆕 新增：添加滚动事件监听器
  useEffect(() => {
    if (!drawerRef.current || !open) return;
    
    const element = drawerRef.current;
    
    // 添加滚动事件监听器
    element.addEventListener('scroll', checkScrollPosition, { passive: true });
    
    // 初始检查滚动位置
    checkScrollPosition();
    
    return () => {
      element.removeEventListener('scroll', checkScrollPosition);
    };
  }, [open, checkScrollPosition]);

  // 🆕 新增：使用 useEffect 添加触摸事件监听器
  useEffect(() => {
    if (!drawerRef.current || !open) return;
    
    const element = drawerRef.current;
    
    // 🆕 修复：只有跟进阶段页面可以滑动关闭
    const canSwipeClose = currentStage && currentStage !== '丢单' && currentStage !== '赢单';
    
    // 🆕 新增：获取最外层 Popup 容器，确保触摸事件能正确捕获
    const popupContainer = element.closest('.adm-popup') as HTMLElement;
    const targetElement = popupContainer || element; // 优先使用 Popup 容器，回退到内部 div
    
    // 创建触摸事件监听器
    const touchStartHandler = (e: TouchEvent) => {
      // 🆕 修复：只有允许滑动关闭的页面才处理触摸事件
      if (!canSwipeClose) return;
      
      // 🆕 新增：在触摸开始时就阻止默认行为，防止浏览器默认右滑动作
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      
      setIsDragging(true);
      setDragDistance(0);
      setShouldClose(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    
    const touchMoveHandler = (e: TouchEvent) => {
      // 🆕 修复：只有允许滑动关闭的页面才处理触摸事件
      if (!canSwipeClose || !touchStartRef.current || !targetElement) return;
      
      const touch = e.touches[0];
      const currentX = touch.clientX;
      const startX = touchStartRef.current.x;
      const currentY = touch.clientY;
      const startY = touchStartRef.current.y;
      
      // 🆕 修改：处理右滑和下滑关闭
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      
      // 判断滑动方向
      const isRightSwipe = deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY);
      const isDownSwipe = deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX);
      
      if (isRightSwipe) {
        // 🆕 右滑关闭逻辑
        e.preventDefault();
        e.stopPropagation();
        
        const distance = deltaX;
        const limitedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
        
        // 🆕 修改：取消跟随动画，只记录滑动距离
        setDragDistance(limitedDistance);
        
        // 判断是否应该关闭
        if (limitedDistance > SWIPE_CLOSE_THRESHOLD) {
          setShouldClose(true);
        } else {
          setShouldClose(false);
        }
      } else if (isDownSwipe && isAtTop) {
        // 🆕 新增：下滑关闭逻辑（只有在顶部时才生效）
        e.preventDefault();
        e.stopPropagation();
        
        const distance = deltaY;
        const limitedDistance = Math.min(distance, MAX_DOWN_DISTANCE);
        
        // 记录下滑距离
        setDragDistance(limitedDistance);
        
        // 判断是否应该关闭
        if (limitedDistance > SWIPE_DOWN_THRESHOLD) {
          setShouldClose(true);
        } else {
          setShouldClose(false);
        }
      }
      
      touchMoveRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };
    
    const touchEndHandler = (e: TouchEvent) => {
      // 🆕 修复：只有允许滑动关闭的页面才处理触摸事件
      if (!canSwipeClose || !touchStartRef.current || !touchMoveRef.current || !targetElement) {
        setIsDragging(false);
        return;
      }
      
      const endTime = Date.now();
      const startTime = touchStartRef.current.time;
      const duration = endTime - startTime;
      
      const endX = touchMoveRef.current.x;
      const startX = touchStartRef.current.x;
      const endY = touchMoveRef.current.y;
      const startY = touchStartRef.current.y;
      
      // 🆕 修改：计算右滑和下滑距离
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // 🆕 简化：统一使用下滑关闭，简化方向判断逻辑
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // 🆕 简化：判断是否应该关闭弹窗（支持右滑和下滑，但都使用下滑关闭动画）
      let shouldCloseBySwipe = false;
      
      // 右滑关闭判断
      if (deltaX > 0 && absDeltaX > absDeltaY) {
        const velocity = absDeltaX / duration;
        shouldCloseBySwipe = (
          deltaX > SWIPE_CLOSE_THRESHOLD || 
          (deltaX > 50 && velocity > SWIPE_CLOSE_VELOCITY)
        );
      }
      
      // 下滑关闭判断（只有在顶部时才生效）
      if (!shouldCloseBySwipe && deltaY > 0 && absDeltaY > absDeltaX && isAtTop) {
        const velocity = absDeltaY / duration;
        shouldCloseBySwipe = (
          deltaY > SWIPE_DOWN_THRESHOLD || 
          (deltaY > 50 && velocity > SWIPE_DOWN_VELOCITY)
        );
      }
      
      if (shouldCloseBySwipe) {
        // 🆕 修复：去除所有动画效果，直接关闭弹窗
        console.log('🔍 [MobileFollowupStageDrawer] 滑动关闭触发，直接关闭弹窗:', {
          timestamp: new Date().toISOString(),
          currentStage,
          currentStep,
          dragDistance,
          shouldClose,
          isDragging
        });
        
        // 🆕 直接调用onClose，不执行任何动画
        onClose();
      } else {
        // 🆕 修改：如果没有达到关闭条件，直接重置状态，不执行动画
        // 重置状态
        setIsDragging(false);
        setDragDistance(0);
        setShouldClose(false);
        touchStartRef.current = null;
        touchMoveRef.current = null;
      }
    };
    
    const touchCancelHandler = (e: TouchEvent) => {
      // 🆕 修复：只有允许滑动关闭的页面才处理触摸事件
      if (!canSwipeClose) return;
      
      // 🆕 新增：在触摸取消时也阻止默认行为，防止浏览器默认右滑动作
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(false);
      setDragDistance(0);
      setShouldClose(false);
      touchStartRef.current = null;
      touchMoveRef.current = null;
      
      // 🆕 修改：触摸取消时直接重置状态，不执行恢复动画
    };
    
    // 🆕 修复：只有允许滑动关闭的页面才添加触摸事件监听器
    if (canSwipeClose) {
      targetElement.addEventListener('touchstart', touchStartHandler, { passive: false });
      targetElement.addEventListener('touchmove', touchMoveHandler, { passive: false });
      targetElement.addEventListener('touchend', touchEndHandler, { passive: false });
      targetElement.addEventListener('touchcancel', touchCancelHandler, { passive: false });
    }
    
    // 清理函数
    return () => {
      if (canSwipeClose) {
        targetElement.removeEventListener('touchstart', touchStartHandler);
        targetElement.removeEventListener('touchmove', touchMoveHandler);
        targetElement.removeEventListener('touchend', touchEndHandler);
        targetElement.removeEventListener('touchcancel', touchCancelHandler);
      }
      
      // 🆕 修复：清理时重置样式，防止下次打开时显示异常
      if (element) {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }
      // 🆕 新增：清理 Popup 容器样式
      if (element) {
        const popupElement = element.closest('.adm-popup-body') as HTMLElement;
        if (popupElement) {
          popupElement.style.transition = '';
          popupElement.style.transform = '';
          popupElement.style.opacity = '';
        }
      }
    };
  }, [open, shouldClose, onClose, currentStage]); // 🆕 修复：添加 currentStage 依赖

  // 🆕 新增：确保组件关闭时完全重置状态和样式
  useEffect(() => {
    if (!open) {
      // 重置所有滑动相关状态
      setIsDragging(false);
      setDragDistance(0);
      setShouldClose(false);
      
      // 清理触摸引用
      touchStartRef.current = null;
      touchMoveRef.current = null;
      
      // 清理动画帧
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // 延迟清理样式，确保动画完成后再重置
      setTimeout(() => {
        if (drawerRef.current) {
          drawerRef.current.style.transition = '';
          drawerRef.current.style.transform = '';
          drawerRef.current.style.opacity = '';
        }
        
        // 🆕 新增：清理 Popup 容器样式
        if (drawerRef.current) {
          const popupElement = drawerRef.current.closest('.adm-popup-body') as HTMLElement;
          if (popupElement) {
            popupElement.style.transition = '';
            popupElement.style.transform = '';
            popupElement.style.opacity = '';
          }
        }
      }, 350); // 比动画时间稍长，确保完全清理
    }
  }, [open]);

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
      
      // 🆕 重置滑动状态
      setIsDragging(false);
      setDragDistance(0);
      setShouldClose(false);
    }
  }, [record, open, fetchDealsList]);

  // 🆕 新增：调试类名生成
  useEffect(() => {
    if (currentStage) {
      const className = `stage-${currentStage.replace(/\s+/g, '-')}`;
      console.log('🔍 [MobileFollowupStageDrawer] Header类名生成:', {
        currentStage,
        className,
        currentStep,
        totalSteps: followupStages.length
      });
    }
  }, [currentStage, currentStep]);

  // 监听form实例变化，确保表单正确初始化
  useEffect(() => {
    
    if (form && record && open) {
      
      const timer = setTimeout(() => {
        
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
    // 🆕 简化：只检查是否正在关闭
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
      
      // 🆕 重置滑动状态
      setIsDragging(false);
      setDragDistance(0);
      setShouldClose(false);
      
      // 🆕 简化：直接调用onClose
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
      
      // 🆕 新增：详细记录表单验证过程
      console.log('🔍 [MobileFollowupStageDrawer] 开始表单验证', {
        recordId: record?.id,
        currentStage,
        currentStep,
        formInstance: !!form
      });
      
      // 验证表单
      const values = await form.validateFields();
      
      console.log('✅ [MobileFollowupStageDrawer] 表单验证通过', {
        recordId: record?.id,
        validatedValues: values,
        fieldsCount: Object.keys(values).length
      });
      
      // 🆕 修复：等待一小段时间确保表单值同步完成
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🆕 处理表单值，确保级联选择器只保存最后一层值
      const processedValues = processFormValues(values);

      
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
      triggerOptimisticUpdate(updatedRecord, updateObj, 'manual');
      
      Toast.show({ content: '保存成功', position: 'center' });
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ [MobileFollowupStageDrawer] 保存失败:', error);
      
      // 🆕 新增：详细错误信息处理
      let errorMessage = '未知错误';
      
      if (error.errorFields && Array.isArray(error.errorFields)) {
        // 表单验证失败
        const fieldNames = error.errorFields.map((field: any) => field.name).join('、');
        errorMessage = `请完善以下必填字段：${fieldNames}`;
        console.warn('⚠️ [MobileFollowupStageDrawer] 表单验证失败字段:', {
          recordId: record?.id,
          errorFields: error.errorFields,
          fieldNames
        });
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      }
      
      Toast.show({ 
        content: '保存失败: ' + errorMessage, 
        position: 'center' 
      });
      
      return { success: false, error: errorMessage };
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
      
      // 这里可以添加发放带看单的逻辑
      // 暂时只是推进到下一阶段
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        setCurrentStep(currentStep + 1);
        setCurrentStage(targetStage);
        Toast.show({ content: '已推进到已到店阶段', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 发放带看单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result,
          error: result?.error,
          currentStep,
          targetStep: currentStep + 1
        });
        
        // 🆕 新增：显示具体的失败原因
        if (result?.error) {
          Toast.show({ 
            content: '发放带看单失败: ' + result.error, 
            position: 'center' 
          });
        }
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
      
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        Toast.show({ content: '已确认丢单', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 确认丢单', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result,
          error: result?.error,
          currentStep,
          targetStep: '丢单'
        });
        
        // 🆕 新增：显示具体的失败原因
        if (result?.error) {
          Toast.show({ 
            content: '确认丢单失败: ' + result.error, 
            position: 'center' 
          });
        }
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
      
      const result = await handleSave({ followupstage: targetStage });
      if (result && result.success) {
        
        setCurrentStep(0);
        setCurrentStage(targetStage);
        Toast.show({ content: '已恢复状态', position: 'center' });
      } else {
        console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 恢复状态', {
          recordId: record?.id,
          fromStage: currentStage,
          toStage: targetStage,
          saveResult: result,
          error: result?.error,
          currentStep,
          targetStep: 0
        });
        
        // 🆕 新增：显示具体的失败原因
        if (result?.error) {
          Toast.show({ 
            content: '恢复状态失败: ' + result.error, 
            position: 'center' 
          });
        }
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

  // 🆕 处理新增签约记录弹窗
  const handleAddDeal = () => {
    setEditingDeal(null);
    setSelectedCommunity(''); // 重置选中的社区
    setAddDealModalVisible(true);
    // 延迟重置表单，确保弹窗完全打开后再重置
    setTimeout(() => {
      dealForm.resetFields();
      // 设置默认签约日期为今天
      dealForm.setFieldValue('contractdate', dayjs());
    }, 100);
  };

  // 🆕 处理编辑签约记录弹窗
  const handleEditDeal = (dealRecord: any) => {
    setEditingDeal(dealRecord);
    setSelectedCommunity(dealRecord.community || ''); // 设置已选择的社区
    setAddDealModalVisible(true);
    // 延迟设置表单值，确保弹窗完全打开后再设置
    setTimeout(() => {
      dealForm.setFieldsValue({
        contractdate: dealRecord.contractdate ? dayjs(dealRecord.contractdate) : dayjs(),
        community: dealRecord.community || '',
        contractnumber: dealRecord.contractnumber || '',
        roomnumber: dealRecord.roomnumber || ''
      });
    }, 100);
  };

  // 🆕 获取弹窗表单的初始值
  const getDealFormInitialValues = () => {
    if (editingDeal) {
      return {
        contractdate: editingDeal.contractdate ? dayjs(editingDeal.contractdate) : dayjs(),
        community: editingDeal.community || '',
        contractnumber: editingDeal.contractnumber || '',
        roomnumber: editingDeal.roomnumber || ''
      };
    }
    return {
      contractdate: dayjs(), // 默认今天
      community: '',
      contractnumber: '',
      roomnumber: ''
    };
  };

  // 🆕 处理签约社区选择
  const [communityPickerVisible, setCommunityPickerVisible] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState('');

  const handleCommunitySelect = (value: any) => {
    if (value && value.length > 0) {
      const selectedValue = value[0];
      setSelectedCommunity(selectedValue);
      dealForm.setFieldValue('community', selectedValue);
    }
    setCommunityPickerVisible(false);
  };

  // 🆕 处理签约日期选择
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const handleDateSelect = (value: any) => {
    if (value) {
      const selectedDate = dayjs(value);
      dealForm.setFieldValue('contractdate', selectedDate);
    }
    setDatePickerVisible(false);
  };

  // 🆕 处理签约记录弹窗确认
  const handleDealModalConfirm = async () => {
    try {
      const values = await dealForm.validateFields();
      
      if (editingDeal) {
        // 编辑现有记录
        if (editingDeal.isNew) {
          // 新增记录
          const dealData = {
            leadid: record?.leadid,
            contractdate: values.contractdate.format('YYYY-MM-DD'),
            community: values.community,
            contractnumber: values.contractnumber,
            roomnumber: values.roomnumber
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
            item.id === editingDeal.id
              ? { ...newDeal, isEditing: false }
              : item
          ));
          
          Toast.show({ content: '签约记录已保存', position: 'center' });
          
          // 🆕 新增成交纪录后，自动推进到赢单阶段
          const result = await handleSave({ followupstage: '赢单' });
          if (result && result.success) {
            setCurrentStep(currentStep + 1);
            setCurrentStage('赢单');
            Toast.show({ content: '已推进到赢单阶段', position: 'center' });
          } else {
            console.warn('⚠️ [MobileFollowupStageDrawer] 推进到赢单阶段失败', {
              recordId: record?.id,
              saveResult: result
            });
          }
        } else {
          // 更新现有记录
          const { error } = await supabase
            .from('deals')
            .update({
              contractdate: values.contractdate.format('YYYY-MM-DD'),
              community: values.community,
              contractnumber: values.contractnumber,
              roomnumber: values.roomnumber
            })
            .eq('id', editingDeal.id);
            
          if (error) {
            Toast.show({ content: '更新签约记录失败: ' + error.message, position: 'center' });
            return;
          }
          
          setDealsList(prev => prev.map(item =>
            item.id === editingDeal.id
              ? { ...item, isEditing: false }
              : item
          ));
          
          Toast.show({ content: '签约记录已更新', position: 'center' });
          
          // 🆕 编辑成交纪录后，也推进到赢单阶段（如果当前不是赢单阶段）
          if (currentStage !== '赢单') {
            console.log('🔍 [MobileFollowupStageDrawer] 编辑成交纪录后准备推进到赢单阶段', {
              recordId: record?.id,
              currentStage,
              currentStep,
              editingDeal
            });
            
            const result = await handleSave({ followupstage: '赢单' });
            if (result && result.success) {
              console.log('✅ [MobileFollowupStageDrawer] 编辑成交纪录后成功推进到赢单阶段', {
                recordId: record?.id,
                fromStage: currentStage,
                toStage: '赢单',
                result
              });
              
              setCurrentStep(currentStep + 1);
              setCurrentStage('赢单');
              Toast.show({ content: '已推进到赢单阶段', position: 'center' });
            } else {
              console.warn('⚠️ [MobileFollowupStageDrawer] 编辑成交纪录后推进到赢单阶段失败', {
                recordId: record?.id,
                currentStage,
                saveResult: result
              });
            }
          }
        }
      } else {
        // 新增记录
        const dealData = {
          leadid: record?.leadid,
          contractdate: values.contractdate.format('YYYY-MM-DD'),
          community: values.community,
          contractnumber: values.contractnumber,
          roomnumber: values.roomnumber
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
        
        setDealsList(prev => [newDeal, ...prev]);
        Toast.show({ content: '签约记录已创建', position: 'center' });
        
        // 🆕 新增成交纪录后，自动推进到赢单阶段
        console.log('🔍 [MobileFollowupStageDrawer] 新增成交纪录后准备推进到赢单阶段', {
          recordId: record?.id,
          currentStage,
          currentStep,
          newDeal
        });
        
        const result = await handleSave({ followupstage: '赢单' });
        if (result && result.success) {
          console.log('✅ [MobileFollowupStageDrawer] 新增成交纪录后成功推进到赢单阶段', {
            recordId: record?.id,
            fromStage: currentStage,
            toStage: '赢单',
            result
          });
          
          setCurrentStep(currentStep + 1);
          setCurrentStage('赢单');
          Toast.show({ content: '已推进到赢单阶段', position: 'center' });
        } else {
          console.warn('⚠️ [MobileFollowupStageDrawer] 新增成交纪录后推进到赢单阶段失败', {
            recordId: record?.id,
            currentStage,
            saveResult: result
          });
        }
      }
      
      setAddDealModalVisible(false);
      setEditingDeal(null);
      dealForm.resetFields();
      
    } catch (error: any) {
      console.error('签约记录保存失败:', error);
      Toast.show({ 
        content: '保存失败: ' + (error.message || '未知错误'), 
        position: 'center' 
      });
    }
  };

  // 🆕 处理签约记录弹窗取消
  const handleDealModalCancel = () => {
    setAddDealModalVisible(false);
    setEditingDeal(null);
    setSelectedCommunity(''); // 重置选中的社区
    dealForm.resetFields();
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
      closeOnMaskClick={false}
      className="mobile-followup-drawer"
      maskStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)'
      }}
      position="bottom"
      showCloseButton={false}
    >
      {/* 🆕 修复：恢复必要的flex布局容器，并添加触摸事件处理 */}
      <div 
        ref={drawerRef}
        className="border-0 divide-y-0" 
        style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
          touchAction: 'pan-y',
          userSelect: 'none'
        }}
      >
        <NavBar
          onBack={handleUnifiedClose}
          className="border-b-0"
          style={{
            flexShrink: 0,
            minHeight: '60px',
            // 🆕 简化：使用统一的简单背景色
            background: '#ffffff',
            borderBottom: '1px solid #f0f0f0'
          }}
          right={
            // 🆕 新增：右侧丢单按钮
            currentStage !== '丢单' && currentStage !== '赢单' ? (
              <Button
                size="small"
                color="danger"
                fill="none"
                onClick={() => {
                  try {
                    if (!record) {
                      Toast.show({ content: '无当前记录，无法操作', position: 'center' });
                      return;
                    }
                    
                    // 🆕 直接跳转到丢单阶段页面，不保存数据
                    setCurrentStage('丢单');
                    setCurrentStep(followupStages.findIndex(stage => stage === '丢单'));
                    
                    // 🆕 可选：显示提示信息
                    Toast.show({ content: '已切换到丢单阶段', position: 'center' });
                    
                  } catch (error: any) {
                    console.error('❌ [MobileFollowupStageDrawer] 丢单按钮点击异常:', error);
                    Toast.show({ 
                      content: '操作失败: ' + (error.message || '未知错误'), 
                      position: 'center' 
                    });
                  }
                }}
              >
                丢单
              </Button>
            ) : null
          }
        >
          {/* 🆕 简化：使用简单的标题样式 */}
          <div className="simple-title-container">
            <div className="simple-title-main">
              跟进阶段管理
            </div>
            <div className="simple-title-sub">
              {currentStage || '待接收'} ({currentStep + 1}/{followupStages.length})
            </div>
          </div>
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
          {(currentStage === '已到店' || currentStage === '赢单') && (
            <ContractDealsTable
              dealsList={dealsList}
              dealsLoading={dealsLoading}
              onAdd={handleAddDeal}
              onEdit={handleEditDeal}
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
            {/* 🆕 上一步按钮 - 保存其他字段但不回退跟进阶段 */}
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
                    
                    // 🆕 先保存除跟进阶段外的其他字段
                    const formValues = form.getFieldsValue();
                    const { followupstage, ...otherFields } = formValues;
                    
                    // 🆕 只保存其他字段，不包含跟进阶段
                    if (Object.keys(otherFields).length > 0) {
                      const result = await handleSave(otherFields);
                      if (!result || !result.success) {
                        console.warn('⚠️ [MobileFollowupStageDrawer] 其他字段保存失败 - 上一步', {
                          recordId: record?.id,
                          saveResult: result,
                          error: result?.error
                        });
                        
                        if (result?.error) {
                          Toast.show({ 
                            content: '字段保存失败: ' + result.error, 
                            position: 'center' 
                          });
                        }
                        return;
                      }
                    }
                    
                    // 🆕 字段保存成功后，直接更新阶段状态（不回退跟进阶段）
                    setCurrentStep(currentStep - 1);
                    setCurrentStage(targetStage);
                    Toast.show({ content: '已回退到上一阶段', position: 'center' });
                    
                  } catch (error: any) {
                    console.error('❌ [MobileFollowupStageDrawer] 上一步操作异常', {
                      recordId: record?.id,
                      fromStage: currentStage,
                      error: error.message
                    });
                    Toast.show({ 
                      content: '操作失败: ' + (error.message || '未知错误'), 
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
                    // 🆕 使用统一的保存逻辑
                    const result = await handleSave({ followupstage: targetStage });
                    
                    if (result && result.success) {
                      
                      setCurrentStep(currentStep + 1);
                      setCurrentStage(targetStage);
                      Toast.show({ content: '已推进到下一阶段', position: 'center' });
                    } else {
                      console.warn('⚠️ [MobileFollowupStageDrawer] 阶段切换失败 - 下一步', {
                        recordId: record?.id,
                        fromStage: currentStage,
                        toStage: targetStage,
                        saveResult: result,
                        error: result?.error,
                        currentStep,
                        targetStep: currentStep + 1
                      });
                      
                      // 🆕 新增：显示具体的失败原因
                      if (result?.error) {
                        Toast.show({ 
                          content: '阶段推进失败: ' + result.error, 
                          position: 'center' 
                        });
                      }
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
      
      {/* 🆕 新增/编辑签约记录弹窗 */}
      <Modal
        visible={addDealModalVisible}
        title={editingDeal ? '编辑签约记录' : '新增签约记录'}
        onClose={handleDealModalCancel}
        closeOnMaskClick={false}
        content={
          <Form
            form={dealForm}
            layout="vertical"
            className="deal-form"
            initialValues={getDealFormInitialValues()}
          >
            <Form.Item
              name="contractdate"
              label="签约日期"
              rules={[{ required: true, message: '请选择签约日期' }]}
            >
              <div
                className="date-picker-trigger"
                style={{
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  color: dealForm.getFieldValue('contractdate') ? 'inherit' : '#999',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => setDatePickerVisible(true)}
              >
                {dealForm.getFieldValue('contractdate') ? 
                  dealForm.getFieldValue('contractdate').format('YYYY-MM-DD') : 
                  '请选择签约日期'}
              </div>
            </Form.Item>
            
            <Form.Item
              name="community"
              label="签约社区"
              rules={[{ required: true, message: '请选择签约社区' }]}
            >
              <div
                className="community-picker-trigger"
                style={{
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  color: selectedCommunity ? 'inherit' : '#999',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => setCommunityPickerVisible(true)}
              >
                {selectedCommunity || '请选择签约社区'}
              </div>
            </Form.Item>
            
            <Form.Item
              name="contractnumber"
              label="合同编号"
              rules={[{ required: true, message: '请填写合同编号' }]}
            >
              <Input placeholder="请填写合同编号" />
            </Form.Item>
            
            <Form.Item
              name="roomnumber"
              label="房间号"
              rules={[{ required: true, message: '请填写房间号' }]}
            >
              <Input placeholder="请填写房间号" />
            </Form.Item>
          </Form>
        }
        actions={[
          {
            key: 'cancel',
            text: '取消',
            onClick: handleDealModalCancel
          },
          {
            key: 'confirm',
            text: '确定',
            onClick: handleDealModalConfirm
          }
        ]}
      />
      
      {/* 🆕 签约社区选择器 */}
      <Picker
        title="选择签约社区"
        columns={[communityEnum]}
        visible={communityPickerVisible}
        onClose={() => setCommunityPickerVisible(false)}
        onConfirm={handleCommunitySelect}
        value={selectedCommunity ? [selectedCommunity] : []}
      />
      
      {/* 🆕 签约日期选择器 */}
      <DatePicker
        title="选择签约日期"
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={handleDateSelect}
        value={dealForm.getFieldValue('contractdate')?.toDate()}
        precision="day"
      />
    </Popup>
  );
};
