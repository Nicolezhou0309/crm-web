// 企业微信OAuth认证API - 符合JustAuth最佳实践
// 所有敏感操作都在后端处理，前端只负责用户交互

import { logger } from '../utils/logger';

interface WecomAuthResponse {
  success: boolean;
  data?: {
    authUrl?: string;
    state?: string;
    sessionId?: string;
    expiresAt?: number;
    expiresIn?: number;
    userInfo?: any;
    redirectUrl?: string;
  };
  message?: string;
  error?: string;
}

interface WecomCallbackRequest {
  code: string;
  state: string;
}

interface WecomCallbackResponse {
  success: boolean;
  data?: {
    userInfo: any;
    redirectUrl: string;
  };
  error?: string;
}

// 1. 获取企业微信授权URL - 后端生成
export const getWecomAuthUrl = async (): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取企业微信授权URL失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取授权URL失败'
    };
  }
};

// 2. 处理企业微信回调 - 后端处理所有OAuth逻辑
export const handleWecomCallback = async (request: WecomCallbackRequest): Promise<WecomCallbackResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('处理企业微信回调失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '处理回调失败'
    };
  }
};

// 2.1 处理企业微信回调 - POST方法（前端发送）
export const handleWecomCallbackPost = async (request: WecomCallbackRequest): Promise<WecomCallbackResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    
    console.log('发送POST请求到后端:', `${apiBaseUrl}/auth/wecom/callback`);
    console.log('请求数据:', request);
    
    const response = await fetch(`${apiBaseUrl}/auth/wecom/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('后端响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('后端响应错误:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('后端响应数据:', data);
    return data;
  } catch (error) {
    console.error('处理企业微信回调失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '处理回调失败'
    };
  }
};

// 3. 检查企业微信登录状态 - 用于轮询
export const checkWecomLoginStatus = async (state: string): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    
    // 获取会话ID
    const sessionId = localStorage.getItem('wecom_session_id');
    
    // 构建请求URL，包含会话ID
    const requestUrl = `${apiBaseUrl}/auth/wecom/status?state=${encodeURIComponent(state)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
    
    logger.api('检查企业微信登录状态:', requestUrl);
    logger.api('state参数:', state);
    logger.api('sessionId参数:', sessionId);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.api('状态检查响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('状态检查API错误:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    logger.api('状态检查响应数据:', data);
    return data;
  } catch (error) {
    logger.error('检查企业微信登录状态失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '检查登录状态失败'
    };
  }
};

// 4. 获取企业微信二维码 - 后端生成
export const getWecomQRCode = async (): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const requestUrl = `${apiBaseUrl}/auth/wecom/qrcode`;
    
    console.log('🌐 请求企业微信二维码API:', requestUrl);
    console.log('🔗 API基础URL:', apiBaseUrl);
    logger.api('请求企业微信二维码API:', requestUrl);
    logger.api('API基础URL:', apiBaseUrl);
    
    if (!apiBaseUrl) {
      throw new Error('API基础URL未配置，请检查VITE_API_BASE_URL环境变量');
    }
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.api('API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('API响应错误:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 API响应数据:', data);
    logger.api('API响应数据:', data);
    
    // 保存会话ID到localStorage
    if (data.success && data.data?.sessionId) {
      localStorage.setItem('wecom_session_id', data.data.sessionId);
      console.log('💾 保存会话ID到localStorage:', data.data.sessionId);
    }
    
    return data;
  } catch (error) {
    logger.error('获取企业微信二维码失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取二维码失败'
    };
  }
};

// 导出类型
export type { WecomAuthResponse, WecomCallbackRequest, WecomCallbackResponse };
