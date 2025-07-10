import { message } from 'antd';
import type { AllocationApiResponse } from '../types/allocation';

// 统一的错误处理函数
export const handleApiError = (
  error: unknown,
  defaultMessage: string = '操作失败'
): void => {
  console.error('API错误:', error);
  
  if (error instanceof Error) {
    message.error(`${defaultMessage}: ${error.message}`);
  } else {
    message.error(defaultMessage);
  }
};

// 处理API响应
export const handleApiResponse = <T>(
  response: AllocationApiResponse<T>,
  successMessage: string = '操作成功'
): boolean => {
  if (response.success) {
    message.success(successMessage);
    return true;
  } else {
    const errorMsg = response.error || '操作失败';
    const detailMsg = response.details ? ` (${response.details})` : '';
    message.error(`${errorMsg}${detailMsg}`);
    return false;
  }
};

// 验证必填字段
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName}不能为空`);
  }
};

// 验证数值范围
export const validateNumberRange = (
  value: number | null | undefined,
  fieldName: string,
  min?: number,
  max?: number
): void => {
  if (value === null || value === undefined) return;
  
  if (min !== undefined && value < min) {
    throw new Error(`${fieldName}不能小于${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${fieldName}不能大于${max}`);
  }
};

// 验证数组长度
export const validateArrayLength = (
  arr: any[] | null | undefined,
  fieldName: string,
  minLength?: number,
  maxLength?: number
): void => {
  if (!arr) return;
  
  if (minLength !== undefined && arr.length < minLength) {
    throw new Error(`${fieldName}至少需要${minLength}个元素`);
  }
  if (maxLength !== undefined && arr.length > maxLength) {
    throw new Error(`${fieldName}不能超过${maxLength}个元素`);
  }
};

// 验证字符串长度
export const validateStringLength = (
  str: string | null | undefined,
  fieldName: string,
  minLength?: number,
  maxLength?: number
): void => {
  if (!str) return;
  
  if (minLength !== undefined && str.length < minLength) {
    throw new Error(`${fieldName}长度不能少于${minLength}个字符`);
  }
  if (maxLength !== undefined && str.length > maxLength) {
    throw new Error(`${fieldName}长度不能超过${maxLength}个字符`);
  }
}; 