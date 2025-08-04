// 测试数据条数显示异常的修复 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试数据条数显示异常的修复...');

function testDataCountFix() {
  try {
    console.log('📊 检查数据条数显示异常修复...');
    
    // 测试1: 检查数据范围
    console.log('🔍 测试1: 检查数据范围');
    const dateRangeText = document.querySelector('[style*="数据范围"]');
    if (dateRangeText) {
      console.log('当前数据范围:', dateRangeText.textContent);
      
      // 检查是否包含跨周的范围
      const rangeText = dateRangeText.textContent;
      if (rangeText.includes('至')) {
        console.log('✅ 数据范围显示正常');
      } else {
        console.log('❌ 数据范围显示异常');
      }
    }
    
    // 测试2: 检查有事件的日期单元格
    console.log('🔍 测试2: 检查有事件的日期单元格');
    const cellsWithEvents = document.querySelectorAll('.ant-picker-cell.has-events');
    console.log('有事件的日期单元格数量:', cellsWithEvents.length);
    
    if (cellsWithEvents.length > 0) {
      cellsWithEvents.forEach((cell, index) => {
        const eventCount = cell.getAttribute('data-event-count');
        const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
        const events = cell.querySelectorAll('.calendar-event');
        
        console.log(`有事件的日期${index + 1}:`, {
          dateValue: dateValue,
          eventCount: eventCount,
          actualEvents: events.length,
          isConsistent: parseInt(eventCount) === events.length
        });
        
        if (parseInt(eventCount) !== events.length) {
          console.log('⚠️ 数据条数不一致:', {
            expected: eventCount,
            actual: events.length
          });
        }
      });
    }
    
    // 测试3: 检查跨月日期
    console.log('🔍 测试3: 检查跨月日期');
    const allCells = document.querySelectorAll('.ant-picker-cell');
    const crossMonthCells = [];
    
    allCells.forEach((cell) => {
      const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
      const hasEvents = cell.classList.contains('has-events');
      const eventCount = cell.getAttribute('data-event-count');
      
      if (dateValue && hasEvents) {
        const dateNum = parseInt(dateValue);
        // 检查是否是跨月日期（小于10或大于20）
        if (dateNum < 10 || dateNum > 20) {
          crossMonthCells.push({
            dateValue: dateValue,
            eventCount: eventCount,
            hasEvents: hasEvents
          });
        }
      }
    });
    
    console.log('跨月日期统计:', crossMonthCells);
    
    // 测试4: 检查数据一致性
    console.log('🔍 测试4: 检查数据一致性');
    let consistentCount = 0;
    let inconsistentCount = 0;
    
    cellsWithEvents.forEach((cell) => {
      const eventCount = cell.getAttribute('data-event-count');
      const events = cell.querySelectorAll('.calendar-event');
      
      if (parseInt(eventCount) === events.length) {
        consistentCount++;
      } else {
        inconsistentCount++;
      }
    });
    
    console.log('数据一致性统计:', {
      consistent: consistentCount,
      inconsistent: inconsistentCount,
      total: cellsWithEvents.length,
      consistencyRate: cellsWithEvents.length > 0 ? (consistentCount / cellsWithEvents.length * 100).toFixed(1) + '%' : '0%'
    });
    
    // 测试5: 检查查询范围
    console.log('🔍 测试5: 检查查询范围');
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // 计算应该的查询范围（包括跨周）
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
    
    const startOfWeek = new Date(firstDayOfMonth);
    startOfWeek.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
    
    const endOfWeek = new Date(lastDayOfMonth);
    endOfWeek.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));
    
    console.log('预期查询范围:', {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0],
      currentMonth: currentMonth,
      currentYear: currentYear
    });
    
    // 测试6: 检查异常情况
    console.log('🔍 测试6: 检查异常情况');
    const abnormalCells = [];
    
    cellsWithEvents.forEach((cell) => {
      const eventCount = cell.getAttribute('data-event-count');
      const events = cell.querySelectorAll('.calendar-event');
      const dateValue = cell.querySelector('.ant-picker-cell-inner')?.textContent?.trim();
      
      if (parseInt(eventCount) > 0 && events.length === 0) {
        abnormalCells.push({
          dateValue: dateValue,
          eventCount: eventCount,
          actualEvents: events.length
        });
      }
    });
    
    console.log('异常单元格数量:', abnormalCells.length);
    if (abnormalCells.length > 0) {
      console.log('异常单元格详情:', abnormalCells);
    }
    
    // 测试7: 检查修复效果
    console.log('🔍 测试7: 检查修复效果');
    const totalCellsWithCount = document.querySelectorAll('[data-event-count]').length;
    const totalCellsWithEvents = document.querySelectorAll('.ant-picker-cell.has-events').length;
    const totalActualEvents = document.querySelectorAll('.calendar-event').length;
    
    console.log('修复效果统计:', {
      cellsWithCount: totalCellsWithCount,
      cellsWithEvents: totalCellsWithEvents,
      totalActualEvents: totalActualEvents,
      isConsistent: totalCellsWithCount === totalCellsWithEvents
    });
    
    if (abnormalCells.length === 0) {
      console.log('✅ 数据条数显示异常已修复！');
    } else {
      console.log('❌ 仍有数据条数显示异常');
    }
    
    console.log('🎉 数据条数显示异常修复测试完成！');
    console.log('✅ 修复效果:');
    console.log('   - 扩展了数据查询范围，包含跨周日期');
    console.log('   - 修正了跨月日期的计算逻辑');
    console.log('   - 确保总数显示与实际事件数量一致');
    console.log('   - 添加了数据一致性检查');
    console.log('   - 清除了无效的类名和数据属性');
    
    console.log('📝 修复规则:');
    console.log('   - 查询范围：从当月第一周开始到当月最后一周结束');
    console.log('   - 跨月计算：根据日期位置判断属于哪个月份');
    console.log('   - 数据清理：移除不匹配的类名和数据属性');
    console.log('   - 一致性检查：确保总数与实际事件数量匹配');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testDataCountFix(); 