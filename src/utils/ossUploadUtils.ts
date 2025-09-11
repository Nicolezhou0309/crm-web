/**
 * 阿里云 OSS 上传工具
 * 提供图片上传到阿里云 OSS 的功能
 */

import OSS from 'ali-oss';

// OSS配置
const ossConfig = {
  region: import.meta.env.VITE_OSS_REGION || 'cn-shanghai',
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID,
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET,
  bucket: import.meta.env.VITE_OSS_BUCKET || 'vlinker-crm',
  endpoint: import.meta.env.VITE_OSS_ENDPOINT || 'https://oss-cn-shanghai.aliyuncs.com',
  secure: true,
  timeout: 60000
};

// 创建OSS客户端实例
let ossClient: OSS | null = null;

function getOSSClient(): OSS {
  if (!ossClient) {
    // 检查必需的环境变量
    if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret) {
      throw new Error('OSS配置不完整：缺少 AccessKeyId 或 AccessKeySecret');
    }
    
    ossClient = new OSS(ossConfig);
  }
  return ossClient;
}

/**
 * 生成唯一的文件名
 * @param originalName 原始文件名
 * @param prefix 前缀路径
 * @returns 唯一的文件名
 */
function generateUniqueFileName(originalName: string, prefix: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || '';
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  
  return `${prefix}${sanitizedName}_${timestamp}_${random}.${extension}`;
}

/**
 * 上传单个文件到 OSS
 * @param file 要上传的文件
 * @param prefix 文件路径前缀
 * @param options 上传选项
 * @returns 上传结果
 */
export async function uploadToOSS(
  file: File,
  prefix: string = '',
  options: {
    maxFileSize?: number;
    allowedTypes?: string[];
    compress?: boolean;
    quality?: number;
  } = {}
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  fileName?: string;
}> {
  try {
    const {
      maxFileSize = 10 * 1024 * 1024, // 默认10MB
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      compress = true,
      quality = 0.8
    } = options;

    // 检查文件大小
    if (file.size > maxFileSize) {
      return {
        success: false,
        error: `文件大小超过限制 (${Math.round(maxFileSize / 1024 / 1024)}MB)`
      };
    }

    // 检查文件类型
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: `不支持的文件类型: ${file.type}`
      };
    }

    // 压缩图片（如果需要）
    let fileToUpload = file;
    if (compress && file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file, quality);
    }

    // 生成唯一文件名
    const fileName = generateUniqueFileName(file.name, prefix);
    
    // 获取OSS客户端
    const client = getOSSClient();
    
    // 上传文件
    const result = await client.put(fileName, fileToUpload);
    
    return {
      success: true,
      url: result.url,
      fileName: fileName
    };

  } catch (error) {
    console.error('OSS上传失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败'
    };
  }
}

/**
 * 批量上传文件到 OSS
 * @param files 要上传的文件数组
 * @param prefix 文件路径前缀
 * @param options 上传选项
 * @returns 上传结果数组
 */
export async function uploadMultipleToOSS(
  files: File[],
  prefix: string = '',
  options: {
    maxFileSize?: number;
    allowedTypes?: string[];
    compress?: boolean;
    quality?: number;
    maxConcurrent?: number;
  } = {}
): Promise<Array<{
  success: boolean;
  url?: string;
  error?: string;
  fileName?: string;
  originalName?: string;
}>> {
  const {
    maxConcurrent = 3
  } = options;

  const results: Array<{
    success: boolean;
    url?: string;
    error?: string;
    fileName?: string;
    originalName?: string;
  }> = [];

  // 分批处理文件
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (file) => {
      const result = await uploadToOSS(file, prefix, options);
      return {
        ...result,
        originalName: file.name
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param quality 压缩质量 (0-1)
 * @returns 压缩后的文件
 */
async function compressImage(file: File, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 计算压缩后的尺寸
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // 设置canvas尺寸
      canvas.width = width;
      canvas.height = height;

      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height);

      // 转换为Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 删除OSS文件
 * @param fileName 文件名
 * @returns 删除结果
 */
export async function deleteFromOSS(fileName: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = getOSSClient();
    await client.delete(fileName);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('OSS删除失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除失败'
    };
  }
}

/**
 * 获取OSS文件信息
 * @param fileName 文件名
 * @returns 文件信息
 */
export async function getOSSFileInfo(fileName: string): Promise<{
  success: boolean;
  info?: any;
  error?: string;
}> {
  try {
    const client = getOSSClient();
    const result = await client.head(fileName);
    
    return {
      success: true,
      info: result
    };
  } catch (error) {
    console.error('获取OSS文件信息失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取文件信息失败'
    };
  }
}

/**
 * 检查OSS连接状态
 * @returns 连接状态
 */
export async function checkOSSConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = getOSSClient();
    await client.getBucketInfo(ossConfig.bucket);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('OSS连接检查失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '连接失败'
    };
  }
}
