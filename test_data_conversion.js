// 测试数据转换
// 模拟数据库返回的数据

const testData = [
  {
    id: 84,
    date: "2025-07-28",
    time_slot_id: "morning-10-12",
    average_score: "0.0",  // 字符串类型
    scoring_status: "scored",
    scored_at: "2025-08-03 16:26:30.301662+00"
  },
  {
    id: 106,
    date: "2025-07-30",
    time_slot_id: "morning-10-12",
    average_score: null,  // null类型
    scoring_status: "not_scored",
    scored_at: null
  },
  {
    id: 85,
    date: "2025-07-28",
    time_slot_id: "afternoon-14-16",
    average_score: undefined,  // undefined类型
    scoring_status: "not_scored",
    scored_at: null
  }
];

console.log('原始数据:');
testData.forEach(item => {
  console.log({
    id: item.id,
    average_score: item.average_score,
    type: typeof item.average_score,
    isNull: item.average_score === null,
    isUndefined: item.average_score === undefined,
    isEmpty: item.average_score === ''
  });
});

console.log('\n转换后的数据:');
testData.forEach(item => {
  const converted = item.average_score !== null && 
                   item.average_score !== undefined && 
                   item.average_score !== '' ? 
                   Number(item.average_score) : null;
  
  console.log({
    id: item.id,
    original: item.average_score,
    original_type: typeof item.average_score,
    converted: converted,
    converted_type: typeof converted,
    will_render: converted ? `${converted.toFixed(1)}分` : '-'
  });
});

// 测试渲染逻辑
console.log('\n渲染结果:');
testData.forEach(item => {
  const converted = item.average_score !== null && 
                   item.average_score !== undefined && 
                   item.average_score !== '' ? 
                   Number(item.average_score) : null;
  
  // 修复后的逻辑：检查是否为null或undefined，而不是检查真值
  const renderResult = converted !== null && converted !== undefined ? `${converted.toFixed(1)}分` : '-';
  
  console.log(`ID ${item.id}: ${renderResult}`);
}); 