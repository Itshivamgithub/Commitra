import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/auth';
import { SocketProvider } from '@/providers/SocketProvider';
import { ThemeProvider } from '@/context/ThemeContext';
import dynamic from 'next/dynamic';

const Toaster = dynamic(() => import('react-hot-toast').then((mod) => mod.Toaster), {
  ssr: false,
});

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Commitra — GitHub Contributor Analytics & Insights',
  description: 'Analyze your GitHub repositories, track commit trends, and gather analytics for contributors.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased transition-colors duration-300`}>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              {children}
              <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
