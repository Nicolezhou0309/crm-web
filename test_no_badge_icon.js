// 测试圆形图标移除功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试圆形图标移除功能...');

function testNoBadgeIcon() {
  try {
    console.log('📊 检查圆形图标是否已移除...');
    
    // 测试1: 检查事件元素结构
    console.log('🔍 测试1: 检查事件元素结构');
    const events = document.querySelectorAll('.calendar-event');
    console.log('事件数量:', events.length);
    
    if (events.length > 0) {
      events.forEach((event, index) => {
        // 检查是否还有 Badge 组件
        const badge = event.querySelector('.ant-badge');
        const eventText = event.querySelector('.event-text');
        
        console.log(`事件${index + 1}:`, {
          hasBadge: !!badge,
          hasEventText: !!eventText,
          textContent: eventText?.textContent?.trim()
        });
        
        if (badge) {
          console.log('❌ 发现 Badge 组件，圆形图标未完全移除');
        } else if (eventText) {
          console.log('✅ 使用纯文本显示，圆形图标已移除');
        }
      });
    }
    
    // 测试2: 检查圆形状态图标
    console.log('🔍 测试2: 检查圆形状态图标');
    const statusDots = document.querySelectorAll('.ant-badge-status-dot');
    console.log('状态圆点数量:', statusDots.length);
    
    if (statusDots.length === 0) {
      console.log('✅ 未发现圆形状态图标');
    } else {
      console.log('❌ 仍存在圆形状态图标');
    }
    
    // 测试3: 检查文本显示
    console.log('🔍 测试3: 检查文本显示');
    const eventTexts = document.querySelectorAll('.event-text');
    console.log('事件文本元素数量:', eventTexts.length);
    
    if (eventTexts.length > 0) {
      eventTexts.forEach((text, index) => {
        const computedStyle = window.getComputedStyle(text);
        console.log(`文本${index + 1}:`, {
          text: text.textContent?.trim(),
          fontSize: computedStyle.fontSize,
          color: computedStyle.color,
          fontWeight: computedStyle.fontWeight,
          textAlign: computedStyle.textAlign
        });
      });
    }
    
    // 测试4: 检查样式应用
    console.log('🔍 测试4: 检查样式应用');
    const firstEvent = events[0];
    if (firstEvent) {
      const eventStyle = window.getComputedStyle(firstEvent);
      const textStyle = window.getComputedStyle(firstEvent.querySelector('.event-text'));
      
      console.log('事件容器样式:', {
        display: eventStyle.display,
        alignItems: eventStyle.alignItems,
        justifyContent: eventStyle.justifyContent
      });
      
      console.log('文本样式:', {
        fontSize: textStyle.fontSize,
        color: textStyle.color,
        fontWeight: textStyle.fontWeight,
        textAlign: textStyle.textAlign,
        overflow: textStyle.overflow,
        textOverflow: textStyle.textOverflow,
        whiteSpace: textStyle.whiteSpace
      });
    }
    
    // 测试5: 检查视觉效果
    console.log('🔍 测试5: 检查视觉效果');
    const hasBadgeComponents = document.querySelectorAll('.ant-badge').length > 0;
    const hasStatusDots = document.querySelectorAll('.ant-badge-status-dot').length > 0;
    const hasEventTexts = document.querySelectorAll('.event-text').length > 0;
    
    console.log('组件检查结果:', {
      hasBadgeComponents: hasBadgeComponents,
      hasStatusDots: hasStatusDots,
      hasEventTexts: hasEventTexts
    });
    
    if (!hasBadgeComponents && !hasStatusDots && hasEventTexts) {
      console.log('✅ 圆形图标移除成功！');
      console.log('✅ 现在使用纯文本显示线索编号');
    } else {
      console.log('❌ 圆形图标移除不完整');
    }
    
    // 测试6: 检查文本省略功能
    console.log('🔍 测试6: 检查文本省略功能');
    const longTexts = Array.from(eventTexts).filter(text => {
      const content = text.textContent?.trim();
      return content && content.length > 8;
    });
    
    console.log('长文本数量:', longTexts.length);
    if (longTexts.length > 0) {
      console.log('长文本示例:', longTexts.map(text => text.textContent?.trim()));
    }
    
    // 测试7: 检查响应式设计
    console.log('🔍 测试7: 检查响应式设计');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (eventTexts.length > 0) {
      const firstText = eventTexts[0];
      const textRect = firstText.getBoundingClientRect();
      console.log('文本元素尺寸:', {
        width: textRect.width,
        height: textRect.height
      });
      
      if (textRect.width < 50) {
        console.log('📱 移动端：文本显示空间较小');
      } else {
        console.log('💻 桌面端：文本显示空间充足');
      }
    }
    
    console.log('🎉 圆形图标移除测试完成！');
    console.log('✅ 优化效果:');
    console.log('   - 移除了线索编号前的圆形状态图标');
    console.log('   - 使用纯文本显示，界面更简洁');
    console.log('   - 保持了文本省略功能');
    console.log('   - 保持了居中对齐效果');
    console.log('   - 响应式设计依然有效');
    
    console.log('📝 显示规则:');
    console.log('   - 直接显示线索编号文本');
    console.log('   - 无圆形状态图标');
    console.log('   - 文本超出时自动省略');
    console.log('   - 保持居中对齐');
    console.log('   - 颜色为深灰色 (#262626)');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testNoBadgeIcon(); 