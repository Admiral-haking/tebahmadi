export default function Loading() {
    return (
        <main
            aria-busy="true"
            aria-label="در حال بارگذاری طب احمدی"
            dir="rtl"
            style={{
                minHeight: '100dvh',
                padding: '12px clamp(12px, 3vw, 32px) 48px',
                background: '#F9F8F6',
                color: '#222222',
                boxSizing: 'border-box',
                fontFamily: 'Tahoma, Arial, sans-serif',
            }}
        >
            <style>{`
                @keyframes tebahmadi-loading-pulse {
                    0%, 100% { opacity: .48; }
                    50% { opacity: .9; }
                }
                .tebahmadi-loading-block {
                    background: linear-gradient(110deg, #eeeede 8%, #f8f8f1 18%, #eeeede 33%);
                    background-size: 200% 100%;
                    animation: tebahmadi-loading-pulse 1.35s ease-in-out infinite;
                    border: 1px solid #DEE0D0;
                }
                .tebahmadi-loading-hero {
                    width: 100%;
                    aspect-ratio: 16 / 6;
                    min-height: 190px;
                    margin-top: 20px;
                    border-radius: 16px;
                }
                .tebahmadi-loading-categories {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    margin-top: 20px;
                }
                .tebahmadi-loading-products {
                    height: 260px;
                    margin-top: 24px;
                    border-radius: 16px;
                }
                @media (max-width: 600px) {
                    .tebahmadi-loading-hero {
                        aspect-ratio: 4 / 3;
                        min-height: 140px;
                        border-radius: 12px;
                    }
                    .tebahmadi-loading-categories {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 8px;
                    }
                    .tebahmadi-loading-products {
                        height: 190px;
                        border-radius: 12px;
                    }
                }
            `}</style>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div
                    className="tebahmadi-loading-block"
                    style={{ height: 12, width: '100%', borderRadius: 6, marginBottom: 12 }}
                />
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #DEE0D0',
                    }}
                >
                    <div className="tebahmadi-loading-block" style={{ height: 42, borderRadius: 10 }} />
                    <div className="tebahmadi-loading-block" style={{ width: 96, height: 48, borderRadius: 10 }} />
                    <div className="tebahmadi-loading-block" style={{ height: 42, borderRadius: 10 }} />
                </div>
                <div
                    className="tebahmadi-loading-block tebahmadi-loading-hero"
                />
                <div
                    className="tebahmadi-loading-categories"
                >
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index}>
                            <div
                                className="tebahmadi-loading-block"
                                style={{ aspectRatio: '1 / 1', borderRadius: 12 }}
                            />
                            <div className="tebahmadi-loading-block" style={{ height: 12, marginTop: 8, borderRadius: 6 }} />
                        </div>
                    ))}
                </div>
                <div
                    className="tebahmadi-loading-block tebahmadi-loading-products"
                />
            </div>
        </main>
    );
}
