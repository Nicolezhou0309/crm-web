import { useEffect, useRef } from 'react';

/**
 * 性能监控 hook，用于监控组件渲染性能
 * @param componentName 组件名称
 * @param threshold 性能阈值（毫秒）
 */
export function usePerformanceMonitor(componentName: string, threshold: number = 50) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      
      if (renderTime > threshold) {
        console.warn(`⚠️ [性能警告] ${componentName} 渲染耗时 ${renderTime.toFixed(2)}ms (第${renderCount.current}次渲染)`);
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [性能监控] ${componentName} 渲染耗时 ${renderTime.toFixed(2)}ms (第${renderCount.current}次渲染)`);
      }
    };
  });
}

/**
 * 监控函数执行时间的 hook
 * @param functionName 函数名称
 * @param threshold 性能阈值（毫秒）
 */
export function useFunctionPerformanceMonitor(functionName: string, threshold: number = 100) {
  return (fn: () => void) => {
    const startTime = performance.now();
    fn();
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    if (executionTime > threshold) {
      console.warn(`⚠️ [性能警告] ${functionName} 执行耗时 ${executionTime.toFixed(2)}ms`);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [性能监控] ${functionName} 执行耗时 ${executionTime.toFixed(2)}ms`);
    }
  };
}
