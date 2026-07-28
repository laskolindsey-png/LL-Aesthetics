import fs from "fs";
import path from "path";

// If the real brand logo exists at public/logo.png, use it everywhere
// automatically. Otherwise fall back to the SVG stand-in below.
// TO USE THE REAL LOGO: just drop the file at public/logo.png — no code change.
function hasRealLogo(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", "logo.png"));
  } catch {
    return false;
  }
}

// A faithful recreation of the LL Aesthetics monogram (mirrored serif "LL").
// Rendered as SVG so it stays crisp at any size. Replaced automatically by the
// real logo when public/logo.png is present.

export function LogoMark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 160 132" className={className} style={style} role="img" aria-label="LL Aesthetics">
      <g fill="currentColor">
        {/* right serif L (vertical near centre, foot + serifs splay right) */}
        <g>
          <rect x="83" y="20" width="41" height="11" rx="1" />
          <rect x="83" y="20" width="14" height="90" />
          <rect x="83" y="99" width="41" height="11" rx="1" />
          <rect x="112" y="84" width="12" height="26" rx="1" />
        </g>
        {/* left serif L — mirror of the right about x=80 */}
        <g transform="translate(160,0) scale(-1,1)">
          <rect x="83" y="20" width="41" height="11" rx="1" />
          <rect x="83" y="20" width="14" height="90" />
          <rect x="83" y="99" width="41" height="11" rx="1" />
          <rect x="112" y="84" width="12" height="26" rx="1" />
        </g>
      </g>
    </svg>
  );
}

/** The square brand tile: white monogram on the taupe ground, like the real asset. */
export function LogoTile({
  size = 40,
  wordmark = false,
}: {
  size?: number;
  wordmark?: boolean;
}) {
  // The real logo (public/logo.png) already includes the taupe ground + wordmark.
  if (hasRealLogo()) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src="/logo.png"
        alt="LL Aesthetics"
        className="rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl bg-[#93857f] text-white"
      style={{ width: size, height: size }}
    >
      <LogoMark className="text-white" style={{ width: size * 0.62, height: size * 0.52 }} />
      {wordmark && (
        <div
          className="font-serif text-white"
          style={{ fontSize: size * 0.1, letterSpacing: size * 0.03, marginTop: size * 0.02 }}
        >
          AESTHETICS
        </div>
      )}
    </div>
  );
}
