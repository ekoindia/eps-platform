/**
 * Generates a standard XML sitemap from the route manifest.
 * Called by the prerender orchestrator after all pages are written.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { SITE_URL } from "@/lib/config/site";

const LOW_PRIORITY_ROUTES = new Set([
	"/tnc",
	"/privacy-policy",
	"/refund-policy",
	"/grievance",
	"/signup",
	"/about-us",
	"/blogs-media",
]);

const MONTHLY_CHANGEFREQ_ROUTES = new Set([
	"/tnc",
	"/privacy-policy",
	"/refund-policy",
	"/grievance",
	"/signup",
]);

function priority(route: string): string {
	if (route === "/") return "1.0";
	if (LOW_PRIORITY_ROUTES.has(route)) return "0.5";
	if (route.startsWith("/industries/")) return "0.6";
	return "0.8";
}

function changefreq(route: string): string {
	if (MONTHLY_CHANGEFREQ_ROUTES.has(route)) return "monthly";
	return "weekly";
}

export async function generateSitemap(
	routes: string[],
	outDir: string,
): Promise<void> {
	const lastmod = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

	const urls = routes
		.map(
			(route) =>
				`  <url>\n    <loc>${SITE_URL}${route === "/" ? "" : route}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq(route)}</changefreq>\n    <priority>${priority(route)}</priority>\n  </url>`,
		)
		.join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	await fs.writeFile(path.join(outDir, "sitemap.xml"), xml, "utf-8");

	// eslint-disable-next-line no-console
	console.log(`[ssg] Wrote sitemap.xml (${routes.length} URLs)`);
}
