import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "./components/SplashScreen";
import AutoTheme from "./components/AutoTheme";
import PageTransition from "./components/PageTransition";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#060b14",
};

export const metadata: Metadata = {
  title: "AlgaeTree AI",
  description: "AlgaeTree Bio-Reactor Monitoring & Conversational AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AlgaeTree",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var nowIST=new Date(Date.now()+(330+new Date().getTimezoneOffset())*60000);var h=nowIST.getHours();var auto=(h>=18||h<5)?'dark':'light';var stored=localStorage.getItem('theme');var lastAuto=localStorage.getItem('themeAuto');var t=auto;if(stored&&lastAuto===auto){t=stored;}localStorage.setItem('themeAuto',auto);document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <AutoTheme />
        <SplashScreen />
        <PageTransition>{children}</PageTransition>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js")})}`,
          }}
        />
      </body>
    </html>
  );
}
