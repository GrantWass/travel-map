import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import AuthBootstrap from "@/components/auth-bootstrap";
import { APP_NAME, APP_NAME_DESCRIPTION } from "@/lib/branding";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const _brandDisplay = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-brand-display" });

const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: APP_NAME,
        template: `%s | ${APP_NAME}`,
    },
    description: APP_NAME_DESCRIPTION,
    applicationName: APP_NAME,
    alternates: {
        canonical: "/",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    openGraph: {
        type: "website",
        url: "/",
        siteName: APP_NAME,
        title: APP_NAME,
        description: APP_NAME_DESCRIPTION,
        images: [
            {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: `${APP_NAME} preview`,
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: APP_NAME,
        description: APP_NAME_DESCRIPTION,
        images: ["/twitter-image"],
    },
    category: "travel",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${_geist.variable} ${_geistMono.variable} ${_brandDisplay.variable} font-sans antialiased overflow-hidden`}>
                <AuthBootstrap>{children}</AuthBootstrap>
            </body>
        </html>
    );
}
