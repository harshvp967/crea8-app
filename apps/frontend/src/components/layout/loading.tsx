'use client';

import { FC } from 'react';
import { WavePhysicsLoader } from '@gitroom/frontend/components/layout/wave-physics-loader';

const Spinner: FC<{
  type?: string;
  color?: string;
  width?: number;
  height?: number;
}> = ({ color = '#00D9FF', width = 100, height = 100 }) => {
  const size = Math.min(width, height);
  const borderWidth = Math.max(2, Math.round(size / 8));

  return (
    <div
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid transparent`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
};

export { Spinner as default };

export const LoadingComponent: FC<{
  width?: number;
  height?: number;
}> = (props) => {
  return (
    <div className="flex-1 flex justify-center pt-[100px]">
      <Spinner
        color="#00D9FF"
        width={props.width || 100}
        height={props.height || 100}
      />
    </div>
  );
};

export const ScheduleLoading: FC = () => {
  return (
    <div
      className="flex flex-1 items-center justify-center py-[48px]"
      role="status"
    >
      <span className="sr-only">Loading</span>
      <WavePhysicsLoader theme="dark" />
    </div>
  );
};
