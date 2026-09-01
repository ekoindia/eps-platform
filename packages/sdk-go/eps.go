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
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
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

const defaultTimeout = 30 * time.Second

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
}

// Endpoint is one callable API, addressed by its Slug.
type Endpoint struct {
	Slug           string   `json:"slug"`
	Method         string   `json:"method"`
	Path           string   `json:"path"`
	Params         []Param  `json:"params"`
	RequiredParams []string `json:"requiredParams"`
}

type environment struct {
	ID      string `json:"id"`
	BaseURL string `json:"baseUrl"`
}

type surface struct {
	Environments []environment `json:"environments"`
	Endpoints    []Endpoint    `json:"endpoints"`
}

var loadedSurface = func() surface {
	var s surface
	if err := json.Unmarshal(surfaceJSON, &s); err != nil {
		panic(fmt.Sprintf("eps: embedded SDK surface is invalid or corrupt: %v", err))
	}
	return s
}()

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
	// HTTPClient defaults to a client with a 30s timeout.
	HTTPClient *http.Client
}

// Client is a signed EPS API client. Safe for concurrent use.
type Client struct {
	cfg     Config
	baseURL string
	http    *http.Client
	// now is test-only clock injection (milliseconds since the epoch); not part
	// of the public surface.
	now func() int64
}

// New validates the config against the baked surface and returns a client.
func New(cfg Config) (*Client, error) {
	c := &Client{
		cfg:  cfg,
		http: cfg.HTTPClient,
		now:  func() int64 { return time.Now().UnixMilli() },
	}
	if c.http == nil {
		c.http = &http.Client{Timeout: defaultTimeout}
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

// Target is the resolved wire target for one call — everything but the sending.
type Target struct {
	Method    string
	URL       string
	Body      []byte
	Headers   map[string]string
	Multipart bool
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
		Method:    endpoint.Method,
		URL:       c.baseURL + path,
		Headers:   c.BuildHeaders(isMultipart),
		Multipart: isMultipart,
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
// A non-2xx response yields *HTTPError; a body that is not JSON is an error,
// never a silent empty map.
func (c *Client) Call(ctx context.Context, slug string, params map[string]any) (map[string]any, error) {
	target, err := c.ResolveTarget(slug, params)
	if err != nil {
		return nil, err
	}
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
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
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
