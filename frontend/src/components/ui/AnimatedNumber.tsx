import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, format, duration = 1100, className }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const current = from + (value - from) * easeOut(p);
      setDisplay(current);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const render = format ? format(display) : Math.round(display).toLocaleString();
  return <span className={className}>{render}</span>;
};

export default AnimatedNumber;