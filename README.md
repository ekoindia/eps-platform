# EPS (Eko Platform Services) Website Project


## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS


## Main Project Structure
- `src/` - Main source code for the React application
  - `App.tsx` - Client-side App with `React.lazy` route imports for code splitting
  - `AppServer.tsx` - Server-side App with eager imports for SSG pre-rendering
  - `entry-server.tsx` - SSR entry point used by the SSG build pipeline
  - `main.tsx` - Client entry point with hydration / SPA-fallback detection
  - `components/` - Reusable React components
  - `hooks/` - Custom React hooks
  - `pages/` - React components for each page/route
  - `lib/` - Utility functions, data sources, and Markdown generation logic
	- **`config/`** - Site-wide configuration constants (e.g. site URL, API endpoints)
	- **`data/`** - Static data for products, industries, solutions, etc.
	- `markdown/` - Logic for generating Markdown content from data
  - `assets/` - Static assets like images and icons, to be imported in React components
- `public/` - Publicly accessible static files (e.g. robots.txt, _redirects)
- `ssg/` - Custom Vite plugin for static page generation and pre-rendering


## Product Data Files (in `src/lib/data/`):
- [`api-product-pages.ts`](src/lib/data/api-product-pages.ts) - Detailed data for product pages (e.g. AEPS API, Lending API)
- [`api-products.ts`](src/lib/data/api-products.ts) - List of API products with metadata
- [`industries.ts`](src/lib/data/industries.ts) - List of industries and their associated data
- [`solutions.ts`](src/lib/data/solutions.ts) - List of solutions and their associated data


## How to Add/Remove an API Product?
1. Add data in `src/lib/data/api-products.ts` and `src/lib/data/api-product-pages.ts` for the new product, following the existing structures.
2. Also update `src/components/sections/ProductsSection.tsx` to add/remove the product from the product tabs widget.


## How can I deploy this project?

This project is a React SPA (Single Page Application) using client-side routing. It's configured to work seamlessly with multiple deployment platforms. Each platform has its own URL rewrite configuration to ensure proper routing.

#### Supported Platforms

**Vercel**
- Uses `vercel.json` for URL rewrites
- Deploy via Vercel CLI or GitHub integration
- Recommended: Connect your GitHub repo for automatic deployments

**Netlify**
- Uses `netlify.toml` or `public/_redirects` for URL rewrites
- Deploy via Netlify CLI or GitHub integration
- Simple drag-and-drop deployment available

**Apache (Shared Hosting/cPanel)**
- Uses `.htaccess` for URL rewrites
- Build locally: `npm run build`
- Upload the `dist/` folder to your Apache server

**Nginx (VPS/Docker/Kubernetes)**
- Uses `nginx.conf` for URL rewrites
- Build locally: `npm run build`
- Copy `dist/` contents to your Nginx web root
- Update your nginx configuration with the provided `nginx.conf`

#### Why Multiple Configuration Files?

This project includes platform-specific redirect configurations because each deployment platform has its own configuration format. When users directly visit URLs like `/products/aeps-api` or refresh the page, the server needs to serve `index.html` for all routes, allowing React Router to handle navigation client-side.

- **vercel.json** → Vercel deployments
- **netlify.toml** / **_redirects** → Netlify deployments
- **.htaccess** → Apache servers
- **nginx.conf** → Nginx servers

These files don't conflict - each platform only reads its own configuration and ignores the others. This makes the project deployment-agnostic and portable across platforms.


## Detailed documentations:
- [Static Page Generation (SSG) and SPA Fallback](docs/static-page-generation.md)
- [AI-Agent-Friendly Content Delivery and Markdown Generation](docs/markdown-generation.md)
