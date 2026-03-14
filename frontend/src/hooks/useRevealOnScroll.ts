import { useEffect } from 'react';

interface RevealOnScrollOptions {
  selector?: string;
  className?: string;
  threshold?: number;
}

export const useRevealOnScroll = (
  trigger?: unknown,
  options: RevealOnScrollOptions = {},
) => {
  const {
    selector = '.reveal-on-scroll',
    className = 'is-visible',
    threshold = 0.12,
  } = options;

  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(className);
          }
        });
      },
      { threshold },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [selector, className, threshold, trigger]);
};
