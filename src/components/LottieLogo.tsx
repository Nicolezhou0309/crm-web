import React, { useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';
import downtownData from '../assets/downtown-lottie.json';

const LottieLogo: React.FC<{ width?: number; height?: number }> = ({ width = 40, height = 40 }) => {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // 页面加载时seek到最后一帧
  useEffect(() => {
    if (lottieRef.current) {
      const totalFrames = lottieRef.current.getDuration(true);
      if (typeof totalFrames === 'number' && !isNaN(totalFrames)) {
        lottieRef.current.goToAndStop(totalFrames - 1, true);
      }
    }
  }, []);

  return (
    <div
      style={{ width, height }}
      onMouseEnter={() => {
        lottieRef.current?.stop();
        lottieRef.current?.play();
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={downtownData}
        loop={false}
        autoplay={false}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default LottieLogo; 