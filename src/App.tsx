import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SlideVerifyProps {
  onSuccess: (token: string) => void;
  getUrl: string;
  checkUrl: string;
  onError?: (message: string) => void;
  maxRetries?: number;
}

interface Challenge {
  id: string;
  mockPosition: number;
  startPosition: number;
}

const SlideVerify: React.FC<SlideVerifyProps> = ({
  onSuccess,
  getUrl,
  checkUrl,
  onError,
  maxRetries = 3
}) => {
  // 状态管理
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [sliderX, setSliderX] = useState(0);
  const [status, setStatus] = useState('Slide to Verify');
  const [track, setTrack] = useState<{ x: number; y: number; timestamp: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [disabled, setDisabled] = useState(false);

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // 获取新的验证码
  const fetchNewChallenge = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(getUrl);
      const data = await response.json();
      if (data.success) {
        setChallenge(data.data);
        setStatus('Slide to Verify');
        setSliderX(data.data.startPosition);
        setTrack([]);
      } else {
        throw new Error(data.reason || 'Failed to get verification code');
      }
    } catch (err) {
      setStatus('Failed to load');
      onError?.(err instanceof Error ? err.message : 'Network Error');
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // 初始化
  useEffect(() => {
    fetchNewChallenge();
  }, [fetchNewChallenge]);

  // 处理重试
  const handleRetry = useCallback(() => {
    if (retryCount >= maxRetries) {
      setDisabled(true);
      setStatus('Too many attempts, please try again later');
      return;
    }
    setRetryCount(prev => prev + 1);
    fetchNewChallenge();
  }, [retryCount, maxRetries, fetchNewChallenge]);

  // 开始滑动
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || isLoading) return;

    setIsDragging(true);
    const startPosition = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setStartX(startPosition);
    startTimeRef.current = Date.now();

    setTrack([{
      x: sliderX,
      y: startY,
      timestamp: Date.now()
    }]);
  }, [disabled, isLoading, sliderX]);

  // 滑动过程
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !challenge) return;

    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    const currentPosition = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = currentPosition - startX;
    const containerWidth = 300 - 40;

    // 修改：允许在整个轨道范围内滑动
    const newX = Math.max(0, Math.min(deltaX + challenge.startPosition, containerWidth));

    setSliderX(newX);

    // 记录轨迹
    setTrack(prev => {
      const lastPoint = prev[prev.length - 1];
      const now = Date.now();

      if (lastPoint && now - lastPoint.timestamp < 16) {
        return prev;
      }

      return [...prev, {
        x: newX,
        y: 0,
        timestamp: now
      }];
    });
  }, [isDragging, challenge, startX]);

  // 结束滑动
  const handleEnd = useCallback(async () => {
    if (!isDragging || !challenge) return;
    setIsDragging(false);

    try {
      const response = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: challenge.id,
          position: sliderX, // 直接使用滑块位置
          trajectory: track.map(point => ({
            ...point,
            x: point.x // 保持原始位置值
          })),
          timeSpent: Date.now() - startTimeRef.current
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('Verification Success ✓');
        setDisabled(true);
        onSuccess(data.token);
      } else {
        setStatus(`Verification Failed: ${data.reason}`);
        setSliderX(0);
        handleRetry();
      }
    } catch (err) {
      setStatus('Request Failed');
      setSliderX(0);
      handleRetry();
    }
  }, [isDragging, challenge, sliderX, track, onSuccess, handleRetry]);

  // 事件监听
  useEffect(() => {
    if (disabled) return;

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [handleMove, handleEnd, disabled]);

  // 样式计算
  const targetStyle: React.CSSProperties = {
    position: 'absolute',
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: '20px',
    left: challenge ? `${challenge.mockPosition}px` : '0', // 使用原始位置
    pointerEvents: 'none',
    transition: 'opacity 0.3s ease',
    opacity: isLoading ? 0 : 1
  };

  const sliderStyle: React.CSSProperties = {
    ...sliderThumbStyle,
    transform: `translateX(${sliderX}px)`,
    cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
    backgroundColor: disabled ? '#ccc' :
      Math.abs(sliderX - (challenge?.mockPosition || 0)) < 10 ? '#4CAF50' : '#2196F3',
    opacity: isLoading ? 0.5 : 1
  };

  return (
    <div className="slider-container" style={containerStyle} ref={containerRef}>
      <div style={sliderTrackStyle}>
        <div style={targetStyle} />
        <div
          style={sliderStyle}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
        />
      </div>
      <p style={{
        textAlign: 'center',
        color: status.includes('Success') ? '#4CAF50' :
          status.includes('Failed') ? '#f44336' : '#666',
        fontSize: '14px',
        marginTop: '8px'
      }}>
        {isLoading ? 'Loading...' : status}
      </p>
      {retryCount > 0 && retryCount < maxRetries && (
        <p style={{
          textAlign: 'center',
          color: '#666',
          fontSize: '12px'
        }}>
          {maxRetries - retryCount} attempts remaining
        </p>
      )}
    </div>
  );
};

// 样式对象
const containerStyle: React.CSSProperties = {
  width: '300px',
  margin: '50px auto',
  userSelect: 'none'
};

const sliderTrackStyle: React.CSSProperties = {
  backgroundColor: '#eee',
  height: '40px',
  borderRadius: '20px',
  position: 'relative',
  overflow: 'hidden'
};

const sliderThumbStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  backgroundColor: '#2196F3',
  borderRadius: '20px',
  position: 'absolute',
  left: 0,
  transition: 'transform 0.1s ease, background-color 0.3s ease, opacity 0.3s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
};

export default SlideVerify;