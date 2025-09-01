import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Select, 
  Upload, 
  Alert, 
  Card, 
  Space,
  Typography,
  Divider,
  Tag
} from 'antd';
import { 
  UploadOutlined, 
  CopyOutlined, 
  DeleteOutlined, 
  RocketOutlined,
  MobileOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

interface FormData {
  title: string;
  content: string;
  topics: string;
  images: UploadFile[];
  publishMethod: 'app' | 'web' | 'both';
}

const XiaohongshuTest: React.FC = () => {
  const [form] = Form.useForm();
  const [selectedImages, setSelectedImages] = useState<UploadFile[]>([]);
  const [deviceType, setDeviceType] = useState<string>('');
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    visible: boolean;
  }>({
    type: 'info',
    message: '页面加载完成，请填写内容并测试发布功能',
    visible: true
  });

  // 检测设备类型
  useEffect(() => {
    detectDevice();
    showStatus('info', '页面加载完成，请填写内容并测试发布功能');
  }, []);

  const detectDevice = () => {
    const userAgent = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(userAgent)) {
      setDeviceType('iOS');
    } else if (/Android/.test(userAgent)) {
      setDeviceType('Android');
    } else {
      setDeviceType('Desktop');
    }
    console.log('检测到设备类型:', deviceType);
  };

  // 检查是否在App内
  const isInApp = () => {
    const userAgent = navigator.userAgent;
    return /xiaohongshu|Xiaohongshu|XHS|xhs/i.test(userAgent);
  };

  // 检查是否在微信内
  const isInWeChat = () => {
    const userAgent = navigator.userAgent;
    return /MicroMessenger/i.test(userAgent);
  };

  // 检查小红书App是否已安装
  const checkAppInstalled = async () => {
    try {
      showStatus('info', '🔍 检查小红书App安装状态...');
      
      // 尝试一个简单的scheme
      const testScheme = 'xiaohongshu://';
      
      // 使用iframe测试
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = testScheme;
      document.body.appendChild(iframe);
      
      // 等待检测
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 清理iframe
      document.body.removeChild(iframe);
      
      // 如果页面被隐藏，说明App已安装
      if (document.hidden) {
        showStatus('success', '✅ 检测到小红书App已安装！');
        return true;
      } else {
        showStatus('warning', '⚠️ 未检测到小红书App，或唤端权限被拒绝');
        return false;
      }
      
    } catch (error) {
      console.error('检查App安装状态失败:', error);
      showStatus('error', '❌ 检查App安装状态失败');
      return false;
    }
  };

  const showStatus = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setStatus({
      type,
      message,
      visible: true
    });

    // 自动隐藏成功和错误消息
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        setStatus(prev => ({ ...prev, visible: false }));
      }, 5000);
    }
  };

  // 图片上传处理
  const handleImageUpload: UploadProps['onChange'] = ({ fileList }) => {
    setSelectedImages(fileList);
  };

  // 移除图片（目前通过Upload组件的onChange自动处理）
  // const removeImage = (uid: string) => {
  //   setSelectedImages(prev => prev.filter(img => img.uid !== uid));
  // };

  // 格式化内容
  const formatContent = (data: FormData) => {
    let content = `${data.title}\n\n${data.content}`;
    
    if (data.topics) {
      const topics = data.topics.split(',').map(t => t.trim()).filter(t => t);
      if (topics.length > 0) {
        content += `\n\n${topics.map(t => `#${t}`).join(' ')}`;
      }
    }
    
    if (data.images && data.images.length > 0) {
      content += `\n\n📷 已选择 ${data.images.length} 张图片`;
    }
    
    return content;
  };

  // 复制到剪贴板
  const copyToClipboard = async (content: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        return true;
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return true;
        } catch (err) {
          document.body.removeChild(textArea);
          return false;
        }
      }
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      return false;
    }
  };

  // 尝试打开App - 模拟小红书网页端的唤端逻辑
  const tryOpenApp = async () => {
    try {
      showStatus('info', '📱 尝试唤端小红书App...');
      
      // 检查是否已经在App内
      if (isInApp()) {
        showStatus('success', '✅ 您已经在小红书App内！');
        return true;
      }
      
      // 检查是否在微信内（微信内唤端有限制）
      if (isInWeChat()) {
        showStatus('warning', '⚠️ 检测到您在微信内，唤端可能受限，建议复制链接到浏览器打开');
      }
      
      let appOpened = false;
      
      // 显示用户引导
      showStatus('info', '🔍 系统可能会弹出确认弹窗，请点击"打开"或"允许"');
      
      // 方法1: 小红书网页端方式 - 先尝试Universal Links
      try {
        showStatus('info', '🔗 尝试小红书网页端唤端方式...');
        
        // 模拟小红书的做法：先尝试网页链接，如果App已安装会自动唤起
        const xiaohongshuUrl = 'https://www.xiaohongshu.com/publish';
        
        // 保存当前页面状态
        const currentUrl = window.location.href;
        const currentTitle = document.title;
        
        // 尝试跳转到小红书网页
        window.location.href = xiaohongshuUrl;
        
        // 等待检测（小红书网页端通常使用较短的延迟）
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // 如果页面被隐藏，说明成功唤起App
        if (document.hidden) {
          appOpened = true;
          showStatus('success', '✅ 成功唤起小红书App！');
        } else {
          // 如果没有成功，恢复页面状态
          if (window.location.href !== currentUrl) {
            window.history.back();
            document.title = currentTitle;
          }
        }
        
      } catch (error) {
        console.log('小红书网页端方式唤端失败:', error);
      }
      
      // 方法2: 如果网页端方式失败，尝试Intent方式（Android）
      if (!appOpened && deviceType === 'Android') {
        try {
          showStatus('info', '🔄 尝试Android Intent方式...');
          
          // 使用更完整的Intent URL，包含fallback
          const intentUrl = 'intent://publish#Intent;scheme=xiaohongshu;package=com.xingin.xhs;S.browser_fallback_url=https://www.xiaohongshu.com/publish;end';
          window.location.href = intentUrl;
          
          // 等待检测
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (document.hidden) {
            appOpened = true;
            showStatus('success', '✅ 通过Android Intent成功唤端！');
          }
        } catch (error) {
          console.log('Android Intent唤端失败:', error);
        }
      }
      
      // 方法3: 如果还是失败，尝试传统URL Scheme
      if (!appOpened) {
        try {
          showStatus('info', '🔄 尝试传统URL Scheme...');
          
          // 保存当前页面状态
          const currentUrl = window.location.href;
          const currentTitle = document.title;
          
          // 尝试直接跳转
          window.location.href = 'xiaohongshu://publish';
          
          // 等待用户操作
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 如果页面被隐藏，说明成功唤端
          if (document.hidden) {
            appOpened = true;
            showStatus('success', '✅ 通过URL Scheme成功唤端！');
          } else {
            // 如果没有成功，恢复页面状态
            if (window.location.href !== currentUrl) {
              window.history.back();
              document.title = currentTitle;
            }
          }
          
        } catch (error) {
          console.log('URL Scheme唤端失败:', error);
        }
      }
      
      // 方法4: 如果还是失败，提供用户指导
      if (!appOpened) {
        showStatus('warning', '⚠️ 唤端可能失败，请检查：');
        
        // 延迟显示详细指导
        setTimeout(() => {
          showStatus('info', '📋 唤端失败可能的原因：\n1. 未安装小红书App\n2. 需要手动允许唤端权限\n3. 在限制性环境内（如微信）');
        }, 2000);
        
        // 提供手动安装指导
        setTimeout(() => {
          showStatus('info', '💡 建议：\n1. 确认已安装小红书App\n2. 在设置中允许浏览器唤端权限\n3. 或直接使用网页版发布');
        }, 4000);
      }
      
      return appOpened;
    } catch (error) {
      console.error('唤端过程出错:', error);
      showStatus('error', '❌ 唤端过程出错');
      return false;
    }
  };

  // 打开网页版
  const openWebVersion = () => {
    try {
      showStatus('info', '🌐 打开小红书网页版...');
      
      setTimeout(() => {
        const webUrl = 'https://www.xiaohongshu.com/publish';
        window.open(webUrl, '_blank');
        showStatus('success', '✅ 已打开小红书网页版');
      }, 2000);
      
    } catch (error) {
      console.error('打开网页版失败:', error);
      showStatus('error', '❌ 打开网页版失败');
    }
  };

  // 执行发布策略
  const executePublishStrategy = async (publishMethod: string) => {
    if (publishMethod === 'app' || publishMethod === 'both') {
      const appOpened = await tryOpenApp();
      if (!appOpened && publishMethod === 'app') {
        // 如果只选择App但唤端失败，自动降级到网页版
        openWebVersion();
      }
    }
    
    if (publishMethod === 'web' || publishMethod === 'both') {
      openWebVersion();
    }
  };

  // 测试小红书发布
  const testXiaohongshu = async () => {
    try {
      const values = await form.validateFields();
      showStatus('info', '🚀 开始测试小红书发布功能...');

      // 复制内容到剪贴板
      const formattedContent = formatContent(values);
      const copySuccess = await copyToClipboard(formattedContent);
      
      if (!copySuccess) {
        showStatus('error', '❌ 复制到剪贴板失败');
        return;
      }

      // 执行发布策略
      await executePublishStrategy(values.publishMethod);

      showStatus('success', '✅ 测试完成！内容已复制到剪贴板，请在小红书中粘贴发布');

    } catch (error) {
      console.error('测试失败:', error);
      showStatus('error', `❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 复制到剪贴板
  const handleCopyToClipboard = async () => {
    try {
      const values = await form.validateFields();
      const formattedContent = formatContent(values);
      
      const success = await copyToClipboard(formattedContent);
      if (success) {
        showStatus('success', '✅ 内容已复制到剪贴板！');
      } else {
        showStatus('error', '❌ 复制失败');
      }
    } catch (error) {
      showStatus('error', '❌ 请先填写完整内容');
    }
  };

  // 清空表单
  const clearForm = () => {
    form.resetFields();
    setSelectedImages([]);
    showStatus('info', '🗑️ 表单已清空');
  };

  // 页面可见性变化检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('页面隐藏 - 可能已切换到小红书App');
      } else {
        console.log('页面显示 - 回到测试页面');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter 快速测试
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        testXiaohongshu();
      }
      
      // Ctrl/Cmd + C 复制到剪贴板
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopyToClipboard();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div style={{ 
      padding: window.innerWidth <= 768 ? '16px' : '24px', 
      maxWidth: '800px', 
      margin: '0 auto',
      paddingBottom: window.innerWidth <= 768 ? '80px' : '24px' // 为移动端底部导航留出空间
    }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={window.innerWidth <= 768 ? 3 : 2} style={{ color: '#ff6b6b', marginBottom: '8px' }}>
            📱 小红书自动发布测试
          </Title>
          <Paragraph style={{ color: '#666', fontSize: window.innerWidth <= 768 ? '14px' : '16px' }}>
            测试自动唤端、打开发帖页面和内容填充功能
          </Paragraph>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            title: '测试自动发布功能',
            content: `这是一条测试笔记，用于验证小红书自动发布功能。

主要测试内容：
✅ 自动唤端小红书App
✅ 自动打开发帖页面  
✅ 自动填充文案内容
✅ 自动上传图片

#测试 #自动化 #小红书`,
            topics: '测试,自动化,小红书,技术',
            publishMethod: 'app'
          }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="输入笔记标题" />
          </Form.Item>

          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea 
              rows={8} 
              placeholder="输入笔记内容"
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Form.Item
            label="话题标签"
            name="topics"
          >
            <Input placeholder="输入话题标签，用逗号分隔" />
          </Form.Item>

          <Form.Item label="图片上传">
            <Upload
              listType={window.innerWidth <= 768 ? "picture" : "picture-card"}
              fileList={selectedImages}
              onChange={handleImageUpload}
              beforeUpload={() => false} // 阻止自动上传
              accept="image/*"
              multiple
            >
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8, fontSize: window.innerWidth <= 768 ? '12px' : '14px' }}>
                  {window.innerWidth <= 768 ? '上传' : '上传图片'}
                </div>
              </div>
            </Upload>
            <div style={{ 
              marginTop: '8px', 
              fontSize: window.innerWidth <= 768 ? '11px' : '12px', 
              color: '#999',
              textAlign: window.innerWidth <= 768 ? 'center' : 'left'
            }}>
              支持 JPG、PNG、GIF 格式{window.innerWidth <= 768 ? '' : '，支持拖拽上传'}
            </div>
          </Form.Item>

          <Form.Item
            label="发布方式"
            name="publishMethod"
          >
            <Select>
              <Select.Option value="app">小红书App（推荐）</Select.Option>
              <Select.Option value="web">网页版</Select.Option>
              <Select.Option value="both">App + 网页版</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space 
              size="middle" 
              direction={window.innerWidth <= 768 ? 'vertical' : 'horizontal'}
              style={{ 
                width: '100%', 
                justifyContent: 'center',
                alignItems: 'stretch'
              }}
            >
              <Button
                type="primary"
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                icon={<RocketOutlined />}
                onClick={testXiaohongshu}
                style={{ 
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  height: window.innerWidth <= 768 ? '44px' : '48px',
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 32px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                🚀 测试小红书发布
              </Button>
              <Button
                icon={<MobileOutlined />}
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                onClick={tryOpenApp}
                style={{ 
                  height: window.innerWidth <= 768 ? '44px' : '48px', 
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 24px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                📱 智能唤端App
              </Button>
              <Button
                icon={<GlobalOutlined />}
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                onClick={() => {
                  showStatus('info', '🔗 尝试小红书官方网页端唤端方式...');
                  window.location.href = 'https://www.xiaohongshu.com/publish';
                }}
                style={{ 
                  height: window.innerWidth <= 768 ? '44px' : '44px', 
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 24px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                🌐 官方网页端
              </Button>
              <Button
                icon={<InfoCircleOutlined />}
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                onClick={checkAppInstalled}
                style={{ 
                  height: window.innerWidth <= 768 ? '44px' : '44px', 
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 24px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                🔍 检查App状态
              </Button>
              <Button
                icon={<CopyOutlined />}
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                onClick={handleCopyToClipboard}
                style={{ 
                  height: window.innerWidth <= 768 ? '44px' : '48px', 
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 24px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                📋 复制到剪贴板
              </Button>
              <Button
                icon={<DeleteOutlined />}
                size={window.innerWidth <= 768 ? 'large' : 'large'}
                onClick={clearForm}
                style={{ 
                  height: window.innerWidth <= 768 ? '44px' : '48px', 
                  padding: window.innerWidth <= 768 ? '0 16px' : '0 24px',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}
              >
                🗑️ 清空表单
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {status.visible && (
          <Alert
            message={status.message}
            type={status.type}
            showIcon
            style={{ marginTop: '16px' }}
            closable
            onClose={() => setStatus(prev => ({ ...prev, visible: false }))}
          />
        )}

        <Divider />

        <Card size="small" style={{ background: '#f8f9fa' }}>
          <Title level={window.innerWidth <= 768 ? 5 : 4} style={{ marginBottom: '16px' }}>
            🎯 功能特性
          </Title>
          <Space 
            direction="vertical" 
            style={{ width: '100%' }}
            size={window.innerWidth <= 768 ? 'small' : 'middle'}
          >
            <div>
              <Tag icon={<MobileOutlined />} color="blue" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                智能检测设备类型（{deviceType}）
              </Tag>
            </div>
            <div>
              <Tag icon={<RocketOutlined />} color="green" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                小红书网页端方式 + Android Intent + URL Scheme（模拟官方实现）
              </Tag>
            </div>
            <div>
              <Tag icon={<GlobalOutlined />} color="orange" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                智能降级到网页版（如果App未安装）
              </Tag>
            </div>
            <div>
              <Tag icon={<CopyOutlined />} color="purple" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                自动复制内容到剪贴板
              </Tag>
            </div>
            <div>
              <Tag icon={<UploadOutlined />} color="cyan" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                支持多图片上传和预览
              </Tag>
            </div>
            <div>
              <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                响应式设计，支持移动端
              </Tag>
            </div>
            <div>
              <Tag icon={<InfoCircleOutlined />} color="default" style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px' }}>
                实时状态反馈和错误处理
              </Tag>
            </div>
          </Space>
        </Card>

        <div style={{ 
          marginTop: '16px', 
          fontSize: window.innerWidth <= 768 ? '10px' : '12px', 
          color: '#999', 
          textAlign: 'center',
          padding: window.innerWidth <= 768 ? '0 16px' : '0'
        }}>
          快捷键：Ctrl/Cmd + Enter 快速测试 | Ctrl/Cmd + C 复制到剪贴板
        </div>
      </Card>
    </div>
  );
};

export default XiaohongshuTest;
