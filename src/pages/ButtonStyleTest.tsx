import React, { useState } from 'react';
import { Button, Modal, Card, Space, Typography } from 'antd';

const { Title, Text } = Typography;

const ButtonStyleTest: React.FC = () => {
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalContent, setConfirmModalContent] = useState('');

  const showConfirmModal = (title: string, content: string) => {
    setConfirmModalTitle(title);
    setConfirmModalContent(content);
    setConfirmModalVisible(true);
  };

  const handleConfirmModalOk = () => {
    console.log('确认按钮被点击');
    setConfirmModalVisible(false);
  };

  const handleConfirmModalCancel = () => {
    console.log('取消按钮被点击');
    setConfirmModalVisible(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>按钮样式测试页面</Title>
      
      <Card title="确认对话框按钮样式测试" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" size="large">
          <Text>点击下面的按钮来测试确认对话框的按钮样式：</Text>
          
          <Space>
            <Button 
              type="primary" 
              onClick={() => showConfirmModal('温馨提示', '您有未保存的更改，确定要取消吗？')}
            >
              测试温馨提示
            </Button>
            
            <Button 
              onClick={() => showConfirmModal('确认操作', '您确定要执行此操作吗？此操作不可撤销。')}
            >
              测试确认操作
            </Button>
            
            <Button 
              onClick={() => showConfirmModal('删除确认', '您确定要删除这条记录吗？删除后将无法恢复。')}
            >
              测试删除确认
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 确认弹窗 */}
      <Modal
        title={confirmModalTitle}
        open={confirmModalVisible}
        onOk={handleConfirmModalOk}
        onCancel={handleConfirmModalCancel}
        okText="确认"
        cancelText="取消"
        width={500}
        zIndex={2000}
        styles={{
          mask: {
            zIndex: 1999
          }
        }}
        footer={[
          <Button key="cancel" onClick={handleConfirmModalCancel} style={{ 
            marginRight: '12px',
            minWidth: '80px'
          }}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmModalOk} style={{
            minWidth: '80px'
          }}>
            确认
          </Button>
        ]}
      >
        <div style={{ 
          whiteSpace: 'pre-line', 
          lineHeight: '1.6',
          fontSize: '14px'
        }}>
          {confirmModalContent}
        </div>
      </Modal>

      <Card title="样式说明" style={{ marginTop: '24px' }}>
        <Space direction="vertical">
          <Text strong>修改内容：</Text>
          <ul>
            <li>✅ 按钮改为并排显示</li>
            <li>✅ 取消按钮在左，确认按钮在右</li>
            <li>✅ 按钮间距：12px</li>
            <li>✅ 按钮最小宽度：80px</li>
            <li>✅ 确认按钮为主色调（蓝色）</li>
            <li>✅ 取消按钮为默认样式（白色边框）</li>
          </ul>
          
          <Text strong>使用场景：</Text>
          <ul>
            <li>未保存更改的确认提示</li>
            <li>删除操作的确认</li>
            <li>重要操作的二次确认</li>
          </ul>
        </Space>
      </Card>
    </div>
  );
};

export default ButtonStyleTest;
