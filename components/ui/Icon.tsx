interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

function toMaterialName(name: string): string {
  return name
    .replace(/([A-Z])/g, c => '_' + c.toLowerCase())
    .replace(/^_/, '');
}

function isMaterialIconName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

export default function Icon({ name, size = 20, color, className }: IconProps) {
  if (!name) return null;

  if (isMaterialIconName(name)) {
    return (
      <span
        className={`material-icons${className ? ` ${className}` : ''}`}
        style={{
          fontSize: size,
          color,
          lineHeight: 1,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFeatureSettings: "'liga'",
          WebkitFontFeatureSettings: "'liga'",
        }}
      >
        {toMaterialName(name)}
      </span>
    );
  }

  // Emoji or text fallback
  return (
    <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>
      {name}
    </span>
  );
}
