import React, { useState } from 'react';

interface TimeBlockSelectorProps {
  value?: boolean[][]; // 7天*24小时的二维数组
  onChange?: (value: boolean[][]) => void;
}

const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const hours = Array.from({ length: 24 }, (_, i) => i);

const defaultValue = () => Array(7).fill(null).map(() => Array(24).fill(false));

const TimeBlockSelector: React.FC<TimeBlockSelectorProps> = ({ value, onChange }) => {
  const [blocks, setBlocks] = useState<boolean[][]>(value || defaultValue());
  const [dragging, setDragging] = useState<boolean>(false);
  const [dragValue, setDragValue] = useState<boolean | null>(null);

  const handleCellClick = (d: number, h: number) => {
    const newBlocks = blocks.map(row => [...row]);
    newBlocks[d][h] = !newBlocks[d][h];
    setBlocks(newBlocks);
    onChange && onChange(newBlocks);
  };

  const handleCellMouseDown = (d: number, h: number) => {
    setDragging(true);
    setDragValue(!blocks[d][h]);
    const newBlocks = blocks.map(row => [...row]);
    newBlocks[d][h] = !blocks[d][h];
    setBlocks(newBlocks);
    onChange && onChange(newBlocks);
  };

  const handleCellMouseOver = (d: number, h: number) => {
    if (!dragging || dragValue === null) return;
    const newBlocks = blocks.map(row => [...row]);
    if (newBlocks[d][h] !== dragValue) {
      newBlocks[d][h] = dragValue;
      setBlocks(newBlocks);
      onChange && onChange(newBlocks);
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setDragValue(null);
  };

  React.useEffect(() => {
    if (value) setBlocks(value);
  }, [value]);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [dragging]);

  return (
    <div style={{ userSelect: 'none' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 60 }}></th>
            {hours.map(h => (
              <th key={h} style={{ width: 24, fontWeight: 'normal', fontSize: 12, color: '#888' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, d) => (
            <tr key={day}>
              <td style={{ fontSize: 13, color: '#666', textAlign: 'right', paddingRight: 4 }}>{day}</td>
              {hours.map(h => (
                <td
                  key={h}
                  style={{
                    width: 24,
                    height: 24,
                    background: blocks[d][h] ? '#1890ff' : '#f5f5f5',
                    border: '1px solid #e8e8e8',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => handleCellClick(d, h)}
                  onMouseDown={() => handleCellMouseDown(d, h)}
                  onMouseOver={() => handleCellMouseOver(d, h)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimeBlockSelector; 