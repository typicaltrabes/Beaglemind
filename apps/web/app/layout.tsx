import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Beagle Agent Console',
  description: 'Observable reasoning system and governed workbench for multi-agent fleet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
