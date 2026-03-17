

## Plan: Update robots.txt to Disallow All Bots

Replace the current `public/robots.txt` content with a single rule that disallows all bots from crawling any page.

**Change:** Overwrite `public/robots.txt` with:
```
User-agent: *
Disallow: /
```

This will block all search engine crawlers from indexing any page on the site.

