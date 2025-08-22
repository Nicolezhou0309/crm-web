import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { useUser } from '../../../context/UserContext';
import { FrequencyController } from '../../../components/Followups/useFrequencyController';
import { toBeijingTimeStr } from '../../../utils/timeUtils';
import type { FrequencyControlState } from '../types';

export const useFrequencyControl = () => {
  const { user, profile } = useUser();
  
  const [frequencyController, setFrequencyController] = useState<FrequencyController | null>(null);
  const [frequencyControllerReady, setFrequencyControllerReady] = useState(false);
  const [isFrequencyLimited, setIsFrequencyLimited] = useState<boolean>(false);
  const [hasCheckedFrequency, setHasCheckedFrequency] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<FrequencyControlState['cooldown']>(null);
  
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);

  // 初始化频率控制器
  useEffect(() => {
    async function initializeUserAndFrequency() {
      if (user && profile) {
        const controller = new FrequencyController(Number(profile.id));
        setFrequencyController(controller);
        setFrequencyControllerReady(true);
      } else {
        setFrequencyControllerReady(true);
      }
    }
    
    initializeUserAndFrequency();
  }, [user, profile]);

  // 页面加载后自动读取一次频控状态
  useEffect(() => {
    if (frequencyController && frequencyControllerReady) {
      (async () => {
        const freqResult = await frequencyController.checkFrequency();
        setHasCheckedFrequency(true);
        
        if (!freqResult.allowed) {
          let bjStr = '';
          let msg = '';
          let until = Date.now();
          let secondsLeft = 0;
          
          if (freqResult.cooldown_until) {
            bjStr = toBeijingTimeStr(freqResult.cooldown_until);
            msg = `请按实际情况填写用户真实信息，勿敷衍了事，避免被系统暂时锁定。请在 ${bjStr} 后重试。`;
            until = new Date(freqResult.cooldown_until).getTime();
            secondsLeft = Math.ceil((until - Date.now()) / 1000);
          } else {
            msg = freqResult.message || '操作过于频繁，请稍后再试';
          }
          
          setCooldown({ until, secondsLeft, message: msg });
          setIsFrequencyLimited(true);
          
          // 设置 cooldown 定时器
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          cooldownTimer.current = setInterval(() => {
            setCooldown(prev => {
              if (!prev) return null;
              const left = Math.ceil((prev.until - Date.now()) / 1000);
              if (left < 1) {
                clearInterval(cooldownTimer.current!);
                setIsFrequencyLimited(false);
                return null;
              }
              return { ...prev, secondsLeft: left };
            });
          }, 1000);
        } else {
          setIsFrequencyLimited(false);
        }
      })();
    } else if (frequencyControllerReady && !frequencyController) {
      setHasCheckedFrequency(true);
    }
  }, [frequencyController, frequencyControllerReady]);

  // 检查频率限制
  const checkFrequency = useCallback(async () => {
    if (!frequencyController || !frequencyControllerReady) {
      return { allowed: true, message: '频率控制器未初始化' };
    }

    // 检查是否在冷却期内
    if (cooldown || isFrequencyLimited) {
      return { allowed: false, message: '操作过于频繁，请稍后再试' };
    }

    try {
      const freqResult = await frequencyController.checkFrequency();
      
      if (!freqResult.allowed) {
        // 设置 cooldown 状态
        let bjStr = '';
        let msg = '';
        let until = Date.now();
        let secondsLeft = 0;
        
        if (freqResult.cooldown_until) {
          bjStr = toBeijingTimeStr(freqResult.cooldown_until);
          msg = `请按实际情况填写用户真实信息，勿敷衍了事，避免被系统暂时锁定。请在 ${bjStr} 后重试。`;
          until = new Date(freqResult.cooldown_until).getTime();
          secondsLeft = Math.ceil((until - Date.now()) / 1000);
        } else {
          msg = freqResult.message || '操作过于频繁，请稍后再试';
        }
        
        setCooldown({ until, secondsLeft, message: msg });
        setIsFrequencyLimited(true);
        
        // 设置 cooldown 定时器
        if (cooldownTimer.current) clearInterval(cooldownTimer.current);
        cooldownTimer.current = setInterval(() => {
          setCooldown(prev => {
            if (!prev) return null;
            const left = Math.ceil((prev.until - Date.now()) / 1000);
            if (left < 1) {
              clearInterval(cooldownTimer.current!);
              setIsFrequencyLimited(false);
              return null;
            }
            return { ...prev, secondsLeft: left };
          });
        }, 1000);
        
        message.error(msg);
      }
      
      return freqResult;
    } catch (error) {
      console.error('频率检查失败:', error);
      return { allowed: false, message: '频率检查失败，请稍后重试' };
    }
  }, [frequencyController, frequencyControllerReady, cooldown, isFrequencyLimited]);

  // 统一的频控禁用判断
  const isFieldDisabled = useCallback((): boolean => {
    // 如果有 cooldown 或频控限制，禁用
    if (cooldown || isFrequencyLimited) {
      return true;
    }
    
    // 如果还没检查过频控状态，禁用（等待状态确定）
    if (!hasCheckedFrequency) {
      return true;
    }
    
    // 如果 frequencyController 不存在但已准备好，说明没有频控系统，允许编辑
    if (!frequencyController && frequencyControllerReady) {
      return false;
    }
    
    // 如果 frequencyController 还没准备好，禁用（等待状态确定）
    if (!frequencyControllerReady) {
      return true;
    }
    
    // 其他情况不禁用
    return false;
  }, [cooldown, isFrequencyLimited, hasCheckedFrequency, frequencyController, frequencyControllerReady]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
      }
    };
  }, []);

  // 手动触发清理
  const clearCooldown = useCallback(() => {
    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current);
    }
    setCooldown(null);
    setIsFrequencyLimited(false);
  }, []);

  return {
    // 状态
    isFrequencyLimited,
    hasCheckedFrequency,
    cooldown,
    frequencyController,
    frequencyControllerReady,
    
    // 方法
    checkFrequency,
    isFieldDisabled,
    clearCooldown,
    
    // 设置器
    setFrequencyController,
    setFrequencyControllerReady
  };
};
