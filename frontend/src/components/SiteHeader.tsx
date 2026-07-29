import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark";

/** Slim top brand bar — primary navigation lives in BottomNav. */
export function SiteHeader() {
  return (
    <header className="site-header site-header--slim">
      <Link className="brand-link" to="/" aria-label="The Digital 26 home">
        <BrandMark size="sm" showText />
      </Link>
    </header>
  );
}
