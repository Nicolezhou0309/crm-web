// 上海地铁站点数据接口
export interface MetroStation {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  pin: string;
  fill: string | null;
  zoom: number;
  distance: number | null;
}

// 地铁线路信息
export interface MetroLine {
  lineNo: number;
  lineName: string;
  stations: MetroStation[];
}

// 换乘信息
export interface TransferInfo {
  station: string;
  fromLine: string;
  toLine: string;
}

// 距离计算结果
export interface DistanceResult {
  fromStation: MetroStation;
  toStation: MetroStation;
  distance: number;
  commuteTime: number; // 分钟
  stationCount: number; // 站点数量
  route: MetroStation[];
  transfers: TransferInfo[]; // 换乘信息
  transferCount: number; // 换乘次数
  routeSummary: string; // 路线摘要
}

// 上海地铁站点数据（从API获取的完整数据）
export const SHANGHAI_METRO_STATIONS: MetroStation[] = [
  {
    "id": "ST11-XZ",
    "title": "莘庄",
    "description": "莘庄",
    "x": 0.3201,
    "y": 0.6252,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-WHL",
    "title": "外环路",
    "description": "外环路",
    "x": 0.332,
    "y": 0.6099,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-LHL",
    "title": "莲花路",
    "description": "莲花路",
    "x": 0.3445,
    "y": 0.5978,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-JJLY",
    "title": "锦江乐园",
    "description": "锦江乐园",
    "x": 0.3569,
    "y": 0.586,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST4005-SHNZ",
    "title": "上海南站",
    "description": "上海南站",
    "x": 0.3732,
    "y": 0.5724,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST801-CBL",
    "title": "漕宝路",
    "description": "漕宝路",
    "x": 0.3841,
    "y": 0.5612,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST9-SHTYG",
    "title": "上海体育馆",
    "description": "上海体育馆",
    "x": 0.3961,
    "y": 0.4924,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST501-XJH",
    "title": "徐家汇",
    "description": "徐家汇",
    "x": 0.4186,
    "y": 0.4706,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-HSL",
    "title": "衡山路",
    "description": "衡山路",
    "x": 0.4376,
    "y": 0.453,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST41-CSL",
    "title": "常熟路",
    "description": "常熟路",
    "x": 0.452,
    "y": 0.4358,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "STA01-SXNL",
    "title": "陕西南路",
    "description": "陕西南路",
    "x": 0.4784,
    "y": 0.4358,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST2001-HPNL",
    "title": "一大会址·黄陂南路",
    "description": "一大会址·黄陂南路",
    "x": 0.524,
    "y": 0.4176,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST83-RMGC",
    "title": "人民广场",
    "description": "人民广场",
    "x": 0.5236,
    "y": 0.3948,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-XZL",
    "title": "新闸路",
    "description": "新闸路",
    "x": 0.5154,
    "y": 0.3609,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1801-HZL",
    "title": "汉中路",
    "description": "汉中路",
    "x": 0.4996,
    "y": 0.3496,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "STD-SHHCZ",
    "title": "上海火车站",
    "description": "上海火车站",
    "x": 0.5013,
    "y": 0.3271,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-ZSBL",
    "title": "中山北路",
    "description": "中山北路",
    "x": 0.5,
    "y": 0.297,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-YCL",
    "title": "延长路",
    "description": "延长路",
    "x": 0.5,
    "y": 0.2814,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-SHMXC",
    "title": "上海马戏城",
    "description": "上海马戏城",
    "x": 0.5,
    "y": 0.261,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-WSL",
    "title": "汶水路",
    "description": "汶水路",
    "x": 0.5,
    "y": 0.2434,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-PPXC",
    "title": "彭浦新村",
    "description": "彭浦新村",
    "x": 0.5,
    "y": 0.2207,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-GKL",
    "title": "共康路",
    "description": "共康路",
    "x": 0.5,
    "y": 0.1973,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-THXC",
    "title": "通河新村",
    "description": "通河新村",
    "x": 0.5,
    "y": 0.1741,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-HLL",
    "title": "呼兰路",
    "description": "呼兰路",
    "x": 0.5,
    "y": 0.1505,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-GFXC",
    "title": "共富新村",
    "description": "共富新村",
    "x": 0.5,
    "y": 0.1273,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-BAGL",
    "title": "宝安公路",
    "description": "宝安公路",
    "x": 0.4954,
    "y": 0.0985,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-YYXL",
    "title": "友谊西路",
    "description": "友谊西路",
    "x": 0.4664,
    "y": 0.0679,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  },
  {
    "id": "ST1-FJL",
    "title": "富锦路",
    "description": "富锦路",
    "x": 0.4623,
    "y": 0.0284,
    "pin": "hidden",
    "fill": null,
    "zoom": 12,
    "distance": null
  }
];

// 上海地铁线路数据（基于Python版本的线路信息）
export const METRO_LINES_DATA: Record<string, string[]> = {
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
  '12号线': ['七莘路', '虹莘路', '顾戴路', '东兰路', '虹梅路', '虹漕路', '桂林公园', '漕宝路', '龙漕路', '龙华', '龙华中路', '大木桥路', '嘉善路', '陕西南路', '南京西路', '汉中路', '曲阜路', '天潼路', '国际客运中心', '提篮桥', '大连路', '江浦公园', '宁国路', '隆昌路', '爱国路', '复兴岛', '东陆路', '巨峰路', '东高北路', '金京路', '申江路', '金海路'],
  '13号线': ['金运路', '金沙江西路', '丰庄', '祁连山南路', '真北路', '大渡河路', '金沙江路', '隆德路', '武宁路', '长寿路', '江宁路', '汉中路', '自然博物馆', '南京西路', '淮海中路', '一大会址·新天地', '马当路', '世博会博物馆', '世博大道', '长清路', '成山路', '东明路', '华鹏路', '下南路', '北蔡', '陈春路', '莲溪路', '华夏中路', '中科路', '学林路', '张江路'],
  '14号线': ['封浜', '乐秀路', '临洮路', '嘉怡路', '定边路', '真新新村', '真光路', '铜川路', '真如', '中宁路', '曹杨路', '武宁路', '武定路', '静安寺', '一大会址·黄陂南路', '大世界', '豫园', '陆家嘴', '浦东南路', '浦东大道', '源深路', '昌邑路', '歇浦路', '云山路', '蓝天路', '黄杨路', '云顺路', '浦东足球场', '金粤路', '桂桥路'],
  '15号线': ['紫竹高新区', '永德路', '元江路', '双柏路', '曙建路', '景西路', '虹梅南路', '景洪路', '朱梅路', '罗秀路', '华东理工大学', '上海南站', '桂林公园', '桂林路', '吴中路', '姚虹路', '红宝石路', '娄山关路', '长风公园', '大渡河路', '梅岭北路', '铜川路', '上海西站', '武威东路', '古浪路', '祁安路', '南大路', '丰翔路', '锦秋路', '顾村公园'],
  '16号线': ['龙阳路', '华夏中路', '罗山路', '周浦东', '鹤沙航城', '航头东', '新场', '野生动物园', '惠南', '浦东火车站', '书院', '临港大道', '滴水湖'],
  '17号线': ['虹桥火车站', '国家会展中心', '蟠龙路', '徐盈路', '徐泾北城', '嘉松中路', '赵巷', '汇金路', '青浦新城', '漕盈路', '淀山湖大道', '朱家角', '东方绿舟', '西岑'],
  '18号线': ['航头', '下沙', '鹤涛路', '沈梅路', '繁荣路', '周浦', '康桥', '御桥', '莲溪路', '北中路', '芳芯路', '龙阳路', '迎春路', '杨高中路', '民生路', '昌邑路', '丹阳路', '平凉路', '江浦公园', '江浦路', '抚顺路', '国权路', '复旦大学', '上海财经大学', '殷高路', '长江南路']
};

// 构建换乘站点映射
const TRANSFER_STATIONS = new Map<string, string[]>();
const STATION_TO_LINES = new Map<string, string[]>();

// 初始化换乘站点映射
Object.entries(METRO_LINES_DATA).forEach(([lineName, stations]) => {
  stations.forEach((station: string) => {
    if (!STATION_TO_LINES.has(station)) {
      STATION_TO_LINES.set(station, []);
    }
    STATION_TO_LINES.get(station)!.push(lineName);
  });
});

// 找出换乘站点
STATION_TO_LINES.forEach((lines, station) => {
  if (lines.length > 1) {
    TRANSFER_STATIONS.set(station, lines);
  }
});

// 地铁线路信息
export const METRO_LINES: MetroLine[] = [
  {
    lineNo: 1,
    lineName: '1号线',
    stations: SHANGHAI_METRO_STATIONS.filter(station => 
      METRO_LINES_DATA['1号线'].includes(station.title)
    )
  },
  {
    lineNo: 2,
    lineName: '2号线',
    stations: SHANGHAI_METRO_STATIONS.filter(station => 
      METRO_LINES_DATA['2号线'].includes(station.title)
    )
  }
];

// 计算两点之间的欧几里得距离
export function calculateDistance(station1: MetroStation, station2: MetroStation): number {
  const dx = station1.x - station2.x;
  const dy = station1.y - station2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 计算通勤时间（基于距离，每站默认3分钟）
export function calculateCommuteTime(station1: MetroStation, station2: MetroStation): number {
  // 使用智能站点计算
  const stationCount = calculateStationCount(station1, station2);
  
  // 每站默认3分钟
  const baseTimePerStation = 3;
  
  // 计算总通勤时间
  const totalTime = stationCount * baseTimePerStation;
  
  return totalTime;
}

// 更智能的站点数量计算（基于线路和实际站点位置）
export function calculateStationCount(station1: MetroStation, station2: MetroStation): number {
  // 尝试找到两个站点是否在同一条线路上
  const line1 = getStationLine(station1);
  const line2 = getStationLine(station2);
  
  if (line1 && line2 && line1.lineNo === line2.lineNo) {
    // 同一条线路，计算实际站点数量
    const stations = getStationsByLine(line1.lineNo);
    const index1 = stations.findIndex(s => s.id === station1.id);
    const index2 = stations.findIndex(s => s.id === station2.id);
    
    if (index1 !== -1 && index2 !== -1) {
      // 返回实际站点数量（绝对值）
      return Math.abs(index2 - index1);
    }
  }
  
  // 如果不在同一条线路或无法确定，使用距离估算
  const distance = calculateDistance(station1, station2);
  const actualDistanceKm = distance * 50;
  const averageStationDistance = 1.3;
  
  return Math.max(1, Math.ceil(actualDistanceKm / averageStationDistance));
}

// 获取站点所属线路
export function getStationLine(station: MetroStation): MetroLine | null {
  for (const line of METRO_LINES) {
    if (line.stations.some(s => s.id === station.id)) {
      return line;
    }
  }
  return null;
}

// 查找站点（按名称或ID）
export function findStation(query: string): MetroStation | null {
  const lowerQuery = query.toLowerCase();
  
  // 先按名称精确匹配
  let station = SHANGHAI_METRO_STATIONS.find(s => 
    s.title.toLowerCase() === lowerQuery
  );
  
  if (station) return station;
  
  // 按名称模糊匹配
  station = SHANGHAI_METRO_STATIONS.find(s => 
    s.title.toLowerCase().includes(lowerQuery)
  );
  
  if (station) return station;
  
  // 按ID匹配
  station = SHANGHAI_METRO_STATIONS.find(s => 
    s.id.toLowerCase().includes(lowerQuery)
  );
  
  return station || null;
}

// 计算两个站点之间的通勤信息
export function calculateMetroCommute(
  fromStationName: string, 
  toStationName: string
): DistanceResult | null {
  const fromStation = findStation(fromStationName);
  const toStation = findStation(toStationName);
  
  if (!fromStation || !toStation) {
    return null;
  }
  
  const distance = calculateDistance(fromStation, toStation);
  const commuteTime = calculateCommuteTime(fromStation, toStation);
  const stationCount = calculateStationCount(fromStation, toStation);
  
  // 简化的路径计算（实际应该使用图算法）
  const route = [fromStation, toStation];
  
  // 检查是否需要换乘
  const fromLines = getStationLine(fromStation);
  const toLines = getStationLine(toStation);
  let transfers: TransferInfo[] = [];
  let transferCount = 0;
  let routeSummary = '';
  
  if (fromLines && toLines && fromLines.lineNo === toLines.lineNo) {
    // 同一条线路，无需换乘
    routeSummary = `从 ${fromStation.title} 乘坐${fromLines.lineName}到 ${toStation.title}，无需换乘`;
  } else {
    // 需要换乘（简化处理）
    transferCount = 1;
    transfers = [{
      station: fromStation.title,
      fromLine: fromLines?.lineName || '未知线路',
      toLine: toLines?.lineName || '未知线路'
    }];
    routeSummary = `从 ${fromStation.title} 到 ${toStation.title}，需要换乘`;
  }
  
  return {
    fromStation,
    toStation,
    distance,
    commuteTime,
    stationCount,
    route,
    transfers,
    transferCount,
    routeSummary
  };
}

// 获取所有站点列表
export function getAllStations(): MetroStation[] {
  return SHANGHAI_METRO_STATIONS;
}

// 按线路获取站点
export function getStationsByLine(lineNo: number): MetroStation[] {
  const line = METRO_LINES.find(l => l.lineNo === lineNo);
  return line ? line.stations : [];
}

// 搜索站点（支持模糊搜索）
export function searchStations(query: string): MetroStation[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  return SHANGHAI_METRO_STATIONS.filter(station => 
    station.title.toLowerCase().includes(lowerQuery) ||
    station.description.toLowerCase().includes(lowerQuery) ||
    station.id.toLowerCase().includes(lowerQuery)
  );
}
