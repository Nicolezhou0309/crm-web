import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { List, Tag, Checkbox, Tooltip, Tabs } from 'antd';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';

export interface TodoItem {
  id: string;
  title: string;
  tag?: string;
  tagColor?: string;
  due?: string; // 截止/完成时间
  owner?: string;
  starter?: string;
  startTime?: string;
  code?: string;
  status: 'todo' | 'done';
}

const mockData: TodoItem[] = [
  {
    id: '1',
    title: '下班去后海',
    due: '11月18日 18:00',
    status: 'todo',
  },
  {
    id: '2',
    title: '完成今天的UI设计工作',
    tag: '特急',
    tagColor: 'red',
    due: '3小时后',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '190006',
    status: 'todo',
  },
  {
    id: '3',
    title: 'APP设计走查',
    tag: '测试',
    tagColor: 'green',
    due: '明天',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180056',
    status: 'todo',
  },
  {
    id: '4',
    title: '完成app切图标注工作',
    tag: '一般',
    tagColor: 'blue',
    due: '11-19 完成',
    owner: '霍勒斯',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180064',
    status: 'done',
  },
];

const TodoCenter: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>(mockData);
  const [activeTab, setActiveTab] = useState<'todo'|'done'>('todo');
  const [openMonths, setOpenMonths] = useState<string[]>(() => {
    // 默认未开始分组全部展开，已完成分组全部收起
    const now = new Date();
    return [`${now.getFullYear()}-${now.getMonth() + 1}`]; // 初始本月展开，tab切换时动态调整
  });
  // 记录tab切换，避免每次数据变化都重置openMonths
  const tabChangedRef = useRef(false);

  // 分组
  const todoList = todos.filter(t => t.status === 'todo');
  const doneList = todos.filter(t => t.status === 'done');

  // 按月分组未完成事项
  const todoListByMonth = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    todoList.forEach(item => {
      let monthKey = '未分组';
      if (item.due) {
        // 支持“11月18日 18:00”或“11-19 完成”
        const match = item.due.match(/(\d{1,2})[月\-](\d{1,2})/);
        if (match) {
          const now = new Date();
          const year = now.getFullYear();
          const month = parseInt(match[1], 10);
          monthKey = `${year}-${month}`;
        }
      }
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])); // [[monthKey, TodoItem[]], ...]
  }, [todoList]);

  // 按月分组已完成事项
  const doneListByMonth = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    doneList.forEach(item => {
      let monthKey = '未分组';
      if (item.due) {
        const match = item.due.match(/(\d{1,2})[月\-](\d{1,2})/);
        if (match) {
          const now = new Date();
          const year = now.getFullYear();
          const month = parseInt(match[1], 10);
          monthKey = `${year}-${month}`;
        }
      }
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [doneList]);

  // tab切换时只在首次切换时设置默认展开分组，之后不再自动重置
  useEffect(() => {
    if (!tabChangedRef.current) {
      if (activeTab === 'todo') {
        setOpenMonths(todoListByMonth.length > 0 ? [todoListByMonth[0][0]] : []);
      } else {
        setOpenMonths([]);
      }
      tabChangedRef.current = true;
    }
  }, [activeTab, todoListByMonth]);
  // 切换tab时重置tabChangedRef
  useEffect(() => {
    tabChangedRef.current = false;
  }, [activeTab]);

  // 月份分组展开/收起
  const toggleMonth = (monthKey: string) => {
    setOpenMonths(list =>
      list.includes(monthKey)
        ? [] // 已展开则收起全部
        : [monthKey] // 只展开当前分组
    );
  };

  // 勾选切换
  const handleCheck = (id: string, checked: boolean) => {
    setTodos(list => list.map(item =>
      item.id === id ? { ...item, status: checked ? 'done' : 'todo' } : item
    ));
  };

  // 事项卡片渲染
  const renderItem = (item: TodoItem) => {
    // 判断是否特急事项
    const isUrgent = item.tag === '特急';
    // 截止时间分两行：如“11月18日 18:00” → ["11月18日", "18:00"]
    let dueDate = '', dueTime = '';
    if (item.due) {
      const match = item.due.match(/^(\d{1,2}月\d{1,2}日)[\s ]?(\d{1,2}:\d{2})?$/);
      if (match) {
        dueDate = match[1];
        dueTime = match[2] || '';
      } else {
        dueDate = item.due;
      }
    }
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #f3f3f3' }}>
        <Checkbox
          checked={item.status === 'done'}
          onChange={e => handleCheck(item.id, e.target.checked)}
          style={{ marginTop: 2, marginRight: 10 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={item.title} placement="topLeft">
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: item.status === 'done' ? '#bbb' : isUrgent ? '#ff4d4f' : '#222',
                textDecoration: item.status === 'done' ? 'line-through' : 'none',
                maxWidth: 150,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}>{item.title}</span>
            </Tooltip>
            {/* 不再显示紧急度标签 */}
          </div>
          <div style={{ color: '#bbb', fontSize: 11, marginTop: 2, textAlign: 'left' }}>
            {item.starter && <span>我发起的</span>} {item.startTime && <span style={{ marginLeft: 8 }}>{item.startTime}</span>}
          </div>
        </div>
        <div style={{ minWidth: 56, textAlign: 'right', color: '#888', fontSize: 12, marginLeft: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
          <span>{dueDate}</span>
          {dueTime && <span>{dueTime}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', background: '#fff', borderRadius: 18, boxShadow: '0 4px 16px rgba(255,107,53,0.08)', padding: 20, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 8, textAlign: 'left' }}>待办事项</div>
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as 'todo'|'done')}
        items={[
          {
            key: 'todo',
            label: `未开始 (${todoList.length})`,
            children: (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {todoList.length === 0
                  ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无待办事项</div>
                  : todoListByMonth.map(([monthKey, items]) => {
                      // monthKey: "2024-11"
                      const [year, month] = monthKey.split('-');
                      const label = monthKey === '未分组' ? '未分组' : `${year}年${month}月`;
                      const open = openMonths.includes(monthKey);
                      return (
                        <div key={monthKey} style={{ marginBottom: 8 }}>
                          <div
                            style={{ fontSize: 13, color: '#888', fontWeight: 500, margin: '8px 0 2px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' }}
                            onClick={() => toggleMonth(monthKey)}
                          >
                            {open ? <CaretDownOutlined style={{ fontSize: 14, marginRight: 4 }} /> : <CaretRightOutlined style={{ fontSize: 14, marginRight: 4 }} />}
                            {label}
                          </div>
                          {open && items.map(renderItem)}
                        </div>
                      );
                    })}
              </div>
            ),
          },
          {
            key: 'done',
            label: `已完成 (${doneList.length})`,
            children: (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {doneList.length === 0
                  ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无已完成事项</div>
                  : doneListByMonth.map(([monthKey, items]) => {
                      const [year, month] = monthKey.split('-');
                      const label = monthKey === '未分组' ? '未分组' : `${year}年${month}月`;
                      const open = openMonths.includes(monthKey);
                      return (
                        <div key={monthKey} style={{ marginBottom: 8 }}>
                          <div
                            style={{ fontSize: 13, color: '#888', fontWeight: 500, margin: '8px 0 2px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' }}
                            onClick={() => toggleMonth(monthKey)}
                          >
                            {open ? <CaretDownOutlined style={{ fontSize: 14, marginRight: 4 }} /> : <CaretRightOutlined style={{ fontSize: 14, marginRight: 4 }} />}
                            {label}
                          </div>
                          {open && items.map(renderItem)}
                        </div>
                      );
                    })}
              </div>
            ),
          },
        ]}
        size="small"
        style={{ marginTop: 0, flex: 1, minHeight: 0 }}
        tabBarStyle={{ marginBottom: 8 }}
      />
    </div>
  );
};

export default TodoCenter; 