import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import './CelebrationAnimation.css';

interface CelebrationAnimationProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const CelebrationAnimation: React.FC<CelebrationAnimationProps> = ({
  visible,
  onClose,
  title = '恭喜成交!',
  message = '您已成功完成一笔交易，继续保持！'
}) => {

  useEffect(() => {
    if (visible) {
      // 创建原生DOM元素
      const modalContainer = document.createElement('div');
      modalContainer.className = 'celebration-modal-native';
      modalContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 9999999 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: auto !important;
      `;

      const modalContent = document.createElement('div');
      modalContent.className = 'celebration-content-native';
      modalContent.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        border-radius: 20px !important;
        padding: 40px !important;
        text-align: center !important;
        color: white !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
        max-width: 500px !important;
        width: 90% !important;
        position: relative !important;
        z-index: 10000000 !important;
      `;

      modalContent.innerHTML = `
        <div class="celebration-icon">
          <div class="celebration-star">⭐</div>
          <div class="celebration-star delay-1">⭐</div>
          <div class="celebration-star delay-2">⭐</div>
          <div class="celebration-star delay-3">⭐</div>
          <div class="celebration-star delay-4">⭐</div>
        </div>
        
        <h2 style="font-size: 24px; margin: 20px 0; color: white;">${title}</h2>
        <p style="font-size: 16px; margin: 0; color: white;">${message}</p>
        
        <div class="celebration-fireworks">
          <div class="firework"></div>
          <div class="firework delay-1"></div>
          <div class="firework delay-2"></div>
          <div class="firework delay-3"></div>
        </div>
      `;

      modalContainer.appendChild(modalContent);
      document.body.appendChild(modalContainer);

      // 触发彩带效果
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000001 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // 3秒后自动关闭
      const timer = setTimeout(() => {
        document.body.removeChild(modalContainer);
        onClose();
      }, 3000);

      // 清理函数
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        if (document.body.contains(modalContainer)) {
          document.body.removeChild(modalContainer);
        }
      };
    }
  }, [visible, onClose, title, message]);

  // 如果不可见，不渲染任何内容
  if (!visible) {
    return null;
  }

  return null; // 使用原生DOM，不需要React组件
};

export default CelebrationAnimation; 