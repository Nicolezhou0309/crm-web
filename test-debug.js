import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 开始测试...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 
  });
  
  const page = await browser.newPage();
  
  // 监听控制台日志
  page.on('console', (msg) => {
    console.log(`🔍 [${msg.type()}] ${msg.text()}`);
  });
  
  try {
    console.log('📱 导航到页面...');
    await page.goto('http://localhost:5177');
    
    console.log('⏳ 等待页面加载...');
    await page.waitForLoadState('networkidle');
    
    // 检查是否需要登录
    console.log('🔍 检查登录状态...');
    const loginButton = page.locator('button').filter({ hasText: '登录' });
    const loginForm = page.locator('form');
    
    if (await loginButton.isVisible()) {
      console.log('🔐 需要登录，尝试自动登录...');
      
      // 查找用户名和密码输入框
      const usernameInput = page.locator('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="用户名"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (await usernameInput.isVisible() && await passwordInput.isVisible()) {
        console.log('📝 填写登录信息...');
        await usernameInput.fill('537093913@qq.com');
        await passwordInput.fill('Xin199539');
        
        console.log('🖱️ 点击登录按钮...');
        await loginButton.click();
        
        console.log('⏳ 等待登录完成...');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        // 检查登录是否成功
        const currentUrl = page.url();
        console.log('🔍 当前URL:', currentUrl);
        
        // 检查是否有错误信息
        const errorMessage = page.locator('.ant-message-error, .error, [class*="error"]');
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          console.log('❌ 登录错误:', errorText);
        }
        
        // 检查是否还在登录页面
        if (currentUrl.includes('login') || await loginButton.isVisible()) {
          console.log('❌ 登录失败，仍在登录页面');
        } else {
          console.log('✅ 登录成功，已跳转到主页面');
        }
      } else {
        console.log('❌ 未找到登录表单');
      }
    } else {
      console.log('✅ 已登录或无需登录');
    }
    
    // 检查当前页面内容
    console.log('🔍 检查当前页面内容...');
    const pageTitle = await page.title();
    console.log('📄 页面标题:', pageTitle);
    
    const bodyText = await page.locator('body').textContent();
    console.log('📄 页面内容片段:', bodyText?.substring(0, 200) + '...');
    
    console.log('🔍 查找实时连接状态...');
    const realtimeStatus = page.locator('[data-testid="realtime-status"]');
    
    if (await realtimeStatus.isVisible()) {
      const statusText = await realtimeStatus.textContent();
      console.log('✅ 实时连接状态:', statusText);
    } else {
      console.log('❌ 未找到实时连接状态元素');
    }
    
    console.log('🔍 查找卡片...');
    const cards = page.locator('[data-testid="schedule-card"]');
    const cardCount = await cards.count();
    console.log(`📊 找到 ${cardCount} 个卡片`);
    
    if (cardCount > 0) {
      const firstCard = cards.first();
      const cardText = await firstCard.textContent();
      console.log('📋 第一个卡片内容:', cardText);
      
      if (cardText?.includes('立即报名')) {
        console.log('🖱️ 点击第一个可编辑卡片...');
        await firstCard.click();
        
        console.log('⏳ 等待弹窗...');
        await page.waitForTimeout(2000);
        
        const modal = page.locator('.ant-modal');
        if (await modal.isVisible()) {
          console.log('✅ 弹窗已打开');
          
          const modalText = await modal.textContent();
          console.log('📋 弹窗内容:', modalText);
          
          // 关闭弹窗
          const cancelButton = page.locator('button').filter({ hasText: '取消' });
          if (await cancelButton.isVisible()) {
            console.log('🖱️ 点击取消按钮...');
            await cancelButton.click();
            console.log('✅ 弹窗已关闭');
          }
        } else {
          console.log('❌ 弹窗未出现');
        }
      }
    }
    
    console.log('✅ 测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await browser.close();
  }
}

runTest();
