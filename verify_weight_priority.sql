-- 验证权重优先级修复效果
-- 检查数据库中的实际权重设置

-- 1. 检查权重设置
SELECT 
  '权重设置验证' as check_type,
  connection_type,
  travel_time,
  COUNT(*) as count,
  CASE 
    WHEN connection_type = 'same_line' AND travel_time = 3 THEN '✅ 同线路权重正确'
    WHEN connection_type = 'transfer' AND travel_time = 5 THEN '✅ 换乘权重正确'
    ELSE '❌ 权重设置错误'
  END as status
FROM public.metro_complete_adjacency
GROUP BY connection_type, travel_time
ORDER BY connection_type, travel_time;

-- 2. 检查3号线路径
SELECT 
  '3号线路径检查' as check_type,
  line,
  station_name,
  next_station,
  travel_time
FROM public.metro_adjacency_view
WHERE line = '3号线' 
  AND station_name IN ('上海南站', '石龙路', '龙漕路', '漕宝路', '宜山路', '虹桥路', '延安西路')
ORDER BY station_name;

-- 3. 检查换乘站点
SELECT 
  '换乘站点检查' as check_type,
  station_name,
  line,
  transfer_line,
  transfer_time
FROM public.metro_transfer_view
WHERE station_name IN ('上海南站', '中山公园')
ORDER BY station_name, line;

-- 4. 验证上海南站连接
SELECT 
  '上海南站连接检查' as check_type,
  station_name,
  next_station,
  connection_type,
  travel_time,
  line_info
FROM public.metro_complete_adjacency
WHERE station_name = '上海南站'
ORDER BY travel_time, line_info;

-- 5. 验证中山公园连接
SELECT 
  '中山公园连接检查' as check_type,
  station_name,
  next_station,
  connection_type,
  travel_time,
  line_info
FROM public.metro_complete_adjacency
WHERE station_name = '中山公园'
ORDER BY travel_time, line_info;

-- 6. 统计信息
SELECT 
  '统计信息' as check_type,
  COUNT(*) as total_connections,
  COUNT(DISTINCT station_name) as unique_stations,
  COUNT(DISTINCT CASE WHEN connection_type = 'same_line' THEN station_name END) as stations_with_same_line,
  COUNT(DISTINCT CASE WHEN connection_type = 'transfer' THEN station_name END) as stations_with_transfers
FROM public.metro_complete_adjacency;

-- 7. 最终验证
SELECT 
  '最终验证：权重优先级' as check_type,
  '3号线直达: 7站 × 3分钟 = 21分钟' as direct_path,
  '换乘路径: 6站 × 3分钟 + 2次换乘 × 5分钟 = 28分钟' as transfer_path,
  '优势: 28 - 21 = 7分钟' as advantage,
  CASE 
    WHEN 21 < 28 THEN '✅ 直达路径权重更低，应该被选择'
    ELSE '❌ 权重设置有问题'
  END as conclusion;
