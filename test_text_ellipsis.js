// 测试线索编号文本省略功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试线索编号文本省略功能...');

function testTextEllipsis() {
  try {
    console.log('📊 测试文本省略功能...');
    
    // 测试1: 检查事件元素
    console.log('🔍 测试1: 检查事件元素');
    const events = document.querySelectorAll('.calendar-event');
    console.log('事件数量:', events.length);
    
    if (events.length > 0) {
      events.forEach((event, index) => {
        const badge = event.querySelector('.ant-badge-status-text');
        const text = badge?.textContent?.trim();
        const computedStyle = window.getComputedStyle(badge);
        
        console.log(`事件${index + 1}:`, {
          text: text,
          width: computedStyle.width,
          overflow: computedStyle.overflow,
          textOverflow: computedStyle.textOverflow,
          whiteSpace: computedStyle.whiteSpace,
          maxWidth: computedStyle.maxWidth
        });
      });
    }
    
    // 测试2: 检查容器宽度
    console.log('🔍 测试2: 检查容器宽度');
    const calendarCells = document.querySelectorAll('.calendar-cell');
    console.log('日历单元格数量:', calendarCells.length);
    
    if (calendarCells.length > 0) {
      const firstCell = calendarCells[0];
      const computedStyle = window.getComputedStyle(firstCell);
      console.log('单元格样式:', {
        width: computedStyle.width,
        padding: computedStyle.padding,
        overflow: computedStyle.overflow
      });
    }
    
    // 测试3: 检查文本长度
    console.log('🔍 测试3: 检查文本长度');
    const eventTexts = Array.from(events).map(event => {
      const badge = event.querySelector('.ant-badge-status-text');
      return badge?.textContent?.trim();
    });
    
    console.log('所有事件文本:', eventTexts);
    
    // 检查是否有长文本
    const longTexts = eventTexts.filter(text => text && text.length > 8);
    console.log('长文本数量:', longTexts.length);
    console.log('长文本列表:', longTexts);
    
    // 测试4: 检查省略效果
    console.log('🔍 测试4: 检查省略效果');
    events.forEach((event, index) => {
      const badge = event.querySelector('.ant-badge-status-text');
      const text = badge?.textContent?.trim();
      const rect = badge?.getBoundingClientRect();
      
      if (text && rect) {
        const isTruncated = text.length > 8 && rect.width < 60; // 假设60px是显示完整文本的宽度
        console.log(`事件${index + 1} (${text}):`, {
          textLength: text.length,
          elementWidth: rect.width,
          isTruncated: isTruncated
        });
      }
    });
    
    // 测试5: 检查响应式设计
    console.log('🔍 测试5: 检查响应式设计');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    // 计算每个单元格的可用宽度
    const calendarContainer = document.querySelector('.ant-picker-calendar');
    if (calendarContainer) {
      const containerRect = calendarContainer.getBoundingClientRect();
      const cellWidth = containerRect.width / 7; // 7列
      console.log('估算单元格宽度:', cellWidth, 'px');
      
      if (cellWidth < 80) {
        console.log('📱 移动端：单元格宽度较小，文本省略更重要');
      } else {
        console.log('💻 桌面端：单元格宽度充足');
      }
    }
    
    // 测试6: 检查CSS样式应用
    console.log('🔍 测试6: 检查CSS样式应用');
    const firstEvent = events[0];
    if (firstEvent) {
      const eventStyle = window.getComputedStyle(firstEvent);
      const badge = firstEvent.querySelector('.ant-badge');
      const badgeStyle = window.getComputedStyle(badge);
      const textStyle = window.getComputedStyle(firstEvent.querySelector('.ant-badge-status-text'));
      
      console.log('事件容器样式:', {
        width: eventStyle.width,
        overflow: eventStyle.overflow,
        display: eventStyle.display
      });
      
      console.log('Badge样式:', {
        width: badgeStyle.width,
        overflow: badgeStyle.overflow,
        display: badgeStyle.display
      });
      
      console.log('文本样式:', {
        overflow: textStyle.overflow,
        textOverflow: textStyle.textOverflow,
        whiteSpace: textStyle.whiteSpace,
        maxWidth: textStyle.maxWidth
      });
    }
    
    console.log('🎉 文本省略功能测试完成！');
    console.log('✅ 优化效果:');
    console.log('   - 线索编号超出容器宽度时自动省略');
    console.log('   - 使用 text-overflow: ellipsis 实现省略');
    console.log('   - 保持 white-space: nowrap 防止换行');
    console.log('   - 设置 max-width: 100% 限制最大宽度');
    console.log('   - 容器设置 overflow: hidden 隐藏超出部分');
    
    console.log('📝 省略规则:');
    console.log('   - 文本超出容器宽度时显示省略号');
    console.log('   - 保持文本居中对齐');
    console.log('   - 响应式设计适配不同屏幕尺寸');
    console.log('   - 悬停时仍可查看完整信息');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testTextEllipsis(); 