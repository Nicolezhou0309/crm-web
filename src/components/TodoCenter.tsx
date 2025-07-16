import React, { useState } from 'react';
import { List, Tag, Checkbox, Tooltip, Tabs } from 'antd';

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

  // 分组
  const todoList = todos.filter(t => t.status === 'todo');
  const doneList = todos.filter(t => t.status === 'done');

  // 勾选切换
  const handleCheck = (id: string, checked: boolean) => {
    setTodos(list => list.map(item =>
      item.id === id ? { ...item, status: checked ? 'done' : 'todo' } : item
    ));
  };

  // 事项卡片渲染
  const renderItem = (item: TodoItem) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f3f3f3' }}>
      <Checkbox
        checked={item.status === 'done'}
        onChange={e => handleCheck(item.id, e.target.checked)}
        style={{ marginTop: 2, marginRight: 12 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={item.title} placement="topLeft">
            <span style={{
              fontSize: 15,
              fontWeight: 500,
              color: item.status === 'done' ? '#bbb' : '#222',
              textDecoration: item.status === 'done' ? 'line-through' : 'none',
              maxWidth: 180,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}>{item.title}</span>
          </Tooltip>
          {item.tag && <Tag color={item.tagColor || 'default'} style={{ marginLeft: 8 }}>{item.tag}</Tag>}
        </div>
        <div style={{ color: '#888', fontSize: 13, margin: '2px 0 0 0', display: 'flex', alignItems: 'center' }}>
        </div>
        <div style={{ color: '#bbb', fontSize: 12, marginTop: 2, textAlign: 'left' }}>
          {item.starter && <span>我发起的</span>} {item.startTime && <span style={{ marginLeft: 8 }}>{item.startTime}</span>}
        </div>
      </div>
      <div style={{ minWidth: 80, textAlign: 'right', color: '#888', fontSize: 13, marginLeft: 8 }}>
        {item.due}
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', background: '#fff', borderRadius: 18, boxShadow: '0 4px 16px rgba(255,107,53,0.08)', padding: 20, minHeight: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 8, textAlign: 'left' }}>待办事项</div>
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as 'todo'|'done')}
        items={[
          {
            key: 'todo',
            label: `未开始 (${todoList.length})`,
            children: todoList.length === 0 ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无待办事项</div> : todoList.map(renderItem),
          },
          {
            key: 'done',
            label: `已完成 (${doneList.length})`,
            children: doneList.length === 0 ? <div style={{ color: '#bbb', fontSize: 13, padding: '12px 0' }}>暂无已完成事项</div> : doneList.map(renderItem),
          },
        ]}
        size="small"
        style={{ marginTop: 0 }}
      />
    </div>
  );
};

export default TodoCenter; 