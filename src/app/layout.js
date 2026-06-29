export const metadata = {
  title: '휴곰 - 군인과 곰신의 휴가 관리 앱',
  description: '입대일 하나로 연가·포상휴가·외박·면회 일정을 자동 관리. 계급·호봉 자동 계산, 카카오 로그인, 파트너와 달력 공유까지.',
  keywords: '군인 휴가관리, 곰신 앱, 전역 디데이, 연가 관리, 포상휴가, 외박, 군인 앱',
  openGraph: {
    title: '휴곰 - 군인과 곰신의 휴가 관리',
    description: '입대일만 입력하면 모든 휴가 관리가 자동으로',
    url: 'https://hugom.vercel.app',
    siteName: '휴곰',
    locale: 'ko_KR',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '휴곰',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2D4A1E',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 파비콘 및 앱 아이콘 */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* 외부 서비스 preconnect (성능 최적화) */}
        <link rel="preconnect" href="https://kauth.kakao.com" />
        <link rel="preconnect" href="https://kapi.kakao.com" />
        <link rel="preconnect" href="https://ljnojlrrjcrlsooowcxf.supabase.co" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
