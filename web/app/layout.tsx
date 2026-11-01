import { DARK_CSS } from "@/lib/darkTheme";

export const metadata = { title: "FantaSoccorritore" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#111111" };

// La scelta chiaro/scuro resta salvata su questo dispositivo e si applica prima di disegnare la pagina
const THEME_BOOT = `try{if(localStorage.getItem('fs-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: DARK_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
