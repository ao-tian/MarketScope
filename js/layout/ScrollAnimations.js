export function initScrollAnimations() {
  const titleArea = document.querySelector('.cinematic-hero');
  const titleText = document.querySelector('.hero-content');
  const sections = document.querySelectorAll('.story-section');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (titleArea) titleArea.style.transform = `translateY(${scrollY * 0.4}px)`;
    if (titleText) titleText.style.opacity = Math.max(0, 1 - scrollY / 600);
  });

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('animate-in');
      });
    },
    { threshold: 0.15, rootMargin: '-50px 0px' }
  );
  sections.forEach((s) => sectionObserver.observe(s));
}
