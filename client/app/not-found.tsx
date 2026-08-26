import Link from "next/link";
import { MapPin } from "lucide-react";

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">Lost?</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                This page doesn&apos;t exist. Maybe the link is wrong, or the trip was moved.
            </p>
            <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
                Back to the map
            </Link>
        </main>
    );
}
