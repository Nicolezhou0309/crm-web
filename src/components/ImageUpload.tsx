import React, { useState } from 'react';
import { Upload, Button, Image, message, type UploadProps } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import imageCompression from 'browser-image-compression';
import { uploadImage, validateImageFile, getImageUrl, generateOSSPath } from '../utils/imageUploadUtils';
import { supabase } from '../supaClient';

export interface ImageUploadProps {
  // 基础配置
  bucket: string;
  filePath: string;
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: string) => void;
  
  // 显示配置
  showPreview?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  buttonSize?: 'small' | 'middle' | 'large';
  
  // 裁剪配置
  enableCrop?: boolean;
  cropShape?: 'rect' | 'round';
  cropAspect?: number;
  cropQuality?: number;
  cropTitle?: string;
  showCropGrid?: boolean;
  showCropReset?: boolean;
  
  // 压缩配置
  enableCompression?: boolean;
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  };
  
  // 验证配置
  accept?: string;
  maxCount?: number;
  maxSize?: number; // MB
  
  // 状态
  disabled?: boolean;
  loading?: boolean;
  currentImageUrl?: string;
  
  // 上传方式
  useOSS?: boolean; // 是否使用OSS上传，默认true
  
  // 样式
  className?: string;
  style?: React.CSSProperties;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  bucket,
  filePath,
  onUploadSuccess,
  onUploadError,
  showPreview = true,
  previewWidth = 120,
  previewHeight = 120,
  buttonText = '上传图片',
  buttonIcon = <UploadOutlined />,
  buttonSize = 'middle',
  enableCrop = false,
  cropShape = 'rect',
  cropAspect = 1,
  cropQuality = 1,
  cropTitle = '裁剪图片',
  showCropGrid = false,
  showCropReset = false,
  enableCompression = true,
  compressionOptions = {
    maxSizeMB: 0.5, // 500KB
    maxWidthOrHeight: 1024,
    useWebWorker: true
  },
  accept = 'image/*',
  maxCount = 1,
  maxSize = 10,
  disabled = false,
  loading = false,
  currentImageUrl,
  useOSS = true, // 默认使用OSS
  className,
  style
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

  // 处理文件上传
  const handleUpload = async (file: File) => {
    try {
      setUploading(true);

      // 1. 验证文件
      const validation = validateImageFile(file);
      if (!validation.valid) {
        message.error(validation.error || '文件验证失败');
        onUploadError?.(validation.error || '文件验证失败');
        return false;
      }

      // 2. 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        const error = `文件大小不能超过 ${maxSize}MB`;
        message.error(error);
        onUploadError?.(error);
        return false;
      }

      let processedFile = file;

      // 3. 压缩图片（如果启用）
      if (enableCompression) {
        try {
          processedFile = await imageCompression(file, compressionOptions);
          console.log('✅ 图片压缩完成:', {
            原始大小: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            压缩后大小: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
            压缩率: `${((1 - processedFile.size / file.size) * 100).toFixed(1)}%`
          });
        } catch (error) {
          console.error('图片压缩失败:', error);
          message.error('图片压缩失败');
          onUploadError?.('图片压缩失败');
          return false;
        }
      }

      // 4. 上传图片（支持OSS和Supabase）
      let finalFilePath = filePath;
      if (useOSS) {
        // 使用OSS上传，根据bucket生成对应的文件路径
        finalFilePath = generateOSSPath(bucket, processedFile.name);
      }
      
      const { data, error } = await uploadImage(bucket, finalFilePath, processedFile, {
        upsert: true,
        contentType: processedFile.type,
        useOSS: useOSS
      });

      if (error) {
        const errorMsg = error.message || '上传失败';
        message.error(errorMsg);
        onUploadError?.(errorMsg);
        return false;
      }

      // 5. 获取公共URL
      const publicUrl = getImageUrl(bucket, finalFilePath, useOSS);
      
      // 6. 更新预览（仅在启用预览时）
      if (showPreview) {
        setPreviewUrl(publicUrl);
      }
      
      // 7. 通知父组件
      onUploadSuccess(publicUrl);
      message.success('上传成功');
      
      return false; // 阻止默认上传行为
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '上传失败';
      console.error('上传异常:', error);
      message.error(errorMsg);
      onUploadError?.(errorMsg);
      return false;
    } finally {
      setUploading(false);
    }
  };

  // 删除图片
  const handleRemove = () => {
    setPreviewUrl(null);
    onUploadSuccess(''); // 通知父组件图片已删除
  };

  // 渲染上传按钮
  const renderUploadButton = () => (
    <Button 
      icon={buttonIcon} 
      size={buttonSize}
      loading={uploading || loading}
      disabled={disabled}
      className={className}
      style={style}
    >
      {buttonText}
    </Button>
  );

  // 渲染上传组件
  const renderUpload = () => {
    const uploadProps: UploadProps = {
      showUploadList: false,
      accept,
      beforeUpload: handleUpload,
      disabled: disabled || uploading || loading,
      multiple: maxCount > 1
    };

    if (enableCrop) {
      return (
        <ImgCrop
          cropShape={cropShape}
          aspect={cropAspect}
          quality={cropQuality}
          showGrid={showCropGrid}
          showReset={showCropReset}
          modalTitle={cropTitle}
        >
          <Upload {...uploadProps}>
            {renderUploadButton()}
          </Upload>
        </ImgCrop>
      );
    }

    return (
      <Upload {...uploadProps}>
        {renderUploadButton()}
      </Upload>
    );
  };

  return (
    <div className="image-upload-container">
      {/* 上传组件 */}
      {renderUpload()}
      
      {/* 预览区域 */}
      {showPreview && previewUrl && (
        <div className="image-preview" style={{ marginTop: 8 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Image
              src={previewUrl}
              width={previewWidth}
              height={previewHeight}
              style={{ 
                objectFit: 'cover',
                borderRadius: cropShape === 'round' ? '50%' : 4
              }}
              alt="预览图片"
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                minWidth: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #ff4d4f'
              }}
              onClick={handleRemove}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
