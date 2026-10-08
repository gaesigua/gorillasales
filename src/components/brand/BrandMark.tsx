/** The gorilla head on packaging gold: the GorillaSales mark. */
export default function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center bg-gold" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gorilla-head.png" alt="" width={Math.round(size * 0.78)} height={Math.round(size * 0.86)} />
    </span>
  );
}
