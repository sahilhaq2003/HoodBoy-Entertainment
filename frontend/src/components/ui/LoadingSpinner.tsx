import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 24, text }) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-full border-2 border-(--hbe-line) border-t-[#7C3AED] animate-spin"
        style={{ width: size, height: size }}
      />
      {text && <p className="text-sm font-medium text-[var(--hbe-muted)]">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;