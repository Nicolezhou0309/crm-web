import React, { useState, useEffect } from 'react';
import { Dropdown, Modal, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined,
  ClockCircleOutlined,
  StarOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useRolePermissions } from '../hooks/useRolePermissions';

interface LiveStreamCardContextMenuProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onHistory?: () => void;
  onRate?: () => void;
  onRelease?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onCreate?: () => void; // 新增：创建新场次
  isLocked?: boolean;
}

const LiveStreamCardContextMenu: React.FC<LiveStreamCardContextMenuProps> = ({
  children,
  onEdit,
  onHistory,
  onRate,
  onRelease,
  onLock,
  onUnlock,
  onCreate,
  isLocked = false,
}) => {
  const { hasLiveStreamManagePermission } = useRolePermissions();
  const [hasManagePermission, setHasManagePermission] = useState<boolean>(false);
  const [permissionChecked, setPermissionChecked] = useState<boolean>(false);

  // 检查权限
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const hasPermission = await hasLiveStreamManagePermission();
        setHasManagePermission(hasPermission);
        setPermissionChecked(true);
      } catch (error) {
        console.error('检查直播管理权限失败:', error);
        setHasManagePermission(false);
        setPermissionChecked(true);
      }
    };

    checkPermission();
  }, [hasLiveStreamManagePermission]);
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // 检查管理权限的函数
    const checkManagePermission = () => {
      if (!hasManagePermission) {
        message.warning('您没有直播管理权限，无法执行此操作');
        return false;
      }
      return true;
    };

    switch (key) {
      case 'edit':
        onEdit?.();
        break;
      case 'history':
        onHistory?.();
        break;
      case 'rate':
        if (!checkManagePermission()) return;
        onRate?.();
        break;
      case 'release':
        if (!checkManagePermission()) return;
        Modal.confirm({
          title: '确认释放场次？',
          content: '释放后该场次将变为可报名状态，确定要释放吗？',
          okText: '确认',
          cancelText: '取消',
          onOk: () => onRelease?.(),
        });
        break;
      case 'lock':
        if (!checkManagePermission()) return;
        Modal.confirm({
          title: '确认锁定场次？',
          content: '锁定后该场次将无法被编辑或报名，确定要锁定吗？',
          okText: '确认',
          cancelText: '取消',
          onOk: () => onLock?.(),
        });
        break;
      case 'unlock':
        if (!checkManagePermission()) return;
        Modal.confirm({
          title: '确认解锁场次？',
          content: '解锁后该场次将变为可报名状态，确定要解锁吗？',
          okText: '确认',
          cancelText: '取消',
          onOk: () => onUnlock?.(),
        });
        break;
      case 'create':
        onCreate?.();
        break;
      default:
        break;
    }
  };

  const menuItems: MenuProps['items'] = [
    // 空卡片显示创建选项
    ...(onCreate ? [{
      key: 'create',
      icon: <EditOutlined />,
      label: '创建新场次',
    }] : []),
    // 只有存在schedule时才显示这些菜单项
    ...(onEdit ? [{
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑记录',
    }] : []),
    ...(onHistory ? [{
      key: 'history',
      icon: <ClockCircleOutlined />,
      label: '查看记录历史',
    }] : []),
    // 评分菜单项 - 只有拥有管理权限的用户才能看到
    ...(hasManagePermission && onRate ? [{
      key: 'rate',
      icon: <StarOutlined />,
      label: '直播评分',
    }] : []),
    // 管理权限相关菜单项 - 只有拥有管理权限的用户才能看到
    ...(hasManagePermission && onRelease ? [{
      key: 'release',
      icon: <DeleteOutlined />,
      label: '释放场次',
      danger: true,
    }] : []),
    // 锁定相关菜单项 - 只有拥有管理权限的用户才能看到
    ...(hasManagePermission && (onLock || onUnlock) ? [{
      type: 'divider' as const,
    }] : []),
    ...(hasManagePermission && (onLock || onUnlock) ? [{
      key: isLocked ? 'unlock' : 'lock',
      icon: isLocked ? <UnlockOutlined /> : <LockOutlined />,
      label: isLocked ? '解锁场次' : '锁定场次',
      danger: isLocked,
    }] : []),
  ];

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={["contextMenu"]}>
      <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
        {children}
      </div>
    </Dropdown>
  );
};

export default LiveStreamCardContextMenu;
