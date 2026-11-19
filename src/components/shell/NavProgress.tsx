'use client';
/** App-wide "Loading, please wait…" overlay for page navigation and slow actions (shown only if it takes > ~250 ms). */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BusyOverlay } from '@/components/ui';

export { signalBusy, signalNavigate } from '@/lib/busy';

export function NavProgress() {
  const path = usePathname();
  const [nav, setNav] = useState(false);
  const [work, setWork] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => { setNav(false); }, [path]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download') || /^(https?:|mailto:|tel:)/.test(href) || href.startsWith('/api/')) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return;
      setNav(true);
    };
    const onNav = () => setNav(true);
    const onBusy = (e: Event) => setWork((e as CustomEvent<number>).detail);
    document.addEventListener('click', onClick, true);
    window.addEventListener('hf:navigate', onNav);
    window.addEventListener('hf:busy', onBusy);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('hf:navigate', onNav); window.removeEventListener('hf:busy', onBusy); };
  }, []);
  const active = nav || work > 0;
  useEffect(() => {
    if (!active) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), nav ? 250 : 500);
    const giveUp = setTimeout(() => { setNav(false); setShow(false); }, 20000);
    return () => { clearTimeout(t); clearTimeout(giveUp); };
  }, [active, nav]);
  return <BusyOverlay show={show} title={nav ? 'Loading, please wait…' : 'Please wait…'} />;
}
