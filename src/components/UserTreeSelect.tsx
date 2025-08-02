import React, { useState, useEffect } from 'react';
import { TreeSelect, Tag } from 'antd';
import { supabase } from '../supaClient';

interface UserTreeSelectProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  maxTagCount?: number | 'responsive';
  treeDefaultExpandAll?: boolean;
  popupMatchSelectWidth?: boolean;
}

interface UserInfo {
  id: string;
  nickname: string;
  status: string;
}

interface UserProfileCache {
  [key: string]: UserInfo;
}

const UserTreeSelect: React.FC<UserTreeSelectProps> = ({
  value = [],
  onChange,
  placeholder = "请选择成员",
  style,
  disabled = false,
  allowClear = true,
  showSearch = true,
  maxTagCount = "responsive",
  treeDefaultExpandAll = true,
  popupMatchSelectWidth = false
}) => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [userProfileCache, setUserProfileCache] = useState<UserProfileCache>({});
  const [loading, setLoading] = useState(false);

  // 加载部门树和成员
  const loadDeptTreeData = async () => {
    try {
      setLoading(true);
      const { data: orgs } = await supabase.from('organizations').select('id, name, parent_id');
      const { data: users } = await supabase
        .from('users_profile')
        .select('id, nickname, organization_id, status')
        .eq('status', 'active');

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

      // 递归组装部门树
      const buildTree = (parentId: string | null): any[] => {
        return (orgs || [])
          .filter(dep => dep.parent_id === parentId)
          .map(dep => {
            const deptUsers = (users || []).filter(u => u.organization_id === dep.id);
            const subDepts = buildTree(dep.id);
            
            return {
              title: `${dep.name} (${deptUsers.length}人)`,
              value: `dept_${dep.id}`,
              key: `dept_${dep.id}`,
              children: [
                // 部门下成员
                ...deptUsers.map(u => ({
                  title: u.nickname,
                  value: String(u.id),
                  key: String(u.id),
                  isLeaf: true
                })),
                // 递归子部门
                ...subDepts
              ]
            };
          });
      };

      // 未分配部门成员
      const ungrouped = (users || [])
        .filter(u => !u.organization_id)
        .map(u => ({
          title: u.nickname,
          value: String(u.id),
          key: String(u.id),
          isLeaf: true
        }));

      const tree = buildTree(null);
      if (ungrouped.length > 0) {
        tree.push({
          title: `未分配部门 (${ungrouped.length}人)`,
          value: 'dept_none',
          key: 'dept_none',
          children: ungrouped
        });
      }
      
      setTreeData(tree);
    } catch (error) {
      console.error('加载部门树数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 递归获取部门下所有成员（包括子部门）
  const getAllUsersInDeptRecursive = (deptKey: string): string[] => {
    const findDept = (nodes: any[]): any | undefined => nodes.find(n => n.key === deptKey);
    const dept = findDept(treeData) || (function find(nodes: any[]): any | undefined {
      for (const n of nodes) {
        if (n.key === deptKey) return n;
        if (n.children) {
          const found = find(n.children);
          if (found) return found;
        }
      }
      return undefined;
    })(treeData);
    
    if (!dept) return [];
    
    // 递归获取所有子部门的用户
    const getAllUsersFromNode = (node: any): string[] => {
      const users: string[] = [];
      if (node.children) {
        node.children.forEach((child: any) => {
          if (child.isLeaf) {
            users.push(child.key);
          } else {
            users.push(...getAllUsersFromNode(child));
          }
        });
      }
      return users;
    };
    
    return getAllUsersFromNode(dept);
  };

  // 处理部门全选/全不选
  const handleDeptSelection = (deptKey: string, isSelect: boolean) => {
    const deptUsers = getAllUsersInDeptRecursive(deptKey);
    let newValue = [...value];
    
    if (isSelect) {
      // 全选：添加部门下所有用户
      deptUsers.forEach(id => {
        if (!newValue.includes(id)) {
          newValue.push(id);
        }
      });
    } else {
      // 全不选：移除部门下所有用户
      newValue = newValue.filter(id => !deptUsers.includes(id));
    }
    
    onChange?.(newValue);
  };

  // 处理值变化
  const handleChange = (val: any) => {
    const values = Array.isArray(val) ? val : [];
    
    // 分离处理：部门选择和人员选择
    let finalSelectedUsers: string[] = [];
    
    // 分离部门选择和人员选择
    const deptSelections = values.filter((value: any) => String(value).startsWith('dept_'));
    const userSelections = values.filter((value: any) => !String(value).startsWith('dept_'));
    
    // 1. 处理部门选择：只有全选/全不选
    deptSelections.forEach(deptId => {
      const deptUsers = getAllUsersInDeptRecursive(deptId);
      
      // 全选该部门的所有成员
      deptUsers.forEach(id => {
        if (!finalSelectedUsers.includes(id)) {
          finalSelectedUsers.push(id);
        }
      });
    });
    
    // 2. 处理人员选择：单独处理
    userSelections.forEach(userId => {
      const userIdStr = String(userId);
      if (!finalSelectedUsers.includes(userIdStr)) {
        finalSelectedUsers.push(userIdStr);
      }
    });
    
    // 只保留叶子节点成员id
    finalSelectedUsers = finalSelectedUsers.filter(id => treeData.some(dept => {
      const findLeaf = (nodes: any[]): boolean => nodes.some(n => (n.isLeaf && n.key === id) || (n.children && findLeaf(n.children)));
      return findLeaf([dept]);
    }));
    
    onChange?.(finalSelectedUsers);
  };

  // 自定义标签渲染
  const tagRender = ({ value, closable, onClose }: any) => {
    const userInfo = userProfileCache?.[String(value)];
    const nickname = userInfo?.nickname || `用户${value}`;
    return <Tag closable={closable} onClose={onClose}>{nickname}</Tag>;
  };

  // 组件初始化时加载数据
  useEffect(() => {
    loadDeptTreeData();
  }, []);

  return (
    <TreeSelect
      treeData={treeData}
      value={value}
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_CHILD}
      treeCheckStrictly={false}
      onSelect={(selectedValue) => {
        // 如果是部门节点，处理全选/全不选
        if (String(selectedValue).startsWith('dept_')) {
          const deptUsers = getAllUsersInDeptRecursive(String(selectedValue));
          const allSelected = deptUsers.length > 0 && deptUsers.every((id: string) => value.includes(id));
          handleDeptSelection(String(selectedValue), !allSelected);
          return; // 阻止默认的onChange处理
        }
      }}
      onDeselect={(deselectedValue) => {
        // 如果是部门节点，处理全不选
        if (String(deselectedValue).startsWith('dept_')) {
          handleDeptSelection(String(deselectedValue), false);
          return; // 阻止默认的onChange处理
        }
      }}
      onChange={handleChange}
      tagRender={tagRender}
      placeholder={placeholder}
      showSearch={showSearch}
      filterTreeNode={(input, node) =>
        (node.title as string).toLowerCase().includes(input.toLowerCase())
      }
      style={style}
      disabled={disabled}
      allowClear={allowClear}
      treeDefaultExpandAll={treeDefaultExpandAll}
      maxTagCount={maxTagCount}
      styles={{
        popup: {
          root: {
            maxHeight: 400,
            overflow: 'auto'
          }
        }
      }}
      popupMatchSelectWidth={popupMatchSelectWidth}
      loading={loading}
    />
  );
};

export default UserTreeSelect; 