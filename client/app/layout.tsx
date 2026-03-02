import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import AuthBootstrap from "@/components/auth-bootstrap";
import { APP_NAME } from "@/lib/branding";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _brandDisplay = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-brand-display" });

export const metadata: Metadata = {
    title: APP_NAME,
    description:
        "Explore the world through authentic travel reviews and recommendations from real travelers, visualized on an interactive map.",
    generator: "v0.app",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${_brandDisplay.variable} font-sans antialiased overflow-hidden`}>
                <AuthBootstrap>{children}</AuthBootstrap>
            </body>
        </html>
    );
}
