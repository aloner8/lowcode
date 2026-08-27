'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export interface HeroSlide {
  image?: string | null;
  title?: string;
  text?: string;
  href?: string;
  /** Describes the picture for people who cannot see it. */
  alt?: string;
}

export interface HeroCarouselComponentProps {
  slides?: HeroSlide[];
  /** Seconds between slides; 0 turns auto-advance off. */
  interval?: number;
  className?: string;
}

/**
 * The picture banner at the top of an agency home page.
 *
 * Auto-advance stops on hover, on keyboard focus and when the visitor asks for
 * reduced motion, and there is a visible pause control — a banner that keeps
 * moving is a genuine accessibility barrier, not a preference.
 */
export const HeroCarouselComponent: React.FC<HeroCarouselComponentProps> = ({
  slides = [],
  interval = 6,
  className = '',
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || interval <= 0) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), interval * 1000);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion, interval]);

  if (count === 0) return null;
  const slide = slides[index];

  const body = (
    <>
      {slide.image && (
        // Agency photographs are uploaded files at arbitrary URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.image} alt={slide.alt ?? slide.title ?? ''} className="gov-hero-image" />
      )}
      {(slide.title || slide.text) && (
        <div className="gov-hero-caption">
          {slide.title && <p className="gov-hero-title">{slide.title}</p>}
          {slide.text && <p className="gov-hero-text">{slide.text}</p>}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`gov-hero ${className}`}
      ref={regionRef}
      role="region"
      aria-roledescription="แถบภาพเลื่อน"
      aria-label="ภาพประชาสัมพันธ์"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="gov-hero-frame" aria-live="polite">
        {slide.href ? (
          <a href={slide.href} className={`gov-hero-slide ${slide.image ? '' : 'is-textonly'}`}>{body}</a>
        ) : (
          <div className={`gov-hero-slide ${slide.image ? '' : 'is-textonly'}`}>{body}</div>
        )}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="gov-hero-arrow is-prev" onClick={() => go(index - 1)} aria-label="ภาพก่อนหน้า">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="gov-hero-arrow is-next" onClick={() => go(index + 1)} aria-label="ภาพถัดไป">
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          <div className="gov-hero-controls">
            <button
              type="button"
              className="gov-hero-play"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              aria-label={paused ? 'เล่นภาพเลื่อนอัตโนมัติ' : 'หยุดภาพเลื่อนอัตโนมัติ'}
            >
              {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            </button>
            {/*
              * Plain buttons, not tabs: these switch a picture, they do not
              * reveal a panel, and announcing them as tabs put them in the same
              * keyboard group as the real tab strips further down the page.
              */}
            <div className="gov-hero-dots" role="group" aria-label="เลือกภาพ">
              {slides.map((item, dot) => (
                <button
                  key={`${item.title ?? 'slide'}-${dot}`}
                  type="button"
                  aria-current={dot === index ? 'true' : undefined}
                  aria-label={`ภาพที่ ${dot + 1} จาก ${count}`}
                  className={`gov-hero-dot ${dot === index ? 'is-active' : ''}`}
                  onClick={() => go(dot)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
