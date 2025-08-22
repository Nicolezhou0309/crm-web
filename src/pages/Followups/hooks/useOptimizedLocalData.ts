import { useCallback, useRef, useState, useMemo } from 'react';

interface OptimizedLocalDataConfig {
  enableOptimisticUpdates?: boolean;
}

export const useOptimizedLocalData = <T extends { id: string }>(
  initialData: T[],
  config: OptimizedLocalDataConfig = {}
) => {
  const { enableOptimisticUpdates = true } = config;

  // 确保初始数据始终是数组
  const safeInitialData = Array.isArray(initialData) ? initialData : [];

  // 主数据状态
  const [data, setData] = useState<T[]>(safeInitialData);
  
  // 本地数据引用（避免不必要的重渲染）
  const localDataRef = useRef<T[]>(safeInitialData);
  
  // 更新统计
  const [updateStats, setUpdateStats] = useState({
    totalUpdates: 0,
    optimisticUpdates: 0
  });

  // 失焦更新本地数据（统一使用此函数）
  const updateField = useCallback((id: string, field: keyof T, value: any) => {
    
    if (!enableOptimisticUpdates) {
      return;
    }

    const currentData = localDataRef.current;
    
    const recordIndex = currentData.findIndex(item => item.id === id);
    
    if (recordIndex === -1) {
      return;
    }
    
    const record = currentData[recordIndex];
    
    // 检查值是否真的发生了变化
    if (record[field] === value) {
      return;
    }
    
    // 创建新的数据
    const newData = [...currentData];
    newData[recordIndex] = { ...record, [field]: value };
    
    // 更新ref和状态
    localDataRef.current = newData;
    setData(newData);
    
    // 更新统计
    setUpdateStats(prev => ({
      ...prev,
      totalUpdates: prev.totalUpdates + 1,
      optimisticUpdates: prev.optimisticUpdates + 1
    }));
    
  }, [enableOptimisticUpdates]);



  // 回滚字段到原始值
  const rollbackField = useCallback((id: string, field: keyof T, originalValue: any) => {
    if (!enableOptimisticUpdates) return;

    const currentData = localDataRef.current;
    const recordIndex = currentData.findIndex(item => item.id === id);
    
    if (recordIndex === -1) return;
    
    const record = currentData[recordIndex];
    
    // 检查值是否真的需要回滚
    if (record[field] === originalValue) return;
    
    // 创建新的数据
    const newData = [...currentData];
    newData[recordIndex] = { ...record, [field]: originalValue };
    
    // 更新ref和状态
    localDataRef.current = newData;
    setData(newData);
    
    // 更新统计
    setUpdateStats(prev => ({
      ...prev,
      totalUpdates: prev.totalUpdates + 1
    }));
  }, [enableOptimisticUpdates]);

  // 更新多个字段
  const updateMultipleFields = useCallback((id: string, updates: Partial<T>) => {
    if (!enableOptimisticUpdates) return;

    const currentData = localDataRef.current;
    const recordIndex = currentData.findIndex(item => item.id === id);
    
    if (recordIndex === -1) return;
    
    const record = currentData[recordIndex];
    const newRecord = { ...record, ...updates };
    
    // 检查是否有变化
    const hasChanges = Object.keys(updates).some(key => 
      record[key as keyof T] !== updates[key as keyof T]
    );
    
    if (!hasChanges) return;
    
    const newData = [...currentData];
    newData[recordIndex] = newRecord;
    
    localDataRef.current = newData;
    setData(newData);
    
    setUpdateStats(prev => ({
      ...prev,
      totalUpdates: prev.totalUpdates + 1,
      optimisticUpdates: prev.optimisticUpdates + 1
    }));
  }, [enableOptimisticUpdates]);

  // 同步外部数据变化
  const syncExternalData = useCallback((newData: T[]) => {
    const safeData = Array.isArray(newData) ? newData : [];
    localDataRef.current = safeData;
    setData(safeData);
  }, []);

  // 获取当前数据
  const getCurrentData = useCallback(() => {
    return localDataRef.current;
  }, []);

  // 重置数据
  const resetData = useCallback((newData: T[]) => {
    localDataRef.current = newData;
    setData(newData);
    setUpdateStats({
      totalUpdates: 0,
      optimisticUpdates: 0
    });
  }, []);

  // 清理资源（保持接口兼容性）
  const cleanup = useCallback(() => {
    // 在立即保存模式下，不需要清理定时器等资源
    // 但保留此方法以保持接口兼容性
  }, []);

  // 当初始数据变化时同步
  useMemo(() => {
    const safeData = Array.isArray(initialData) ? initialData : [];
    if (safeData.length > 0) {
      syncExternalData(safeData);
    } else {
      // 即使没有数据，也要确保是空数组
      syncExternalData([]);
    }
  }, [initialData, syncExternalData]);

  return {
    data,
    updateField,
    rollbackField,
    updateMultipleFields,
    syncExternalData,
    getCurrentData,
    resetData,
    cleanup,
    stats: updateStats
  };
};
