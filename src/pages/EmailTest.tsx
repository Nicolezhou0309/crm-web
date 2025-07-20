import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Alert, Space, Typography, Divider } from 'antd';
import { MailOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface EmailTestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

const EmailTest: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<EmailTestResult | null>(null);

  const onFinish = async (values: any) => {
    setLoading(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-email', {
        body: {
          to: values.email,
          subject: values.subject || 'Supabase邮件测试',
          content: values.content || '这是一封测试邮件'
        }
      });

      if (error) {
        setTestResult({
          success: false,
          message: '邮件发送失败',
          error: error.message || '未知错误'
        });
        message.error('邮件发送失败：' + error.message);
      } else if (data && data.success) {
        setTestResult({
          success: true,
          message: '邮件发送成功！',
          data: data.data
        });
        message.success('邮件发送成功！');
      } else {
        setTestResult({
          success: false,
          message: '邮件发送失败',
          error: data?.error || data?.message || '未知错误'
        });
        message.error('邮件发送失败');
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: '请求失败',
        error: error.message
      });
      message.error('请求失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = async () => {
    form.setFieldsValue({
      email: 'zhoulingxin0309@gmail.com',
      subject: '快速测试邮件',
      content: '这是一封来自系统管理模块的快速测试邮件。'
    });
    
    await onFinish({
      email: 'zhoulingxin0309@gmail.com',
      subject: '快速测试邮件',
      content: '这是一封来自系统管理模块的快速测试邮件。'
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <MailOutlined style={{ fontSize: '48px', color: '#1677ff', marginBottom: '16px' }} />
          <Title level={2}>邮件发送测试</Title>
          <Text type="secondary">
            测试Supabase Edge Function的邮件发送功能
          </Text>
        </div>

        <Alert
          message="测试说明"
          description="本页面用于测试Resend SMTP邮件发送功能。开发环境限制：只能发送到Resend验证的邮箱地址。"
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
        
        <Alert
          message="重要提示"
          description="在开发环境中，Resend只允许发送到验证过的邮箱地址。如需发送到其他邮箱，需要验证域名。"
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            email: 'zhoulingxin0309@gmail.com',
            subject: '系统邮件测试',
            content: '这是一封来自系统管理模块的测试邮件。\n\n发送时间：' + new Date().toLocaleString('zh-CN')
          }}
        >
          <Form.Item
            label="收件人邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入收件人邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input 
              placeholder="请输入收件人邮箱，如：zhoulingxin0309@gmail.com"
              prefix={<MailOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="邮件主题"
            name="subject"
            rules={[{ required: true, message: '请输入邮件主题' }]}
          >
            <Input placeholder="请输入邮件主题" />
          </Form.Item>

          <Form.Item
            label="邮件内容"
            name="content"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="请输入邮件内容"
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<SendOutlined />}
                size="large"
              >
                发送测试邮件
              </Button>
              <Button 
                onClick={handleQuickTest}
                loading={loading}
                icon={<CheckCircleOutlined />}
                size="large"
              >
                快速测试
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {testResult && (
          <>
            <Divider />
            <div>
              <Title level={4}>测试结果</Title>
              <Alert
                message={testResult.message}
                description={
                  <div>
                    {testResult.success ? (
                      <div>
                        <p>✅ 邮件发送成功！</p>
                        {testResult.data?.id && (
                          <p><strong>邮件ID：</strong>{testResult.data.id}</p>
                        )}
                        <p><strong>发送时间：</strong>{new Date().toLocaleString('zh-CN')}</p>
                      </div>
                    ) : (
                      <div>
                        <p>❌ 邮件发送失败</p>
                        <p><strong>错误信息：</strong>{testResult.error}</p>
                      </div>
                    )}
                  </div>
                }
                type={testResult.success ? 'success' : 'error'}
                showIcon
                icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              />
            </div>
          </>
        )}

        <Divider />

        <div>
          <Title level={4}>使用说明</Title>
          <ul>
            <li><strong>测试邮箱：</strong>请使用Resend验证的邮箱地址，如 <code>zhoulingxin0309@gmail.com</code></li>
            <li><strong>发件人：</strong>系统将使用 <code>noreply@resend.dev</code> 作为发件人</li>
            <li><strong>服务商：</strong>使用Resend作为SMTP服务提供商</li>
            <li><strong>开发限制：</strong>只能发送到验证过的邮箱地址</li>
            <li><strong>快速测试：</strong>点击"快速测试"按钮使用预设的测试参数</li>
            <li><strong>生产环境：</strong>需要验证域名才能发送到任意邮箱</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default EmailTest; 