/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
	  remotePatterns: [
		{
		  hostname: "avatars.githubusercontent.com",
		  protocol: "https",
		},
		{
		  protocol: "https",
		  hostname: "res.cloudinary.com",
		},
		{
		  protocol: "https",
		  hostname: "lh3.googleusercontent.com",  // ✅ Added: Fixes Google avatar 400s
		  pathname: "/a/**",  // Specific to avatar paths (more secure)
		},
		{
		  protocol: "https",
		  hostname: "flychatapp.vercel.app",
		},
	  ],
	  dangerouslyAllowSVG: true,
	  contentDispositionType: "attachment",
	  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; sandbox;",  // ✅ Fixed: Allows scripts; kept sandbox (test uploads)
	},
  };
  
module.exports = nextConfig;