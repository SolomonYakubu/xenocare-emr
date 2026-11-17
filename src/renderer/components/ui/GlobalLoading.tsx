import React, { useEffect, useRef, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const GlobalLoading: React.FC = () => {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [isVisible, setIsVisible] = useState(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = isFetching > 0 || isMutating > 0;

  useEffect(() => {
    if (isLoading) {
      if (!delayTimerRef.current) {
        delayTimerRef.current = setTimeout(() => {
          setIsVisible(true);
          delayTimerRef.current = null;
        }, 150);
      }
      return;
    }

    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setIsVisible(false);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[9999]">
      <div className="h-full bg-[#E9783F] animate-progress origin-left" />
    </div>
  );
};
