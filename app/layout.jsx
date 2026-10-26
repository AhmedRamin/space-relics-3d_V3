import '../src/styles/theme.css';
import '../src/styles/app.css';

export const metadata = {
  title: 'Space Relics 3D — Solar System Explorer',
  description:
    'Fly through the Solar System and find every rover, lander, orbiter, satellite, telescope, probe and space station that was sent there.',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#04060f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <noscript>This explorer renders the Solar System in 3D and needs JavaScript enabled.</noscript>
      </body>
    </html>
  );
}
