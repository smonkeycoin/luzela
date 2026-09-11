import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f7f6f1",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#147b75",
            borderRadius: 40,
            color: "#f7f6f1",
            display: "flex",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 102,
            fontWeight: 700,
            height: 140,
            justifyContent: "center",
            letterSpacing: 0,
            width: 140,
          }}
        >
          L
        </div>
      </div>
    ),
    size,
  );
}
