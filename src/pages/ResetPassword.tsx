import React, { useState } from 'react';
import { Card, Typography, Form, Input, Button, message, Spin } from 'antd';
import { LockOutlined, MailOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ResetPassword: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const navigate = useNavigate();

  // 提交新密码
  const handleResetPassword = async (values: any) => {
    try {
      setLoading(true);
      const { password } = values;
      // Supabase 会自动识别当前URL中的access_token
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        message.error('密码重置失败: ' + error.message);
        return;
      }
      message.success('密码重置成功！正在跳转登录...');
      setCompleted(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      message.error('密码重置失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa' }}>
        <Card style={{ width: 400, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <Title level={3}>密码重置成功！</Title>
          <Text>即将跳转到登录页面...</Text>
          <div style={{ marginTop: 24 }}><Spin /></div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa' }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <Title level={3}>重置密码</Title>
        <Text type="secondary">请输入新密码以完成重置</Text>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleResetPassword}
          style={{ marginTop: 32 }}
        >
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                message: '密码必须包含大小写字母和数字'
              }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginTop: 32 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              重置密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword; 