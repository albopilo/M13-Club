import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'largeDesktop';

export interface ResponsiveState {
  width: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  isWeb: boolean;
  isNative: boolean;
  showSidebar: boolean;
}

const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1536,
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.largeDesktop) return 'largeDesktop';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export function useResponsive(): ResponsiveState {
  const [width, setWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const handler = ({ window }: { window: { width: number; height: number } }) => {
      setWidth(window.width);
    };
    const subscription = Dimensions.addEventListener('change', handler);
    return () => subscription?.remove();
  }, []);

  const breakpoint = getBreakpoint(width);
  const isWeb = Platform.OS === 'web';
  const isNative = Platform.OS !== 'web';

  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isLargeDesktop: breakpoint === 'largeDesktop',
    isWeb,
    isNative,
    showSidebar: isWeb && width >= BREAKPOINTS.desktop,
  };
}
