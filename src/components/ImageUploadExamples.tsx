import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import ImageUpload from './ImageUpload';

const { Title, Text } = Typography;

/**
 * ImageUpload 组件使用示例
 * 展示各种配置和使用场景
 */

const ImageUploadExamples: React.FC = () => {
  // 头像上传示例
  const handleAvatarUpload = (url: string) => {
    console.log('头像上传成功:', url);
  };

  // 横幅上传示例
  const handleBannerUpload = (url: string) => {
    console.log('横幅上传成功:', url);
  };

  // 图标上传示例
  const handleIconUpload = (url: string) => {
    console.log('图标上传成功:', url);
  };

  // 多文件上传示例
  const handleMultipleUpload = (url: string) => {
    console.log('多文件上传成功:', url);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>ImageUpload 组件使用示例</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 基础头像上传 */}
        <Card title="1. 基础头像上传（圆形裁剪）">
          <ImageUpload
            bucket="avatars"
            filePath="user_123_avatar.jpg"
            onUploadSuccess={handleAvatarUpload}
            enableCrop={true}
            cropShape="round"
            cropAspect={1}
            cropTitle="裁剪头像"
            showCropGrid={false}
            showCropReset={true}
            buttonText="上传头像"
            previewWidth={100}
            previewHeight={100}
          />
        </Card>

        {/* 横幅上传 */}
        <Card title="2. 横幅上传（矩形裁剪，3:1比例）">
          <ImageUpload
            bucket="banners"
            filePath="banner_homepage.jpg"
            onUploadSuccess={handleBannerUpload}
            enableCrop={true}
            cropShape="rect"
            cropAspect={3}
            cropTitle="裁剪横幅"
            showCropGrid={true}
            cropQuality={0.92}
            compressionOptions={{
              maxSizeMB: 1,          // 中等压缩：1MB
              maxWidthOrHeight: 1920, // 中等压缩：1920px
              useWebWorker: true
            }}
            buttonText="上传横幅"
            previewWidth={200}
            previewHeight={67}
          />
        </Card>

        {/* 图标上传 */}
        <Card title="3. 图标上传（小尺寸，PNG格式）">
          <ImageUpload
            bucket="achievement-icons"
            filePath="achievement_icon.png"
            onUploadSuccess={handleIconUpload}
            enableCrop={true}
            cropShape="round"
            cropAspect={1}
            cropTitle="裁剪图标"
            compressionOptions={{
              maxSizeMB: 0.2,
              maxWidthOrHeight: 128,
              useWebWorker: true
            }}
            accept="image/png,image/jpeg"
            buttonText="上传图标"
            buttonSize="small"
            previewWidth={64}
            previewHeight={64}
          />
        </Card>

        {/* 多文件上传 */}
        <Card title="4. 多文件上传（回退证据）">
          <ImageUpload
            bucket="rollback"
            filePath="evidence_123.jpg"
            onUploadSuccess={handleMultipleUpload}
            enableCompression={true}
            compressionOptions={{
              maxSizeMB: 0.1,        // 高压缩率：0.1MB
              maxWidthOrHeight: 800, // 高压缩率：800px
              useWebWorker: true
            }}
            maxCount={5}
            maxSize={5}
            buttonText="上传证据"
            previewWidth={120}
            previewHeight={120}
          />
        </Card>

        {/* 禁用状态 */}
        <Card title="5. 禁用状态">
          <ImageUpload
            bucket="avatars"
            filePath="disabled_upload.jpg"
            onUploadSuccess={handleAvatarUpload}
            disabled={true}
            buttonText="禁用上传"
            currentImageUrl="https://via.placeholder.com/100x100"
          />
        </Card>

        {/* 加载状态 */}
        <Card title="6. 加载状态">
          <ImageUpload
            bucket="avatars"
            filePath="loading_upload.jpg"
            onUploadSuccess={handleAvatarUpload}
            loading={true}
            buttonText="上传中..."
          />
        </Card>
      </Space>

      <Divider />

      <Card title="迁移指南">
        <Title level={4}>从现有代码迁移到 ImageUpload 组件</Title>
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>迁移前（Profile.tsx 头像上传）：</Text>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 8 }}>
{`<ImgCrop cropShape="round" aspect={1} quality={1}>
  <Upload
    showUploadList={false}
    accept="image/png,image/jpeg,image/jpg"
    disabled={avatarUploading}
    beforeUpload={async (file) => {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      try {
        const compressedFile = await imageCompression(file, options);
        await handleAvatarUpload({ file: { status: 'done', originFileObj: compressedFile } });
        return false;
      } catch (e) {
        message.error('图片压缩失败: ' + e.message);
        return false;
      }
    }}
  >
    <Button icon={<UploadOutlined />} loading={avatarUploading}>
      更换头像
    </Button>
  </Upload>
</ImgCrop>`}
          </pre>
        </div>

        <div>
          <Text strong>迁移后：</Text>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 8 }}>
{`<ImageUpload
  bucket="avatars"
  filePath={\`user_\${user.id}_\${Date.now()}.jpg\`}
  onUploadSuccess={(url) => {
    // 处理上传成功
    setAvatarUrl(url);
    // 更新数据库...
  }}
  enableCrop={true}
  cropShape="round"
  cropAspect={1}
  cropTitle="裁剪头像"
  compressionOptions={{
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    useWebWorker: true
  }}
  buttonText="更换头像"
  previewWidth={100}
  previewHeight={100}
  currentImageUrl={avatarUrl}
/>`}
          </pre>
        </div>
      </Card>
    </div>
  );
};

export default ImageUploadExamples;
