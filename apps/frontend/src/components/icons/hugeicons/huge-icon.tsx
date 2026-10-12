import { createElement, SVGProps } from 'react';
import { hugeIcons, type HugeIconName, type HugeNode } from './paths';

const DROP = new Set([
  'key',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
]);

export type HugeIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: HugeIconName;
  size?: number | string;
};

const renderNode = ([tag, attrs]: HugeNode, index: number) => {
  const next: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (DROP.has(key)) continue;
    if (key === 'fill' && (value === 'none' || value === 'transparent')) continue;
    next[key] = value;
  }
  return createElement(tag, { ...next, key: index });
};

export const HugeIcon = ({
  name,
  size = 20,
  className,
  ...props
}: HugeIconProps) => {
  const labelled = Boolean(props['aria-label'] || props['aria-labelledby']);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
      aria-hidden={labelled ? undefined : props['aria-hidden'] ?? true}
    >
      {(hugeIcons[name] || []).map(renderNode)}
    </svg>
  );
};
