"use client";

export function Marquee({ items, speed = 38 }: { items: string[]; speed?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee overflow-hidden py-5 hairline-t hairline-b">
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        {doubled.map((item, i) => (
          <span key={i} className="t-mono flex items-center whitespace-nowrap px-7 opacity-70">
            {item}
            <span className="blue ml-7">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
