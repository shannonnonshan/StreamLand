import { CheckIcon, EyeIcon } from '@heroicons/react/24/solid';

type MessageStatus = 'SENT' | 'DELIVERED' | 'SEEN';

interface MessageStatusIconProps {
  status: MessageStatus;
  className?: string;
}

export default function MessageStatusIcon({ status, className = '' }: MessageStatusIconProps) {
  if (status === 'SEEN') {
    return (
      <EyeIcon className={`w-4 h-4 ${className}`} title="Đã xem" />
    );
  }

  if (status === 'DELIVERED') {
    return (
      <div className="relative inline-flex items-center w-4 h-4" title="Đã nhận">
        <CheckIcon className={`w-3.5 h-3.5 absolute ${className}`} style={{ left: '0px' }} />
        <CheckIcon className={`w-3.5 h-3.5 absolute ${className}`} style={{ left: '4px' }} />
      </div>
    );
  }

  // SENT - single tick
  return (
    <CheckIcon className={`w-4 h-4 ${className}`} title="Đã gửi" />
  );
}
