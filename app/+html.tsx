import { type PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

export default function Document({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <meta
          name="theme-color"
          content="#111827"
        />

        <meta
          name="description"
          content="M13 Club Member Web App"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="M13 Club"
        />

        <link
          rel="manifest"
          href="/manifest.json"
        />

        {/* Browser favicon */}
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon.png"
        />

        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon.png"
        />

        {/* Apple / iOS home-screen icon */}
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/icon-192.png"
        />
      </head>

      <body>
        <ScrollViewStyleReset />
        <div id="root">{children}</div>
        <style>{`
          @media print {
            body { background: #fff !important; }
            /* Hide everything except the flyer */
            #root > div > *:not([data-print="flyer-wrap"]) {
              display: none !important;
            }
            [data-print="flyer-wrap"] {
              max-width: 100% !important;
              width: 100% !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              overflow: visible !important;
            }
            [data-print="flyer"] {
              min-height: auto !important;
              padding: 32px !important;
              border-radius: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 0;
            }
          }
        `}</style>
      </body>
    </html>
  );
}