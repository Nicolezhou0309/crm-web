 -- 创建直播报名系统表结构

-- 直播管家表
CREATE TABLE IF NOT EXISTS live_stream_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  avatar TEXT,
  department VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 直播地点表
CREATE TABLE IF NOT EXISTS live_stream_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT,
  district VARCHAR(50),
  coordinates POINT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 直播户型表
CREATE TABLE IF NOT EXISTS live_stream_property_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 时间段表
CREATE TABLE IF NOT EXISTS live_stream_time_slots (
  id VARCHAR(50) PRIMARY KEY,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  description VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 直播安排表
CREATE TABLE IF NOT EXISTS live_stream_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time_slot_id VARCHAR(50) NOT NULL REFERENCES live_stream_time_slots(id),
  manager_ids UUID[] NOT NULL,
  location_id UUID NOT NULL REFERENCES live_stream_locations(id),
  property_type_id UUID NOT NULL REFERENCES live_stream_property_types(id),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, time_slot_id)
);

-- 直播报名表
CREATE TABLE IF NOT EXISTS live_stream_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES live_stream_schedules(id),
  manager_ids UUID[] NOT NULL,
  location_id UUID NOT NULL REFERENCES live_stream_locations(id),
  property_type_id UUID NOT NULL REFERENCES live_stream_property_types(id),
  registrant_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approval_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入预设的时间段数据
INSERT INTO live_stream_time_slots (id, start_time, end_time, period, description) VALUES
  ('morning-10-12', '10:00', '12:00', 'morning', '上午时段'),
  ('afternoon-14-16', '14:00', '16:00', 'afternoon', '下午时段1'),
  ('afternoon-16-18', '16:00', '18:00', 'afternoon', '下午时段2'),
  ('evening-19-21', '19:00', '21:00', 'evening', '晚间时段1'),
  ('evening-21-23', '21:00', '23:00', 'evening', '晚间时段2')
ON CONFLICT (id) DO NOTHING;

-- 插入预设的直播管家数据
INSERT INTO live_stream_managers (id, name, department) VALUES
  (gen_random_uuid(), '罗思思', '销售部'),
  (gen_random_uuid(), '王梦雨', '销售部'),
  (gen_random_uuid(), '张磊磊', '销售部'),
  (gen_random_uuid(), '杨函颖', '销售部'),
  (gen_random_uuid(), '李鹏飞', '销售部'),
  (gen_random_uuid(), '张文雅', '销售部'),
  (gen_random_uuid(), '樊繁', '销售部'),
  (gen_random_uuid(), '王黎明', '销售部')
ON CONFLICT DO NOTHING;

-- 插入预设的直播地点数据
INSERT INTO live_stream_locations (id, name, address, district) VALUES
  (gen_random_uuid(), '南京西路', '上海市静安区南京西路', '静安区'),
  (gen_random_uuid(), '静安寺', '上海市静安区静安寺', '静安区'),
  (gen_random_uuid(), '徐家汇', '上海市徐汇区徐家汇', '徐汇区'),
  (gen_random_uuid(), '人民广场', '上海市黄浦区人民广场', '黄浦区'),
  (gen_random_uuid(), '陆家嘴', '上海市浦东新区陆家嘴', '浦东新区'),
  (gen_random_uuid(), '汉中路', '上海市静安区汉中路', '静安区'),
  (gen_random_uuid(), '东方体育中心', '上海市浦东新区东方体育中心', '浦东新区'),
  (gen_random_uuid(), '大世界', '上海市黄浦区大世界', '黄浦区'),
  (gen_random_uuid(), '新天地', '上海市黄浦区新天地', '黄浦区'),
  (gen_random_uuid(), '中山公园', '上海市长宁区中山公园', '长宁区'),
  (gen_random_uuid(), '南京东路', '上海市黄浦区南京东路', '黄浦区'),
  (gen_random_uuid(), '老西门', '上海市黄浦区老西门', '黄浦区')
ON CONFLICT DO NOTHING;

-- 插入预设的直播户型数据
INSERT INTO live_stream_property_types (id, name, description, category) VALUES
  (gen_random_uuid(), '平层', '标准平层户型', '住宅'),
  (gen_random_uuid(), '钻石房', '钻石型户型', '住宅'),
  (gen_random_uuid(), 'LF两室', 'LF品牌两室户型', '住宅'),
  (gen_random_uuid(), 'LF外场+钻石房', 'LF外场展示加钻石房', '混合'),
  (gen_random_uuid(), 'lv平层', 'LV品牌平层户型', '住宅'),
  (gen_random_uuid(), 'LF平层', 'LF品牌平层户型', '住宅'),
  (gen_random_uuid(), 'LV平层', 'LV品牌平层户型', '住宅')
ON CONFLICT DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_date ON live_stream_schedules(date);
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_time_slot ON live_stream_schedules(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_status ON live_stream_schedules(status);
CREATE INDEX IF NOT EXISTS idx_live_stream_registrations_registrant ON live_stream_registrations(registrant_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_registrations_status ON live_stream_registrations(status);

-- 创建RLS策略
ALTER TABLE live_stream_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_registrations ENABLE ROW LEVEL SECURITY;

-- 直播管家表策略 - 所有用户可读，管理员可写
CREATE POLICY "live_stream_managers_read_policy" ON live_stream_managers
  FOR SELECT USING (true);

CREATE POLICY "live_stream_managers_write_policy" ON live_stream_managers
  FOR ALL USING (auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  ));

-- 直播地点表策略 - 所有用户可读，管理员可写
CREATE POLICY "live_stream_locations_read_policy" ON live_stream_locations
  FOR SELECT USING (true);

CREATE POLICY "live_stream_locations_write_policy" ON live_stream_locations
  FOR ALL USING (auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  ));

-- 直播户型表策略 - 所有用户可读，管理员可写
CREATE POLICY "live_stream_property_types_read_policy" ON live_stream_property_types
  FOR SELECT USING (true);

CREATE POLICY "live_stream_property_types_write_policy" ON live_stream_property_types
  FOR ALL USING (auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  ));

-- 时间段表策略 - 所有用户可读，管理员可写
CREATE POLICY "live_stream_time_slots_read_policy" ON live_stream_time_slots
  FOR SELECT USING (true);

CREATE POLICY "live_stream_time_slots_write_policy" ON live_stream_time_slots
  FOR ALL USING (auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  ));

-- 直播安排表策略 - 所有用户可读，管理员可写
CREATE POLICY "live_stream_schedules_read_policy" ON live_stream_schedules
  FOR SELECT USING (true);

CREATE POLICY "live_stream_schedules_write_policy" ON live_stream_schedules
  FOR ALL USING (auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  ));

-- 直播报名表策略 - 用户只能看到自己的报名记录，管理员可看所有
CREATE POLICY "live_stream_registrations_read_policy" ON live_stream_registrations
  FOR SELECT USING (
    auth.uid() = registrant_id OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  );

CREATE POLICY "live_stream_registrations_insert_policy" ON live_stream_registrations
  FOR INSERT WITH CHECK (auth.uid() = registrant_id);

CREATE POLICY "live_stream_registrations_update_policy" ON live_stream_registrations
  FOR UPDATE USING (
    auth.uid() = registrant_id OR
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  );

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_live_stream_managers_updated_at BEFORE UPDATE ON live_stream_managers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_stream_locations_updated_at BEFORE UPDATE ON live_stream_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_stream_property_types_updated_at BEFORE UPDATE ON live_stream_property_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_stream_time_slots_updated_at BEFORE UPDATE ON live_stream_time_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_stream_schedules_updated_at BEFORE UPDATE ON live_stream_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_stream_registrations_updated_at BEFORE UPDATE ON live_stream_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();