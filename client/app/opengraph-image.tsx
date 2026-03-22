import { ImageResponse } from "next/og";
import { APP_NAME, APP_NAME_DESCRIPTION } from "@/lib/branding";

export const runtime = "edge";
export const alt = `${APP_NAME} — Social Travel Planning Map`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1a3a5c 60%, #0e4c81 100%)",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px",
                    fontFamily: "sans-serif",
                }}
            >
                <div
                    style={{
                        fontSize: 90,
                        fontWeight: 800,
                        color: "white",
                        letterSpacing: "-2px",
                        marginBottom: 28,
                    }}
                >
                    ✈️ {APP_NAME}
                </div>
                <div
                    style={{
                        fontSize: 34,
                        color: "#94a3b8",
                        textAlign: "center",
                        maxWidth: 820,
                        lineHeight: 1.4,
                    }}
                >
                    {APP_NAME_DESCRIPTION}
                </div>
            </div>
        ),
        size,
    );
}
