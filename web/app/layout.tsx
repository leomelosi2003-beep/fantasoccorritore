export const metadata = { title: "FantaSoccorritore" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#111111" };

// Modalità scura: tutta la pagina viene "invertita", poi immagini, disegni e mappa vengono rimessi com'erano
// (la mappa si scurisce insieme alla pagina). La scelta resta salvata su questo dispositivo.
const THEME_CSS = `
html.dark { background: #0b0b0b; }
html.dark body { background: #0b0b0b; }
html.dark body > div, html.dark body > main { filter: invert(1) hue-rotate(180deg); }
html.dark img, html.dark svg, html.dark video, html.dark canvas { filter: invert(1) hue-rotate(180deg); }
/* la mappa resta invertita insieme alla pagina: diventa una mappa scura senza servizi esterni */
html.dark .leaflet-tile-pane img { filter: brightness(1.05) contrast(.9); }
html.dark svg img, html.dark svg svg { filter: none; }
html.dark .fs-keep { filter: invert(1) hue-rotate(180deg); }
`;
const THEME_BOOT = `try{if(localStorage.getItem('fs-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
