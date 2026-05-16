import { ImageResponse } from "next/og";

// Desktop favicon — 32×32 PNG.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F172A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          color: "#FAF9F6",
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
