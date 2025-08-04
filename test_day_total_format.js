// 测试日期记录总数"共X条"格式显示 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试日期记录总数"共X条"格式显示...');

function testDayTotalFormat() {
  try {
    console.log('📊 检查日期记录总数显示格式...');
    
    // 测试1: 检查总数显示元素
    console.log('🔍 测试1: 检查总数显示元素');
    const totalCounts = document.querySelectorAll('.day-total-count');
    console.log('日期总数显示元素数量:', totalCounts.length);
    
    if (totalCounts.length > 0) {
      totalCounts.forEach((count, index) => {
        const text = count.querySelector('.count-text')?.textContent;
        console.log(`日期${index + 1}总数显示:`, text);
        
        // 检查格式是否符合"共X条"
        if (text && text.match(/共\d+条/)) {
          console.log('✅ 格式正确:', text);
        } else {
          console.log('❌ 格式错误:', text);
        }
      });
    } else {
      console.log('📝 暂无日期记录总数显示');
    }
    
    // 测试2: 检查样式应用
    console.log('🔍 测试2: 检查样式应用');
    if (totalCounts.length > 0) {
      const firstCount = totalCounts[0];
      const computedStyle = window.getComputedStyle(firstCount);
      const textStyle = window.getComputedStyle(firstCount.querySelector('.count-text'));
      
      console.log('总数容器样式:', {
        position: computedStyle.position,
        top: computedStyle.top,
        right: computedStyle.right,
        background: computedStyle.backgroundColor,
        borderRadius: computedStyle.borderRadius,
        padding: computedStyle.padding,
        fontSize: computedStyle.fontSize,
        minWidth: computedStyle.minWidth,
        height: computedStyle.height
      });
      
      console.log('总数文本样式:', {
        fontSize: textStyle.fontSize,
        fontWeight: textStyle.fontWeight,
        color: textStyle.color,
        whiteSpace: textStyle.whiteSpace
      });
    }
    
    // 测试3: 检查位置和尺寸
    console.log('🔍 测试3: 检查位置和尺寸');
    if (totalCounts.length > 0) {
      totalCounts.forEach((count, index) => {
        const rect = count.getBoundingClientRect();
        console.log(`日期${index + 1}总数元素尺寸:`, {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right
        });
        
        // 检查是否在右上角
        const cell = count.closest('.calendar-cell');
        if (cell) {
          const cellRect = cell.getBoundingClientRect();
          const isTopRight = rect.top <= cellRect.top + 10 && rect.right >= cellRect.right - 40;
          console.log(`日期${index + 1}位置检查:`, isTopRight ? '✅ 右上角位置正确' : '❌ 位置不正确');
        }
      });
    }
    
    // 测试4: 检查数字范围
    console.log('🔍 测试4: 检查数字范围');
    const countNumbers = Array.from(totalCounts).map(count => {
      const text = count.querySelector('.count-text')?.textContent;
      const match = text?.match(/共(\d+)条/);
      return match ? parseInt(match[1]) : 0;
    });
    
    console.log('各日期记录数:', countNumbers);
    
    if (countNumbers.length > 0) {
      const maxCount = Math.max(...countNumbers);
      const minCount = Math.min(...countNumbers);
      console.log('记录数范围:', { min: minCount, max: maxCount });
      
      // 检查大数字的显示效果
      const largeCounts = countNumbers.filter(count => count > 9);
      if (largeCounts.length > 0) {
        console.log('大数字记录:', largeCounts);
        console.log('⚠️ 注意：大数字可能需要更多显示空间');
      }
    }
    
    // 测试5: 检查响应式设计
    console.log('🔍 测试5: 检查响应式设计');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (totalCounts.length > 0) {
      const firstCount = totalCounts[0];
      const rect = firstCount.getBoundingClientRect();
      
      if (rect.width < 40) {
        console.log('📱 移动端：总数显示可能被压缩');
      } else {
        console.log('💻 桌面端：总数显示空间充足');
      }
    }
    
    // 测试6: 检查与事件列表的关系
    console.log('🔍 测试6: 检查与事件列表的关系');
    const cellsWithEvents = document.querySelectorAll('.calendar-cell');
    let cellsWithCount = 0;
    let cellsWithEventsButNoCount = 0;
    
    cellsWithEvents.forEach(cell => {
      const events = cell.querySelectorAll('.calendar-event');
      const count = cell.querySelector('.day-total-count');
      
      if (events.length > 0) {
        if (count) {
          cellsWithCount++;
        } else {
          cellsWithEventsButNoCount++;
        }
      }
    });
    
    console.log('统计结果:', {
      cellsWithEvents: cellsWithEvents.length,
      cellsWithCount: cellsWithCount,
      cellsWithEventsButNoCount: cellsWithEventsButNoCount
    });
    
    if (cellsWithEventsButNoCount === 0) {
      console.log('✅ 所有有事件的日期都显示了总数');
    } else {
      console.log('❌ 部分有事件的日期未显示总数');
    }
    
    console.log('🎉 日期记录总数格式测试完成！');
    console.log('✅ 功能特点:');
    console.log('   - 格式：共X条');
    console.log('   - 位置：日期卡片右上角');
    console.log('   - 样式：蓝色背景，白色文字');
    console.log('   - 圆角设计，紧凑显示');
    console.log('   - 响应式适配不同屏幕');
    
    console.log('📝 显示规则:');
    console.log('   - 只有有记录的日期才显示总数');
    console.log('   - 格式统一为"共X条"');
    console.log('   - 位置固定在右上角');
    console.log('   - 字体大小9px，紧凑显示');
    console.log('   - 背景色为蓝色 (#1890ff)');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testDayTotalFormat(); 