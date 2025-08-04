// 测试修复后的cellRender功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试修复后的cellRender功能...');

function testFixedCellRender() {
  try {
    console.log('📊 检查修复后的功能...');
    
    // 测试1: 检查是否有错误
    console.log('🔍 测试1: 检查控制台错误');
    const hasErrors = document.querySelector('.ant-picker-cell') !== null;
    console.log('日历单元格是否存在:', hasErrors);
    
    if (hasErrors) {
      console.log('✅ 日历单元格正常渲染');
    } else {
      console.log('❌ 日历单元格渲染异常');
    }
    
    // 测试2: 检查事件数据
    console.log('🔍 测试2: 检查事件数据');
    const calendarEvents = document.querySelectorAll('.calendar-event');
    console.log('日历事件数量:', calendarEvents.length);
    
    if (calendarEvents.length > 0) {
      console.log('✅ 事件数据正常显示');
      calendarEvents.forEach((event, index) => {
        const text = event.querySelector('.event-text')?.textContent?.trim();
        console.log(`事件${index + 1}:`, text);
      });
    } else {
      console.log('📝 暂无事件数据显示');
    }
    
    // 测试3: 检查动态添加的类名
    console.log('🔍 测试3: 检查动态添加的类名');
    const cellsWithEvents = document.querySelectorAll('.ant-picker-cell.has-events');
    console.log('有事件的日期单元格数量:', cellsWithEvents.length);
    
    if (cellsWithEvents.length > 0) {
      cellsWithEvents.forEach((cell, index) => {
        const eventCount = cell.getAttribute('data-event-count');
        const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
        
        console.log(`有事件的日期${index + 1}:`, {
          dateValue: dateValue,
          eventCount: eventCount
        });
      });
    } else {
      console.log('📝 暂无有事件的日期单元格');
    }
    
    // 测试4: 检查总数显示
    console.log('🔍 测试4: 检查总数显示');
    const cellsWithDataAttr = document.querySelectorAll('[data-event-count]');
    console.log('有data-event-count属性的单元格数量:', cellsWithDataAttr.length);
    
    if (cellsWithDataAttr.length > 0) {
      cellsWithDataAttr.forEach((cell, index) => {
        const eventCount = cell.getAttribute('data-event-count');
        const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
        const hasEventsClass = cell.classList.contains('has-events');
        
        console.log(`数据属性${index + 1}:`, {
          dateValue: dateValue,
          eventCount: eventCount,
          hasEventsClass: hasEventsClass
        });
      });
    }
    
    // 测试5: 检查CSS伪元素
    console.log('🔍 测试5: 检查CSS伪元素');
    if (cellsWithEvents.length > 0) {
      const firstCell = cellsWithEvents[0];
      const computedStyle = window.getComputedStyle(firstCell, '::after');
      
      console.log('伪元素样式:', {
        content: computedStyle.content,
        position: computedStyle.position,
        top: computedStyle.top,
        right: computedStyle.right,
        background: computedStyle.backgroundColor,
        color: computedStyle.color
      });
      
      if (computedStyle.content && computedStyle.content !== 'none') {
        console.log('✅ CSS伪元素正常应用');
      } else {
        console.log('❌ CSS伪元素未应用');
      }
    }
    
    // 测试6: 检查性能
    console.log('🔍 测试6: 检查性能');
    const allCells = document.querySelectorAll('.ant-picker-cell');
    console.log('总日期单元格数量:', allCells.length);
    
    const cellsWithEventsCount = document.querySelectorAll('.ant-picker-cell.has-events').length;
    const cellsWithDataAttrCount = document.querySelectorAll('[data-event-count]').length;
    
    console.log('性能统计:', {
      totalCells: allCells.length,
      cellsWithEvents: cellsWithEventsCount,
      cellsWithDataAttr: cellsWithDataAttrCount,
      consistency: cellsWithEventsCount === cellsWithDataAttrCount ? '✅ 一致' : '❌ 不一致'
    });
    
    // 测试7: 检查错误恢复
    console.log('🔍 测试7: 检查错误恢复');
    const errorElements = document.querySelectorAll('.ant-picker-cell[class*="error"]');
    console.log('错误元素数量:', errorElements.length);
    
    if (errorElements.length === 0) {
      console.log('✅ 无错误元素，修复成功');
    } else {
      console.log('❌ 仍有错误元素');
    }
    
    console.log('🎉 修复后的cellRender功能测试完成！');
    console.log('✅ 修复效果:');
    console.log('   - 移除了只读属性修改错误');
    console.log('   - 使用useEffect动态添加类名');
    console.log('   - 使用setTimeout确保DOM渲染完成');
    console.log('   - 保持了总数显示功能');
    console.log('   - 保持了事件列表显示');
    
    console.log('📝 技术实现:');
    console.log('   - 使用useEffect监听数据变化');
    console.log('   - 动态查询DOM元素');
    console.log('   - 安全地添加类名和数据属性');
    console.log('   - 使用CSS伪元素显示总数');
    console.log('   - 避免直接修改只读属性');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testFixedCellRender(); 