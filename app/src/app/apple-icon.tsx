import { ImageResponse } from "next/og";

// iOS home-screen icon. Generated at request time, cached by Vercel.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 110,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          position: "relative",
        }}
      >
        C
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: 28,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#0F766E",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
