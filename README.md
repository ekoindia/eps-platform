# Eko Platform Services Website Project


## How to Add/Remove a Product?
1. To add a product, create a new file in `src/pages/products/` with the product's slug as the filename (e.g. `my-new-product.tsx`).
2. Use the existing product pages as a reference for the structure and content of the new product page.
3. To remove a product, simply delete the corresponding file from `src/pages/products/`.
4. Update the `products` array in `src/components/Header.tsx` and `src/components/Footer.tsx` to reflect the addition or removal of the product.
5. Also update `src/components/sections/ProductsSection.tsx` to add/remove the product from the product tabs.


## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Deploy via Lovable

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

### Deploy to Any Platform

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

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
