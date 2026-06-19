/**
 * Registers the extra Prism grammars the docs code panel needs but
 * prism-react-renderer does NOT vendor: `bash` (cURL samples) and `php`.
 * `javascript`, `python` and `json` ship with the renderer already.
 *
 * Import order matters and is guaranteed here: `./prism-global` (which puts the
 * renderer's Prism on `globalThis`) is the first import, so it is fully
 * evaluated before the grammar side-effect imports below run. `markup-templating`
 * is a prerequisite of `php`. Importing this module anywhere is enough to
 * activate the grammars (side-effect only).
 */
import "./prism-global";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
