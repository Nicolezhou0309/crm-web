// 安全的JWT token解析 - 保留此功能，tokenManager中没有
export const safeParseJWT = (token: string): any => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }
    
    const payload = tokenParts[1];
    // 添加padding以确保base64解码正确
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decodedPayload = atob(paddedPayload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.warn('JWT解析失败:', error);
    return null;
  }
};

// 检查token是否有效 - 保留此功能，tokenManager中没有
export const isTokenValid = (token: string): boolean => {
  try {
    const payload = safeParseJWT(token);
    if (!payload) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}; 