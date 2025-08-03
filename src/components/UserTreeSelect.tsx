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
  const [dataLoaded, setDataLoaded] = useState(false);

  // 加载部门树和成员
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

      // 递归组装部门树
      const buildTree = (parentId: string | null): any[] => {
        return (orgs || [])
          .filter(dep => dep.parent_id === parentId)
          .map(dep => {
            // 过滤该部门下的用户 - 确保organization_id匹配
            const deptUsers = (users || []).filter(u => {
              // 处理organization_id可能为null的情况
              if (!u.organization_id) return false;
              return u.organization_id === dep.id;
            });
            
            const subDepts = buildTree(dep.id);
            
            return {
              title: `${dep.name} (${deptUsers.length}人)`,
              value: `dept_${dep.id}`,
              key: `dept_${dep.id}`,
              children: [
                // 部门下成员 - 确保每个用户都有有效的 key
                ...deptUsers.map(u => ({
                  title: u.nickname || `用户${u.id}`,
                  value: String(u.id), // 确保转换为字符串
                  key: String(u.id),   // 确保转换为字符串
                  isLeaf: true
                })).filter(node => node.key && node.key !== 'undefined' && node.key !== 'null'),
                // 递归子部门
                ...subDepts
              ].filter(child => child.key && child.key !== 'undefined' && child.key !== 'null')
            };
          });
      };

      // 未分配部门成员 - 确保每个用户都有有效的 key
      const ungrouped = (users || [])
        .filter(u => !u.organization_id) // 没有organization_id的用户
        .map(u => ({
          title: u.nickname || `用户${u.id}`,
          value: String(u.id), // 确保转换为字符串
          key: String(u.id),   // 确保转换为字符串
          isLeaf: true
        }))
        .filter(node => node.key && node.key !== 'undefined' && node.key !== 'null');

      const tree = buildTree(null);
      if (ungrouped.length > 0) {
        tree.push({
          title: `未分配部门 (${ungrouped.length}人)`,
          value: 'dept_none',
          key: 'dept_none',
          children: ungrouped
        });
      }
      
      // 最终过滤，确保所有节点都有有效的 key
      const filteredTree = tree.filter(node => 
        node.key && 
        node.key !== 'undefined' && 
        node.key !== 'null' &&
        (!node.children || node.children.every((child: any) => 
          child.key && 
          child.key !== 'undefined' && 
          child.key !== 'null'
        ))
      );
      
      setTreeData(filteredTree);
      setDataLoaded(true);
    } catch (error) {
      console.error('❌ 加载部门树数据失败:', error);
      setTreeData([]); // 出错时设置为空数组
      setDataLoaded(true);
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
          if (child.isLeaf && child.key) {
            users.push(child.key);
          } else if (child.children) {
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
    
    // 只保留叶子节点成员id，并确保这些id在树中存在
    finalSelectedUsers = finalSelectedUsers.filter(id => {
      // 过滤掉无效的ID
      if (!id || id === 'undefined' || id === 'null') {
        console.warn('⚠️ 过滤掉无效的ID:', id);
        return false;
      }
      
      const findLeaf = (nodes: any[]): boolean => 
        nodes.some(n => (n.isLeaf && n.key === id) || (n.children && findLeaf(n.children)));
      return treeData.some(dept => findLeaf([dept]));
    });
    
    
    // 确保所有用户ID都是有效的
    const validUsers = finalSelectedUsers.filter(id => id && id !== 'undefined' && id !== 'null');
    if (validUsers.length !== finalSelectedUsers.length) {
      console.warn('⚠️ 检测到无效的用户ID，已过滤');
    }
    
    onChange?.(validUsers);
  };

  // 自定义标签渲染
  const tagRender = ({ value, closable, onClose }: any) => {
    // 确保value是有效的
    if (!value || value === 'undefined' || value === 'null') {
      console.warn('⚠️ 检测到无效的value:', value);
      return <Tag closable={closable} onClose={onClose}>无效用户</Tag>;
    }
    
    const userInfo = userProfileCache?.[String(value)];
    const nickname = userInfo?.nickname || `用户${value}`;
    
    return <Tag closable={closable} onClose={onClose}>{nickname}</Tag>;
  };

  // 组件初始化时加载数据
  useEffect(() => {
    loadDeptTreeData();
  }, []);

  // 添加数据验证的useEffect
  useEffect(() => {
    if (dataLoaded && treeData.length > 0) {
      
      let totalUsers = 0;
      const validateTree = (nodes: any[], level = 0) => {
        nodes.forEach(node => {
          const indent = '  '.repeat(level);
          if (node.isLeaf) {
            totalUsers++;
          } else {
            if (node.children) {
              validateTree(node.children, level + 1);
            }
          }
        });
      };
      
      validateTree(treeData);
    }
  }, [dataLoaded, treeData]);

  // 如果数据还没加载完成，显示加载状态
  if (!dataLoaded) {
    return (
      <div style={{ 
        ...style, 
        padding: '8px 12px', 
        border: '1px solid #d9d9d9', 
        borderRadius: '6px',
        backgroundColor: '#fafafa',
        color: '#999'
      }}>
        正在加载用户数据...
      </div>
    );
  }

  // 过滤有效的value值
  const validValues = value.filter(v => {
    if (!v || v === 'undefined' || v === 'null') {
      console.warn('⚠️ 过滤掉无效的value:', v);
      return false;
    }
    // 确保所有 value 都在树中存在
    const findValue = (nodes: any[]): boolean => 
      nodes.some(n => n.value === v || (n.children && findValue(n.children)));
    return treeData.some(dept => findValue([dept]));
  });


  return (
    <TreeSelect
      treeData={treeData}
      value={validValues}
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