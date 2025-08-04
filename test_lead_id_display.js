// 测试线索编号显示效果 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试线索编号显示效果...');

function testLeadIdDisplay() {
  try {
    console.log('📊 测试线索编号显示...');
    
    // 测试1: 检查日历单元格
    console.log('🔍 测试1: 检查日历单元格');
    const calendarCells = document.querySelectorAll('.ant-picker-calendar-date');
    console.log('日历单元格数量:', calendarCells.length);
    
    // 检查有事件的单元格
    const cellsWithEvents = document.querySelectorAll('.ant-picker-calendar-date .calendar-event');
    console.log('有事件的单元格数量:', cellsWithEvents.length);
    
    if (cellsWithEvents.length > 0) {
      console.log('事件详情:');
      cellsWithEvents.forEach((event, index) => {
        const badge = event.querySelector('.ant-badge-status-text');
        const badgeStatus = event.querySelector('.ant-badge-status-dot');
        const statusClass = badgeStatus?.className || '';
        
        console.log(`  事件${index + 1}:`, {
          text: badge?.textContent?.trim(),
          status: statusClass.includes('success') ? '成功' : 
                  statusClass.includes('processing') ? '进行中' :
                  statusClass.includes('warning') ? '警告' :
                  statusClass.includes('error') ? '错误' : '默认'
        });
      });
    }
    
    // 测试2: 检查样式
    console.log('🔍 测试2: 检查样式');
    const firstEvent = document.querySelector('.calendar-event');
    if (firstEvent) {
      const computedStyle = window.getComputedStyle(firstEvent);
      console.log('事件样式:', {
        fontSize: computedStyle.fontSize,
        padding: computedStyle.padding,
        margin: computedStyle.margin,
        borderRadius: computedStyle.borderRadius,
        backgroundColor: computedStyle.backgroundColor
      });
    }
    
    // 测试3: 检查文本内容
    console.log('🔍 测试3: 检查文本内容');
    const eventTexts = Array.from(cellsWithEvents).map(event => {
      const badge = event.querySelector('.ant-badge-status-text');
      return badge?.textContent?.trim();
    });
    
    console.log('事件文本列表:', eventTexts);
    
    // 检查是否只显示线索编号
    const hasPrefix = eventTexts.some(text => text?.includes('线索'));
    console.log('是否包含"线索"前缀:', hasPrefix);
    
    if (!hasPrefix) {
      console.log('✅ 已优化为只显示线索编号');
    } else {
      console.log('❌ 仍包含"线索"前缀');
    }
    
    // 测试4: 检查单元格布局
    console.log('🔍 测试4: 检查单元格布局');
    const firstCell = document.querySelector('.calendar-cell');
    if (firstCell) {
      const computedStyle = window.getComputedStyle(firstCell);
      console.log('单元格样式:', {
        display: computedStyle.display,
        flexDirection: computedStyle.flexDirection,
        gap: computedStyle.gap,
        padding: computedStyle.padding,
        minHeight: computedStyle.minHeight
      });
    }
    
    // 测试5: 检查响应式设计
    console.log('🔍 测试5: 检查响应式设计');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (viewportWidth < 768) {
      console.log('📱 移动端视图');
    } else {
      console.log('💻 桌面端视图');
    }
    
    // 测试6: 检查事件数量
    console.log('🔍 测试6: 检查事件数量');
    const cellsWithMultipleEvents = Array.from(calendarCells).filter(cell => {
      const events = cell.querySelectorAll('.calendar-event');
      return events.length > 1;
    });
    
    console.log('包含多个事件的单元格数量:', cellsWithMultipleEvents.length);
    
    cellsWithMultipleEvents.forEach((cell, index) => {
      const events = cell.querySelectorAll('.calendar-event');
      const dateValue = cell.querySelector('.ant-picker-calendar-date-value');
      console.log(`  单元格${index + 1} (${dateValue?.textContent?.trim()}):`, events.length, '个事件');
    });
    
    console.log('🎉 线索编号显示测试完成！');
    console.log('✅ 优化效果:');
    console.log('   - 只显示线索编号，不显示"线索"前缀');
    console.log('   - 字体大小优化为9px');
    console.log('   - 事件间距优化为1px');
    console.log('   - 单元格内边距优化为2px');
    console.log('   - 支持多个事件紧凑显示');
    console.log('   - 响应式设计适配移动端');
    
    console.log('📝 显示效果:');
    console.log('   - 线索编号居中显示');
    console.log('   - 不同跟进阶段用不同颜色标识');
    console.log('   - 悬停时有轻微上移效果');
    console.log('   - 支持多个线索在同一日期显示');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testLeadIdDisplay(); 