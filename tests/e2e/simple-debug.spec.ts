import { test, expect, Page } from '@playwright/test';

test.describe('简单调试测试', () => {
  test('检查页面加载和基本功能', async ({ page }) => {
    // 监听控制台日志
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const logMessage = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleLogs.push(logMessage);
      console.log(`🔍 [控制台] ${logMessage}`);
    });

    // 监听网络请求
    page.on('request', (request) => {
      if (request.url().includes('live_stream_schedules') || request.url().includes('realtime')) {
        console.log(`🌐 [请求] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('live_stream_schedules') || response.url().includes('realtime')) {
        console.log(`📡 [响应] ${response.status()} ${response.url()}`);
      }
    });

    // 导航到页面
    console.log('🚀 开始导航到页面...');
    await page.goto('http://localhost:5177');
    
    // 等待页面加载
    console.log('⏳ 等待页面加载...');
    await page.waitForLoadState('networkidle');
    
    // 检查是否有实时连接状态显示
    console.log('🔍 查找实时连接状态...');
    const realtimeStatus = page.locator('[data-testid="realtime-status"]');
    
    if (await realtimeStatus.isVisible()) {
      const statusText = await realtimeStatus.textContent();
      console.log('✅ 实时连接状态:', statusText);
    } else {
      console.log('❌ 未找到实时连接状态元素');
    }
    
    // 检查是否有报名状态显示
    console.log('🔍 查找报名状态...');
    const registrationStatus = page.locator('[data-testid="registration-status"]');
    
    if (await registrationStatus.isVisible()) {
      const regStatusText = await registrationStatus.textContent();
      console.log('✅ 报名状态:', regStatusText);
    } else {
      console.log('❌ 未找到报名状态元素');
    }
    
    // 查找可编辑的卡片
    console.log('🔍 查找可编辑卡片...');
    const cards = page.locator('[data-testid="schedule-card"]');
    const cardCount = await cards.count();
    console.log(`📊 找到 ${cardCount} 个卡片`);
    
    if (cardCount > 0) {
      // 获取第一个卡片的文本内容
      const firstCard = cards.first();
      const cardText = await firstCard.textContent();
      console.log('📋 第一个卡片内容:', cardText);
      
      // 检查是否有"立即报名"按钮
      const hasRegisterButton = cardText?.includes('立即报名');
      console.log('🔍 是否有立即报名按钮:', hasRegisterButton);
      
      if (hasRegisterButton) {
        console.log('🖱️ 点击第一个可编辑卡片...');
        await firstCard.click();
        
        // 等待弹窗出现
        console.log('⏳ 等待弹窗出现...');
        const modal = page.locator('.ant-modal');
        
        if (await modal.isVisible({ timeout: 5000 })) {
          console.log('✅ 弹窗已打开');
          
          // 检查弹窗内容
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
    
    // 输出所有控制台日志
    console.log('\n📋 所有控制台日志:');
    consoleLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    // 基本断言
    expect(cardCount).toBeGreaterThan(0);
  });
});
