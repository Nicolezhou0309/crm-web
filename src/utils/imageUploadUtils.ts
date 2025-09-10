/**
 * 图片上传工具类
 * 支持Supabase Storage和阿里云OSS两种上传方式
 */

import { supabase } from '../supaClient';
import { 
  safeUploadImage as ossUploadImage, 
  getImagePublicUrl as ossGetPublicUrl,
  validateImageFile as ossValidateImageFile,
  compressImage as ossCompressImage,
  generateFilePath as ossGenerateFilePath,
  checkOSSConnection
} from './ossUploadUtils';

/**
 * 安全上传图片到Supabase Storage
 * 自动设置正确的Content-Type，避免multipart格式问题
 */
export async function safeUploadImage(
  bucket: string,
  filePath: string,
  file: File,
  options: {
    upsert?: boolean;
    contentType?: string;
  } = {}
): Promise<{ data: any; error: any }> {
  try {
    // 确定正确的Content-Type
    const contentType = options.contentType || file.type || getContentTypeFromFile(file);
    
    console.log('📤 上传图片:', {
      bucket,
      filePath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      contentType
    });
    
    // 上传到Supabase Storage，确保设置正确的Content-Type
    const result = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: options.upsert || false,
        contentType: contentType
      });
    
    if (result.error) {
      console.error('❌ 上传失败:', result.error);
    } else {
      console.log('✅ 上传成功:', result.data);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 图片上传异常:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('上传失败')
    };
  }
}

/**
 * 根据文件扩展名确定Content-Type
 */
function getContentTypeFromFile(file: File): string {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    return 'image/jpeg';
  } else if (fileName.endsWith('.png')) {
    return 'image/png';
  } else if (fileName.endsWith('.gif')) {
    return 'image/gif';
  } else if (fileName.endsWith('.webp')) {
    return 'image/webp';
  } else if (fileName.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  
  // 默认返回JPEG
  return 'image/jpeg';
}

/**
 * 获取图片的公共URL
 */
export function getImagePublicUrl(bucket: string, filePath: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * 验证图片文件格式
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: '请选择图片文件' };
  }
  
  // 检查文件大小 (10MB限制)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '图片文件过大，请选择小于10MB的图片' };
  }
  
  // 检查文件扩展名
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return { valid: false, error: '不支持的图片格式，请选择JPG、PNG、GIF或WebP格式' };
  }
  
  return { valid: true };
}

/**
 * 压缩图片文件
 */
export async function compressImage(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  } = {}
): Promise<File> {
  // 动态导入imageCompression库
  const imageCompression = await import('browser-image-compression');
  
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    ...options
  };
  
  try {
    const compressedFile = await imageCompression.default(file, defaultOptions);
    console.log('✅ 图片压缩完成:', {
      原始大小: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      压缩后大小: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      压缩率: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
    });
    
    return compressedFile;
  } catch (error) {
    console.error('图片压缩失败:', error);
    throw new Error('图片压缩失败');
  }
}

// ============================================================================
// OSS上传相关函数
// ============================================================================

/**
 * 安全上传图片到阿里云OSS
 * 自动设置正确的Content-Type，避免multipart格式问题
 */
export async function safeUploadImageToOSS(
  filePath: string,
  file: File,
  options: {
    upsert?: boolean;
    contentType?: string;
    expires?: number;
  } = {}
): Promise<{ data: any; error: any }> {
  return await ossUploadImage(filePath, file, options);
}

/**
 * 获取OSS图片的公共URL
 */
export function getOSSImagePublicUrl(filePath: string, expires: number = 3600): string {
  return ossGetPublicUrl(filePath, expires);
}

/**
 * 验证OSS图片文件格式
 */
export function validateOSSImageFile(file: File): { valid: boolean; error?: string } {
  return ossValidateImageFile(file);
}

/**
 * 压缩OSS图片文件
 */
export async function compressOSSImage(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  } = {}
): Promise<File> {
  return await ossCompressImage(file, options);
}

/**
 * 生成OSS文件路径
 */
export function generateOSSPath(prefix: string, fileName: string): string {
  return ossGenerateFilePath(prefix, fileName);
}

/**
 * 检查OSS连接状态
 */
export async function checkOSSConnectionStatus(): Promise<{ connected: boolean; error?: string }> {
  return await checkOSSConnection();
}

// ============================================================================
// 统一上传接口（自动选择上传方式）
// ============================================================================

/**
 * 统一图片上传接口
 * 根据配置自动选择Supabase Storage或阿里云OSS
 */
export async function uploadImage(
  bucket: string,
  filePath: string,
  file: File,
  options: {
    upsert?: boolean;
    contentType?: string;
    useOSS?: boolean; // 强制使用OSS
  } = {}
): Promise<{ data: any; error: any }> {
  // 默认使用OSS，除非明确指定使用Supabase
  const useOSS = options.useOSS !== false;
  
  if (useOSS) {
    console.log('📤 使用OSS上传图片');
    return await safeUploadImageToOSS(filePath, file, options);
  } else {
    console.log('📤 使用Supabase上传图片');
    return await safeUploadImage(bucket, filePath, file, options);
  }
}

/**
 * 统一获取图片公共URL
 */
export function getImageUrl(
  bucket: string,
  filePath: string,
  useOSS: boolean = true,
  expires?: number
): string {
  if (useOSS) {
    return getOSSImagePublicUrl(filePath, expires);
  } else {
    return getImagePublicUrl(bucket, filePath);
  }
}
