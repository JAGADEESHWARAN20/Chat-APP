"use client";

import { useState, ReactNode, CSSProperties, MouseEvent } from "react";
// Removed import Link from "next/link";
import { LogOut, Menu, User, Settings, ChevronsUpDown, Home, Sun, Moon, LucideIcon } from "lucide-react";

// --- MOCK LINK COMPONENT ---
// Replacing the next/link import with a mock component that simply renders an anchor tag.
interface MockLinkProps {
    href: string;
    onClick?: () => void;
    children: ReactNode;
    // Allow other standard anchor properties
    [key: string]: any; 
}

const Link = ({ href, onClick, children, ...props }: MockLinkProps) => {
    // In a real environment, Link handles routing. Here, we mimic a clickable container.
    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        // Prevent default navigation for demonstration clarity in this environment
        e.preventDefault(); 
        if (onClick) {
            onClick();
        }
        console.log(`Mock Navigation: Navigating to ${href}`);
    };
    
    return (
        // Render as a standard anchor tag for accessibility and basic link behavior
        <a href={href} onClick={handleClick} {...props}>
            {children}
        </a>
    );
};


// --- MOCK API FUNCTIONS & TYPES ---

// Define the core types needed for the component
interface SupabaseUser {
  id: string;
  email: string;
  user_metadata: {
    username?: string;
    [key: string]: any;
  } | null;
}

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

// Mocking Supabase and Router functions to prevent import errors
const mockSupabase = {
  auth: {
    signOut: () => new Promise<void>(resolve => setTimeout(resolve, 50)),
  },
};
const mockRouter = {
  refresh: () => console.log("Router refresh called (mock)"),
  push: (path: string) => console.log(`Router push to ${path} (mock)`),
};
const createClientComponentClient = () => mockSupabase;
const useRouter = () => mockRouter;


// --- PLACEHOLDER COMPONENT TYPES ---

interface PlaceholderButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm';
  title?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  // Allows for other standard button props like disabled, type, etc.
  [key: string]: any; 
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface SheetTriggerProps {
  asChild?: boolean;
  children: ReactNode;
}

interface SheetContentProps {
  children: ReactNode;
  className?: string;
  side?: 'left' | 'right' | 'top' | 'bottom';
  style?: CSSProperties;
}

interface SheetBlockProps {
  children: ReactNode;
  className?: string;
}

interface PopoverProps {
  children: ReactNode;
}

interface PopoverContentProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}


// --- PLACEHOLDER COMPONENTS ---
// We define simplified, functional versions that maintain the layout structure.

const PlaceholderButton = ({ children, className = '', variant = 'default', size = 'default', ...props }: PlaceholderButtonProps) => {
  let baseClasses = "inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none";
  
  if (variant === 'ghost') {
    baseClasses += " bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800";
  } else if (variant === 'outline') {
    baseClasses += " border border-input bg-background hover:bg-zinc-100 dark:hover:bg-zinc-800";
  } else { // default
    baseClasses += " bg-blue-600 text-white hover:bg-blue-700";
  }

  if (size === 'sm') {
    baseClasses += " h-[2em] px-[0.8em] text-[0.9em]";
  } else { // default or custom
    baseClasses += " h-[2.5em] px-[1em] text-[1em]";
  }

  return (
    <button className={`${baseClasses} rounded-[0.5em] ${className}`} {...props}>
      {children}
    </button>
  );
};

// Simplified Sheet (assumes Sheet functionality works behind the scenes for the trigger/portal)
const Sheet = ({ children }: SheetProps) => children;
const SheetTrigger = ({ asChild, children }: SheetTriggerProps) => asChild ? children : <PlaceholderButton>{children}</PlaceholderButton>;

const SheetContent = ({ children, className, style }: SheetContentProps) => (
  // Mocking the sheet visually
  <div 
    className={`fixed inset-y-0 right-0 z-[50] shadow-2xl overflow-y-auto ${className}`} 
    style={{ ...style, transform: 'translateX(0%)', transition: 'transform 0.3s ease-out' }}
  >
    {children}
  </div>
);
const SheetHeader = ({ children, className = '' }: SheetBlockProps) => <header className={className}>{children}</header>;
const SheetTitle = ({ children, className = '' }: SheetBlockProps) => <h2 className={className}>{children}</h2>;

// Simplified Popover (assumes Popover functionality works behind the scenes)
const Popover = ({ children }: PopoverProps) => children;
const PopoverTrigger = ({ asChild, children }: SheetTriggerProps) => asChild ? children : <PlaceholderButton>{children}</PlaceholderButton>;
const PopoverContent = ({ children, className = '', sideOffset = 4 }: PopoverContentProps) => (
  // Mocking the popover content visually
  <div className={`absolute z-40 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-xl mt-[${sideOffset}px] ${className}`}>
    {children}
  </div>
);

// Simplified Theme Toggle
const ThemeToggleButton = () => {
  const [isDark, setIsDark] = useState(false);
  // Type assertion for the icon component
  const Icon: LucideIcon = isDark ? Sun : Moon; 

  return (
    <PlaceholderButton 
      variant="ghost" 
      onClick={() => setIsDark(!isDark)}
      title="Toggle Theme"
      className="p-[0.5em] w-[2.5em] h-[2.5em] text-[1.1em] flex items-center justify-center transition-transform hover:scale-110"
    >
      <Icon className="h-full w-full" />
    </PlaceholderButton>
  );
};


// --- UTILITY FUNCTION ---
const getDisplayName = (user: SupabaseUser | undefined | null): string => 
  user?.user_metadata?.username || user?.email || "User";


// --- CONSTANTS FOR DYNAMIC SIZING (em/vw based) ---
const EM_BASE_ICON = "h-[1.2em] w-[1.2em]";
const EM_SPACING = "p-[1em]"; // Standardized padding for blocks
const EM_ROUNDED = "rounded-[0.5em]";
const EM_MENU_BTN_SIZE = "w-[2.5em] h-[2.5em]";
const EM_LINK_ICON = "h-[1em] w-[1em] mr-[0.6em]";


export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    // Close the sheet first for better UX
    setIsSheetOpen(false);
    // Perform Supabase logout
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const displayEmail = user?.email || "No Email";
  
  // Custom class for styling the mock Sheet and Popover content elements
  const mockSheetPopoverBackground = 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white';


  // --- LOGGED IN STATE (Advanced Sheet UI) ---
  if (user) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <PlaceholderButton
            title="Menu"
            // Use em for dynamic size, and apply polished hover/focus states
            className={`flex items-center justify-center ${EM_MENU_BTN_SIZE} ${EM_ROUNDED} transition-all duration-200 bg-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <Menu className={`${EM_BASE_ICON}`} />
          </PlaceholderButton>
        </SheetTrigger>
        
        {/*
          Sheet Content: Responsive width using vw on mobile, capped by a large em value on desktop.
        */}
        <SheetContent 
          side="right" 
          className={`
            ${mockSheetPopoverBackground} border-l-[0.2em] shadow-2xl 
            w-[85vw] max-w-[20em] md:max-w-[22em] lg:max-w-[24em] 
            p-0 flex flex-col justify-between 
          `}
          // Enforcing em/vw cap through inline style for maximum compatibility 
          style={{ width: '85vw', maxWidth: '24em' }}
        >
          {/* TOP SECTION: Header and Main Content */}
          <div className="flex flex-col flex-grow overflow-y-auto">

            {/* HEADER: Title and Theme Toggle */}
            <SheetHeader className={`flex-row items-center justify-between ${EM_SPACING} border-b border-zinc-200 dark:border-zinc-700 sticky top-0 ${mockSheetPopoverBackground} z-10`}>
              <SheetTitle className="flex items-center gap-[0.5em] text-[1.4em] font-extrabold text-blue-600 dark:text-blue-400">
                <Menu className={`${EM_BASE_ICON}`} /> Navigation
              </SheetTitle>
              <div className="flex-shrink-0">
                <ThemeToggleButton />
              </div>
            </SheetHeader>

            {/* USER IDENTITY CARD / POPOVER */}
            <Popover>
              <PopoverTrigger asChild>
                {/* Identity Button: Highly visual, full-width element for the user's identity. */}
                <PlaceholderButton
                  variant="outline"
                  className={`
                    w-[95%] mx-auto mt-[1.2em] mb-[1em] flex items-center justify-between 
                    h-auto py-[1em] text-[1em] font-semibold 
                    bg-zinc-50/50 dark:bg-zinc-800/50 border-blue-300 dark:border-blue-700
                    transition-shadow hover:shadow-lg focus:shadow-lg ${EM_ROUNDED}
                  `}
                >
                  <div className="flex flex-col items-start truncate overflow-hidden">
                    <span className="truncate text-base leading-snug">{getDisplayName(user)}</span>
                    <span className="truncate text-xs opacity-70 font-normal mt-0.5">{displayEmail}</span>
                  </div>
                  <ChevronsUpDown className="h-[1em] w-[1em] ml-[0.5em] flex-shrink-0" />
                </PlaceholderButton>
              </PopoverTrigger>
              
              {/* Profile Popover Content */}
              <PopoverContent 
                className={`
                  w-[18em] p-[0.7em] flex flex-col gap-[0.4em] z-50 
                  ${mockSheetPopoverBackground} shadow-xl border-t-2 border-blue-500
                `} 
                align="start" 
                sideOffset={10}
              >
                <Link href={`/dashboard`} onClick={() => setIsSheetOpen(false)}>
                  <PlaceholderButton variant="ghost" className={`w-full justify-start ${EM_ROUNDED}`}>
                    <Home className={EM_LINK_ICON} /> Dashboard
                  </PlaceholderButton>
                </Link>
                <Link href={`/profile/${user.id}`} onClick={() => setIsSheetOpen(false)}>
                  <PlaceholderButton variant="ghost" className={`w-full justify-start ${EM_ROUNDED}`}>
                    <User className={EM_LINK_ICON} /> View Profile
                  </PlaceholderButton>
                </Link>
                <Link href={`/profile/${user.id}/edit`} onClick={() => setIsSheetOpen(false)}>
                  <PlaceholderButton variant="ghost" className={`w-full justify-start ${EM_ROUNDED}`}>
                    <Settings className={EM_LINK_ICON} /> Edit Settings
                  </PlaceholderButton>
                </Link>
              </PopoverContent>
            </Popover>

            {/* Additional Menu Links go here */}
            <div className="flex flex-col gap-[0.4em] px-[1em] mt-[1em] flex-grow">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-[0.2em] ml-[0.5em] border-b border-zinc-200 dark:border-zinc-700 pb-1">Quick Actions</p>
              
              <Link href="/tasks" onClick={() => setIsSheetOpen(false)}>
                <PlaceholderButton variant="ghost" className={`w-full justify-start ${EM_ROUNDED}`}>
                  <Menu className={EM_LINK_ICON} /> My Tasks
                </PlaceholderButton>
              </Link>
              
              {/* Example of another link */}
              <Link href="/reports" onClick={() => setIsSheetOpen(false)}>
                <PlaceholderButton variant="ghost" className={`w-full justify-start ${EM_ROUNDED}`}>
                  <Settings className={EM_LINK_ICON} /> Reports
                </PlaceholderButton>
              </Link>

            </div>

          </div>

          {/* BOTTOM SECTION: LOGOUT (Fixed Position Footer) */}
          <div className={`${EM_SPACING} border-t border-zinc-200 dark:border-zinc-700`}>
            <PlaceholderButton
              onClick={handleLogout}
              variant="ghost"
              className={`
                w-full justify-center text-red-500 hover:text-red-700 dark:hover:text-red-300 
                hover:bg-red-50/50 dark:hover:bg-red-900/30 font-bold 
                transition-all duration-200 h-[3em] text-[1em] ${EM_ROUNDED}
              `}
            >
              <LogOut className="h-[1.1em] w-[1.1em] mr-[0.5em]" /> Sign Out Securely
            </PlaceholderButton>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // --- LOGGED OUT STATE (Clean, Primary Action Buttons) ---
  return (
    <div className="flex items-center gap-[0.8em] text-[1em]">
      <Link href="/auth/login">
        <PlaceholderButton
          variant="ghost"
          // Custom class for dynamic text size and button height
          className={`
            h-[2.5em] px-[1em] text-[0.9em] font-semibold 
            text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 
            hover:bg-blue-100/30 dark:hover:bg-blue-900/30 ${EM_ROUNDED}
          `}
        >
          Sign In
        </PlaceholderButton>
      </Link>
      <Link href="/auth/register">
        <PlaceholderButton
          // Use primary variant for the CTA (default button)
          className={`
            h-[2.5em] px-[1em] text-[0.9em] font-semibold 
            bg-blue-600 text-white hover:bg-blue-700 
            transition-all duration-200 ${EM_ROUNDED}
          `}
        >
          Sign Up
        </PlaceholderButton>
      </Link>
    </div>
  );
}
