// Debug mode: opt-in, masked diagnostics a developer can share with Eko
// support. Normative contract: "Debug mode conformance" in
// docs/sdk-golden-vector.md; port of packages/sdk-js/src/debug.ts.
//
// Everything here is best-effort and isolated: a failure (or panic) while
// building, masking or writing an event is swallowed, so debug can never change
// a call's outcome. Masking is fail-closed: only keys the surface classifies
// print anything but "****".
package eps

import (
	"bytes"
	cryptorand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	rtdebug "runtime/debug"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	debugMask          = "****"
	debugUnavailable   = "[unavailable]"
	debugMaxDepth      = 8
	debugMaxEventBytes = 64 * 1024
	debugTextCap       = 1024
	debugSafeTextCap   = 256
	debugBodyTextCap   = 512
	modulePath         = "github.com/ekoindia/eps-sdk-go"
)

var (
	safeShapeRe = regexp.MustCompile(`^[A-Za-z0-9_.:-]{0,64}$`)
	keyShapeRe  = regexp.MustCompile(`^[a-z][a-z0-9_]{0,39}$`)
	last4URLRe  = regexp.MustCompile(`^\*\*\*\*[A-Za-z0-9]{4}$`)
	extShapeRe  = regexp.MustCompile(`^[a-z0-9]{1,5}$`)
	emailRe     = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	panRe       = regexp.MustCompile(`[A-Z]{5}[0-9]{4}[A-Z]`)
	digitsRe    = regexp.MustCompile(`[0-9]{6,}`)
	pathParamRe = regexp.MustCompile(`^\{([^}]+)\}$`)
)

// debugMu serializes every debug write of this SDK, across all clients and
// writers, so lines never interleave. It orders this SDK's own writes only:
// anything else writing to the same io.Writer is not coordinated with it.
// ponytail: one global lock; per-writer locks if debug throughput ever matters.
var debugMu sync.Mutex

// redactLists is the surface's `redact` classification (any list may be absent).
type redactLists struct {
	Safe  []string `json:"safe"`
	Last4 []string `json:"last4"`
	Text  []string `json:"text"`
	Nest  []string `json:"nest"`
}

type keyClass int

const (
	classDefault keyClass = iota
	classSafe
	classLast4
	classText
	classNest
)

// multipartMeta is captured by encodeMultipart from values already in hand —
// debug never re-reads a file.
type multipartMeta struct {
	fields string
	files  []uploadMeta
}

type uploadMeta struct {
	param, name string
	size        int
}

// debugFile is one upload as logged: never its name or bytes.
type debugFile struct {
	Param string  `json:"param"`
	Ext   *string `json:"ext"`
	Bytes int     `json:"bytes"`
}

// last4 is "****" for 8 code points or fewer, else "****" + the last 4.
func last4(s string) string {
	runes := []rune(s)
	if len(runes) <= 8 {
		return debugMask
	}
	return debugMask + string(runes[len(runes)-4:])
}

// masker classifies keys by the surface's lists and masks values accordingly.
type masker struct {
	classes   map[string]keyClass
	clientRef *regexp.Regexp
}

// newMasker builds the key → class table; later lists win, so last4 beats
// every other class.
func newMasker(r redactLists, clientRef *regexp.Regexp) *masker {
	m := &masker{classes: map[string]keyClass{}, clientRef: clientRef}
	for _, list := range []struct {
		cls  keyClass
		keys []string
	}{{classNest, r.Nest}, {classText, r.Text}, {classSafe, r.Safe}, {classLast4, r.Last4}} {
		for _, key := range list.keys {
			m.classes[key] = list.cls
		}
	}
	return m
}

func (m *masker) classOf(key string) keyClass { return m.classes[strings.ToLower(key)] }

// printable reports whether a key name prints: classified, or field-name shaped.
func (m *masker) printable(key string) bool {
	_, classified := m.classes[strings.ToLower(key)]
	return classified || keyShapeRe.MatchString(key)
}

// childClass is the class of a child key: an unprintable name is always default.
func (m *masker) childClass(key string, parent keyClass) keyClass {
	if !m.printable(key) {
		return classDefault
	}
	if parent == classText {
		return classText
	}
	return m.classOf(key)
}

// mask masks a decoded JSON value held under key of class cls. Every scalar
// it changes is appended to changed (when non-nil) so later text can be
// scrubbed of it.
func (m *masker) mask(value any, cls keyClass, key string, known []string, changed *[]string, depth int) any {
	walks := (cls == classNest || cls == classSafe || cls == classText) && depth < debugMaxDepth
	switch v := value.(type) {
	case nil:
		return nil
	case bool:
		return v
	case []any:
		if !walks {
			return opaque(value, changed)
		}
		out := make([]any, len(v))
		for i, e := range v {
			out[i] = m.mask(e, cls, key, known, changed, depth+1)
		}
		return out
	case map[string]any:
		if !walks {
			return opaque(value, changed)
		}
		out := make(map[string]any, len(v))
		unnamed := 0
		// Sorted keys: Go maps are unordered, and "#n" names must be stable.
		for _, k := range sortedKeys(v) {
			name := k
			if !m.printable(k) {
				unnamed++
				name = fmt.Sprintf("#%d", unnamed)
			}
			out[name] = m.mask(v[k], m.childClass(k, cls), k, known, changed, depth+1)
		}
		return out
	}
	s := wireString(value)
	masked, same := m.scalar(value, s, cls, key, known)
	if changed != nil && !same && utf8.RuneCountInString(s) >= 4 {
		*changed = append(*changed, s)
	}
	return masked
}

// opaque masks a whole structured value, remembering every scalar under it.
func opaque(value any, changed *[]string) string {
	if changed != nil {
		collectAll(value, changed)
	}
	return debugMask
}

// collectAll appends every scalar wire string of 4+ code points under value.
func collectAll(value any, out *[]string) {
	switch v := value.(type) {
	case nil, bool:
	case []any:
		for _, e := range v {
			collectAll(e, out)
		}
	case map[string]any:
		for _, e := range v {
			collectAll(e, out)
		}
	default:
		if s := wireString(v); utf8.RuneCountInString(s) >= 4 {
			*out = append(*out, s)
		}
	}
}

// scalar masks one scalar on its wire string s; same reports whether the
// output equals the input (a safe number is returned as the number itself).
func (m *masker) scalar(value any, s string, cls keyClass, key string, known []string) (any, bool) {
	str, isStr := value.(string)
	result := func(out string) (any, bool) { return out, isStr && str == out }
	switch cls {
	case classLast4:
		return result(last4(s))
	case classSafe:
		if strings.ToLower(key) == "client_ref_id" && m.clientRef != nil && !m.clientRef.MatchString(s) {
			return result(debugMask)
		}
		if safeShapeRe.MatchString(s) {
			if containsKnown(s, known) {
				return result(debugMask)
			}
			return value, true
		}
		return result(m.text(s, debugSafeTextCap, known))
	case classText, classNest:
		return result(m.text(s, debugTextCap, known))
	}
	return result(debugMask)
}

// nonEmpty is the known-value list for s: an empty string is never a known
// value (it would match everywhere and mask every safe value).
func nonEmpty(s string) []string {
	if s == "" {
		return nil
	}
	return []string{s}
}

// containsKnown skips empty known values: they would match everything.
func containsKnown(s string, known []string) bool {
	for _, k := range known {
		if k != "" && strings.Contains(s, k) {
			return true
		}
	}
	return false
}

// root masks a whole JSON document (request or response body).
func (m *masker) root(value any, known []string, changed *[]string) any {
	return m.mask(value, classNest, "", known, changed, 0)
}

// text is the text scrub: digit runs first (so a short known value cannot
// match inside a longer number and leave its ends visible), then known values
// in every encoded form, PAN shapes and e-mails, then a code-point cap.
func (m *masker) text(s string, limit int, known []string) string {
	out := digitsRe.ReplaceAllStringFunc(s, func(d string) string {
		if len(d) >= 9 {
			return debugMask + d[len(d)-4:]
		}
		return debugMask
	})
	sorted := append([]string(nil), known...)
	sort.SliceStable(sorted, func(i, j int) bool { return len(sorted[i]) > len(sorted[j]) })
	for _, k := range sorted {
		if k == "" {
			continue
		}
		for _, form := range knownForms(k) {
			out = strings.ReplaceAll(out, form, debugMask)
		}
	}
	out = panRe.ReplaceAllLiteralString(out, debugMask)
	out = emailRe.ReplaceAllLiteralString(out, debugMask+"@"+debugMask)
	if n := utf8.RuneCountInString(out); n > limit {
		return fmt.Sprintf("%s…(+%d chars)", string([]rune(out)[:limit]), n-limit)
	}
	return out
}

// knownForms is a known value raw and percent-encoded. Beyond the spec's
// encodeURIComponent form it adds Go's own wire forms (url.QueryEscape: space
// as "+"; url.PathEscape), since those are what this SDK puts in a URL.
func knownForms(k string) []string {
	forms := []string{k}
	for _, form := range []string{encodeURIComponent(k), url.QueryEscape(k), url.PathEscape(k)} {
		seen := false
		for _, f := range forms {
			seen = seen || f == form
		}
		if !seen {
			forms = append(forms, form)
		}
	}
	return forms
}

// encodeURIComponent matches JavaScript's: every byte but A-Z a-z 0-9 and
// -_.!~*'() is percent-encoded (uppercase hex).
func encodeURIComponent(s string) string {
	const digits = "0123456789ABCDEF"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		if 'A' <= c && c <= 'Z' || 'a' <= c && c <= 'z' || '0' <= c && c <= '9' || strings.IndexByte("-_.!~*'()", c) >= 0 {
			b.WriteByte(c)
			continue
		}
		b.WriteByte('%')
		b.WriteByte(digits[c>>4])
		b.WriteByte(digits[c&15])
	}
	return b.String()
}

// headers is an allowlist, matched case-insensitively.
func (m *masker) headers(headers map[string]string) map[string]string {
	out := make(map[string]string, len(headers))
	for name, value := range headers {
		switch strings.ToLower(name) {
		case "secret-key-timestamp", "content-type":
			out[name] = value
		case "developer_key":
			out[name] = last4(value)
		default:
			out[name] = debugMask
		}
	}
	return out
}

// url masks the URL actually sent by the endpoint's path template. Any
// mismatch with the base URL or the template, or a bad escape, fails closed.
func (m *masker) url(raw, baseURL, template string, known []string, changed *[]string) (out string) {
	defer func() {
		if recover() != nil {
			out = debugUnavailable
		}
	}()
	if !strings.HasPrefix(raw, baseURL) {
		return debugUnavailable
	}
	pathPart, query, _ := strings.Cut(raw[len(baseURL):], "?")
	tSegs, pSegs := strings.Split(template, "/"), strings.Split(pathPart, "/")
	if len(tSegs) != len(pSegs) {
		return debugUnavailable
	}
	segs := make([]string, len(tSegs))
	for i, seg := range tSegs {
		param := pathParamRe.FindStringSubmatch(seg)
		if param == nil {
			if seg != pSegs[i] {
				return debugUnavailable
			}
			segs[i] = seg
			continue
		}
		decoded, err := url.PathUnescape(pSegs[i])
		if err != nil || !utf8.ValidString(decoded) {
			return debugUnavailable
		}
		segs[i] = m.urlValue(param[1], true, decoded, pSegs[i], known, changed)
	}
	var pairs []string
	unnamed := 0
	for _, pair := range strings.Split(query, "&") {
		if pair == "" {
			continue
		}
		rawKey, rawValue, _ := strings.Cut(pair, "=")
		key, keyErr := url.QueryUnescape(rawKey)
		value, valueErr := url.QueryUnescape(rawValue)
		if keyErr != nil || valueErr != nil || !utf8.ValidString(key) || !utf8.ValidString(value) {
			return debugUnavailable
		}
		named := m.printable(key)
		masked := m.urlValue(key, named, value, rawValue, known, changed)
		if !named {
			unnamed++
			rawKey = fmt.Sprintf("#%d", unnamed)
		}
		pairs = append(pairs, rawKey+"="+masked)
	}
	out = baseURL + strings.Join(segs, "/")
	if len(pairs) > 0 {
		out += "?" + strings.Join(pairs, "&")
	}
	return out
}

// urlValue keeps the raw (still-encoded) value when masking left it unchanged,
// a last4 result only when its tail is alphanumeric, else "****".
func (m *masker) urlValue(key string, named bool, decoded, raw string, known []string, changed *[]string) string {
	cls := classDefault
	if !named {
		key = ""
	} else {
		cls = m.classOf(key)
	}
	masked, _ := m.mask(decoded, cls, key, known, changed, 0).(string)
	if masked == decoded {
		return raw
	}
	if cls == classLast4 && last4URLRe.MatchString(masked) {
		return masked
	}
	return debugMask
}

// debugField is one key of an event; a slice of them keeps the spec's key order.
type debugField struct {
	key   string
	value any
}

// debugger emits events for one client.
type debugger struct {
	w            io.Writer
	masker       *masker
	common       []debugField
	baseURL      string
	developerKey string
}

// sdkVersion is this module's version from the build info, else "unknown".
var sdkVersion = sync.OnceValue(func() string {
	info, ok := rtdebug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}
	version := ""
	if info.Main.Path == modulePath {
		version = info.Main.Version
	}
	for _, dep := range info.Deps {
		if dep.Path == modulePath {
			version = dep.Version
		}
	}
	if version == "" || version == "(devel)" {
		return "unknown"
	}
	return version
})

// startDebug resolves w against EPS_SDK_DEBUG (nil: the env var decides;
// io.Discard: off; any other writer: on) and emits init. It returns nil when
// debug is off or its setup fails — debug must never break a client.
func startDebug(c *Client, w io.Writer) (d *debugger) {
	defer func() {
		if recover() != nil {
			d = nil
		}
	}()
	source := "option"
	switch {
	case w == io.Discard:
		return nil
	case w == nil:
		flag := strings.ToLower(strings.TrimSpace(os.Getenv("EPS_SDK_DEBUG")))
		if flag != "1" && flag != "true" {
			return nil
		}
		w, source = os.Stderr, "env"
	}
	var surfaceVersion any
	if loadedSurface.BundleVersion != "" {
		surfaceVersion = loadedSurface.BundleVersion
	}
	d = &debugger{
		w:      w,
		masker: newMasker(loadedSurface.Redact, formatRes["client-ref"]),
		common: []debugField{
			{"sdk", "go"},
			{"sdk_version", sdkVersion()},
			{"surface", surfaceVersion},
			{"env", c.cfg.Environment},
		},
		baseURL:      c.baseURL,
		developerKey: c.cfg.DeveloperKey,
	}
	d.emit("init", nil, []debugField{
		{"base_url", c.baseURL},
		{"runtime", runtime.Version()},
		{"developer_key", last4(c.cfg.DeveloperKey)},
		{"timeout_ms", c.http.Timeout.Milliseconds()},
		{"retries", c.retries},
		{"auto_status_check", c.autoStatusCheck},
		{"source", source},
	})
	return d
}

// emit builds, bounds, serializes and writes one event; it never panics.
func (d *debugger) emit(event string, call, fields []debugField) {
	defer func() { _ = recover() }()
	all := make([]debugField, 0, 3+len(d.common)+len(call)+len(fields))
	all = append(all,
		debugField{"logger", "eps-sdk"},
		debugField{"ts", time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")},
		debugField{"event", event})
	all = append(append(append(all, d.common...), call...), fields...)
	line, err := encodeEvent(all)
	if err != nil {
		return
	}
	if len(line) > debugMaxEventBytes {
		for i := range all {
			if all[i].key == "body" {
				all[i].value = fmt.Sprintf("[%d bytes omitted]", len(line))
				if line, err = encodeEvent(all); err != nil {
					return
				}
				break
			}
		}
	}
	d.write(append(line, '\n'))
}

// write delivers one line in a single Write under the package mutex.
func (d *debugger) write(line []byte) {
	debugMu.Lock()
	defer debugMu.Unlock()
	_, _ = d.w.Write(line)
}

// encodeEvent serializes fields in order, without HTML escaping so an echoed
// <html> page stays readable. Nested maps get encoding/json's sorted keys.
func encodeEvent(fields []debugField) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	buf.WriteByte('{')
	for i, f := range fields {
		if i > 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(f.key); err != nil {
			return nil, err
		}
		buf.Truncate(buf.Len() - 1) // Encode's trailing newline
		buf.WriteByte(':')
		if err := enc.Encode(f.value); err != nil {
			return nil, err
		}
		buf.Truncate(buf.Len() - 1)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

// decodeJSON parses one whole JSON document, numbers kept exactly as received.
func decodeJSON(raw []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var value any
	if err := dec.Decode(&value); err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errors.New("trailing data after JSON value")
	}
	return value, nil
}

// errorName is the concrete error type's name without package or pointer, or
// "error" for an unexported type (errors.New, fmt.Errorf, context errors).
func errorName(err error) string {
	t := reflect.TypeOf(err)
	for t != nil && t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t == nil {
		return "error"
	}
	if first, _ := utf8.DecodeRuneInString(t.Name()); !unicode.IsUpper(first) {
		return "error"
	}
	return t.Name()
}

// trace is the per-Call state: the call id and the values later text is
// scrubbed of. Every method is a no-op on a nil trace (debug off).
type trace struct {
	d         *debugger
	call      []debugField
	slug      string
	known     []string
	started   time.Time
	multipart *multipartMeta
}

// trace starts tracing one Call; nil when debug is off or setup fails.
func (d *debugger) trace(slug string) (t *trace) {
	if d == nil {
		return nil
	}
	defer func() {
		if recover() != nil {
			t = nil
		}
	}()
	id := make([]byte, 4)
	if _, err := cryptorand.Read(id); err != nil {
		return nil
	}
	return &trace{
		d:     d,
		call:  []debugField{{"call_id", hex.EncodeToString(id)}, {"slug", slug}},
		slug:  slug,
		known: nonEmpty(d.developerKey),
	}
}

// resolved records the multipart metadata of the resolved target, if any.
func (t *trace) resolved(meta *multipartMeta) {
	if t != nil {
		t.multipart = meta
	}
}

// request masks and logs the request as sent (signed holds the freshly signed
// headers) and remembers its values for later scrubs.
func (t *trace) request(attempt int, target *Target, signed map[string]string) {
	if t == nil {
		return
	}
	defer func() { _ = recover() }()
	t.started = time.Now()
	m := t.d.masker
	headers := make(map[string]string, len(target.Headers)+len(signed))
	for name, value := range target.Headers {
		headers[name] = value
	}
	for name, value := range signed {
		headers[name] = value
	}
	base := nonEmpty(t.d.developerKey)
	for name, value := range headers {
		if strings.ToLower(name) == "secret-key" {
			base = append(base, nonEmpty(value)...)
		}
	}
	template := ""
	if endpoint, err := endpointFor(t.slug); err == nil {
		template = endpoint.Path
	}
	var changed []string
	maskedURL := m.url(target.URL, t.d.baseURL, template, base, &changed)
	var body any
	switch {
	case t.multipart != nil:
		fields, err := decodeJSON([]byte(t.multipart.fields))
		if err != nil {
			return
		}
		files := make([]debugFile, len(t.multipart.files))
		for i, f := range t.multipart.files {
			files[i] = debugFile{Param: f.param, Ext: fileExt(f.name), Bytes: f.size}
		}
		body = map[string]any{"fields": m.root(fields, base, &changed), "files": files}
	case target.Body != nil:
		parsed, err := decodeJSON(target.Body)
		if err != nil {
			return
		}
		body = m.root(parsed, base, &changed)
	}
	t.known = append(base, changed...)
	t.d.emit("request", t.call, []debugField{
		{"attempt", attempt},
		{"method", target.Method},
		{"url", maskedURL},
		{"headers", m.headers(headers)},
		{"body", body},
	})
}

// fileExt is the lowercased extension when tidy, else nil.
func fileExt(name string) *string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	if !extShapeRe.MatchString(ext) {
		return nil
	}
	return &ext
}

// response logs an attempt that got an HTTP status.
func (t *trace) response(attempt, status int, raw []byte) {
	if t == nil {
		return
	}
	defer func() { _ = recover() }()
	var body any
	if parsed, err := decodeJSON(raw); err == nil {
		body = t.d.masker.root(parsed, t.known, nil)
	} else {
		body = t.d.masker.text(string(raw), debugBodyTextCap, t.known)
	}
	t.d.emit("response", t.call, []debugField{
		{"attempt", attempt}, {"status", status}, {"ms", t.elapsed()}, {"body", body},
	})
}

// transportError logs an attempt with no usable response; status is the HTTP
// status when one arrived before the body failed, else 0. The *url.Error that
// http.Client.Do wraps every failure in is peeled off: its type says nothing.
func (t *trace) transportError(attempt int, err error, status int) {
	if t == nil {
		return
	}
	defer func() { _ = recover() }()
	var urlErr *url.Error
	if errors.As(err, &urlErr) && urlErr.Err != nil {
		err = urlErr.Err
	}
	fields := []debugField{
		{"attempt", attempt},
		{"ms", t.elapsed()},
		{"error", errorName(err)},
		{"message", t.d.masker.text(err.Error(), debugTextCap, t.known)},
	}
	if status != 0 {
		fields = append(fields, debugField{"status", status})
	}
	t.d.emit("transport_error", t.call, fields)
}

// retry logs the attempt that failed and the backoff about to be slept.
func (t *trace) retry(attempt int, delay time.Duration) {
	if t == nil {
		return
	}
	t.d.emit("retry", t.call, []debugField{{"attempt", attempt}, {"delay_ms", delay.Milliseconds()}})
}

// failed logs the error Call is about to return, with the ref / tid an
// *IndeterminateError carries.
func (t *trace) failed(err error) {
	if t == nil {
		return
	}
	defer func() { _ = recover() }()
	m := t.d.masker
	fields := []debugField{
		{"error", errorName(err)},
		{"message", m.text(err.Error(), debugTextCap, t.known)},
	}
	var ind *IndeterminateError
	if errors.As(err, &ind) {
		if ind.ClientRefID != "" {
			fields = append(fields, debugField{"client_ref_id", m.mask(ind.ClientRefID, classSafe, "client_ref_id", t.known, nil, 0)})
		}
		if ind.TID != "" {
			fields = append(fields, debugField{"tid", m.mask(ind.TID, classSafe, "tid", t.known, nil, 0)})
		}
	}
	t.d.emit("error", t.call, fields)
}

// elapsed is the monotonic time since this attempt's request, in whole ms.
func (t *trace) elapsed() int64 {
	return time.Since(t.started).Round(time.Millisecond).Milliseconds()
}
