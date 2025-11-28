import { motion } from 'framer-motion';

export function FriendCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* Avatar skeleton */}
        <div className="w-14 h-14 bg-gray-200 rounded-full animate-pulse" />
        
        <div className="flex-1 space-y-2">
          {/* Name skeleton */}
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          {/* Bio skeleton */}
          <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
        </div>
        
        {/* Button skeleton */}
        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </motion.div>
  );
}

export function FriendRequestSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* Avatar skeleton */}
        <div className="w-14 h-14 bg-gray-200 rounded-full animate-pulse" />
        
        <div className="flex-1 space-y-2">
          {/* Name skeleton */}
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          {/* Bio skeleton */}
          <div className="h-4 bg-gray-100 rounded w-48 animate-pulse" />
        </div>
        
        {/* Buttons skeleton */}
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

export function SuggestionCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        {/* Avatar skeleton */}
        <div className="w-14 h-14 bg-gray-200 rounded-full animate-pulse" />
        
        <div className="flex-1 space-y-2">
          {/* Name skeleton */}
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          {/* School skeleton */}
          <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
        </div>
        
        {/* Button skeleton */}
        <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </motion.div>
  );
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <FriendCardSkeleton key={i} />
      ))}
    </div>
  );
}
