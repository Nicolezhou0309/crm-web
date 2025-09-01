import React, { useState, useEffect } from 'react';
import { Button, CascadePicker } from 'antd-mobile';
import { supabase } from '../supaClient';

interface MobileUserPickerProps {
  value?: string[] | string | null | undefined;
  onChange?: (value: string[]) => void;
  placeholder?: string;
  buttonText?: string;
  title?: string;
  multiple?: boolean; // 是否支持多选，默认为true
  disabled?: boolean;
}

interface UserInfo {
  id: string;
  nickname: string;
  status: string;
}

interface UserProfileCache {
  [key: string]: UserInfo;
}

interface CascadeOption {
  label: string;
  value: string;
  children?: CascadeOption[];
}

const MobileUserPicker: React.FC<MobileUserPickerProps> = ({
  value,
  onChange,
  placeholder = "请选择成员",
  buttonText = "选择成员",
  title = "选择成员",
  multiple = true,
  disabled = false
}) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<CascadeOption[]>([]);
  const [userProfileCache, setUserProfileCache] = useState<UserProfileCache>({});
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 加载部门树和成员数据
  const loadDeptTreeData = async () => {
    try {
      setLoading(true);
      
      // 加载组织数据
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, parent_id');
      
      if (orgError) {
        console.error('❌ 加载组织数据失败:', orgError);
        throw orgError;
      }
      
      // 加载用户数据 - 确保只加载活跃用户
      const { data: users, error: userError } = await supabase
        .from('users_profile')
        .select('id, nickname, organization_id, status')
        .eq('status', 'active');
      
      if (userError) {
        console.error('❌ 加载用户数据失败:', userError);
        throw userError;
      }
      
      // 同时加载用户信息到缓存
      if (users && users.length > 0) {
        const newCache = users.reduce((acc, user) => ({
          ...acc,
          [String(user.id)]: { 
            id: String(user.id), 
            nickname: user.nickname || `用户${user.id}`, 
            status: user.status 
          }
        }), {});
        setUserProfileCache(prev => ({ ...prev, ...newCache }));
      }

      // 递归组装部门树，转换为CascadePicker格式
      const buildCascadeOptions = (parentId: string | null): CascadeOption[] => {
        return (orgs || [])
          .filter(dep => dep.parent_id === parentId)
          .map(dep => {
            // 过滤该部门下的用户
            const deptUsers = (users || []).filter(u => {
              if (!u.organization_id) return false;
              return u.organization_id === dep.id;
            });
            
            const subDepts = buildCascadeOptions(dep.id);
            
            const children: CascadeOption[] = [
              // 部门下成员
              ...deptUsers.map(u => ({
                label: u.nickname || `用户${u.id}`,
                value: String(u.id)
              })).filter(node => node.value && node.value !== 'undefined' && node.value !== 'null'),
              // 递归子部门
              ...subDepts
            ].filter(child => child.value && child.value !== 'undefined' && child.value !== 'null');
            
            return {
              label: `${dep.name} (${deptUsers.length}人)`,
              value: `dept_${dep.id}`,
              children: children.length > 0 ? children : undefined
            };
          });
      };

      // 未分配部门成员
      const ungrouped = (users || [])
        .filter(u => !u.organization_id)
        .map(u => ({
          label: u.nickname || `用户${u.id}`,
          value: String(u.id)
        }))
        .filter(node => node.value && node.value !== 'undefined' && node.value !== 'null');

      const cascadeOptions = buildCascadeOptions(null);
      if (ungrouped.length > 0) {
        cascadeOptions.push({
          label: `未分配部门 (${ungrouped.length}人)`,
          value: 'dept_none',
          children: ungrouped
        });
      }
      
      setOptions(cascadeOptions);
      setDataLoaded(true);
    } catch (error) {
      console.error('❌ 加载部门树数据失败:', error);
      setOptions([]);
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // 组件初始化时加载数据
  useEffect(() => {
    loadDeptTreeData();
  }, []);

  // 处理确认选择
  const handleConfirm = (val: (string | null)[], extend: any) => {
    console.log('选择结果:', val, extend);
    
    // 过滤出有效的用户ID（非部门节点）
    const selectedUsers = val
      .filter(v => v && !String(v).startsWith('dept_'))
      .map(v => String(v))
      .filter(id => id && id !== 'undefined' && id !== 'null');
    
    if (multiple) {
      // 多选模式：合并已选择的用户
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = [...new Set([...currentValue, ...selectedUsers])];
      onChange?.(newValue);
    } else {
      // 单选模式：只保留最后选择的用户
      const lastSelected = selectedUsers[selectedUsers.length - 1];
      onChange?.(lastSelected ? [lastSelected] : []);
    }
    
    setVisible(false);
  };

  // 获取显示文本
  const getDisplayText = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return placeholder;
    }
    
    const valueArray = Array.isArray(value) ? value : [String(value)];
    const validValues = valueArray.filter(v => v && v !== 'undefined' && v !== 'null');
    
    if (validValues.length === 0) {
      return placeholder;
    }
    
    if (validValues.length === 1) {
      const userInfo = userProfileCache[validValues[0]];
      return userInfo?.nickname || `用户${validValues[0]}`;
    }
    
    return `已选择 ${validValues.length} 人`;
  };

  // 如果数据还没加载完成，显示加载状态
  if (!dataLoaded) {
    return (
      <Button disabled>
        正在加载用户数据...
      </Button>
    );
  }

  return (
    <>
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
          borderColor: disabled ? '#d9d9d9' : '#1890ff'
        }}
      >
        {getDisplayText()}
      </Button>
      
      <CascadePicker
        title={title}
        options={options}
        visible={visible}
        onClose={() => {
          setVisible(false);
        }}
        onConfirm={handleConfirm}
        onSelect={(val) => {
          console.log('选择中:', val);
        }}
      />
    </>
  );
};

export default MobileUserPicker;
