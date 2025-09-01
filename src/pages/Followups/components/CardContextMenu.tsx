import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { message } from 'antd';
import { CopyOutlined, PhoneOutlined, WechatOutlined, MessageOutlined } from '@ant-design/icons';
import './CardContextMenu.css';

interface CardContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  record: any;
  onClose: () => void;
  onRollback: (record: any) => void;
}

export const CardContextMenu: React.FC<CardContextMenuProps> = ({
  visible,
  x,
  y,
  record,
  onClose}) => {
  const menuRef = useRef<HTMLDivElement>(null);


  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [visible, onClose]);

  // 拨打电话
  const handleCallPhone = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    e.preventDefault(); // 阻止默认行为
    try {
      if (record.phone) {
        // 先复制电话号码到剪贴板（备用）
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(record.phone).catch(() => {});
        }
        
        // 使用tel:协议触发系统拨号
        window.location.href = `tel:${record.phone}`;
        
        // 延迟提示，让拨号器有时间打开
        setTimeout(() => {
          message.success(`正在拨打：${record.phone}`);
        }, 500);
        
        onClose();
      } else {
        message.warning('该记录没有电话信息');
      }
    } catch (error) {
      console.error('拨打电话失败:', error);
      message.error('拨打失败，请手动拨打');
    }
  };

  // 发送短信
  const handleSendSMS = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    e.preventDefault(); // 阻止默认行为
    try {
      if (record.phone) {
        // 预设的短信内容
        const smsContent = "您好，我是微领地青年社区的专属管家！我已经添加您的微信了，辛苦通过一下。";
        
        // 先复制短信内容到剪贴板（备用）
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(smsContent).catch(() => {});
        }
        
        // 使用sms:协议触发系统短信应用
        const encodedMessage = encodeURIComponent(smsContent);
        window.location.href = `sms:${record.phone}?body=${encodedMessage}`;
        
        // 延迟提示，让短信应用有时间打开
        setTimeout(() => {
          message.success(`正在发送短信提醒给：${record.phone}`);
        }, 500);
        
        onClose();
      } else {
        message.warning('该记录没有电话信息');
      }
    } catch (error) {
      console.error('发送短信提醒失败:', error);
      message.error('发送短信提醒失败，请手动发送');
    }
  };

  // 复制电话
  const handleCopyPhone = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    e.preventDefault(); // 阻止默认行为
    try {
      if (record.phone) {
        // 优先使用现代Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(record.phone);
          message.success('电话已复制到剪贴板');
        } else {
          // 降级方案：使用传统方法
          const textArea = document.createElement('textarea');
          textArea.value = record.phone;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          message.success('电话已复制到剪贴板');
        }
        // 延迟关闭菜单，让用户看到成功消息
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        message.warning('该记录没有电话信息');
      }
    } catch (error) {
      console.error('复制电话失败:', error);
      // 降级方案：使用传统方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = record.phone || '';
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success('电话已复制到剪贴板');
        onClose();
      } catch (fallbackError) {
        console.error('降级复制也失败:', fallbackError);
        message.error('复制失败，请手动复制');
      }
    }
  };

    // 添加微信联系人
  const handleOpenWechat = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    e.preventDefault(); // 阻止默认行为
    try {
      let copiedContent = '';
      let copiedType = '';
      
      // 优先复制微信信息，没有微信则复制手机号
      if (record.wechat) {
        copiedContent = record.wechat;
        copiedType = '微信号';
        
        // 复制微信号到剪贴板
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(record.wechat);
        } else {
          // 降级方案：使用传统方法
          const textArea = document.createElement('textarea');
          textArea.value = record.wechat;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else if (record.phone) {
        copiedContent = record.phone;
        copiedType = '手机号';
        
        // 复制手机号到剪贴板
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(record.phone);
        } else {
          // 降级方案：使用传统方法
          const textArea = document.createElement('textarea');
          textArea.value = record.phone;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        message.warning('该记录没有微信和电话信息');
        return;
      }
      
      // 尝试打开微信
      try {
        const wechatUrl = `weixin://`;
        window.location.href = wechatUrl;
        
        // 延迟提示，让微信有时间打开
        setTimeout(() => {
          if (record.wechat) {
            // 有微信号的情况
            message.success(`${copiedType}已复制：${copiedContent}，微信已打开，请按以下步骤添加好友：
1. 点击微信底部的"通讯录"
2. 点击右上角的"+"号
3. 选择"添加朋友"
4. 粘贴${copiedType}搜索添加`);
          } else {
            // 只有手机号的情况
            message.success(`${copiedType}已复制：${copiedContent}，微信已打开，请按以下步骤添加好友：
1. 点击微信底部的"通讯录"
2. 点击右上角的"+"号
3. 选择"添加朋友"
4. 选择"手机号"或"搜索手机号"
5. 粘贴手机号搜索添加`);
          }
        }, 1000);
        
      } catch {
        // 如果无法打开微信，给出提示
        if (record.wechat) {
          message.info(`${copiedType}已复制：${copiedContent}，请手动打开微信添加好友`);
        } else {
          message.info(`${copiedType}已复制：${copiedContent}，请手动打开微信，通过手机号搜索添加好友`);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('添加微信好友失败:', error);
      if (record.wechat) {
        message.info(`微信号：${record.wechat}，请手动搜索添加`);
      } else if (record.phone) {
        message.info(`手机号：${record.phone}，请手动在微信中搜索添加`);
      }
      onClose();
    }
  };





  if (!visible) return null;

  // 使用Portal渲染到body上，确保不被其他元素遮挡
  const menuContent = (
    <>
      {/* 长按菜单 */}
      <div
        ref={menuRef}
        className="card-context-menu"
        style={{
          position: 'fixed',
          zIndex: 9999,
          // 智能定位：水平居中，垂直根据触摸位置调整
          left: Math.max(10, Math.min(window.innerWidth - 180, x - 90)), // 水平居中，避免超出屏幕
          top: y > window.innerHeight / 2 ? y - 160 : y + 20, // 触摸位置在上半屏时向上显示，下半屏时向下显示（调整高度以适应4个选项）
        }}
        onClick={(e) => e.stopPropagation()} // 阻止菜单容器的点击事件冒泡
        onTouchEnd={(e) => e.stopPropagation()} // 阻止触摸事件冒泡
      >
                <div className="menu-item primary" onClick={handleCallPhone}>
          <PhoneOutlined className="menu-icon" />
          <span>拨打电话</span>
        </div>
        
        <div className="menu-item" onClick={handleCopyPhone}>
          <CopyOutlined className="menu-icon" />
          <span>复制电话</span>
        </div>
        
        <div className="menu-item" onClick={handleOpenWechat}>
          <WechatOutlined className="menu-icon" />
          <span>添加微信好友</span>
        </div>
        
        <div className="menu-item" onClick={handleSendSMS}>
          <MessageOutlined className="menu-icon" />
          <span>发送短信提醒</span>
        </div>
        

      </div>


    </>
  );

  // 使用Portal渲染到document.body
  return ReactDOM.createPortal(menuContent, document.body);
};
