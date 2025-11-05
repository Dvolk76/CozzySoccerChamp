import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleProps {
  isOpen: boolean;
  durationMs?: number;
  children: React.ReactNode;
}

export function Collapsible({ isOpen, durationMs = 180, children }: CollapsibleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<string>(isOpen ? 'auto' : '0px');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Ensure initial height is correct on mount
  useLayoutEffect(() => {
    if (isOpen) {
      setHeight('auto');
    } else {
      setHeight('0px');
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measured = `${content.scrollHeight}px`;

    if (isOpen) {
      // Opening: go from current (0) to measured, then to auto
      setIsTransitioning(true);
      // If currently auto (already open but re-open triggered), set to current pixel height first
      if (height === 'auto') {
        setHeight(measured);
      }
      requestAnimationFrame(() => {
        setHeight(measured);
        const onEnd = () => {
          setHeight('auto');
          setIsTransitioning(false);
          container.removeEventListener('transitionend', onEnd);
        };
        container.addEventListener('transitionend', onEnd);
      });
    } else {
      // Closing: from current height (auto -> measured) down to 0
      setIsTransitioning(true);
      const startHeight = height === 'auto' ? measured : height;
      setHeight(startHeight);
      requestAnimationFrame(() => {
        setHeight('0px');
        const onEnd = () => {
          setIsTransitioning(false);
          container.removeEventListener('transitionend', onEnd);
        };
        container.addEventListener('transitionend', onEnd);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Recalculate height if content changes while open (keep auto behavior)
  useEffect(() => {
    if (!isOpen) return;
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;
    
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastKnownHeight = content.scrollHeight;
    
    const observer = new ResizeObserver((entries) => {
      if (isTransitioning || height !== 'auto') return;
      
      // Debounce rapid changes to prevent jank
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      resizeTimeout = setTimeout(() => {
        if (!contentRef.current) return;
        
        const currentHeight = contentRef.current.scrollHeight;
        // Only update if height changed significantly (more than 10px)
        if (Math.abs(currentHeight - lastKnownHeight) > 10) {
          lastKnownHeight = currentHeight;
          // Height is already auto, just let it expand naturally
          // Force a reflow to ensure smooth expansion
          if (containerRef.current) {
            containerRef.current.style.height = 'auto';
          }
        }
      }, 50); // 50ms debounce
    });
    
    // Only observe the main content wrapper
    observer.observe(content);
    
    return () => {
      observer.disconnect();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [isOpen, height, isTransitioning]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        overflow: 'hidden',
        transition: `height ${durationMs}ms ease`,
      }}
      aria-hidden={!isOpen}
    >
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}


