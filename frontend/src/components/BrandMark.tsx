type BrandMarkProps = {
  size?: "sm" | "md" | "lg" | "hero";
  showText?: boolean;
  className?: string;
};

const sizes = {
  sm: 40,
  md: 56,
  lg: 88,
  hero: 168,
} as const;

export function BrandMark({ size = "md", showText = false, className = "" }: BrandMarkProps) {
  const px = sizes[size];
  return (
    <div className={`brand-mark ${className}`.trim()}>
      <img
        src="/logo.png"
        alt="The Digital 26"
        width={px}
        height={px}
        className="brand-mark__logo"
      />
      {showText && (
        <div className="brand-mark__text">
          <span className="brand-mark__name">The Digital 26</span>
          <span className="brand-mark__tag">Vibe Coding Studio</span>
        </div>
      )}
    </div>
  );
}

export function DocBrandHeader({ title }: { title: string }) {
  return (
    <div className="doc-brand-header">
      <BrandMark size="md" />
      <div>
        <p className="doc-brand-header__org">The Digital 26</p>
        <h1 className="doc-brand-header__title">{title}</h1>
      </div>
    </div>
  );
}
