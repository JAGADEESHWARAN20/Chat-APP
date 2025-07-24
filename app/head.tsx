export default function Head() {
  return (
    <>
      <title>Daily Chat | Real-time Supabase Chat App</title>
      <meta name="description" content="A real-time chat app powered by Supabase. Join rooms, chat instantly, and connect seamlessly!" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />
      <meta name="theme-color" content="#18181b" />

      {/* Open Graph for Social Sharing */}
      <meta property="og:title" content="Daily Chat | Real-time Supabase Chat App" />
      <meta property="og:description" content="Join rooms, chat in real-time with Supabase and Next.js. No refresh needed!" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://your-app-url.com/" />
      <meta property="og:image" content="/next.svg" />

      {/* Twitter Meta */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Daily Chat | Real-time Supabase Chat App" />
      <meta name="twitter:description" content="Chat in real-time using Supabase rooms. Fast, modern UI with no reloads!" />
      <meta name="twitter:image" content="/next.svg" />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
    </>
  );
}
