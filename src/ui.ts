export const SCREEN_PADDING = 20;
export const TOUCH_MIN = 44;
export const TITLE_SIZE = 30;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 4,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const TYPOGRAPHY = {
  title: 30,
  section: 19,
  body: 16,
  caption: 13,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#183022',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  md: {
    shadowColor: '#183022',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;
//utilitie