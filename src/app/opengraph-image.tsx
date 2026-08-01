import { ImageResponse } from "next/og";

/**
 * The card this application unfurls as when its URL is pasted somewhere.
 *
 * Generated rather than committed as a PNG, so the words on it come from the
 * same place as the words on the page and cannot drift into describing an older
 * version of the product.
 *
 * It is drawn by Satori, which is not a browser and has two rules worth knowing
 * before editing this file — both of them found the hard way, by a build that
 * failed:
 *
 * 1. **Every element with more than one child needs an explicit `display`.**
 *    There is no block layout to fall back on. A `<div>` holding two lines of
 *    text and a `<br>` is three children and fails the export outright.
 * 2. **Only characters the bundled font has.** Anything outside it sends Satori
 *    off to fetch a font at build time, and that request is not guaranteed to
 *    be answerable — so the mark here is drawn with boxes rather than typed as
 *    a glyph, and every string is plain Latin text.
 */
export const alt = "Nivara Desk: four apps, one support desk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGS = ["Next.js", "React 19", "TypeScript", "Tailwind v4", "Realtime"];

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#0c1017",
        color: "#e7ebf1",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* The mark, drawn rather than typed — see rule 2 above. */}
        <div
          style={{
            display: "flex",
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#1d63c4",
          }}
        />
        <div style={{ display: "flex", marginLeft: 20, fontSize: 30, color: "#9aa6b6" }}>
          Nivara Desk
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 44,
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        <div style={{ display: "flex" }}>Four front ends.</div>
        <div style={{ display: "flex", marginTop: 4 }}>One API.</div>
      </div>

      <div
        style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#9aa6b6", maxWidth: 920 }}
      >
        A support desk — portal, dashboard, widget and analytics — told apart by which credential
        each one holds.
      </div>

      <div style={{ display: "flex", marginTop: 48 }}>
        {TAGS.map((tag) => (
          <div
            key={tag}
            style={{
              display: "flex",
              marginRight: 12,
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid #232c39",
              background: "#141a23",
              fontSize: 24,
              color: "#9aa6b6",
            }}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
