import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { StorefrontSlide } from "../hooks";

export function HeroSlider({ slides }: { slides: StorefrontSlide[] }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setActiveSlide((current) =>
      Math.min(current, Math.max(0, slides.length - 1)),
    );
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      className="hero-slider"
      aria-label="بنرهای فروشگاه"
      aria-roledescription="carousel"
    >
      {slides.map((slide, i) => {
        const picture = (
          <picture>
            {slide.mobileImageUrl && (
              <source
                media="(max-width: 768px)"
                srcSet={slide.mobileImageUrl}
              />
            )}
            <img
              className="hero-slide-image"
              src={slide.imageUrl}
              alt={slide.title || `بنر ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
            />
          </picture>
        );
        const linkedPicture = slide.linkUrl ? (
          /^https?:\/\//i.test(slide.linkUrl) ? (
            <a
              href={slide.linkUrl}
              target="_blank"
              rel="noreferrer"
              tabIndex={i === activeSlide ? 0 : -1}
              aria-label={slide.title || "مشاهده بنر"}
            >
              {picture}
            </a>
          ) : (
            <Link
              to={slide.linkUrl}
              tabIndex={i === activeSlide ? 0 : -1}
              aria-label={slide.title || "مشاهده بنر"}
            >
              {picture}
            </Link>
          )
        ) : (
          picture
        );
        return (
          <div
            key={slide.id}
            className={`hero-slide${i === activeSlide ? " active" : ""}${slide.mobileImageUrl ? " has-mobile-art" : ""}`}
            aria-hidden={i !== activeSlide}
          >
            {linkedPicture}
          </div>
        );
      })}
      {slides.length > 1 && (
        <div className="slider-nav">
          <button
            type="button"
            className="slider-arrow"
            aria-label="بنر قبلی"
            onClick={() =>
              setActiveSlide((activeSlide - 1 + slides.length) % slides.length)
            }
          >
            ‹
          </button>
          <button
            type="button"
            className="slider-arrow"
            aria-label="بنر بعدی"
            onClick={() => setActiveSlide((activeSlide + 1) % slides.length)}
          >
            ›
          </button>
        </div>
      )}
      {slides.length > 1 && (
        <div className="slider-dots">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              className={`slider-dot${i === activeSlide ? " active" : ""}`}
              onClick={() => setActiveSlide(i)}
              aria-label={`نمایش بنر ${i + 1}`}
              aria-current={i === activeSlide ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
