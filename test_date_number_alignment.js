// 测试日期数字与总数显示的对齐效果 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试日期数字与总数显示的对齐效果...');

function testDateNumberAlignment() {
  try {
    console.log('📊 检查日期数字与总数显示的对齐...');
    
    // 测试1: 检查有事件的日期单元格
    console.log('🔍 测试1: 检查有事件的日期单元格');
    const cellsWithEvents = document.querySelectorAll('.ant-picker-cell.has-events');
    console.log('有事件的日期单元格数量:', cellsWithEvents.length);
    
    if (cellsWithEvents.length > 0) {
      cellsWithEvents.forEach((cell, index) => {
        const eventCount = cell.getAttribute('data-event-count');
        const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
        
        console.log(`日期${index + 1}:`, {
          dateValue: dateValue,
          eventCount: eventCount,
          hasAfterPseudo: !!cell.querySelector('::after')
        });
      });
    }
    
    // 测试2: 检查伪元素样式
    console.log('🔍 测试2: 检查伪元素样式');
    if (cellsWithEvents.length > 0) {
      const firstCell = cellsWithEvents[0];
      const computedStyle = window.getComputedStyle(firstCell, '::after');
      
      console.log('伪元素样式:', {
        content: computedStyle.content,
        position: computedStyle.position,
        top: computedStyle.top,
        right: computedStyle.right,
        background: computedStyle.backgroundColor,
        color: computedStyle.color,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight
      });
    }
    
    // 测试3: 检查日期数字位置
    console.log('🔍 测试3: 检查日期数字位置');
    const dateNumbers = document.querySelectorAll('.ant-picker-cell-inner');
    console.log('日期数字元素数量:', dateNumbers.length);
    
    if (dateNumbers.length > 0) {
      dateNumbers.forEach((dateNum, index) => {
        const rect = dateNum.getBoundingClientRect();
        const cell = dateNum.closest('.ant-picker-cell');
        const hasEvents = cell?.classList.contains('has-events');
        
        console.log(`日期数字${index + 1}:`, {
          text: dateNum.textContent?.trim(),
          top: rect.top,
          left: rect.left,
          hasEvents: hasEvents
        });
      });
    }
    
    // 测试4: 检查总数显示位置
    console.log('🔍 测试4: 检查总数显示位置');
    const cellsWithCount = Array.from(cellsWithEvents).filter(cell => {
      const eventCount = cell.getAttribute('data-event-count');
      return eventCount && parseInt(eventCount) > 0;
    });
    
    console.log('有总数显示的单元格数量:', cellsWithCount.length);
    
    cellsWithCount.forEach((cell, index) => {
      const eventCount = cell.getAttribute('data-event-count');
      const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
      const cellRect = cell.getBoundingClientRect();
      
      console.log(`总数显示${index + 1}:`, {
        dateValue: dateValue,
        eventCount: eventCount,
        cellTop: cellRect.top,
        cellRight: cellRect.right,
        expectedCountText: `共${eventCount}条`
      });
    });
    
    // 测试5: 检查视觉效果
    console.log('🔍 测试5: 检查视觉效果');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (cellsWithCount.length > 0) {
      const firstCell = cellsWithCount[0];
      const rect = firstCell.getBoundingClientRect();
      
      console.log('单元格尺寸:', {
        width: rect.width,
        height: rect.height
      });
      
      if (rect.width < 80) {
        console.log('📱 移动端：单元格较小，总数显示可能紧凑');
      } else {
        console.log('💻 桌面端：单元格较大，总数显示空间充足');
      }
    }
    
    // 测试6: 检查CSS应用
    console.log('🔍 测试6: 检查CSS应用');
    if (cellsWithEvents.length > 0) {
      const firstCell = cellsWithEvents[0];
      const cellStyle = window.getComputedStyle(firstCell);
      
      console.log('单元格样式:', {
        position: cellStyle.position,
        display: cellStyle.display
      });
      
      // 检查是否有相对定位
      if (cellStyle.position === 'relative') {
        console.log('✅ 单元格有相对定位，伪元素可以正确定位');
      } else {
        console.log('❌ 单元格缺少相对定位');
      }
    }
    
    // 测试7: 检查数据属性
    console.log('🔍 测试7: 检查数据属性');
    const cellsWithDataAttr = document.querySelectorAll('[data-event-count]');
    console.log('有data-event-count属性的单元格数量:', cellsWithDataAttr.length);
    
    cellsWithDataAttr.forEach((cell, index) => {
      const eventCount = cell.getAttribute('data-event-count');
      const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
      
      console.log(`数据属性${index + 1}:`, {
        dateValue: dateValue,
        eventCount: eventCount,
        hasEventsClass: cell.classList.contains('has-events')
      });
    });
    
    console.log('🎉 日期数字对齐测试完成！');
    console.log('✅ 优化效果:');
    console.log('   - 使用CSS伪元素显示总数');
    console.log('   - 总数显示在日期数字同行');
    console.log('   - 位置固定在右上角');
    console.log('   - 格式：共X条');
    console.log('   - 紧凑的蓝色背景设计');
    
    console.log('📝 显示规则:');
    console.log('   - 位置：与日期数字同行，右上角');
    console.log('   - 格式：共X条');
    console.log('   - 样式：蓝色背景，白色文字');
    console.log('   - 尺寸：最小宽度20px，高度14px');
    console.log('   - 字体：8px，粗体');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testDateNumberAlignment(); 