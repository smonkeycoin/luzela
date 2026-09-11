import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = "Luzela Protección solar mineral SPF 50+";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  const bottle = readFileSync(join(process.cwd(), "public/luzela/bottle-og.png"));
  const bottleSrc = `data:image/png;base64,${bottle.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f7f6f1",
          color: "#1f1b18",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#147b75",
            height: 760,
            opacity: 0.1,
            position: "absolute",
            right: -240,
            top: -190,
            transform: "rotate(18deg)",
            width: 560,
          }}
        />
        <div
          style={{
            background: "#d8ece7",
            borderRadius: "50%",
            bottom: -250,
            height: 560,
            opacity: 0.7,
            position: "absolute",
            right: 40,
            width: 720,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: "72px 0 68px 78px",
            width: 620,
          }}
        >
          <div
            style={{
              color: "#147b75",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 8,
            }}
          >
            LUZELA MEXICO
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: 0,
                lineHeight: 0.98,
              }}
            >
              Protección solar mineral SPF 50+
            </div>
            <div
              style={{
                color: "#147b75",
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              Hecha en México
            </div>
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            position: "absolute",
            right: 92,
            top: 18,
            width: 430,
          }}
        >
          <img
            alt=""
            src={bottleSrc}
            style={{
              filter: "drop-shadow(0 34px 34px rgba(31, 27, 24, 0.2))",
              height: 520,
              objectFit: "contain",
              width: 360,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
