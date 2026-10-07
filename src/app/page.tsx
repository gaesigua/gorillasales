import { getSession } from '@/lib/auth';
import HomePageClient from './HomePageClient';

export default async function PublicHomePage() {
  const session = await getSession();
  return <HomePageClient isLoggedIn={!!session} />;
}
