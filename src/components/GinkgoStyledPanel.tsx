import React from 'react';
import { ginkgoTheme } from '../styles/ginkgoTheme';

interface GinkgoPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function GinkgoPanel({ children, style }: GinkgoPanelProps) {
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '30px',
    left: '30px',
    background: ginkgoTheme.colors.background.main,
    padding: ginkgoTheme.spacing.small,
    borderRadius: '12px',
    boxShadow: ginkgoTheme.shadows.medium,
    maxWidth: '420px',
    border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
    fontFamily: ginkgoTheme.typography.fontFamily.body,
    ...style
  };

  return <div style={panelStyle}>{children}</div>;
}

export function GinkgoButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  style,
  ...props
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    padding: `0 ${ginkgoTheme.components.button.paddingX}`,
    height: ginkgoTheme.components.button.height,
    borderRadius: ginkgoTheme.components.button.borderRadius,
    fontSize: '16px',
    fontWeight: ginkgoTheme.components.button.fontWeight,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: ginkgoTheme.components.button.transition,
    fontFamily: ginkgoTheme.typography.fontFamily.body,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    ...style
  };

  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          ...baseStyle,
          backgroundColor: disabled 
            ? ginkgoTheme.colors.button.disabled 
            : ginkgoTheme.colors.button.primaryBg,
          color: ginkgoTheme.colors.button.primaryText,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = ginkgoTheme.colors.button.primaryHover;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = ginkgoTheme.shadows.glow;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = ginkgoTheme.colors.button.primaryBg;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  } else {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          ...baseStyle,
          backgroundColor: disabled 
            ? ginkgoTheme.colors.button.disabled 
            : ginkgoTheme.colors.button.secondaryBg,
          color: disabled 
            ? ginkgoTheme.colors.button.disabled 
            : ginkgoTheme.colors.button.secondaryText,
          border: `2px solid ${disabled 
            ? ginkgoTheme.colors.button.disabled 
            : ginkgoTheme.colors.button.secondaryBorder}`,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = ginkgoTheme.colors.button.secondaryHover;
            e.currentTarget.style.borderColor = ginkgoTheme.colors.button.secondaryHover;
            e.currentTarget.style.color = ginkgoTheme.colors.text.white;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(15, 234, 166, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = ginkgoTheme.colors.button.secondaryBg;
            e.currentTarget.style.borderColor = ginkgoTheme.colors.button.secondaryBorder;
            e.currentTarget.style.color = ginkgoTheme.colors.button.secondaryText;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
}

export function GinkgoCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: ginkgoTheme.colors.secondary.offWhite,
        borderRadius: '8px',
        padding: '16px',
        border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
        marginBottom: '12px',
        transition: 'all 0.3s ease',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = ginkgoTheme.shadows.large;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </div>
  );
}

export function GinkgoTitle({ children, level = 1 }: { children: React.ReactNode; level?: 1 | 2 | 3 }) {
  const styles: Record<number, React.CSSProperties> = {
    1: {
      fontSize: '32px',
      fontWeight: 700,
      color: ginkgoTheme.colors.primary.navy,
      marginBottom: '8px',
      marginTop: 0,
      fontFamily: ginkgoTheme.typography.fontFamily.heading,
    },
    2: {
      fontSize: '24px',
      fontWeight: 700,
      color: ginkgoTheme.colors.primary.navy,
      marginBottom: '6px',
      marginTop: 0,
      fontFamily: ginkgoTheme.typography.fontFamily.heading,
    },
    3: {
      fontSize: '18px',
      fontWeight: 600,
      color: ginkgoTheme.colors.primary.darkTeal,
      marginBottom: '4px',
      marginTop: 0,
      fontFamily: ginkgoTheme.typography.fontFamily.heading,
    }
  };

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag style={styles[level]}>{children}</Tag>;
}

export function GinkgoText({ children, style, muted = false }: { 
  children: React.ReactNode; 
  style?: React.CSSProperties;
  muted?: boolean;
}) {
  return (
    <p style={{
      fontSize: '14px',
      lineHeight: '1.6',
      color: muted ? ginkgoTheme.colors.text.light : ginkgoTheme.colors.text.secondary,
      margin: '8px 0',
      fontFamily: ginkgoTheme.typography.fontFamily.body,
      ...style
    }}>
      {children}
    </p>
  );
}

export function GinkgoBadge({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'error' 
}) {
  const colors = {
    default: { bg: ginkgoTheme.colors.secondary.lightGray, text: ginkgoTheme.colors.text.secondary },
    success: { bg: '#e2f2ee', text: ginkgoTheme.colors.primary.green },
    warning: { bg: '#fff4ec', text: ginkgoTheme.colors.primary.orange },
    error: { bg: '#fee2e2', text: '#dc2626' }
  };

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: colors[variant].bg,
      color: colors[variant].text,
      fontFamily: ginkgoTheme.typography.fontFamily.body,
    }}>
      {children}
    </span>
  );
}

export function GinkgoLegend() {
  const categoryColors: Record<string, string> = {
    'Food & Drink': ginkgoTheme.colors.primary.orange,
    'Shopping': '#e45756',
    'Services': ginkgoTheme.colors.primary.darkTeal,
    'Entertainment': ginkgoTheme.colors.primary.green,
    'Other': ginkgoTheme.colors.secondary.softGreen,
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <GinkgoTitle level={3}>Legend</GinkgoTitle>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '8px',
        marginTop: '12px',
      }}>
        {Object.entries(categoryColors).map(([category, color]) => (
          <React.Fragment key={category}>
            <span style={{
              width: 12,
              height: 12,
              background: color,
              borderRadius: '50%',
              marginTop: '3px',
            }} />
            <span style={{
              fontSize: '13px',
              color: ginkgoTheme.colors.text.secondary,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
            }}>
              {category}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}