import { MD3LightTheme as DefaultTheme, configureFonts, MD3Theme } from 'react-native-paper';

const fontConfig = {
  web: {
    regular: {
      fontFamily: 'sans-serif',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    medium: {
      fontFamily: 'sans-serif-medium',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    light: {
      fontFamily: 'sans-serif-light',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    thin: {
      fontFamily: 'sans-serif-thin',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
  },
  ios: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as '400',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as '500',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300' as '300',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100' as '100',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
  },
  android: {
    regular: {
      fontFamily: 'sans-serif',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    medium: {
      fontFamily: 'sans-serif-medium',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    light: {
      fontFamily: 'sans-serif-light',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
    thin: {
      fontFamily: 'sans-serif-thin',
      fontWeight: 'normal' as 'normal',
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.25,
    },
  },
};

const theme: MD3Theme = {
  ...DefaultTheme,
//   fonts: configureFonts({ config: fontConfig, isV3: true }),
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E90FF',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    backdrop: '#00000050'
  },
};

export default theme;
