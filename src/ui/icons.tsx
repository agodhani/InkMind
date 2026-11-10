import type { SVGProps } from 'react';

/** Inline 20px stroke icons (1.75px, round caps) so the UI has one consistent weight and no icon-font dependency. */
export type IconName =
  | 'menu'
  | 'pen'
  | 'eraser'
  | 'hand'
  | 'undo'
  | 'redo'
  | 'ink'
  | 'split'
  | 'digital'
  | 'sparkles'
  | 'refresh'
  | 'download'
  | 'upload'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'close'
  | 'plus'
  | 'search'
  | 'trash'
  | 'edit'
  | 'check'
  | 'alert'
  | 'info'
  | 'more'
  | 'chevron-down'
  | 'dot'
  | 'spinner'
  | 'file'
  | 'keyboard'
  | 'brush';

const PATHS: Record<IconName, React.ReactNode> = {
  menu: <path d="M3 6h14M3 10h14M3 14h14" />,
  pen: <path d="M3 17l1-4L13.5 3.5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L7 16l-4 1zM11.5 5.5l3 3" />,
  eraser: <path d="M7.5 16.5L3.4 12.4a1.5 1.5 0 0 1 0-2.1l6.4-6.4a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L11 16.5zM17 16.5H7.5M6 10l5 5" />,
  hand: <path d="M7 10V4.5a1.5 1.5 0 0 1 3 0V9M10 8.5V3.5a1.5 1.5 0 0 1 3 0V9M13 8.5V5a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 6-6 6-2.6 0-4.1-1.1-5.3-3L3 11.4a1.4 1.4 0 0 1 2.3-1.5L7 12" />,
  undo: <path d="M7 5L3 9l4 4M3 9h8a5 5 0 0 1 0 10h-1" />,
  redo: <path d="M13 5l4 4-4 4M17 9H9a5 5 0 0 0 0 10h1" />,
  ink: <path d="M3 15c3-7 5.5-10 8-10 2 0 1.5 4 3 4s2-2 3-2.5M3 17h14" />,
  split: <path d="M3.5 4.5h13v11h-13zM10 4.5v11" />,
  digital: <path d="M4 5h12M4 9h12M4 13h8" />,
  sparkles: <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM16 14l.7 1.8 1.8.7-1.8.7L16 19l-.7-1.8-1.8-.7 1.8-.7z" />,
  refresh: <path d="M16.5 10a6.5 6.5 0 0 1-11.3 4.4M3.5 10a6.5 6.5 0 0 1 11.3-4.4M15 3v3h-3M5 17v-3h3" />,
  download: <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16.5h12" />,
  upload: <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 16.5h12" />,
  settings: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5l1.3 1.8 2.2-.5.5 2.2 1.8 1.3-1.1 1.9 1.1 1.9-1.8 1.3-.5 2.2-2.2-.5L10 17.5l-1.3-1.8-2.2.5-.5-2.2-1.8-1.3L5.3 10 4.2 8.1 6 6.8l.5-2.2 2.2.5z" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </>
  ),
  moon: <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z" />,
  monitor: <path d="M3 4.5h14v9H3zM7 17h6M10 13.5V17" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  plus: <path d="M10 4v12M4 10h12" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </>
  ),
  trash: <path d="M4 5.5h12M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.8 10a1.5 1.5 0 0 0 1.5 1.5h4.4a1.5 1.5 0 0 0 1.5-1.5l.8-10M8.5 9v5M11.5 9v5" />,
  edit: <path d="M4 16h3l8.5-8.5a1.4 1.4 0 0 0 0-2L14.5 4.5a1.4 1.4 0 0 0-2 0L4 13v3zM11.5 5.5l3 3" />,
  check: <path d="M4 10.5l4 4 8-9" />,
  alert: <path d="M10 3.5l7.5 13h-15zM10 8v4M10 14.2v.3" />,
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.5M10 6.5v.3" />
    </>
  ),
  more: <path d="M5 10h.01M10 10h.01M15 10h.01" strokeWidth={3} />,
  'chevron-down': <path d="M5 8l5 5 5-5" />,
  dot: <circle cx="10" cy="10" r="3.5" fill="currentColor" stroke="none" />,
  spinner: <path d="M10 3a7 7 0 0 1 7 7" />,
  file: <path d="M5 3h6.5L15 6.5V17H5zM11.5 3v3.5H15M7.5 10h5M7.5 13h5" />,
  keyboard: <path d="M3 6h14v9H3zM6 9h.01M9 9h.01M12 9h.01M15 9h.01M6 12h8" />,
  brush: <path d="M15.5 3.5l1 1-6.2 7.2-2-2zM8.3 9.7c-2.3-.3-4 .9-4.3 3-.1 1.1-.6 2-2 2.8 2.9 1.2 6.4.5 7.3-1.8.5-1.3.2-2.6-1-4z" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      className={['icon', name === 'spinner' ? 'icon-spin' : '', className ?? ''].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
