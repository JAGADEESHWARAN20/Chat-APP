const fs = require('fs');

const filesToFix = [
  './app/api/rooms/[roomId]/route.ts',
  './app/api/users/search/route.ts', 
  './app/profile/[id]/page.tsx'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    console.log(`Fixing: ${file}`);
    
    if (file.includes('route.ts') && content.includes('createRouteHandlerClient')) {
      // API Route files
      content = `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

${content.replace(/import.*@supabase\/auth-helpers-nextjs.*\n?/g, '')}`;
      
      content = content.replace(
        /const supabase = createRouteHandlerClient\(\{ cookies \}\);?/,
        `const cookieStore = cookies();
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore if called from Server Component
        }
      },
    },
  }
);`
      );
    }
    
    if (file.includes('page.tsx') && content.includes('createClientComponentClient')) {
      // Client component files
      content = `import { createBrowserClient } from "@supabase/ssr";

${content.replace(/import.*@supabase\/auth-helpers-nextjs.*\n?/g, '')}`;
      
      content = content.replace(
        /const supabase = createClientComponentClient\(\);?/,
        `const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`
      );
    }
    
    fs.writeFileSync(file, content);
    console.log(`‚úÖ Fixed: ${file}`);
  } else {
    console.log(`‚ùå File not found: ${file}`);
  }
});

console.log('\nÌæâ All remaining files fixed!');
