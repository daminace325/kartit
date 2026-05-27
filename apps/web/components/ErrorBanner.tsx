export function ErrorBanner({ message, className = "" }: { message: string | null; className?: string }) {
    if (!message) return null;
    return (
        <div role="alert" className={`rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 ${className}`}>
            {message}
        </div>
    );
}
