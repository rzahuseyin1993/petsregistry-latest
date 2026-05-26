import { useCmsPage } from "@/hooks/useCmsPage";
import { ReactNode, useId, useMemo } from "react";
import DOMPurify from "dompurify";

interface CmsRendererProps {
  slug: string;
  fallback: ReactNode;
  className?: string;
}

/** Strip dangerous patterns from CMS-authored CSS */
const stripDangerousCss = (raw: string): string =>
  raw
    .replace(/expression\s*\(/gi, "/* blocked */")
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url("blocked:')
    .replace(/@import\b/gi, "/* @import blocked */")
    .replace(/behavior\s*:/gi, "/* behavior blocked */")
    .replace(/-moz-binding\s*:/gi, "/* binding blocked */");

/** Inline <style> in CMS HTML applies globally — extract and scope it */
const extractInlineStyles = (html: string): { html: string; css: string } => {
  let css = "";
  const stripped = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, block: string) => {
    css += `${block}\n`;
    return "";
  });
  return { html: stripped, css };
};

/**
 * Prefix every CSS rule selector with the CMS container scope so header/footer
 * styles cannot leak onto the rest of the app (e.g. input::before on search fields).
 */
const scopeCssRules = (raw: string, scope: string): string => {
  if (!raw.trim()) return "";

  const css = stripDangerousCss(raw.replace(/\bbody\b/g, scope));
  let out = "";
  let i = 0;

  const prefixSelectors = (selectors: string): string =>
    selectors
      .split(",")
      .map((part) => {
        const sel = part.trim();
        if (!sel) return sel;
        if (sel.startsWith(scope)) return sel;
        // Global selectors must stay inside CMS container only
        if (sel === "*" || sel === "html" || sel === ":root") {
          return `${scope} ${sel}`;
        }
        return `${scope} ${sel}`;
      })
      .join(", ");

  while (i < css.length) {
    if (css.slice(i, i + 2) === "/*") {
      const end = css.indexOf("*/", i + 2);
      const commentEnd = end === -1 ? css.length : end + 2;
      out += css.slice(i, commentEnd);
      i = commentEnd;
      continue;
    }

    if (css[i] === "@") {
      const blockStart = i;
      let depth = 0;
      let j = i;
      while (j < css.length) {
        if (css[j] === "{") depth++;
        if (css[j] === "}") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }
      const block = css.slice(blockStart, j);
      const isNestedAtRule = /^@(media|supports|container|layer)\b/i.test(block);

      if (isNestedAtRule) {
        const innerStart = block.indexOf("{") + 1;
        const innerEnd = block.lastIndexOf("}");
        const inner = block.slice(innerStart, innerEnd);
        out += block.slice(0, innerStart) + scopeCssRules(inner, scope) + block.slice(innerEnd);
      } else {
        out += block;
      }
      i = j;
      continue;
    }

    const selStart = i;
    while (i < css.length && css[i] !== "{") i++;
    const selectors = css.slice(selStart, i).trim();
    if (selectors && !selectors.startsWith("@")) {
      out += prefixSelectors(selectors);
    } else if (selectors) {
      out += selectors;
    }

    let depth = 0;
    while (i < css.length) {
      const ch = css[i];
      out += ch;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        i++;
        if (depth === 0) break;
      } else {
        i++;
      }
    }
  }

  return out;
};

const CmsRenderer = ({ slug, fallback, className }: CmsRendererProps) => {
  const { html, css, hasCmsContent, isLoading } = useCmsPage(slug);
  const scopeId = useId().replace(/:/g, "");
  const scopeSelector = `#cms-${scopeId}`;

  const { sanitizedHtml, sanitizedCss } = useMemo(() => {
    if (!html) return { sanitizedHtml: "", sanitizedCss: "" };

    const { html: htmlNoInlineStyle, css: inlineCss } = extractInlineStyles(html);
    const sanitizedHtml = DOMPurify.sanitize(htmlNoInlineStyle);
    const combinedCss = [css, inlineCss].filter(Boolean).join("\n");
    const sanitizedCss = combinedCss ? scopeCssRules(combinedCss, scopeSelector) : "";

    return { sanitizedHtml, sanitizedCss };
  }, [html, css, scopeSelector]);

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
