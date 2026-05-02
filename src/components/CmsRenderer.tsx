import { useCmsPage } from "@/hooks/useCmsPage";
import { ReactNode, useId, useMemo } from "react";
import DOMPurify from "dompurify";

interface CmsRendererProps {
  slug: string;
  fallback: ReactNode;
  className?: string;
}

const sanitizeCss = (raw: string, scopeSelector: string): string => {
  const scoped = raw.replace(/body/g, scopeSelector);
  // Strip dangerous CSS patterns
  return scoped
    .replace(/expression\s*\(/gi, "/* blocked */")
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url("blocked:')
    .replace(/@import\b/gi, "/* @import blocked */")
    .replace(/behavior\s*:/gi, "/* behavior blocked */")
    .replace(/-moz-binding\s*:/gi, "/* binding blocked */");
};

const CmsRenderer = ({ slug, fallback, className }: CmsRendererProps) => {
  const { html, css, hasCmsContent, isLoading } = useCmsPage(slug);
  const scopeId = useId().replace(/:/g, "");

  const sanitizedHtml = useMemo(
    () => (html ? DOMPurify.sanitize(html) : ""),
    [html]
  );
  const sanitizedCss = useMemo(
    () => (css ? sanitizeCss(css, `#cms-${scopeId}`) : ""),
    [css, scopeId]
  );

  if (isLoading) return <>{fallback}</>;
  if (!hasCmsContent) return <>{fallback}</>;

  return (
    <div className={className} id={`cms-${scopeId}`}>
      {sanitizedCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCss }} />
      )}
      <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
    </div>
  );
};

export default CmsRenderer;
