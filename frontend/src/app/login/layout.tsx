import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'sign in — domino',
  description: 'Sign in to domino on the web.',
};

export default function DominoLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
