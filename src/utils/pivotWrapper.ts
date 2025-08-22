import React from 'react';

// 动态导入react-pivot模块
let PivotComponent: any = null;

// 异步加载模块
const loadPivotComponent = async () => {
  if (!PivotComponent) {
    try {
      // 使用动态import来加载模块
      const module = await import('react-pivot/index.jsx');
      PivotComponent = module.default || module;
    } catch (error) {
      console.error('Failed to load react-pivot:', error);
      // 如果加载失败，返回一个占位符组件
      PivotComponent = () => React.createElement('div', null, '透视表组件加载失败');
    }
  }
  return PivotComponent;
};

export { loadPivotComponent }; 