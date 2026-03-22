// Global theme matching the user's provided palette: #8F8FEB, #98B9AB, #3555BD, #2C7B84, #000E45
export const theme = {
  colors: {
    primary: '#3555BD',
    secondary: '#8F8FEB', // light purple/blue
    accent: '#2C7B84', // teal
    background: '#F0F2FA', // light background for screens (as seen in the mockup)
    surface: '#FFFFFF', // cards and inputs
    text: '#000E45', // dark blue
    textLight: '#98B9AB', // light sage green
    error: '#FF4C4C', // error red
    danger: '#FF4C4C',
    success: '#4CAF50',
    border: '#E0E5F1'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 9999
  },
  typography: {
    fontFamily: 'System', // Can be replaced by Google Fonts if loaded
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      bold: '700',
    }
  }
}
