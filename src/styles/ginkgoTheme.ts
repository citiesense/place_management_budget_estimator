// Ginkgo Brand Theme - Based on Web Style Guide
// This file contains all brand colors, typography, and component styles

export const ginkgoTheme = {
  // Brand Colors from Style Guide
  colors: {
    primary: {
      green: '#0feaa6',      // Primary accent green
      orange: '#f37129',     // Orange (used in buttons)
      darkTeal: '#034744',   // Dark teal
      navy: '#162e54',       // Navy blue
    },
    secondary: {
      softGreen: '#a1c6bb',  // Soft green
      lightGray: '#dfebef',  // Light gray
      veryLightGreen: '#e2f2ee', // Very light green
      offWhite: '#eaf2f4',   // Off-white background
    },
    // Functional colors
    text: {
      primary: '#162e54',    // Navy for primary text
      secondary: '#034744',  // Dark teal for secondary
      light: '#64748b',      // Light gray for muted text
      white: '#ffffff',
    },
    background: {
      main: '#ffffff',
      light: '#eaf2f4',      // Off-white
      card: '#ffffff',
      hover: '#e2f2ee',      // Very light green for hover
    },
    status: {
      success: '#0feaa6',
      warning: '#f37129',
      error: '#dc2626',
      info: '#0ea5e9',
    },
    // Button specific colors
    button: {
      primaryBg: '#f37129',   // Orange
      primaryText: '#ffffff',
      primaryHover: '#0feaa6',
      secondaryBg: '#162d54', // Navy blue background
      secondaryText: '#ffffff', // White text on navy
      secondaryBorder: '#162d54', // Navy border
      secondaryHover: '#0feaa6', // Green on hover
      disabled: '#d8d8d8',
    }
  },
  
  // Typography (using web-safe alternatives)
  typography: {
    fontFamily: {
      heading: '"Montserrat", "Segoe UI", Tahoma, sans-serif', // Alternative to P22 Mackinac Pro
      body: '"Inter", "Segoe UI", Tahoma, sans-serif',        // Alternative to Freight Sans Pro
    },
    fontSize: {
      // Desktop sizes
      h1: '80px',
      h2: '50px',
      h3: '35px',
      subheader: '30px',
      body: '25px',
      button: '20px',
      small: '14px',
      // Mobile sizes
      mobile: {
        h1: '40px',
        h2: '25px',
        h3: '20px',
        subheader: '18px',
        body: '14px',
        button: '14px',
      }
    },
    fontWeight: {
      bold: 700,
      semibold: 600,
      medium: 500,
      regular: 400,
    },
    lineHeight: {
      h1: '85px',
      h2: '60px',
      h3: '45px',
      body: 'auto',
      mobile: {
        h1: '45px',
        h2: '30px',
        h3: '25px',
      }
    }
  },
  
  // Spacing based on style guide
  spacing: {
    xLarge: '150px',
    large: '100px',
    medium: '50px',
    small: '30px',
    xSmall: '20px',
    tiny: '10px',
    // Grid system
    grid: {
      columns: 12,
      gutter: '20px',
      margin: '50px',
    }
  },
  
  // Component styles
  components: {
    button: {
      height: '45px',
      paddingX: '30px',
      borderRadius: '6px',
      fontSize: '20px',
      fontWeight: 600,
      transition: 'all 0.3s ease',
      // Hover state
      hover: {
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 20px rgba(15, 234, 166, 0.4)',
      }
    },
    card: {
      borderRadius: '12px',
      padding: '30px',
      background: '#ffffff',
      border: '1px solid #dfebef',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      hover: {
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        transform: 'translateY(-4px)',
      }
    },
    input: {
      height: '45px',
      padding: '12px 16px',
      borderRadius: '6px',
      border: '2px solid #dfebef',
      fontSize: '16px',
      focus: {
        borderColor: '#0feaa6',
        outline: 'none',
        boxShadow: '0 0 0 3px rgba(15, 234, 166, 0.1)',
      }
    },
    modal: {
      overlay: 'rgba(22, 46, 84, 0.7)', // Navy with opacity
      borderRadius: '16px',
      padding: '40px',
      maxWidth: '600px',
    }
  },
  
  // Breakpoints
  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1440px',
  },
  
  // Shadows
  shadows: {
    small: '0 2px 4px rgba(0,0,0,0.05)',
    medium: '0 4px 6px rgba(0,0,0,0.05)',
    large: '0 10px 30px rgba(0,0,0,0.1)',
    glow: '0 10px 20px rgba(15, 234, 166, 0.4)',
  }
};

// CSS helper functions
export const getButtonStyles = (variant: 'primary' | 'secondary' = 'primary') => {
  const theme = ginkgoTheme;
  
  if (variant === 'primary') {
    return {
      backgroundColor: theme.colors.button.primaryBg,
      color: theme.colors.button.primaryText,
      border: 'none',
      height: theme.components.button.height,
      padding: `0 ${theme.components.button.paddingX}`,
      borderRadius: theme.components.button.borderRadius,
      fontSize: theme.components.button.fontSize,
      fontWeight: theme.components.button.fontWeight,
      fontFamily: theme.typography.fontFamily.body,
      cursor: 'pointer',
      transition: theme.components.button.transition,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    };
  } else {
    return {
      backgroundColor: theme.colors.button.secondaryBg,
      color: theme.colors.button.secondaryText,
      border: `2px solid ${theme.colors.button.secondaryBorder}`,
      height: theme.components.button.height,
      padding: `0 ${theme.components.button.paddingX}`,
      borderRadius: theme.components.button.borderRadius,
      fontSize: theme.components.button.fontSize,
      fontWeight: theme.components.button.fontWeight,
      fontFamily: theme.typography.fontFamily.body,
      cursor: 'pointer',
      transition: theme.components.button.transition,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    };
  }
};

export const getCardStyles = () => ({
  backgroundColor: ginkgoTheme.components.card.background,
  borderRadius: ginkgoTheme.components.card.borderRadius,
  padding: ginkgoTheme.components.card.padding,
  border: ginkgoTheme.components.card.border,
  boxShadow: ginkgoTheme.components.card.boxShadow,
  transition: 'all 0.3s ease',
});

export const getInputStyles = () => ({
  height: ginkgoTheme.components.input.height,
  padding: ginkgoTheme.components.input.padding,
  borderRadius: ginkgoTheme.components.input.borderRadius,
  border: ginkgoTheme.components.input.border,
  fontSize: ginkgoTheme.components.input.fontSize,
  fontFamily: ginkgoTheme.typography.fontFamily.body,
  width: '100%',
  outline: 'none',
  transition: 'all 0.2s ease',
});

// Export theme as default
export default ginkgoTheme;