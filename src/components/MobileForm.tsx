import React, { useMemo, useState } from 'react';
import { Form, Input, Picker, DatePicker, Button } from 'antd-mobile';
import dayjs from 'dayjs';

interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  required?: boolean;
  disabled?: boolean;
}

export const MobileInput: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  disabled = false
}) => {
  return (
    <Form.Item
      label={label}
      rules={required ? [{ required: true, message: `请输入${label}` }] : []}
    >
      <Input
        type={type}
        value={value?.toString() || ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Form.Item>
  );
};

interface SelectProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: { label: string; value: string | number }[];
  required?: boolean;
  disabled?: boolean;
}

export const MobileSelect: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false
}) => {
  const [visible, setVisible] = useState(false);

  // 使用 useMemo 优化选项数据的创建
  const pickerOptions = useMemo(() => {
    return options.map((option, index) => ({
      label: option.label,
      value: option.value,
      key: `${option.value}-${index}` // 添加唯一的key
    }));
  }, [options]);

  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return `请选择${label}`;
    const selectedOption = options.find(option => option.value === value);
    return selectedOption ? selectedOption.label : `请选择${label}`;
  };

  // 处理选择确认
  const handleConfirm = (selectedValue: any) => {
    if (selectedValue && selectedValue.length > 0) {
      onChange(selectedValue[0]);
    }
    setVisible(false);
  };

  return (
    <Form.Item
      label={label}
      rules={required ? [{ required: true, message: `请选择${label}` }] : []}
    >
      <Button
        onClick={() => {
          if (!disabled) {
            setVisible(true);
          }
        }}
        disabled={disabled}
        fill="outline"
        style={{
          color: disabled ? '#999' : '#1890ff',
          borderColor: disabled ? '#d9d9d9' : '#1890ff',
          textAlign: 'left',
          justifyContent: 'flex-start'
        }}
      >
        {getDisplayText()}
      </Button>
      
      <Picker
        title={label}
        columns={[pickerOptions]}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={handleConfirm}
        value={value ? [value] : []}
      />
    </Form.Item>
  );
};

interface DateInputProps {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  type?: 'date' | 'datetime-local';
}

export const MobileDateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  type = 'datetime-local'
}) => {
  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    try {
      // 如果 val 已经是 dayjs 对象
      if (val && typeof val.format === 'function') {
        if (!val.isValid()) return '';
        
        if (type === 'date') {
          return val.format('YYYY-MM-DD');
        }
        return val.format('YYYY-MM-DD HH:mm');
      }
      
      // 如果 val 是字符串或其他类型，尝试转换为 dayjs
      const date = dayjs(val);
      if (!date.isValid()) return '';
      
      if (type === 'date') {
        return date.format('YYYY-MM-DD');
      }
      return date.format('YYYY-MM-DD HH:mm');
    } catch (error) {
      return '';
    }
  };

  // 安全地创建 dayjs 对象 - 暂时注释掉
  // const _getDateValue = (val: any) => {
  //   if (val === null || val === undefined || val === '') return undefined;
  //   
  //   // 如果 val 已经是 dayjs 对象
  //   if (val && typeof val.format === 'function' && val.isValid()) {
  //     return val;
  //   }
  //   
  //   try {
  //     const date = dayjs(val);
  //     return date.isValid() ? date : undefined;
  //   } catch (error) {
  //     return undefined;
  //   }
  // };

  return (
    <Form.Item
      label={label}
      rules={required ? [{ required: true, message: `请选择${label}` }] : []}
    >
      <DatePicker
        value={undefined}
        onConfirm={(val) => {
          // antd-mobile DatePicker 返回的是 dayjs 对象
          if (val && typeof (val as any).toISOString === 'function') {
            // 转换为 ISO 字符串
            onChange((val as any).toISOString());
          } else if (val && typeof (val as any).format === 'function') {
            // 如果是 dayjs 对象但没有 toISOString 方法
            onChange((val as any).format('YYYY-MM-DD'));
          }
        }}
      >
        {(_pickerValue, actions) => (
          <Button
            className="w-full h-10 text-left justify-start border border-gray-300 rounded-lg bg-white text-gray-700 hover:border-blue-500"
            onClick={() => actions.open()}
            disabled={disabled}
          >
            {value ? formatValue(value) : `请选择${label}`}
          </Button>
        )}
      </DatePicker>
    </Form.Item>
  );
};

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  type?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export const MobileButton: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false
}) => {
  const sizeMap = {
    small: 'mini',
    medium: 'small',
    large: 'large'
  } as const;

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      color={type === 'primary' ? 'primary' : 'default'}
      size={sizeMap[size]}
      loading={loading}
      block={fullWidth}
      className={fullWidth ? 'w-full' : ''}
    >
      {children}
    </Button>
  );
};
