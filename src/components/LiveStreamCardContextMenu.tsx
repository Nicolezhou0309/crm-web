import React from 'react';
import { Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined,
  ClockCircleOutlined,
  StarOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

interface LiveStreamCardContextMenuProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onHistory?: () => void;
  onRate?: () => void;
  onRelease?: () => void;
}

const LiveStreamCardContextMenu: React.FC<LiveStreamCardContextMenuProps> = ({
  children,
  onEdit,
  onHistory,
  onRate,
  onRelease,
}) => {
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'edit':
        onEdit?.();
        break;
      case 'history':
        onHistory?.();
        break;
      case 'rate':
        onRate?.();
        break;
      case 'release':
        Modal.confirm({
          title: '确认释放场次？',
          content: '释放后该场次将变为可报名状态，确定要释放吗？',
          okText: '确认',
          cancelText: '取消',
          onOk: () => onRelease?.(),
        });
        break;
      default:
        break;
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑记录',
    },
    {
      key: 'history',
      icon: <ClockCircleOutlined />,
      label: '查看记录历史',
    },
    {
      key: 'rate',
      icon: <StarOutlined />,
      label: '直播评分',
    },
    {
      key: 'release',
      icon: <DeleteOutlined />,
      label: '释放场次',
      danger: true,
    },
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
