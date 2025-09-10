import React, { useState, useCallback } from 'react';
import { Upload, Button, Image, message, List } from 'antd';
import type { UploadProps } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { uploadImage, validateImageFile, getImageUrl, generateOSSPath } from '../utils/imageUploadUtils';
import { supabase } from '../supaClient';

export interface MultiImageUploadProps {
  // 基础配置
  bucket: string;
  filePathPrefix: string; // 文件路径前缀，如 'rollback-evidence'
  onUploadSuccess: (urls: string[]) => void;
  onUploadError?: (error: string) => void;
  
  // 显示配置
  showPreview?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  buttonSize?: 'small' | 'middle' | 'large';
  
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
  currentImages?: string[]; // 当前已上传的图片URL列表
  
  // 上传方式
  useOSS?: boolean; // 是否使用OSS上传，默认true
  
  // 样式
  className?: string;
  style?: React.CSSProperties;
}

interface UploadFile {
  uid: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  url?: string;
  thumbUrl?: string;
  file?: File;
  preview?: string;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  bucket,
  filePathPrefix,
  onUploadSuccess,
  onUploadError,
  showPreview = true,
  previewWidth = 120,
  previewHeight = 120,
  buttonText = '上传图片',
  buttonIcon = <UploadOutlined />,
  buttonSize = 'middle',
  enableCompression = true,
  compressionOptions = {
    maxSizeMB: 0.1,        // 高压缩率：0.1MB
    maxWidthOrHeight: 800, // 高压缩率：800px
    useWebWorker: true
  },
  accept = 'image/*',
  maxCount = 5,
  maxSize = 0.5,
  disabled = false,
  loading = false,
  currentImages = [],
  useOSS = true, // 默认使用OSS
  className,
  style
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // 处理文件上传
  const handleUpload = useCallback(async (file: File) => {
    try {
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

      // 3. 检查文件数量
      if (fileList.length >= maxCount) {
        const error = `最多只能上传 ${maxCount} 张图片`;
        message.error(error);
        onUploadError?.(error);
        return false;
      }

      let processedFile = file;

      // 4. 压缩图片（如果启用）
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

      // 5. 创建预览
      const preview = URL.createObjectURL(processedFile);
      const uid = `${Date.now()}-${Math.random()}`;
      
      const newFile: UploadFile = {
        uid,
        name: file.name,
        status: 'uploading',
        file: processedFile,
        preview
      };

      setFileList(prev => [...prev, newFile]);
      setUploading(true);

      // 6. 上传图片（支持OSS和Supabase）
      let finalFilePath: string;
      if (useOSS) {
        // 使用OSS上传，生成新的文件路径
        finalFilePath = generateOSSPath(filePathPrefix, processedFile.name);
      } else {
        // 使用Supabase上传，保持原有逻辑
        const fileExt = processedFile.name.split('.').pop() || 'jpg';
        finalFilePath = `${filePathPrefix}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
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
        
        // 更新文件状态为错误
        setFileList(prev => prev.map(f => 
          f.uid === uid ? { ...f, status: 'error' } : f
        ));
        return false;
      }

      // 7. 获取公共URL
      const publicUrl = getImageUrl(bucket, finalFilePath, useOSS);
      
      // 8. 更新文件状态
      setFileList(prev => prev.map(f => 
        f.uid === uid 
          ? { 
              ...f, 
              status: 'done', 
              url: publicUrl, 
              thumbUrl: publicUrl 
            } 
          : f
      ));

      // 9. 通知父组件
      const allUrls = fileList
        .filter(f => f.status === 'done' && f.url)
        .map(f => f.url!)
        .concat([publicUrl]);
      
      onUploadSuccess(allUrls);
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
  }, [bucket, filePathPrefix, onUploadSuccess, onUploadError, enableCompression, compressionOptions, maxCount, maxSize, fileList]);

  // 删除文件
  const handleRemove = useCallback((file: UploadFile) => {
    // 清理预览URL
    if (file.preview && file.preview.startsWith('blob:')) {
      URL.revokeObjectURL(file.preview);
    }

    setFileList(prev => {
      const newList = prev.filter(f => f.uid !== file.uid);
      
      // 通知父组件更新URL列表
      const urls = newList
        .filter(f => f.status === 'done' && f.url)
        .map(f => f.url!);
      onUploadSuccess(urls);
      
      return newList;
    });
  }, [onUploadSuccess]);

  // 渲染上传按钮
  const renderUploadButton = () => (
    <div>
      {buttonIcon}
      <div style={{ marginTop: 8 }}>{buttonText}</div>
    </div>
  );

  // 渲染文件列表
  const renderFileList = () => {
    if (!showPreview) return null;

    return (
      <div className="multi-image-preview" style={{ marginTop: 8 }}>
        {fileList.map(file => (
          <div key={file.uid} style={{ 
            display: 'inline-block', 
            margin: '4px',
            position: 'relative'
          }}>
            <Image
              src={file.preview || file.thumbUrl}
              width={previewWidth}
              height={previewHeight}
              style={{ 
                objectFit: 'cover',
                borderRadius: 4,
                border: file.status === 'error' ? '2px solid #ff4d4f' : '1px solid #d9d9d9'
              }}
              alt={file.name}
            />
            {file.status === 'uploading' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px'
              }}>
                上传中...
              </div>
            )}
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
              onClick={() => handleRemove(file)}
            />
          </div>
        ))}
      </div>
    );
  };

  const uploadProps: UploadProps = {
    showUploadList: false,
    accept,
    beforeUpload: handleUpload,
    disabled: disabled || uploading || loading,
    multiple: true
  };

  return (
    <div className="multi-image-upload-container">
      <Upload {...uploadProps}>
        {fileList.length < maxCount && renderUploadButton()}
      </Upload>
      
      {renderFileList()}
      
      <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
        支持jpg、png格式，最多{maxCount}张，每张不超过{maxSize}MB
      </div>
    </div>
  );
};

export default MultiImageUpload;
