const fs = require('fs');
const path = require('path');

// Files that need fixing based on the deployment error
const filesToFix = [
  './components/LoginLogoutButton.tsx',
  './hooks/useTypingStatus.ts',
  './app/api/messages/read-all/route.ts',
  './app/api/messages/route.ts',
  './app/api/notifications/[notificationId]/accept/route.ts',
  './app/api/notifications/route.ts',
  './app/api/notifications/[notificationId]/read/route.ts',
  './app/api/notifications/[notificationId]/reject/route.ts',
  './app/api/notifications/[notificationId].ts',
  './app/api/rooms/all/route.ts',
  './app/api/rooms/route.ts',
  './app/api/rooms/search/route.ts',
  './app/api/rooms/switch/route.ts',
  './app/api/rooms/[roomId]/route.ts',
  './app/api/users/search/route.ts'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    console.log(`Checking: ${file}`);
    
    // Fix duplicate cookies imports
    if (content.includes('import { cookies } from "next/headers"')) {
      const importCount = (content.match(/import { cookies } from "next\/headers"/g) || []).length;
      if (importCount > 1) {
        content = content.replace(/import { cookies } from "next\/headers";\n/g, '');
        content = 'import { cookies } from "next/headers";\n' + content;
        console.log(`  ✅ Fixed duplicate cookies import`);
      }
    }
    
    // Fix old auth helpers imports
    if (content.includes('@supabase/auth-helpers-nextjs')) {
      if (content.includes('createRouteHandlerClient')) {
        content = content.replace(
          'import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";',
          'import { createServerClient } from "@supabase/ssr";'
        );
        console.log(`  ✅ Fixed createRouteHandlerClient import`);
      }
      
      if (content.includes('createClientComponentClient')) {
        content = content.replace(
          'import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";',
          'import { createBrowserClient } from "@supabase/ssr";'
        );
        console.log(`  ✅ Fixed createClientComponentClient import`);
      }
      
      // Replace the client creation
      if (content.includes('createRouteHandlerClient({ cookies })')) {
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
        console.log(`  ✅ Fixed createRouteHandlerClient usage`);
      }
      
      if (content.includes('createClientComponentClient()')) {
        content = content.replace(
          /const supabase = createClientComponentClient\(\);?/,
          `const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`
        );
        console.log(`  ✅ Fixed createClientComponentClient usage`);
      }
    }
    
    fs.writeFileSync(file, content);
  } else {
    console.log(`❌ File not found: ${file}`);
  }
});

console.log('\n��� All files fixed!');
