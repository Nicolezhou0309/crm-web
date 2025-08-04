// 快速验证记录总数显示功能
// 在浏览器控制台中运行

console.log('🔍 快速验证记录总数显示...');

// 检查总数显示元素
const totalElement = document.querySelector('[style*="共"]');
if (totalElement) {
  const text = totalElement.textContent;
  console.log('✅ 找到总数显示:', text);
  
  // 检查样式
  const style = window.getComputedStyle(totalElement);
  console.log('样式检查:', {
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight
  });
} else {
  console.log('❌ 未找到总数显示元素');
}

// 检查数据状态
const events = document.querySelectorAll('.calendar-event');
console.log('📊 日历事件数量:', events.length);

// 检查加载状态
const loading = document.querySelector('.ant-spin-spinning');
console.log('⏳ 加载状态:', loading ? '正在加载' : '加载完成');

console.log('🎉 快速验证完成！'); 