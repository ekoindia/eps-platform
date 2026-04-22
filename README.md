# EPS (Eko Platform Services) Website Project


## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS


## How to Add/Remove a Product?
1. To add a product, create a new file in `src/pages/products/` with the product's slug as the filename (e.g. `my-new-product.tsx`).
2. Use the existing product pages as a reference for the structure and content of the new product page.
3. To remove a product, simply delete the corresponding file from `src/pages/products/`.
4. Update the `products` array in `src/components/Header.tsx` and `src/components/Footer.tsx` to reflect the addition or removal of the product.
5. Also update `src/components/sections/ProductsSection.tsx` to add/remove the product from the product tabs.


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
