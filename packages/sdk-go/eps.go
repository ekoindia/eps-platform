// Package eps is the backend-only Go client for Eko Platform Services (EPS)
// APIs — DMT, AePS, BBPS, KYC and verification — with HMAC request signing
// built in.
//
// Port of packages/sdk-js/src/client.ts and packages/sdk-php/src/EpsClient.php.
// The signing algorithm, validation rules and error message formats are fixed
// by docs/sdk-golden-vector.md — every SDK language must agree byte for byte.
//
// Never run this anywhere a browser can reach: AccessKey signs every request.
package eps

import (
	"bytes"
	"context"
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/big"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// MultipartJSONField is the name of the single form field carrying every
// non-file value as one JSON object. Eko's upload APIs do not take a form field
// per parameter. Mirrors MULTIPART_JSON_FIELD in the website's
// src/lib/data/api-specs-common.ts.
const MultipartJSONField = "form-data"

// defaultTimeout is the per-attempt budget, matching every other EPS SDK.
const defaultTimeout = 30 * time.Second

const (
	// defaultRetries is the extra attempts for a GET that ended indeterminate.
	defaultRetries = 2
	// defaultRetryBaseDelay: attempt n waits a random slice of min(base × 2^(n-1), 2s).
	defaultRetryBaseDelay = 200 * time.Millisecond
	maxRetryDelay         = 2 * time.Second
	// inquirySlug is the generic status-check endpoint, keyed by TID or
	// "client_ref_id:<ref>".
	inquirySlug = "transaction-inquiry"
)

// surfaceJSON is the generated API surface, baked in at build time by
// scripts/bake-surface.mjs. It is gitignored in the monorepo (run `npm run
// build` first) and force-committed into the release mirror by CI, so a
// `go get` consumer always compiles against a present file.
//
//go:embed data/sdk-surface.json
var surfaceJSON []byte

var (
	numberRe  = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
	integerRe = regexp.MustCompile(`^-?\d+$`)
)

// Param is one request parameter as declared by the API spec.
type Param struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
	// Format keys the surface's formats table; the wire string must match.
	Format string `json:"format,omitempty"`
	// Enum lists the allowed values, compared as wire strings.
	Enum []any `json:"enum,omitempty"`
	// Min and Max are inclusive numeric bounds.
	Min *float64 `json:"min,omitempty"`
	Max *float64 `json:"max,omitempty"`
	// MaxLength caps the wire string, in UTF-8 bytes.
	MaxLength *int `json:"maxLength,omitempty"`
}

// Endpoint is one callable API, addressed by its Slug.
type Endpoint struct {
	Slug           string   `json:"slug"`
	Method         string   `json:"method"`
	Path           string   `json:"path"`
	Params         []Param  `json:"params"`
	RequiredParams []string `json:"requiredParams"`
	// Financial marks a money-moving endpoint: an indeterminate failure is
	// followed by a status check on the client_ref_id before the error surfaces.
	Financial bool `json:"financial,omitempty"`
}

type environment struct {
	ID      string `json:"id"`
	BaseURL string `json:"baseUrl"`
}

type surface struct {
	Environments []environment     `json:"environments"`
	Endpoints    []Endpoint        `json:"endpoints"`
	Formats      map[string]string `json:"formats"`
}

var loadedSurface = func() surface {
	var s surface
	if err := json.Unmarshal(surfaceJSON, &s); err != nil {
		panic(fmt.Sprintf("eps: embedded SDK surface is invalid or corrupt: %v", err))
	}
	return s
}()

// formatRes is the surface's format table compiled once. A pattern that does
// not compile is corrupt package data, so it panics at init like the surface
// itself — never silently skipping a validation. RE2 has no multiline mode by
// default, so "$" is the true end of the text and a trailing newline cannot
// slip past.
var formatRes = func() map[string]*regexp.Regexp {
	res := make(map[string]*regexp.Regexp, len(loadedSurface.Formats))
	for name, pattern := range loadedSurface.Formats {
		re, err := regexp.Compile(pattern)
		if err != nil {
			panic(fmt.Sprintf("eps: embedded SDK surface is invalid or corrupt: format %q does not compile: %v", name, err))
		}
		res[name] = re
	}
	return res
}()

// scalarTypes are the spec types whose values the value checks can stringify.
var scalarTypes = map[string]bool{"string": true, "number": true, "integer": true, "boolean": true}

// File is an in-memory upload, for callers that do not have the bytes on disk.
type File struct {
	Name    string
	Content []byte
}

// HTTPError is a non-2xx response. The decoded envelope is kept on Body when
// the response was JSON, but this is an error rather than a result: an auth or
// infrastructure failure must never be mistaken for a successful call.
type HTTPError struct {
	StatusCode int
	URL        string
	Body       map[string]any
	Raw        []byte
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("eps: request to %s failed with HTTP %d", e.URL, e.StatusCode)
}

// TransportError wraps a failure that produced no response at all — DNS,
// connect, TLS, or the per-attempt timeout. Err is the native error (a
// *url.Error, context.DeadlineExceeded, …) and is reachable with errors.As /
// errors.Is. The outcome is unknown, which is what separates it from a decode
// failure: a GET is retried, a financial non-GET gets a status check.
type TransportError struct {
	URL string
	Err error
}

func (e *TransportError) Error() string {
	return fmt.Sprintf("eps: request to %s failed: %v", e.URL, e.Err)
}

func (e *TransportError) Unwrap() error { return e.Err }

// IndeterminateError is a non-GET call on a money-moving endpoint that ended
// without a confirmed outcome (timeout, transport failure, HTTP 429 or 5xx).
// The SDK never re-sends such a request — that is how a customer gets debited
// twice — so it inquired by the call's client_ref_id instead and reports what
// it found. StatusCheck is the Transaction Inquiry envelope (data.tx_status:
// "0" success, "1" fail, "2" awaited, …) or nil when the inquiry itself
// failed, in which case StatusCheckErr says why. Err is the original failure,
// reachable with errors.As (for *HTTPError) and errors.Is. Reconcile with the
// ref before retrying; never assume a timeout meant failure.
type IndeterminateError struct {
	Slug        string
	ClientRefID string
	// Status is the HTTP status of the original attempt, or 0 for a transport
	// failure.
	Status         int
	StatusCheck    map[string]any
	StatusCheckErr error
	Err            error
}

func (e *IndeterminateError) Error() string {
	return fmt.Sprintf("eps: request for %q with client_ref_id %q has no confirmed outcome", e.Slug, e.ClientRefID)
}

func (e *IndeterminateError) Unwrap() error { return e.Err }

// isIndeterminate reports whether the outcome is unknown: no response, or a
// 429/5xx that says nothing about whether the request was processed. A 4xx is
// a decisive no, and so is a 2xx that failed to decode.
func isIndeterminate(err error) bool {
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		return httpErr.StatusCode == 429 || httpErr.StatusCode >= 500
	}
	var transportErr *TransportError
	return errors.As(err, &transportErr)
}

// GenerateClientRefID mints a client_ref_id for a non-GET call that did not
// supply one: base36 millisecond stamp (sortable, greppable against a log
// line) plus 7 random base36 chars, exactly 15 of [0-9a-z]. Under EPS's
// 20-char limit with ~7.8e10 distinct tails per millisecond, so concurrent
// processes cannot collide in practice. Same shape in every SDK — see
// docs/sdk-golden-vector.md.
func GenerateClientRefID(nowMs int64) string {
	n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(math.Pow(36, 7))))
	if err != nil {
		panic(fmt.Sprintf("eps: crypto/rand unavailable: %v", err))
	}
	tail := fmt.Sprintf("%07s", strconv.FormatInt(n.Int64(), 36))
	ref := strconv.FormatInt(nowMs, 36) + tail
	return ref[len(ref)-15:]
}

// Config constructs a Client. InitiatorID and UserCode are near-constant per
// developer, so they are set once here and injected into every call; pass
// either in a call's params to override (including an explicit nil to clear).
type Config struct {
	DeveloperKey string
	AccessKey    string
	// Environment is an id from the surface: "sandbox" or "production".
	Environment string
	InitiatorID string
	UserCode    string
	// HTTPClient defaults to a client with a 30s per-attempt timeout.
	HTTPClient *http.Client
	// Retries is the number of extra attempts for a GET whose outcome was
	// indeterminate (timeout, transport failure, HTTP 429/5xx). nil means the
	// default of 2 — three tries in all; point at 0 to disable. Non-GET calls
	// are never retried.
	Retries *int
	// RetryBaseDelay is the backoff base: attempt n waits a random slice of
	// min(base × 2^(n-1), 2s). Zero means the default of 200ms.
	RetryBaseDelay time.Duration
	// AutoStatusCheck: after an indeterminate failure on a financial endpoint,
	// look the transaction up by its client_ref_id and surface the result on
	// IndeterminateError.StatusCheck. nil means the default of true.
	AutoStatusCheck *bool
}

// Client is a signed EPS API client. Safe for concurrent use.
type Client struct {
	cfg             Config
	baseURL         string
	http            *http.Client
	retries         int
	retryBaseDelay  time.Duration
	autoStatusCheck bool
	// now is test-only clock injection (milliseconds since the epoch); not part
	// of the public surface.
	now func() int64
}

// New validates the config against the baked surface and returns a client.
func New(cfg Config) (*Client, error) {
	c := &Client{
		cfg:             cfg,
		http:            cfg.HTTPClient,
		retries:         defaultRetries,
		retryBaseDelay:  defaultRetryBaseDelay,
		autoStatusCheck: true,
		now:             func() int64 { return time.Now().UnixMilli() },
	}
	if c.http == nil {
		c.http = &http.Client{Timeout: defaultTimeout}
	}
	if cfg.Retries != nil {
		if *cfg.Retries < 0 {
			return nil, fmt.Errorf("Invalid retries: %d. Expected a non-negative integer.", *cfg.Retries)
		}
		c.retries = *cfg.Retries
	}
	if cfg.RetryBaseDelay < 0 {
		return nil, fmt.Errorf("Invalid retry base delay: %v. Expected a non-negative duration.", cfg.RetryBaseDelay)
	}
	if cfg.RetryBaseDelay != 0 {
		c.retryBaseDelay = cfg.RetryBaseDelay
	}
	if cfg.AutoStatusCheck != nil {
		c.autoStatusCheck = *cfg.AutoStatusCheck
	}
	for _, env := range loadedSurface.Environments {
		if env.ID == cfg.Environment {
			c.baseURL = env.BaseURL
			return c, nil
		}
	}
	return nil, fmt.Errorf("Unknown environment %q.", cfg.Environment)
}

// Sign computes secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))).
//
// The HMAC key is the base64 string's bytes — the encoded text, not the decoded
// key. See docs/sdk-golden-vector.md.
func Sign(accessKey, timestamp string) string {
	encodedKey := base64.StdEncoding.EncodeToString([]byte(accessKey))
	mac := hmac.New(sha256.New, []byte(encodedKey))
	mac.Write([]byte(timestamp))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// asNumber reports a value's numeric form, whether it is a whole number, and
// whether it is numeric at all. Booleans are not numbers.
func asNumber(value any) (f float64, whole bool, ok bool) {
	if n, isJSON := value.(json.Number); isJSON {
		if i, err := n.Int64(); err == nil {
			return float64(i), true, true
		}
		parsed, err := n.Float64()
		return parsed, false, err == nil
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(rv.Int()), true, true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(rv.Uint()), true, true
	case reflect.Float32, reflect.Float64:
		v := rv.Float()
		if math.IsInf(v, 0) || math.IsNaN(v) {
			return v, false, false
		}
		return v, v == math.Trunc(v), true
	}
	return 0, false, false
}

// isFileValue reports whether a value can be uploaded: a File, or a path to an
// existing readable file. Paths must exist, matching the PHP SDK — a typo'd
// path is caught before the request is signed rather than at read time.
func isFileValue(value any) bool {
	switch v := value.(type) {
	case File:
		return true
	case *File:
		return v != nil
	case string:
		info, err := os.Stat(v)
		return err == nil && !info.IsDir()
	}
	return false
}

// matchesType is a lenient, coercion-aware type check against a spec type. Only
// present values are checked (presence is enforced separately). Unknown types
// pass. The wire sends everything as strings, so numeric/boolean strings are
// accepted.
func matchesType(specType string, value any) bool {
	switch specType {
	case "string":
		// Strings and numbers (which coerce cleanly); not booleans/objects.
		if _, isStr := value.(string); isStr {
			return true
		}
		_, _, ok := asNumber(value)
		return ok
	case "file":
		return isFileValue(value)
	case "number":
		if _, _, ok := asNumber(value); ok {
			return true
		}
		s, isStr := value.(string)
		return isStr && numberRe.MatchString(s)
	case "integer":
		if _, whole, ok := asNumber(value); ok {
			// Matches JS `Number.isInteger`: a whole float counts as an integer.
			return whole
		}
		s, isStr := value.(string)
		return isStr && integerRe.MatchString(s)
	case "boolean":
		if _, isBool := value.(bool); isBool {
			return true
		}
		return value == "true" || value == "false"
	default:
		return true // unknown/unsupported spec type -> not enforced
	}
}

// wireString stringifies a value for a URL path token or query param, matching
// JavaScript String(value) so every SDK puts identical bytes on the wire:
// lowercase booleans, no trailing ".0" on whole floats.
func wireString(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case json.Number:
		return v.String()
	}
	if f, _, ok := asNumber(value); ok {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	return fmt.Sprint(value)
}

// valueProblem is the value check after the type check: enum → format →
// min/max → maxLength, on the wire string so 5 and "5" behave alike. It returns
// the first problem as the reason text, or "" when the value passes. Formats
// are syntactic regexes from the surface, matched whole-string. MaxLength
// counts UTF-8 bytes — the one length every language agrees on.
func valueProblem(p Param, value any, formats map[string]*regexp.Regexp) string {
	if !scalarTypes[p.Type] {
		return ""
	}
	wire := wireString(value)
	if p.Enum != nil {
		allowed := make([]string, len(p.Enum))
		found := false
		for i, a := range p.Enum {
			allowed[i] = wireString(a)
			found = found || allowed[i] == wire
		}
		if !found {
			return "not one of: " + strings.Join(allowed, ", ")
		}
	}
	if p.Format != "" {
		if re, ok := formats[p.Format]; ok && !re.MatchString(wire) {
			return "expected format " + p.Format
		}
	}
	if p.Min != nil || p.Max != nil {
		n, _ := strconv.ParseFloat(wire, 64)
		if p.Min != nil && n < *p.Min {
			return "below min " + wireString(*p.Min)
		}
		if p.Max != nil && n > *p.Max {
			return "above max " + wireString(*p.Max)
		}
	}
	if p.MaxLength != nil && len(wire) > *p.MaxLength {
		return fmt.Sprintf("longer than %d bytes", *p.MaxLength)
	}
	return ""
}

// Target is the resolved wire target for one call — everything but the sending.
type Target struct {
	Method    string
	URL       string
	Body      []byte
	Headers   map[string]string
	Multipart bool
	Slug      string
	// Financial marks a money-moving endpoint (surface "financial").
	Financial bool
	// ClientRefID is the ref this non-GET call carries (generated or supplied);
	// empty on GET or when the endpoint omits the param.
	ClientRefID string
	// InitiatorID is the initiator the call resolved, reused by the status check.
	InitiatorID any
}

func endpointFor(slug string) (*Endpoint, error) {
	for i := range loadedSurface.Endpoints {
		if loadedSurface.Endpoints[i].Slug == slug {
			return &loadedSurface.Endpoints[i], nil
		}
	}
	return nil, fmt.Errorf("Unknown endpoint slug %q.", slug)
}

// BuildHeaders returns the signed auth headers. Multipart callers get no
// content-type here — the boundary-carrying value is set when the body is
// encoded.
func (c *Client) BuildHeaders(multipartBody bool) map[string]string {
	timestamp := strconv.FormatInt(c.now(), 10)
	headers := map[string]string{
		"developer_key":        c.cfg.DeveloperKey,
		"secret-key":           Sign(c.cfg.AccessKey, timestamp),
		"secret-key-timestamp": timestamp,
	}
	if !multipartBody {
		headers["content-type"] = "application/json"
	}
	return headers
}

// encodeMultipart builds a multipart/form-data body: one form-data part holding
// every non-file value as JSON, then a part per upload — the order the API
// documents. nil values are dropped (a form field has no null encoding), while
// nulls nested inside a value survive the JSON.
func encodeMultipart(values map[string]any, fileParams map[string]bool) ([]byte, string, error) {
	payload := map[string]any{}
	type upload struct {
		field, name string
		content     []byte
	}
	var uploads []upload
	for _, name := range sortedKeys(values) {
		value := values[name]
		if value == nil {
			continue
		}
		if !fileParams[name] {
			payload[name] = value
			continue
		}
		switch v := value.(type) {
		case File:
			uploads = append(uploads, upload{name, v.Name, v.Content})
		case *File:
			uploads = append(uploads, upload{name, v.Name, v.Content})
		case string:
			content, err := os.ReadFile(v)
			if err != nil {
				return nil, "", fmt.Errorf("eps: reading upload %q: %w", name, err)
			}
			uploads = append(uploads, upload{name, filepath.Base(v), content})
		default:
			return nil, "", fmt.Errorf("eps: param %q is not a file value", name)
		}
	}

	// A value the encoder cannot handle must fail here — a blanked payload would
	// fail far from its cause.
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, "", fmt.Errorf("eps: params could not be JSON-encoded: %w", err)
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	if err := writer.WriteField(MultipartJSONField, string(encoded)); err != nil {
		return nil, "", err
	}
	for _, u := range uploads {
		part, err := writer.CreateFormFile(u.field, u.name)
		if err != nil {
			return nil, "", err
		}
		if _, err := part.Write(u.content); err != nil {
			return nil, "", err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), writer.FormDataContentType(), nil
}

// sortedKeys keeps request bytes deterministic — Go map iteration is randomized,
// and an unstable query string or multipart order makes requests unreproducible.
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ResolveTarget resolves a slug and params into the signed wire target.
//
// It fails before anything is signed or sent on an unknown slug, a missing
// required param or a type mismatch.
func (c *Client) ResolveTarget(slug string, params map[string]any) (*Target, error) {
	endpoint, err := endpointFor(slug)
	if err != nil {
		return nil, err
	}

	// Client-level defaults first; an explicit per-call value wins, including an
	// explicit nil that clears one.
	merged := map[string]any{}
	if c.cfg.InitiatorID != "" {
		merged["initiator_id"] = c.cfg.InitiatorID
	}
	if c.cfg.UserCode != "" {
		merged["user_code"] = c.cfg.UserCode
	}
	for k, v := range params {
		merged[k] = v
	}

	// Every non-GET call carries a client_ref_id — the key a partner reconciles
	// a lost response by. Generated only when the endpoint declares the param
	// and the caller sent none (absent or nil); a supplied value, even "", is
	// theirs to own. Done before the required-param guard so a generated ref
	// satisfies endpoints that require one.
	declaresRef := false
	if endpoint.Method != http.MethodGet {
		for _, p := range endpoint.Params {
			if p.Name == "client_ref_id" {
				declaresRef = true
			}
		}
	}
	clientRefID := ""
	if declaresRef {
		if ref, ok := merged["client_ref_id"]; !ok || ref == nil {
			merged["client_ref_id"] = GenerateClientRefID(c.now())
		}
		clientRefID = wireString(merged["client_ref_id"])
	}

	// Spec-driven guard: every requiredParam must be present and non-null before
	// we sign and send.
	var missing []string
	for _, name := range endpoint.RequiredParams {
		if value, ok := merged[name]; !ok || value == nil {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("Missing required params for %q: %s.", slug, strings.Join(missing, ", "))
	}

	// Type guard: every provided param known to the spec must match its type.
	// Unknown params (not in the surface) pass through untouched.
	var badTypes []string
	for _, p := range endpoint.Params {
		value, ok := merged[p.Name]
		if !ok || value == nil {
			continue
		}
		if !matchesType(p.Type, value) {
			badTypes = append(badTypes, fmt.Sprintf("%s (expected %s)", p.Name, p.Type))
		}
	}
	if len(badTypes) > 0 {
		return nil, fmt.Errorf("Invalid param types for %q: %s.", slug, strings.Join(badTypes, ", "))
	}

	// Value guard: enum / format / min / max / maxLength from the spec, on the
	// same provided params. Syntactic only — the server still owns semantics.
	var badValues []string
	for _, p := range endpoint.Params {
		value, ok := merged[p.Name]
		if !ok || value == nil {
			continue
		}
		if reason := valueProblem(p, value, formatRes); reason != "" {
			badValues = append(badValues, fmt.Sprintf("%s (%s)", p.Name, reason))
		}
	}
	if len(badValues) > 0 {
		return nil, fmt.Errorf("Invalid param values for %q: %s.", slug, strings.Join(badValues, ", "))
	}

	// A type:"file" param flips the whole request to multipart/form-data.
	fileParams := map[string]bool{}
	for _, p := range endpoint.Params {
		if p.Type == "file" {
			fileParams[p.Name] = true
		}
	}
	isMultipart := len(fileParams) > 0

	// Path params (e.g. {customer_id}) fill the URL; the rest become the query
	// string on GET, a multipart body when the endpoint has file uploads, or the
	// JSON body on every other method.
	path := endpoint.Path
	rest := map[string]any{}
	for name, value := range merged {
		token := "{" + name + "}"
		if strings.Contains(path, token) {
			path = strings.ReplaceAll(path, token, url.PathEscape(wireString(value)))
		} else {
			rest[name] = value
		}
	}

	target := &Target{
		Method:      endpoint.Method,
		URL:         c.baseURL + path,
		Headers:     c.BuildHeaders(isMultipart),
		Multipart:   isMultipart,
		Slug:        slug,
		Financial:   endpoint.Financial,
		ClientRefID: clientRefID,
		InitiatorID: merged["initiator_id"],
	}
	switch {
	case endpoint.Method == http.MethodGet:
		query := url.Values{}
		for _, name := range sortedKeys(rest) {
			query.Set(name, wireString(rest[name]))
		}
		if encoded := query.Encode(); encoded != "" {
			separator := "?"
			if strings.Contains(target.URL, "?") {
				separator = "&"
			}
			target.URL += separator + encoded
		}
	case isMultipart:
		body, contentType, err := encodeMultipart(rest, fileParams)
		if err != nil {
			return nil, err
		}
		target.Body = body
		target.Headers["content-type"] = contentType
	default:
		body, err := json.Marshal(rest)
		if err != nil {
			return nil, fmt.Errorf("eps: params could not be JSON-encoded: %w", err)
		}
		target.Body = body
	}
	return target, nil
}

// Call signs and sends one endpoint call, returning the decoded response
// envelope.
//
// It validates first (an error, nothing sent), then sends. A GET whose outcome
// is indeterminate is retried; a non-GET never is — on a financial endpoint it
// is followed by a Transaction Inquiry on its client_ref_id and returned as
// *IndeterminateError. Otherwise a non-2xx response yields *HTTPError, a
// transport failure *TransportError, and a body that is not JSON is an error,
// never a silent empty map. A cancelled ctx stops everything: no retry, no
// inquiry. See docs/sdk-golden-vector.md.
func (c *Client) Call(ctx context.Context, slug string, params map[string]any) (map[string]any, error) {
	target, err := c.ResolveTarget(slug, params)
	if err != nil {
		return nil, err
	}
	attempts := 1
	if target.Method == http.MethodGet {
		attempts = c.retries + 1
	}
	for attempt := 1; ; attempt++ {
		envelope, err := c.send(ctx, target)
		if err == nil {
			return envelope, nil
		}
		if !isIndeterminate(err) || ctx.Err() != nil {
			return nil, err
		}
		if attempt < attempts {
			if err := c.backoff(ctx, attempt); err != nil {
				return nil, err
			}
			continue
		}
		// Never re-send a non-GET: that is how a customer is debited twice. Ask
		// EPS what happened to the ref instead, if there is one to ask by.
		if c.autoStatusCheck && target.Financial && target.ClientRefID != "" {
			return nil, c.indeterminate(ctx, target, err)
		}
		return nil, err
	}
}

// backoff sleeps a random slice of min(base × 2^(n-1), 2s) — full jitter —
// or returns early when ctx is done.
func (c *Client) backoff(ctx context.Context, attempt int) error {
	limit := c.retryBaseDelay << (attempt - 1)
	if limit > maxRetryDelay || limit < 0 {
		limit = maxRetryDelay
	}
	if limit <= 0 {
		return nil
	}
	delay := time.Duration(rand.Int63n(int64(limit) + 1))
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(delay):
		return nil
	}
}

// indeterminate runs one inquiry by "client_ref_id:<ref>"; its own failure is
// reported, never allowed to mask the original one.
func (c *Client) indeterminate(ctx context.Context, target *Target, cause error) *IndeterminateError {
	params := map[string]any{"transaction-reference": "client_ref_id:" + target.ClientRefID}
	if target.InitiatorID != nil {
		params["initiator_id"] = target.InitiatorID
	}
	statusCheck, checkErr := c.Call(ctx, inquirySlug, params)
	result := &IndeterminateError{
		Slug:           target.Slug,
		ClientRefID:    target.ClientRefID,
		StatusCheck:    statusCheck,
		StatusCheckErr: checkErr,
		Err:            cause,
	}
	var httpErr *HTTPError
	if errors.As(cause, &httpErr) {
		result.Status = httpErr.StatusCode
	}
	return result
}

// send signs (fresh timestamp) and sends one attempt, decoding per the
// contract. The multipart content-type, with its boundary, is kept from the
// target; every other header is re-signed so a retry never reuses a stale
// secret-key-timestamp.
func (c *Client) send(ctx context.Context, target *Target) (map[string]any, error) {
	var body io.Reader
	if target.Body != nil {
		body = bytes.NewReader(target.Body)
	}
	req, err := http.NewRequestWithContext(ctx, target.Method, target.URL, body)
	if err != nil {
		return nil, err
	}
	for name, value := range target.Headers {
		req.Header.Set(name, value)
	}
	for name, value := range c.BuildHeaders(target.Multipart) {
		req.Header.Set(name, value)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, &TransportError{URL: target.URL, Err: err}
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, &TransportError{URL: target.URL, Err: err}
	}
	var envelope map[string]any
	decodeErr := json.Unmarshal(raw, &envelope)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, &HTTPError{StatusCode: res.StatusCode, URL: target.URL, Body: envelope, Raw: raw}
	}
	if decodeErr != nil {
		return nil, fmt.Errorf("eps: response from %s was not valid JSON: %w", target.URL, decodeErr)
	}
	return envelope, nil
}
