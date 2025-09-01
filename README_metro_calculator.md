# 上海地铁通勤时间计算工具

## 简介

这是一个基于Dijkstra算法的上海地铁通勤时间计算工具，能够找到任意两个地铁站点之间的最优路线，支持多级换乘。

## 核心特性

- 🎯 **全局最优**：使用Dijkstra算法找到真正的最短路径
- 🔄 **智能换乘**：自动识别最优换乘站点组合
- ⏱️ **精确时间**：考虑换乘时间（5分钟）和站点间时间（3分钟/站）
- 🛤️ **多级换乘**：支持2次、3次甚至更多次换乘的复杂路线
- 📍 **路径重建**：能够完整重建最优路径和换乘信息

## 安装和使用

### 基本使用

```python
from metro_commute_calculator import MetroCommuteCalculator

# 创建计算器实例
calculator = MetroCommuteCalculator()

# 查找路线
result = calculator.find_route('起始站', '终点站')

# 获取结果
if result['success']:
    print(f"通勤时间：{result['total_time_formatted']}")
    print(f"站点数：{result['stations_count']}")
    print(f"换乘数：{result['transfer_count']}")
    print(f"详细路径：{result['path']}")
    print(f"换乘信息：{result['transfers']}")
    print(f"路线摘要：{result['route_summary']}")
else:
    print(f"错误：{result['error']}")
```

### 示例

```python
# 计算从浦东机场到迪士尼的路线
result = calculator.find_route('浦东1号2号航站楼', '迪士尼')

# 输出结果
# ✅ 浦东1号2号航站楼 → 迪士尼: 58分钟
# 📊 16站, 2次换乘
# 📝 从 浦东1号2号航站楼 乘坐2号线，在龙阳路换乘16号线，在罗山路换乘11号线，到达迪士尼
```

## API 参考

### MetroCommuteCalculator 类

#### 方法

- `find_route(start_station: str, end_station: str) -> Dict`
  - 查找从起始站到终点站的最优路线
  - 返回包含路线信息的字典

- `calculate_commute_time(start_station: str, end_station: str) -> Dict`
  - 计算通勤时间（兼容接口）
  - 返回与 `find_route` 相同的结果

#### 返回结果格式

```python
{
    'success': True,                    # 是否成功找到路线
    'start_station': '起始站',          # 起始站名称
    'end_station': '终点站',            # 终点站名称
    'total_time_minutes': 58,          # 总时间（分钟）
    'total_time_formatted': '58分钟',   # 格式化的时间字符串
    'stations_count': 16,              # 经过的站点数
    'path': ['站点1', '站点2', ...],   # 详细路径列表
    'transfers': [                     # 换乘信息列表
        {
            'station': '换乘站',
            'from_line': '起始线路',
            'to_line': '目标线路'
        }
    ],
    'transfer_count': 2,               # 换乘次数
    'route_summary': '路线摘要'         # 人类可读的路线摘要
}
```

## 时间计算规则

- **站点间时间**：每站3分钟
- **换乘时间**：每次换乘5分钟
- **总时间** = 站点间时间 + 换乘时间

## 支持的线路

包含上海地铁1号线至18号线的完整站点信息。

## 错误处理

当无法找到路线时，返回的字典包含：
- `success: False`
- `error: '错误描述'`

常见错误：
- 起始站不存在
- 终点站不存在
- 无法找到连接路线

## 性能特点

- 使用Dijkstra算法，时间复杂度为 O(V² + E)
- 支持任意次数的换乘
- 内存占用适中，适合大多数应用场景

## 使用场景

- 通勤时间计算
- 路线规划应用
- 交通分析工具
- 移动应用后端
- 网站路线查询功能

## 注意事项

1. 站点名称必须与地铁官方名称完全一致
2. 换乘时间固定为5分钟，不考虑实际换乘距离
3. 站点间时间固定为3分钟，不考虑实际距离
4. 算法会找到时间最短的路线，但不一定是最少换乘的路线

## 许可证

本项目采用开源许可证，可自由使用和修改。
