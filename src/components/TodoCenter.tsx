import React, { useState, useMemo } from 'react';
import { Checkbox, Tooltip, Tabs } from 'antd';

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
    title: '1*0888续租',
    tag: '特急',
    tagColor: 'red',
    due: '11月18日 18:00',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '190006',
    status: 'todo',
  },
  {
    id: '2',
    title: '提交小红书勤奋度',
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
    title: '发布小红书内容',
    tag: '一般',
    tagColor: 'blue',
    due: '明天',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180056',
    status: 'todo',
  },
  {
    id: '4',
    title: '2*0666房租催收',
    tag: '重要',
    tagColor: 'orange',
    due: '11月19日 12:00',
    owner: '霍勒斯',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180064',
    status: 'todo',
  },
  {
    id: '5',
    title: '提交月度绩效报告',
    tag: '重要',
    tagColor: 'orange',
    due: '11月20日 17:00',
    owner: '我',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180065',
    status: 'todo',
  },
  {
    id: '6',
    title: '3*0999房间清洁检查',
    tag: '一般',
    tagColor: 'blue',
    due: '11月21日 14:00',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180066',
    status: 'todo',
  },
  {
    id: '7',
    title: '4*0555租客投诉处理',
    tag: '特急',
    tagColor: 'red',
    due: '11月18日 20:00',
    owner: '霍勒斯',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180067',
    status: 'todo',
  },
  {
    id: '8',
    title: '5*0777水电费催缴',
    tag: '一般',
    tagColor: 'blue',
    due: '11月22日 16:00',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180068',
    status: 'todo',
  },
  {
    id: '9',
    title: '6*0444房间维修跟进',
    tag: '重要',
    tagColor: 'orange',
    due: '11月23日 10:00',
    owner: '霍勒斯',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180069',
    status: 'done',
  },
  {
    id: '10',
    title: '7*0333租客退房手续',
    tag: '一般',
    tagColor: 'blue',
    due: '11月24日 15:00',
    owner: '麦莉',
    starter: '我',
    startTime: '11月18日 15:05',
    code: '180070',
    status: 'done',
  },
];

const TodoCenter: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>(mockData);
  const [activeTab, setActiveTab] = useState<'todo'|'done'>('todo');

  // 分组
  const todoList = todos.filter(t => t.status === 'todo');
  const doneList = todos.filter(t => t.status === 'done');

  // 按时间排序未完成事项
  const sortedTodoList = useMemo(() => {
    return todoList.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
  }, [todoList]);

  // 按时间排序已完成事项
  const sortedDoneList = useMemo(() => {
    return doneList.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
  }, [doneList]);

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
    // 截止时间分两行：如"11月18日 18:00" → ["11月18日", "18:00"]
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
      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f3f3f3' }}>
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
          </div>
          <div style={{ color: '#bbb', fontSize: 11, marginTop: 2, textAlign: 'left' }}>
            {item.starter && <span>我发起的</span>} {item.startTime && <span style={{ marginLeft: 8 }}>{item.startTime}</span>}
          </div>
        </div>
        <div style={{ minWidth: 56, textAlign: 'right', color: '#888', fontSize: 12, marginLeft: 8, marginRight: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
          <span>{dueDate}</span>
          {dueTime && <span>{dueTime}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', background: '#fff', borderRadius: 18, boxShadow: '0 4px 16px rgba(255,107,53,0.08)', padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 8, textAlign: 'left' }}>待办中心</div>
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as 'todo'|'done')}
        items={[
          {
            key: 'todo',
            label: `未开始 (${todoList.length})`,
            children: (
              <div style={{ 
                height: '300px',
                overflow: 'auto', 
                scrollbarWidth: 'thin',
                scrollbarColor: '#d9d9d9 #f5f5f5'
              }}>
                {sortedTodoList.length === 0
                  ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无待办任务</div>
                  : sortedTodoList.map(item => renderItem(item))}
              </div>
            ),
          },
          {
            key: 'done',
            label: `已完成 (${doneList.length})`,
            children: (
              <div style={{ 
                height: '300px',
                overflow: 'auto', 
                scrollbarWidth: 'thin',
                scrollbarColor: '#d9d9d9 #f5f5f5'
              }}>
                {sortedDoneList.length === 0
                  ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无已完成任务</div>
                  : sortedDoneList.map(item => renderItem(item))}
              </div>
            ),
          },
        ]}
        size="small"
        style={{ marginTop: 0, flex: 1 }}
        tabBarStyle={{ marginBottom: 8 }}
      />
    </div>
  );
};

export default TodoCenter; 