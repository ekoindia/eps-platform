/**
 * Registers the extra Prism grammars the docs code panel needs but
 * prism-react-renderer does NOT vendor: `bash` (cURL samples), `php`, and
 * `java` (for fenced code blocks in endpoint descriptions, e.g. the AePS
 * Aadhaar-encryption snippet). `javascript`, `python` and `json` ship with the
 * renderer already.
 *
 * Import order matters and is guaranteed here: `./prism-global` (which puts the
 * renderer's Prism on `globalThis`) is the first import, so it is fully
 * evaluated before the grammar side-effect imports below run. `markup-templating`
 * is a prerequisite of `php`; `clike` is a prerequisite of `java`. Importing this
 * module anywhere is enough to activate the grammars (side-effect only).
 */
import "./prism-global";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-java";
