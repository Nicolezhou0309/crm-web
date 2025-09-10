/**
 * OSS图片上传使用示例
 * 展示如何在现有组件中使用新的OSS上传功能
 */

import React, { useState } from 'react';
import { Card, Row, Col, Button, message, Space, Divider } from 'antd';
import ImageUpload from './ImageUpload';
import MultiImageUpload from './MultiImageUpload';

const OSSImageUploadExamples: React.FC = () => {
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [iconUrls, setIconUrls] = useState<string[]>([]);

  return (
    <div style={{ padding: 24 }}>
      <h1>OSS图片上传使用示例</h1>
      <p>展示如何在现有组件中使用新的OSS上传功能</p>
      
      <Row gutter={[16, 16]}>
        {/* 头像上传示例 */}
        <Col span={12}>
          <Card title="头像上传 (OSS)" size="small">
            <ImageUpload
              bucket="avatars"
              filePath="avatar.jpg"
              onUploadSuccess={(url) => {
                setAvatarUrl(url);
                message.success('头像上传成功');
              }}
              onUploadError={(error) => {
                message.error('头像上传失败: ' + error);
              }}
              useOSS={true} // 启用OSS上传
              enableCrop={true}
              cropShape="round"
              cropAspect={1}
              buttonText="上传头像"
              showPreview={true}
              previewWidth={120}
              previewHeight={120}
            />
            {avatarUrl && (
              <div style={{ marginTop: 8 }}>
                <p>上传的URL:</p>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {avatarUrl}
                </code>
              </div>
            )}
          </Card>
        </Col>

        {/* 横幅上传示例 */}
        <Col span={12}>
          <Card title="横幅上传 (OSS)" size="small">
            <ImageUpload
              bucket="banners"
              filePath="banner.jpg"
              onUploadSuccess={(url) => {
                setBannerUrl(url);
                message.success('横幅上传成功');
              }}
              onUploadError={(error) => {
                message.error('横幅上传失败: ' + error);
              }}
              useOSS={true} // 启用OSS上传
              enableCrop={true}
              cropAspect={3}
              cropQuality={0.92}
              buttonText="上传横幅"
              showPreview={true}
              previewWidth={200}
              previewHeight={67}
            />
            {bannerUrl && (
              <div style={{ marginTop: 8 }}>
                <p>上传的URL:</p>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {bannerUrl}
                </code>
              </div>
            )}
          </Card>
        </Col>

        {/* 回退证据上传示例 */}
        <Col span={12}>
          <Card title="回退证据上传 (OSS)" size="small">
            <MultiImageUpload
              bucket="avatars"
              filePathPrefix="rollback-evidence"
              onUploadSuccess={(urls) => {
                setEvidenceUrls(urls);
                message.success(`上传了 ${urls.length} 张证据图片`);
              }}
              onUploadError={(error) => {
                message.error('证据上传失败: ' + error);
              }}
              useOSS={true} // 启用OSS上传
              maxCount={5}
              maxSize={0.5} // 0.5MB
              buttonText="上传证据"
              showPreview={true}
              previewWidth={100}
              previewHeight={100}
            />
            {evidenceUrls.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p>上传的URLs ({evidenceUrls.length}):</p>
                {evidenceUrls.map((url, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {index + 1}. {url}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* 成就图标上传示例 */}
        <Col span={12}>
          <Card title="成就图标上传 (OSS)" size="small">
            <MultiImageUpload
              bucket="avatars"
              filePathPrefix="achievement-icons"
              onUploadSuccess={(urls) => {
                setIconUrls(urls);
                message.success(`上传了 ${urls.length} 个成就图标`);
              }}
              onUploadError={(error) => {
                message.error('图标上传失败: ' + error);
              }}
              useOSS={true} // 启用OSS上传
              enableCompression={true}
              compressionOptions={{
                maxSizeMB: 0.2, // 高压缩率
                maxWidthOrHeight: 200,
                useWebWorker: true
              }}
              maxCount={10}
              maxSize={0.2} // 0.2MB
              buttonText="上传图标"
              showPreview={true}
              previewWidth={80}
              previewHeight={80}
            />
            {iconUrls.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p>上传的URLs ({iconUrls.length}):</p>
                {iconUrls.map((url, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {index + 1}. {url}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* 对比示例 */}
      <Card title="OSS vs Supabase 对比" size="small">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <h4>使用OSS上传 (推荐)</h4>
            <ImageUpload
              bucket="avatars"
              filePath="comparison-oss.jpg"
              onUploadSuccess={(url) => {
                message.success('OSS上传成功');
              }}
              onUploadError={(error) => {
                message.error('OSS上传失败: ' + error);
              }}
              useOSS={true} // 使用OSS
              buttonText="OSS上传"
              showPreview={true}
              previewWidth={100}
              previewHeight={100}
            />
          </Col>
          
          <Col span={12}>
            <h4>使用Supabase上传 (备用)</h4>
            <ImageUpload
              bucket="avatars"
              filePath="comparison-supabase.jpg"
              onUploadSuccess={(url) => {
                message.success('Supabase上传成功');
              }}
              onUploadError={(error) => {
                message.error('Supabase上传失败: ' + error);
              }}
              useOSS={false} // 使用Supabase
              buttonText="Supabase上传"
              showPreview={true}
              previewWidth={100}
              previewHeight={100}
            />
          </Col>
        </Row>
      </Card>

      <Divider />

      {/* 使用说明 */}
      <Card title="使用说明" size="small">
        <div>
          <h4>1. 基本用法</h4>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
{`<ImageUpload
  bucket="avatars"
  filePath="avatar.jpg"
  onUploadSuccess={(url) => console.log(url)}
  useOSS={true} // 启用OSS上传
/>`}
          </pre>

          <h4>2. 多图片上传</h4>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
{`<MultiImageUpload
  bucket="avatars"
  filePathPrefix="evidence"
  onUploadSuccess={(urls) => console.log(urls)}
  useOSS={true} // 启用OSS上传
  maxCount={5}
/>`}
          </pre>

          <h4>3. 配置选项</h4>
          <ul>
            <li><code>useOSS</code>: 是否使用OSS上传，默认true</li>
            <li><code>enableCompression</code>: 是否启用图片压缩</li>
            <li><code>compressionOptions</code>: 压缩配置</li>
            <li><code>maxCount</code>: 最大上传数量</li>
            <li><code>maxSize</code>: 最大文件大小(MB)</li>
          </ul>

          <h4>4. 优势</h4>
          <ul>
            <li>✅ 更稳定的上传服务</li>
            <li>✅ 更好的CDN加速</li>
            <li>✅ 更灵活的存储管理</li>
            <li>✅ 支持签名URL访问</li>
            <li>✅ 向后兼容Supabase</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default OSSImageUploadExamples;
