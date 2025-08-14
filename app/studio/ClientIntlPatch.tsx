"use client";

// Some browsers/extensions may set navigator.language(s) to a comma-separated string,
// which will cause Intl APIs to throw with "invalid language tag".
// This component runs on the client and normalizes those values early.
export default function ClientIntlPatch() {
  if (typeof window !== "undefined") {
    try {
      const nav = window.navigator as Navigator & {
        language?: string;
        languages?: readonly string[] | string;
      };

      // Normalize <html lang>
      const html = document.documentElement;
      const htmlLang = html.getAttribute("lang") || "";
      if (htmlLang.includes(",")) {
        const first = htmlLang
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)[0];
        if (first) html.setAttribute("lang", first);
      }

      // Normalize navigator.language if it contains commas
      if (typeof nav.language === "string" && nav.language.includes(",")) {
        const first = nav.language
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)[0];
        if (first) {
          try {
            // Validate by constructing a formatter
            new Intl.DateTimeFormat(first);
            Object.defineProperty(nav, "language", {
              configurable: true,
              get: () => first,
            });
          } catch {}
        }
      }

      // Normalize navigator.languages if it is a string or contains commas
      if (nav.languages) {
        let langs: string[] | undefined;
        if (typeof nav.languages === "string") {
          langs = nav.languages
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (Array.isArray(nav.languages)) {
          const joined = nav.languages.join(",");
          if (joined.includes(",")) {
            langs = joined
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }

        if (langs && langs.length > 0) {
          const valid = langs.filter((code) => {
            try {
              new Intl.DateTimeFormat(code);
              return true;
            } catch {
              return false;
            }
          });
          if (valid.length > 0) {
            Object.defineProperty(nav, "languages", {
              configurable: true,
              get: () => valid,
            });
          }
        }
      }

      // Monkey patch Intl.DateTimeFormat to sanitize comma-separated string tags
      const OriginalDTF = Intl.DateTimeFormat;
      const sanitizeLocaleArg = (arg: unknown): unknown => {
        if (typeof arg === "string" && arg.includes(",")) {
          const first = arg
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)[0];
          return first || arg;
        }
        return arg;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Intl as any).DateTimeFormat = function (
        locale?: unknown,
        options?: Intl.DateTimeFormatOptions
      ) {
        const sanitized = sanitizeLocaleArg(locale);
        // @ts-expect-error preserve constructor signature
        return new OriginalDTF(sanitized as any, options);
      };
      (
        Intl.DateTimeFormat as unknown as { prototype: Intl.DateTimeFormat }
      ).prototype = OriginalDTF.prototype;
    } catch {
      // no-op
    }
  }

  return null;
}
