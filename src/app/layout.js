export const metadata = {
  title: '휴곰 — 군인과 곰신의 휴가 관리',
  description: '군인과 기다리는 사람(곰신)의 휴가 일정을 함께 관리하는 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#3D5A1E" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
