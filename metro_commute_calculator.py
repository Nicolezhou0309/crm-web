#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上海地铁通勤时间计算工具（精简版）
基于Dijkstra算法实现最优路线查找，支持多级换乘
"""

import heapq
from collections import defaultdict
from typing import Dict, List, Tuple

class MetroCommuteCalculator:
    def __init__(self):
        """初始化地铁线路和换乘信息"""
        self.lines = {
            '1号线': ['莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场', '新闸路', '汉中路', '上海火车站', '中山北路', '延长路', '上海马戏城', '汶水路', '彭浦新村', '共康路', '通河新村', '呼兰路', '共富新村', '宝安公路', '友谊西路', '富锦路'],
            '2号线': ['国家会展中心', '虹桥火车站', '虹桥2号航站楼', '淞虹路', '北新泾', '威宁路', '娄山关路', '中山公园', '江苏路', '静安寺', '南京西路', '人民广场', '南京东路', '陆家嘴', '浦东南路', '世纪大道', '上海科技馆', '世纪公园', '龙阳路', '张江高科', '金科路', '广兰路', '唐镇', '创新中路', '华夏东路', '川沙', '凌空路', '远东大道', '海天三路', '浦东1号2号航站楼'],
            '3号线': ['上海南站', '石龙路', '龙漕路', '漕溪路', '宜山路', '虹桥路', '延安西路', '中山公园', '金沙江路', '曹杨路', '镇坪路', '中潭路', '上海火车站', '宝山路', '东宝兴路', '虹口足球场', '赤峰路', '大柏树', '江湾镇', '殷高西路', '长江南路', '淞发路', '张华浜', '淞滨路', '水产路', '宝杨路', '友谊路', '铁力路', '江杨北路'],
            '4号线': ['宜山路', '虹桥路', '延安西路', '中山公园', '金沙江路', '曹杨路', '镇坪路', '中潭路', '上海火车站', '宝山路', '海伦路', '临平路', '大连路', '杨树浦路', '浦东大道', '世纪大道', '向城路', '蓝村路', '塘桥', '南浦大桥', '西藏南路', '鲁班路', '大木桥路', '东安路', '上海体育场', '上海体育馆'],
            '5号线': ['莘庄', '春申路', '银都路', '颛桥', '北桥', '剑川路', '东川路', '江川路', '西渡', '萧塘', '奉浦大道', '环城东路', '望园路', '金海湖', '奉贤新城', '金平路', '华宁路', '文井路', '闵行开发区'],
            '6号线': ['东方体育中心', '灵岩南路', '上南路', '华夏西路', '高青路', '东明路', '高科西路', '临沂新村', '上海儿童医学中心', '蓝村路', '浦电路', '世纪大道', '源深体育中心', '民生路', '北洋泾路', '德平路', '云山路', '金桥路', '博兴路', '五莲路', '巨峰路', '东靖路', '五洲大道', '洲海路', '外高桥保税区南', '航津路', '外高桥保税区北', '港城路'],
            '7号线': ['美兰湖', '罗南新村', '潘广路', '刘行', '顾村公园', '祁华路', '上海大学', '南陈路', '上大路', '场中路', '大场镇', '行知路', '大华三路', '新村路', '岚皋路', '镇坪路', '长寿路', '昌平路', '静安寺', '常熟路', '肇嘉浜路', '东安路', '龙华中路', '后滩', '长清路', '耀华路', '云台路', '高科西路', '杨高南路', '锦绣路', '芳华路', '龙阳路', '花木路'],
            '8号线': ['沈杜公路', '联航路', '江月路', '浦江镇', '芦恒路', '凌兆新村', '东方体育中心', '杨思', '成山路', '耀华路', '中华艺术宫', '西藏南路', '陆家浜路', '老西门', '大世界', '人民广场', '曲阜路', '中兴路', '西藏北路', '虹口足球场', '曲阳路', '四平路', '鞍山新村', '江浦路', '黄兴路', '延吉中路', '黄兴公园', '翔殷路', '嫩江路', '市光路'],
            '9号线': ['上海松江站', '醉白池', '松江体育中心', '松江新城', '松江大学城', '洞泾', '佘山', '泗泾', '九亭', '中春路', '七宝', '星中路', '合川路', '漕河泾开发区', '桂林路', '宜山路', '徐家汇', '肇嘉浜路', '嘉善路', '打浦桥', '马当路', '陆家浜路', '小南门', '商城路', '世纪大道', '杨高中路', '芳甸路', '蓝天路', '台儿庄路', '金桥', '金吉路', '金海路', '顾唐路', '民雷路', '曹路'],
            '10号线': ['航中路', '紫藤路', '龙柏新村', '虹桥火车站', '虹桥2号航站楼', '虹桥1号航站楼', '上海动物园', '龙溪路', '水城路', '伊犁路', '宋园路', '虹桥路', '交通大学', '上海图书馆', '陕西南路', '一大会址·新天地', '老西门', '豫园', '南京东路', '天潼路', '四川北路', '海伦路', '邮电新村', '四平路', '同济大学', '国权路', '五角场', '江湾体育场', '三门路', '殷高东路', '新江湾城', '国帆路', '双江路', '高桥西', '高桥', '港城路', '基隆路'],
            '11号线': ['花桥', '光明路', '兆丰路', '安亭', '上海汽车城', '昌吉东路', '上海赛车场', '嘉定北', '嘉定西', '白银路', '嘉定新城', '马陆', '陈翔公路', '南翔', '桃浦新村', '武威路', '祁连山路', '李子园', '上海西站', '真如', '枫桥路', '曹杨路', '隆德路', '江苏路', '交通大学', '徐家汇', '上海游泳馆', '龙华', '云锦路', '龙耀路', '东方体育中心', '三林', '三林东', '浦三路', '康恒路', '御桥', '罗山路', '秀沿路', '康新公路', '迪士尼'],
            '12号线': ['七莘路', '虹莘路', '顾戴路', '东兰路', '虹梅路', '虹漕路', '桂林公园', '漕宝路', '龙漕路', '龙华', '龙华中路', '大木桥路', '嘉善路', '陕西南路', '南京西路', '汉中路', '曲阜路', '天潼路', '国际客运中心', '提篮桥', '大连路', '江浦公园', '宁国路', '隆昌路', '爱国路', '复兴岛', '东陆路', '巨峰路', '杨高北路', '金京路', '申江路', '金海路'],
            '13号线': ['金运路', '金沙江西路', '丰庄', '祁连山南路', '真北路', '大渡河路', '金沙江路', '隆德路', '武宁路', '长寿路', '江宁路', '汉中路', '自然博物馆', '南京西路', '淮海中路', '一大会址·新天地', '马当路', '世博会博物馆', '世博大道', '长清路', '成山路', '东明路', '华鹏路', '下南路', '北蔡', '陈春路', '莲溪路', '华夏中路', '中科路', '学林路', '张江路'],
            '14号线': ['封浜', '乐秀路', '临洮路', '嘉怡路', '定边路', '真新新村', '真光路', '铜川路', '真如', '中宁路', '曹杨路', '武宁路', '武定路', '静安寺', '一大会址·黄陂南路', '大世界', '豫园', '陆家嘴', '浦东南路', '浦东大道', '源深路', '昌邑路', '歇浦路', '云山路', '蓝天路', '黄杨路', '云顺路', '浦东足球场', '金粤路', '桂桥路'],
            '15号线': ['紫竹高新区', '永德路', '元江路', '双柏路', '曙建路', '景西路', '虹梅南路', '景洪路', '朱梅路', '罗秀路', '华东理工大学', '上海南站', '桂林公园', '桂林路', '吴中路', '姚虹路', '红宝石路', '娄山关路', '长风公园', '大渡河路', '梅岭北路', '铜川路', '上海西站', '武威东路', '古浪路', '祁安路', '南大路', '丰翔路', '锦秋路', '顾村公园'],
            '16号线': ['龙阳路', '华夏中路', '罗山路', '周浦东', '鹤沙航城', '航头东', '新场', '野生动物园', '惠南', '浦东火车站', '书院', '临港大道', '滴水湖'],
            '17号线': ['虹桥火车站', '国家会展中心', '蟠龙路', '徐盈路', '徐泾北城', '嘉松中路', '赵巷', '汇金路', '青浦新城', '漕盈路', '淀山湖大道', '朱家角', '东方绿舟', '西岑'],
            '18号线': ['航头', '下沙', '鹤涛路', '沈梅路', '繁荣路', '周浦', '康桥', '御桥', '莲溪路', '北中路', '芳芯路', '龙阳路', '迎春路', '杨高中路', '民生路', '昌邑路', '丹阳路', '平凉路', '江浦公园', '江浦路', '抚顺路', '国权路', '复旦大学', '上海财经大学', '殷高路', '长江南路']
        }
        
        # 构建换乘站点映射和邻接图
        self._build_transfer_mapping()
        self._build_adjacency_graph()
    
    def _build_transfer_mapping(self):
        """构建换乘站点映射"""
        self.transfer_stations = defaultdict(list)
        self.station_to_lines = defaultdict(list)
        
        # 统计每个站点出现在哪些线路上
        for line_name, stations in self.lines.items():
            for station in stations:
                self.station_to_lines[station].append(line_name)
        
        # 找出换乘站点（出现在多条线路上的站点）
        for station, lines_list in self.station_to_lines.items():
            if len(lines_list) > 1:
                self.transfer_stations[station] = lines_list
    
    def _build_adjacency_graph(self):
        """构建邻接图，包含站点间距离"""
        self.graph = defaultdict(list)
        
        # 为每条线路构建邻接关系
        for line_name, stations in self.lines.items():
            for i, station in enumerate(stations):
                # 添加相邻站点（3分钟一站）
                if i > 0:
                    prev_station = stations[i-1]
                    self.graph[station].append((prev_station, 3, line_name))
                if i < len(stations) - 1:
                    next_station = stations[i+1]
                    self.graph[station].append((next_station, 3, line_name))
    
    def find_route(self, start_station: str, end_station: str) -> Dict:
        """
        查找从起始站到终点站的最优路线
        使用Dijkstra算法找到全局最优路径
        """
        if start_station not in self.station_to_lines:
            return {'success': False, 'error': f'起始站 {start_station} 不存在'}
        
        if end_station not in self.station_to_lines:
            return {'success': False, 'error': f'终点站 {end_station} 不存在'}
        
        # 使用Dijkstra算法找最短路径
        distances, previous, lines_used = self._dijkstra(start_station)
        
        if end_station not in distances:
            return {'success': False, 'error': f'无法找到从 {start_station} 到 {end_station} 的路线'}
        
        # 重建路径
        path, transfers = self._reconstruct_path(start_station, end_station, previous, lines_used)
        
        # 计算总时间：站点间时间 + 换乘时间
        total_time = distances[end_station] + (len(transfers) * 5)
        
        return {
            'success': True,
            'start_station': start_station,
            'end_station': end_station,
            'total_time_minutes': total_time,
            'total_time_formatted': f'{total_time}分钟',
            'stations_count': len(path) - 1,
            'path': path,
            'transfers': transfers,
            'transfer_count': len(transfers),
            'route_summary': self._generate_route_summary(start_station, end_station, path, transfers, lines_used)
        }
    
    def _dijkstra(self, start_station: str) -> Tuple[Dict[str, int], Dict[str, str], Dict[str, str]]:
        """
        Dijkstra算法实现
        返回：距离字典、前驱节点字典、使用的线路字典
        """
        distances = {station: float('inf') for station in self.station_to_lines}
        distances[start_station] = 0
        
        previous = {}
        lines_used = {}
        
        # 优先队列：(距离, 站点)
        pq = [(0, start_station)]
        visited = set()
        
        while pq:
            current_distance, current_station = heapq.heappop(pq)
            
            if current_station in visited:
                continue
            
            visited.add(current_station)
            
            # 遍历所有相邻站点
            for neighbor, weight, line_info in self.graph[current_station]:
                if neighbor in visited:
                    continue
                
                new_distance = current_distance + weight
                
                if new_distance < distances[neighbor]:
                    distances[neighbor] = new_distance
                    previous[neighbor] = current_station
                    lines_used[neighbor] = line_info
                    heapq.heappush(pq, (new_distance, neighbor))
        
        return distances, previous, lines_used
    
    def _reconstruct_path(self, start_station: str, end_station: str, 
                         previous: Dict[str, str], lines_used: Dict[str, str]) -> Tuple[List[str], List[Dict]]:
        """重建路径和换乘信息"""
        path = []
        transfers = []
        current = end_station
        
        # 从终点回溯到起点
        while current is not None:
            path.append(current)
            current = previous.get(current)
        
        path.reverse()
        
        # 分析换乘信息
        current_line = None
        for i in range(len(path) - 1):
            current_station = path[i]
            next_station = path[i + 1]
            
            # 尝试从站点推断线路
            found_line = None
            for line_name, stations in self.lines.items():
                if current_station in stations and next_station in stations:
                    found_line = line_name
                    break
            
            if found_line:
                if current_line and current_line != found_line:
                    # 发现换乘
                    transfers.append({
                        'station': current_station,
                        'from_line': current_line,
                        'to_line': found_line
                    })
                current_line = found_line
        
        return path, transfers
    
    def _generate_route_summary(self, start_station: str, end_station: str, 
                               path: List[str], transfers: List[Dict], lines_used: Dict[str, str]) -> str:
        """生成路线摘要"""
        if not transfers:
            # 无需换乘，找到起始站和终点站所在的线路
            for line_name, stations in self.lines.items():
                if start_station in stations and end_station in stations:
                    return f'从 {start_station} 乘坐{line_name}到 {end_station}，无需换乘'
            return f'从 {start_station} 到 {end_station}，无需换乘'
        
        # 有换乘的情况
        # 首先找到起始站所在的线路
        start_line = None
        for line_name, stations in self.lines.items():
            if start_station in stations:
                start_line = line_name
                break
        
        summary_parts = [f'从 {start_station} 乘坐{start_line}']
        
        for transfer in transfers:
            summary_parts.append(f'在{transfer["station"]}换乘{transfer["to_line"]}')
        
        summary_parts.append(f'到达{end_station}')
        
        return '，'.join(summary_parts)
    
    def calculate_commute_time(self, start_station: str, end_station: str) -> Dict:
        """计算通勤时间（兼容接口）"""
        return self.find_route(start_station, end_station)

def main():
    """主函数 - 简单的使用示例"""
    calculator = MetroCommuteCalculator()
    
    print("上海地铁通勤时间计算工具")
    print("=" * 50)
    
    # 示例：浦东1号2号航站楼到迪士尼
    start_station = "浦东1号2号航站楼"
    end_station = "迪士尼"
    
    result = calculator.find_route(start_station, end_station)
    
    if result['success']:
        print(f"✅ {start_station} → {end_station}: {result['total_time_formatted']}")
        print(f"📊 {result['stations_count']}站, {result['transfer_count']}次换乘")
        print(f"📝 {result['route_summary']}")
    else:
        print(f"❌ {result['error']}")

if __name__ == "__main__":
    main()
