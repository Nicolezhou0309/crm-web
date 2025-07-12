import React from 'react';

interface HouseLogoProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const HouseLogo: React.FC<HouseLogoProps> = ({ 
  width = 32, 
  height = 32, 
  className = '', 
  style = {} 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* 房屋主体轮廓 - 手绘风格 */}
      <path d="M58 90 L142 90 L142 150 L58 150 Z" fill="none" stroke="#4CAF50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 屋顶线条 - 手绘风格 */}
      <path d="M48 90 L100 45 L152 90" fill="none" stroke="#4CAF50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 门框线条 - 手绘风格 */}
      <path d="M82 120 L112 120 L112 150 L82 150 Z" fill="none" stroke="#8BC34A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 门把手 - 手绘风格 */}
      <circle cx="92" cy="135" r="2.5" fill="#8BC34A" />
      
      {/* 左窗户轮廓 - 手绘风格 */}
      <path d="M68 100 L83 100 L83 115 L68 115 Z" fill="none" stroke="#81C784" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 右窗户轮廓 - 手绘风格 */}
      <path d="M117 100 L132 100 L132 115 L117 115 Z" fill="none" stroke="#81C784" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* 窗户十字线 - 手绘风格 */}
      <line x1="75.5" y1="100" x2="75.5" y2="115" stroke="#81C784" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="68" y1="107.5" x2="83" y2="107.5" stroke="#81C784" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="124.5" y1="100" x2="124.5" y2="115" stroke="#81C784" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="117" y1="107.5" x2="132" y2="107.5" stroke="#81C784" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* 装饰线条 - 房屋底部的地面线 */}
      <path d="M45 155 L155 155" fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
      
      {/* 装饰线条 - 屋顶装饰 */}
      <path d="M75 75 L125 75" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      
      {/* 手绘风格的装饰细节 */}
      <path d="M65 140 L75 140" fill="none" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M125 140 L135 140" fill="none" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

export default HouseLogo; 