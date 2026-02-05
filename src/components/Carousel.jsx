import React, { useEffect, useMemo, useState } from "react";

export default function Carousel({ slides = [], autoPlayMs = 0 }) {
  const safeSlides = useMemo(() => slides ?? [], [slides]);
  const [idx, setIdx] = useState(0);

  const goPrev = () => setIdx((v) => (v - 1 + safeSlides.length) % safeSlides.length);
  const goNext = () => setIdx((v) => (v + 1) % safeSlides.length);

  useEffect(() => {
    if (!autoPlayMs || safeSlides.length <= 1) return;
    const t = setInterval(goNext, autoPlayMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayMs, safeSlides.length]);

  const current = safeSlides[idx];

  return (
    <section className="hero">
      <div className="heroCard">
        <div className="heroGlow" aria-hidden />

        <div className="heroTop">
          <div className="heroKicker">Peer learning platform</div>
          <h1 className="heroTitle">Study smarter with peers + AI support</h1>
          <p className="heroDesc">
            Book peer tutoring, join study groups, and get instant explanations with an AI chatbot.
          </p>

          <div className="heroPills">
            <span className="pill">Peer tutoring</span>
            <span className="pill">Study groups</span>
            <span className="pill">AI help</span>
            <span className="pill">Support</span>
          </div>
        </div>

        <div className="heroSlider">
          <button className="arrowBtn left" onClick={goPrev} aria-label="Previous slide">
            ‹
          </button>

          <div className="heroSlide">
            <div className="heroSlideText">
              <div className="heroSlideTitle">{current?.title ?? "Carousel title"}</div>
              <div className="heroSlideDesc">
                {current?.description ??
                  "Carousel about website features with images. Replace with real screenshots later."}
              </div>
            </div>

            <div className="heroMock">
              <div className="heroMockInner">{current?.imageText ?? "Screenshot / Illustration"}</div>
            </div>
          </div>

          <button className="arrowBtn right" onClick={goNext} aria-label="Next slide">
            ›
          </button>

          <div className="dotsRow" aria-label="Carousel pagination">
            {safeSlides.map((_, i) => (
              <button
                key={i}
                className={`dot2 ${i === idx ? "active" : ""}`}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
