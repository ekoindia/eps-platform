// Cross-language conformance suite for the Go SDK.
//
// Ported case for case from packages/sdk-php/tests/EpsClientTest.php, which is
// itself the executable form of docs/sdk-golden-vector.md. Any divergence here
// is a divergence on the wire.
package eps

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

const (
	golden    = "u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk="
	accessKey = "TEST_ACCESS_KEY_DO_NOT_USE"
	fixedMS   = int64(1700000000000)
)

var address = map[string]any{
	"line": "Shop 5", "city": "Patna", "state": "Bihar", "pincode": "800001",
}

// thisFile is an existing readable path, used wherever a test needs a real
// upload without shipping a fixture binary.
var thisFile = func() string {
	path, err := filepath.Abs("eps_test.go")
	if err != nil {
		panic(err)
	}
	return path
}()

func newTestClient(t *testing.T, mutate ...func(*Config)) *Client {
	t.Helper()
	cfg := Config{
		DeveloperKey: "dev123",
		AccessKey:    accessKey,
		Environment:  "sandbox",
	}
	for _, m := range mutate {
		m(&cfg)
	}
	client, err := New(cfg)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	client.now = func() int64 { return fixedMS }
	return client
}

// aepsParams returns every required param of activate-aeps-fingpay, so a test
// targeting one guard is not short-circuited by the missing-param guard.
func aepsParams(overrides map[string]any) map[string]any {
	params := map[string]any{
		"initiator_id":         "9962981729",
		"user_code":            "20810200",
		"modelname":            "Morpho 1300E3",
		"devicenumber":         "SN1234567890",
		"account":              "38759149196",
		"ifsc":                 "SBIN0007515",
		"shop_type":            4215,
		"office_address":       address,
		"address_as_per_proof": address,
		"pan_card":             thisFile,
		"aadhar":               "123456789012",
		"aadhar_front":         thisFile,
		"aadhar_back":          thisFile,
		"latlong":              "28.6139,77.2090",
	}
	for k, v := range overrides {
		params[k] = v
	}
	return params
}

// multipartParts splits an encoded body into the decoded form-data envelope and
// the filename of every upload part, keyed by field name.
func multipartParts(t *testing.T, target *Target) (map[string]any, map[string]string) {
	t.Helper()
	_, params, err := mime.ParseMediaType(target.Headers["content-type"])
	if err != nil {
		t.Fatalf("parsing content-type: %v", err)
	}
	reader := multipart.NewReader(strings.NewReader(string(target.Body)), params["boundary"])
	envelope := map[string]any{}
	files := map[string]string{}
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("reading multipart: %v", err)
		}
		body, _ := io.ReadAll(part)
		if part.FormName() == MultipartJSONField {
			if err := json.Unmarshal(body, &envelope); err != nil {
				t.Fatalf("decoding %s: %v", MultipartJSONField, err)
			}
			continue
		}
		files[part.FormName()] = part.FileName()
	}
	return envelope, files
}

func mustResolve(t *testing.T, c *Client, slug string, params map[string]any) *Target {
	t.Helper()
	target, err := c.ResolveTarget(slug, params)
	if err != nil {
		t.Fatalf("ResolveTarget(%q): %v", slug, err)
	}
	return target
}

func wantErr(t *testing.T, err error, substrings ...string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error, got nil")
	}
	for _, want := range substrings {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not contain %q", err, want)
		}
	}
}

func TestGoldenVector(t *testing.T) {
	if got := Sign(accessKey, "1700000000000"); got != golden {
		t.Errorf("Sign = %q, want %q", got, golden)
	}
}

func TestBuildsSignedHeaders(t *testing.T) {
	headers := newTestClient(t).BuildHeaders(false)
	if headers["developer_key"] != "dev123" {
		t.Errorf("developer_key = %q", headers["developer_key"])
	}
	if headers["secret-key"] != golden {
		t.Errorf("secret-key = %q, want %q", headers["secret-key"], golden)
	}
	if headers["secret-key-timestamp"] != "1700000000000" {
		t.Errorf("secret-key-timestamp = %q", headers["secret-key-timestamp"])
	}
}

func TestMultipartHeadersOmitContentType(t *testing.T) {
	client := newTestClient(t)
	headers := client.BuildHeaders(true)
	if _, present := headers["content-type"]; present {
		t.Error("multipart headers must not carry a content-type")
	}
	if headers["secret-key"] != golden {
		t.Error("multipart headers must still be signed")
	}
	if got := client.BuildHeaders(false)["content-type"]; got != "application/json" {
		t.Errorf("content-type = %q", got)
	}
}

func TestUnknownEnvironmentRejected(t *testing.T) {
	_, err := New(Config{DeveloperKey: "dev123", AccessKey: accessKey, Environment: "moon"})
	wantErr(t, err, "Unknown environment")
}

func TestUnknownSlugRejected(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("no-such-endpoint", nil)
	wantErr(t, err, "Unknown endpoint slug")
}

func TestGetPutsNonPathParamsInQueryStringNoBody(t *testing.T) {
	target := mustResolve(t, newTestClient(t), "dmt-get-sender", map[string]any{
		"customer_id":  "9123456789",
		"initiator_id": "9962981729",
		"user_code":    "20810200",
	})
	for _, want := range []string{
		"/customer/payment/dmt-fino/sender/9123456789",
		"initiator_id=9962981729",
		"user_code=20810200",
	} {
		if !strings.Contains(target.URL, want) {
			t.Errorf("URL %q does not contain %q", target.URL, want)
		}
	}
	if strings.Contains(target.URL, "{customer_id}") {
		t.Errorf("path token left unsubstituted: %s", target.URL)
	}
	if target.Body != nil {
		t.Errorf("GET must have no body, got %q", target.Body)
	}
}

func TestJSONEndpointStillSendsJSONBody(t *testing.T) {
	target := mustResolve(t, newTestClient(t), "pan-lite", map[string]any{
		"initiator_id": "9962981729",
		"pan_number":   "ABCDE1234F",
		"name":         "Test Name",
		"dob":          "1990-01-01",
	})
	if target.Multipart {
		t.Error("pan-lite is not a multipart endpoint")
	}
	if !strings.Contains(string(target.Body), `"pan_number":"ABCDE1234F"`) {
		t.Errorf("body = %s", target.Body)
	}
}

func TestThrowsWhenRequiredParamMissing(t *testing.T) {
	// dmt-get-sender requires initiator_id and customer_id (user_code is optional).
	_, err := newTestClient(t).ResolveTarget("dmt-get-sender", map[string]any{
		"user_code": "20810200",
	})
	wantErr(t, err, "Missing required params", "initiator_id", "customer_id")
}

func TestThrowsWhenRequiredParamNull(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("dmt-get-sender", map[string]any{
		"initiator_id": "9962981729",
		"customer_id":  nil,
	})
	wantErr(t, err, "Missing required params", "customer_id")
}

func TestAcceptsNumericStringForNumberParam(t *testing.T) {
	// bbps-get-operators: category is an optional `number` param.
	target := mustResolve(t, newTestClient(t), "bbps-get-operators", map[string]any{
		"initiator_id": "9962981729",
		"user_code":    "20810200",
		"category":     "5",
	})
	if !strings.Contains(target.URL, "category=5") {
		t.Errorf("URL = %s", target.URL)
	}
}

func TestAcceptsPlainNumberForNumberParam(t *testing.T) {
	target := mustResolve(t, newTestClient(t), "bbps-get-operators", map[string]any{
		"initiator_id": "9962981729",
		"user_code":    "20810200",
		"category":     5,
	})
	// A whole number must serialize as "5", never "5.0" — JS String(5) is "5".
	if !strings.Contains(target.URL, "category=5&") && !strings.HasSuffix(target.URL, "category=5") {
		t.Errorf("URL = %s", target.URL)
	}
}

func TestThrowsOnTypeMismatch(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("bbps-get-operators", map[string]any{
		"initiator_id": "9962981729",
		"user_code":    "20810200",
		"category":     "abc",
	})
	wantErr(t, err, "Invalid param types", "category (expected number)")
}

func TestThrowsOnObjectForNumberParam(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("bbps-get-operators", map[string]any{
		"initiator_id": "9962981729",
		"user_code":    "20810200",
		"category":     map[string]any{},
	})
	wantErr(t, err, "Invalid param types", "category (expected number)")
}

func TestRejectsNonFileValueForFileParam(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("activate-aeps-fingpay",
		aepsParams(map[string]any{"pan_card": "/no/such/file.jpg"}))
	wantErr(t, err, "Invalid param types", "pan_card (expected file)")
}

func TestInjectsClientLevelInitiatorIDAndUserCode(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.InitiatorID, c.UserCode = "9962981729", "20810200"
	})
	target := mustResolve(t, client, "dmt-get-sender", map[string]any{
		"customer_id": "9123456789",
	})
	for _, want := range []string{"initiator_id=9962981729", "user_code=20810200"} {
		if !strings.Contains(target.URL, want) {
			t.Errorf("URL %q does not contain %q", target.URL, want)
		}
	}
}

func TestPerCallParamOverridesClientLevelDefault(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.InitiatorID, c.UserCode = "9962981729", "20810200"
	})
	target := mustResolve(t, client, "dmt-get-sender", map[string]any{
		"customer_id":  "9123456789",
		"initiator_id": "1111111111",
	})
	if !strings.Contains(target.URL, "initiator_id=1111111111") {
		t.Errorf("per-call value did not win: %s", target.URL)
	}
	if strings.Contains(target.URL, "initiator_id=9962981729") {
		t.Errorf("client default leaked: %s", target.URL)
	}
	if !strings.Contains(target.URL, "user_code=20810200") {
		t.Errorf("untouched default was dropped: %s", target.URL)
	}
}

func TestExplicitNilPerCallClearsTheDefault(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.InitiatorID, c.UserCode = "9962981729", "20810200"
	})
	_, err := client.ResolveTarget("dmt-get-sender", map[string]any{
		"customer_id":  "9123456789",
		"initiator_id": nil,
	})
	wantErr(t, err, "Missing required params", "initiator_id")
}

func TestMultipartEndpointBuildsJSONEnvelopeWithFiles(t *testing.T) {
	target := mustResolve(t, newTestClient(t), "activate-aeps-fingpay", aepsParams(nil))
	if !strings.Contains(target.URL, "/admin/network/agent/20810200/aeps-fingpay/activate") {
		t.Errorf("URL = %s", target.URL)
	}
	if !target.Multipart {
		t.Fatal("expected a multipart target")
	}
	if !strings.HasPrefix(target.Headers["content-type"], "multipart/form-data;") {
		t.Errorf("content-type = %q", target.Headers["content-type"])
	}
	envelope, files := multipartParts(t, target)
	// Every non-file value rides in ONE form-data JSON field, never a form field
	// of its own; nested objects stay nested rather than being stringified.
	if envelope["modelname"] != "Morpho 1300E3" || envelope["account"] != "38759149196" {
		t.Errorf("envelope = %v", envelope)
	}
	nested, ok := envelope["office_address"].(map[string]any)
	if !ok || nested["city"] != "Patna" {
		t.Errorf("office_address = %v", envelope["office_address"])
	}
	if _, present := envelope["pan_card"]; present {
		t.Error("a file param must not appear in the JSON envelope")
	}
	if _, present := envelope["user_code"]; present {
		t.Error("user_code filled the path and must not be in the envelope")
	}
	for _, field := range []string{"pan_card", "aadhar_front", "aadhar_back"} {
		if files[field] != "eps_test.go" {
			t.Errorf("upload %q filename = %q", field, files[field])
		}
	}
}

func TestAcceptsInMemoryFile(t *testing.T) {
	target := mustResolve(t, newTestClient(t), "activate-aeps-fingpay",
		aepsParams(map[string]any{
			"pan_card": File{Name: "pan.jpg", Content: []byte("\x89PNG-not-really")},
		}))
	_, files := multipartParts(t, target)
	if files["pan_card"] != "pan.jpg" {
		t.Errorf("pan_card filename = %q", files["pan_card"])
	}
	if !strings.Contains(string(target.Body), "PNG-not-really") {
		t.Error("in-memory content missing from the body")
	}
}

func TestMultipartOmitsNilParamsButKeepsNestedNulls(t *testing.T) {
	body, contentType, err := encodeMultipart(map[string]any{
		// A nil param has no form encoding, so it is dropped entirely...
		"extra_note": nil,
		// ...but a null INSIDE a value is real data JSON preserves.
		"office_address": map[string]any{"line": "Shop 5", "state": nil},
		"pan_card":       thisFile,
	}, map[string]bool{"pan_card": true})
	if err != nil {
		t.Fatalf("encodeMultipart: %v", err)
	}
	envelope, _ := multipartParts(t, &Target{
		Body:    body,
		Headers: map[string]string{"content-type": contentType},
	})
	if _, present := envelope["extra_note"]; present {
		t.Error("a nil param must be dropped")
	}
	nested, ok := envelope["office_address"].(map[string]any)
	if !ok {
		t.Fatalf("office_address = %v", envelope["office_address"])
	}
	value, present := nested["state"]
	if !present || value != nil {
		t.Errorf("nested null was not preserved: %v", nested)
	}
}

func TestMultipartFailsWhenTheEnvelopeCannotBeEncoded(t *testing.T) {
	// Without this guard an unencodable value would blank the whole non-file
	// payload and the request would fail far from its cause.
	_, _, err := encodeMultipart(map[string]any{
		"office_address": make(chan int),
	}, map[string]bool{})
	wantErr(t, err, "could not be JSON-encoded")
}

func TestMultipartRejectsAnUnreadableUpload(t *testing.T) {
	missing := filepath.Join(os.TempDir(), "eps-sdk-go-no-such-file")
	_, _, err := encodeMultipart(map[string]any{"pan_card": missing},
		map[string]bool{"pan_card": true})
	wantErr(t, err, "reading upload")
}

// ---- Response and error contract (docs/sdk-golden-vector.md) --------------

// roundTripFunc lets a test stand in for the transport without a live server.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func respondWith(status int, body string) *http.Client {
	return &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: status,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
				Request:    r,
			}, nil
		}),
	}
}

var panParams = map[string]any{
	"initiator_id": "9962981729",
	"pan_number":   "BNZAA2318J",
	"name":         "Rahul Sharma",
	"dob":          "1990-01-01",
}

func TestCallReturnsHTTPErrorOnNon2xx(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.HTTPClient = respondWith(403, `{"status":403,"message":"Forbidden"}`)
	})
	_, err := client.Call(context.Background(), "pan-lite", panParams)
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("Call error = %v, want *HTTPError", err)
	}
	if httpErr.StatusCode != 403 {
		t.Errorf("StatusCode = %d, want 403", httpErr.StatusCode)
	}
	if !strings.Contains(httpErr.URL, "/tools/kyc/pan-lite") {
		t.Errorf("URL = %q, want the pan-lite path", httpErr.URL)
	}
	if httpErr.Body["message"] != "Forbidden" {
		t.Errorf("Body = %v, want the decoded envelope", httpErr.Body)
	}
	if string(httpErr.Raw) != `{"status":403,"message":"Forbidden"}` {
		t.Errorf("Raw = %q, want the raw payload", httpErr.Raw)
	}
}

func TestCallKeepsNilBodyForNonJSONErrorPayload(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.HTTPClient = respondWith(502, "<html>502</html>")
	})
	_, err := client.Call(context.Background(), "pan-lite", panParams)
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("Call error = %v, want *HTTPError", err)
	}
	if httpErr.Body != nil {
		t.Errorf("Body = %v, want nil", httpErr.Body)
	}
	if string(httpErr.Raw) != "<html>502</html>" {
		t.Errorf("Raw = %q, want the raw payload", httpErr.Raw)
	}
}

func TestCallErrorsOnNonJSONSuccessBody(t *testing.T) {
	client := newTestClient(t, func(c *Config) {
		c.HTTPClient = respondWith(200, "not json")
	})
	_, err := client.Call(context.Background(), "pan-lite", panParams)
	wantErr(t, err, "was not valid JSON")
}

func TestDefaultTimeoutIs30s(t *testing.T) {
	client := newTestClient(t)
	if got := client.http.Timeout; got != defaultTimeout {
		t.Errorf("default timeout = %v, want %v", got, defaultTimeout)
	}
}

// ---- Shared fixtures for the suites below (docs/sdk-golden-vector.md) -----

var refRe = regexp.MustCompile(`^[0-9a-z]{15}$`)

// transferParams: dmt-initiate-transfer — POST, financial, client_ref_id required.
var transferParams = map[string]any{
	"initiator_id": "9962981729",
	"customer_id":  "9123456789",
	"recipient_id": "1",
	"amount":       100,
	"otp":          "123456",
	"otp_ref_id":   "ref1",
}

var getParams = map[string]any{"initiator_id": "9962981729"}

// step is one scripted transport outcome: a response, or a transport error.
type step struct {
	status int
	body   string
	err    error
}

func ok() step               { return step{status: 200, body: `{"status":0}`} }
func httpStep(s int) step    { return step{status: s, body: `{"status":1}`} }
func transportFail() step    { return step{err: errors.New("dial tcp: connection refused")} }
func withBody(b string) step { return step{status: 200, body: b} }

// scripted replays steps in order (the last one repeats) and records every
// request with its body already read, so URLs, bodies and headers can be
// asserted after the fact.
type scripted struct {
	steps    []step
	requests []*http.Request
	bodies   []string
}

func (s *scripted) RoundTrip(r *http.Request) (*http.Response, error) {
	s.requests = append(s.requests, r)
	body := ""
	if r.Body != nil {
		b, _ := io.ReadAll(r.Body)
		body = string(b)
	}
	s.bodies = append(s.bodies, body)
	st := s.steps[0]
	if len(s.steps) > 1 {
		s.steps = s.steps[1:]
	}
	if st.err != nil {
		return nil, st.err
	}
	return &http.Response{
		StatusCode: st.status,
		Body:       io.NopCloser(strings.NewReader(st.body)),
		Header:     make(http.Header),
		Request:    r,
	}, nil
}

func (s *scripted) body(t *testing.T, i int) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(s.bodies[i]), &m); err != nil {
		t.Fatalf("body %d is not JSON: %v", i, err)
	}
	return m
}

// fastClient never sleeps between retries.
func fastClient(t *testing.T, tr *scripted, mutate ...func(*Config)) *Client {
	t.Helper()
	all := append([]func(*Config){func(c *Config) { c.HTTPClient = &http.Client{Transport: tr} }}, mutate...)
	client := newTestClient(t, all...)
	client.retryBaseDelay = 0
	return client
}

func mustCall(t *testing.T, c *Client, slug string, params map[string]any) {
	t.Helper()
	if _, err := c.Call(context.Background(), slug, params); err != nil {
		t.Fatalf("Call(%s): %v", slug, err)
	}
}

// ---- client_ref_id ---------------------------------------------------------

func TestGenerateClientRefIDShape(t *testing.T) {
	a, b := GenerateClientRefID(fixedMS), GenerateClientRefID(fixedMS)
	if !refRe.MatchString(a) {
		t.Errorf("ref = %q, want 15 of [0-9a-z]", a)
	}
	if !strings.HasPrefix(a, strconv.FormatInt(fixedMS, 36)) {
		t.Errorf("ref = %q, want the base36 stamp first", a)
	}
	if a == b {
		t.Errorf("two refs in one ms collided: %q", a)
	}
}

func TestClientRefIDGeneratedForNonGet(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	mustCall(t, fastClient(t, tr), "pan-lite", panParams)
	if ref, _ := tr.body(t, 0)["client_ref_id"].(string); !refRe.MatchString(ref) {
		t.Errorf("client_ref_id = %q, want a generated ref", ref)
	}
}

func TestClientRefIDSuppliedValueKept(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	params := map[string]any{"client_ref_id": "MY-REF_1"}
	for k, v := range panParams {
		params[k] = v
	}
	mustCall(t, fastClient(t, tr), "pan-lite", params)
	if got := tr.body(t, 0)["client_ref_id"]; got != "MY-REF_1" {
		t.Errorf("client_ref_id = %v, want the supplied value", got)
	}
}

func TestClientRefIDSatisfiesRequiredParam(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	mustCall(t, fastClient(t, tr), "dmt-initiate-transfer", transferParams)
	if ref, _ := tr.body(t, 0)["client_ref_id"].(string); !refRe.MatchString(ref) {
		t.Errorf("client_ref_id = %q, want a generated ref", ref)
	}
}

func TestClientRefIDNotAddedToGet(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	mustCall(t, fastClient(t, tr), "bbps-get-operators", getParams)
	if u := tr.requests[0].URL.String(); strings.Contains(u, "client_ref_id") {
		t.Errorf("GET url = %q, want no client_ref_id", u)
	}
}

func TestClientRefIDNotAddedWhenEndpointOmitsIt(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	mustCall(t, fastClient(t, tr), "get-refund-otp", map[string]any{"initiator_id": "9962981729", "tid": "1"})
	if _, has := tr.body(t, 0)["client_ref_id"]; has {
		t.Error("client_ref_id was added to an endpoint that omits it")
	}
}

func TestClientRefIDDiffersBetweenCalls(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	client := fastClient(t, tr)
	mustCall(t, client, "pan-lite", panParams)
	mustCall(t, client, "pan-lite", panParams)
	if tr.body(t, 0)["client_ref_id"] == tr.body(t, 1)["client_ref_id"] {
		t.Error("successive calls reused a client_ref_id")
	}
}

func TestEmptyClientRefIDCountsAsSupplied(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	params := map[string]any{"client_ref_id": ""}
	for k, v := range panParams {
		params[k] = v
	}
	_, err := fastClient(t, tr).Call(context.Background(), "pan-lite", params)
	wantErr(t, err, "client_ref_id (expected format client-ref)")
	if len(tr.requests) != 0 {
		t.Errorf("sent %d requests, want 0", len(tr.requests))
	}
}

// ---- retry and status check ------------------------------------------------

func TestGetRetries500ThenSucceedsResigning(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500), ok()}}
	client := fastClient(t, tr)
	clock := fixedMS
	client.now = func() int64 { clock++; return clock }
	got, err := client.Call(context.Background(), "bbps-get-operators", getParams)
	if err != nil || got["status"] != float64(0) {
		t.Fatalf("Call = %v, %v; want the eventual 2xx", got, err)
	}
	if len(tr.requests) != 2 {
		t.Fatalf("sent %d requests, want 2", len(tr.requests))
	}
	ts := func(i int) string { return tr.requests[i].Header.Get("secret-key-timestamp") }
	if ts(0) == ts(1) {
		t.Errorf("retry reused secret-key-timestamp %q", ts(0))
	}
}

func TestGetIndeterminateEveryAttemptThenFails(t *testing.T) {
	for _, failure := range []step{transportFail(), httpStep(429), httpStep(503)} {
		tr := &scripted{steps: []step{failure}}
		if _, err := fastClient(t, tr).Call(context.Background(), "bbps-get-operators", getParams); err == nil {
			t.Fatal("Call succeeded, want the final failure")
		}
		if len(tr.requests) != 3 {
			t.Errorf("%+v: sent %d requests, want 3", failure, len(tr.requests))
		}
	}
}

func TestGetTransportFailureIsATransportError(t *testing.T) {
	tr := &scripted{steps: []step{transportFail()}}
	_, err := fastClient(t, tr).Call(context.Background(), "bbps-get-operators", getParams)
	var te *TransportError
	if !errors.As(err, &te) || !strings.Contains(te.Err.Error(), "connection refused") {
		t.Errorf("err = %v, want *TransportError wrapping the native error", err)
	}
}

func TestGetDoesNotRetry4xx(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(400)}}
	_, err := fastClient(t, tr).Call(context.Background(), "bbps-get-operators", getParams)
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want *HTTPError after 1", err, len(tr.requests))
	}
}

func TestRetriesZeroDisables(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500)}}
	zero := 0
	_, _ = fastClient(t, tr, func(c *Config) { c.Retries = &zero }).Call(context.Background(), "bbps-get-operators", getParams)
	if len(tr.requests) != 1 {
		t.Errorf("sent %d requests, want 1", len(tr.requests))
	}
}

func TestCancelledContextStopsRetrying(t *testing.T) {
	tr := &scripted{steps: []step{transportFail()}}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := fastClient(t, tr).Call(ctx, "bbps-get-operators", getParams)
	if err == nil || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want a failure after exactly 1", err, len(tr.requests))
	}
}

func TestPostNeverRetried(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500)}}
	_, err := fastClient(t, tr).Call(context.Background(), "pan-lite", panParams)
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want *HTTPError after 1", err, len(tr.requests))
	}
}

func TestFinancialPost5xxInquiresAndReturnsIndeterminate(t *testing.T) {
	inquiry := `{"status":0,"data":{"tx_status":"0","tid":"1"}}`
	tr := &scripted{steps: []step{httpStep(502), withBody(inquiry)}}
	_, err := fastClient(t, tr).Call(context.Background(), "dmt-initiate-transfer", transferParams)
	var ind *IndeterminateError
	if !errors.As(err, &ind) {
		t.Fatalf("err = %v, want *IndeterminateError", err)
	}
	ref := tr.body(t, 0)["client_ref_id"].(string)
	if ind.ClientRefID != ref || ind.Slug != "dmt-initiate-transfer" || ind.Status != 502 {
		t.Errorf("IndeterminateError = %+v, want ref %q / slug / 502", ind, ref)
	}
	if ind.StatusCheck["data"].(map[string]any)["tx_status"] != "0" || ind.StatusCheckErr != nil {
		t.Errorf("StatusCheck = %v (err %v), want the inquiry envelope", ind.StatusCheck, ind.StatusCheckErr)
	}
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) || httpErr.StatusCode != 502 {
		t.Errorf("errors.As(*HTTPError) through Unwrap failed: %v", err)
	}
	want := `eps: request for "dmt-initiate-transfer" with client_ref_id "` + ref + `" has no confirmed outcome`
	if err.Error() != want {
		t.Errorf("Error() = %q, want %q", err.Error(), want)
	}
	if len(tr.requests) != 2 {
		t.Fatalf("sent %d requests, want 2", len(tr.requests))
	}
	inq := tr.requests[1]
	if inq.Method != http.MethodGet || !strings.Contains(inq.URL.String(),
		"/tools/reference/transaction/client_ref_id:"+ref+"?initiator_id=9962981729") {
		t.Errorf("inquiry = %s %s, want GET transaction-inquiry by client_ref_id", inq.Method, inq.URL)
	}
}

func TestFinancialPostTransportFailureReusesSuppliedRef(t *testing.T) {
	tr := &scripted{steps: []step{transportFail(), ok()}}
	params := map[string]any{"client_ref_id": "MY-REF"}
	for k, v := range transferParams {
		params[k] = v
	}
	_, err := fastClient(t, tr).Call(context.Background(), "dmt-initiate-transfer", params)
	var ind *IndeterminateError
	if !errors.As(err, &ind) || ind.ClientRefID != "MY-REF" || ind.Status != 0 {
		t.Fatalf("err = %v, want *IndeterminateError for MY-REF with Status 0", err)
	}
	var te *TransportError
	if !errors.As(ind.Err, &te) {
		t.Errorf("Err = %v, want the *TransportError cause", ind.Err)
	}
	if !strings.Contains(tr.requests[1].URL.String(), "client_ref_id:MY-REF") {
		t.Errorf("inquiry url = %s, want the supplied ref", tr.requests[1].URL)
	}
}

func TestFailingInquiryLandsOnStatusCheckErr(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500), httpStep(503)}}
	_, err := fastClient(t, tr).Call(context.Background(), "dmt-initiate-transfer", transferParams)
	var ind *IndeterminateError
	if !errors.As(err, &ind) {
		t.Fatalf("err = %v, want *IndeterminateError", err)
	}
	var checkErr *HTTPError
	if ind.StatusCheck != nil || !errors.As(ind.StatusCheckErr, &checkErr) || checkErr.StatusCode != 503 {
		t.Errorf("StatusCheck = %v / %v, want nil and a 503", ind.StatusCheck, ind.StatusCheckErr)
	}
	if ind.Status != 500 || len(tr.requests) != 1+3 {
		t.Errorf("Status = %d after %d requests, want 500 after 4", ind.Status, len(tr.requests))
	}
}

func TestFinancialPost4xxIsPlainHTTPError(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(403)}}
	_, err := fastClient(t, tr).Call(context.Background(), "dmt-initiate-transfer", transferParams)
	var ind *IndeterminateError
	if errors.As(err, &ind) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want plain *HTTPError after 1", err, len(tr.requests))
	}
}

func TestNonFinancialPost5xxNoInquiry(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500)}}
	_, err := fastClient(t, tr).Call(context.Background(), "pan-lite", panParams)
	var ind *IndeterminateError
	if errors.As(err, &ind) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want plain *HTTPError after 1", err, len(tr.requests))
	}
}

func TestFinancialWithoutRefParamNoInquiry(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500)}}
	_, err := fastClient(t, tr).Call(context.Background(), "initiate-refund",
		map[string]any{"initiator_id": "9962981729", "tid": "1", "otp": "1"})
	var ind *IndeterminateError
	if errors.As(err, &ind) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want plain *HTTPError after 1", err, len(tr.requests))
	}
}

func TestAutoStatusCheckOff(t *testing.T) {
	tr := &scripted{steps: []step{httpStep(500)}}
	off := false
	_, err := fastClient(t, tr, func(c *Config) { c.AutoStatusCheck = &off }).
		Call(context.Background(), "dmt-initiate-transfer", transferParams)
	var ind *IndeterminateError
	if errors.As(err, &ind) || len(tr.requests) != 1 {
		t.Errorf("err = %v after %d requests, want plain *HTTPError after 1", err, len(tr.requests))
	}
}

func TestRejectsBadRetryKnobs(t *testing.T) {
	neg := -1
	if _, err := New(Config{DeveloperKey: "d", AccessKey: accessKey, Environment: "sandbox", Retries: &neg}); err == nil {
		t.Error("New accepted Retries -1")
	}
	if _, err := New(Config{DeveloperKey: "d", AccessKey: accessKey, Environment: "sandbox", RetryBaseDelay: -1}); err == nil {
		t.Error("New accepted a negative RetryBaseDelay")
	}
}

// ---- value validation ------------------------------------------------------

func withPan(over map[string]any) map[string]any {
	params := map[string]any{}
	for k, v := range panParams {
		params[k] = v
	}
	for k, v := range over {
		params[k] = v
	}
	return params
}

func TestRejectsBadFormatAndSendsNothing(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	_, err := fastClient(t, tr).Call(context.Background(), "pan-lite", withPan(map[string]any{"dob": "01-01-1990"}))
	if err == nil || err.Error() != `Invalid param values for "pan-lite": dob (expected format date).` {
		t.Errorf("err = %v", err)
	}
	if len(tr.requests) != 0 {
		t.Errorf("sent %d requests, want 0", len(tr.requests))
	}
}

func TestListsEveryOffenderInSurfaceOrder(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("pan-lite", withPan(map[string]any{"pan_number": "bad", "dob": "1990-1-1"}))
	want := `Invalid param values for "pan-lite": pan_number (expected format pan), dob (expected format date).`
	if err == nil || err.Error() != want {
		t.Errorf("err = %v, want %q", err, want)
	}
}

func TestWholeStringMatchRejectsTrailingNewline(t *testing.T) {
	_, err := newTestClient(t).ResolveTarget("pan-lite", withPan(map[string]any{"dob": "1990-01-01\n"}))
	wantErr(t, err, "dob (expected format date)")
}

func TestUnconstrainedParamPasses(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	mustCall(t, fastClient(t, tr), "pan-lite", withPan(map[string]any{"name": "anything at all \n"}))
}

func TestValueProblemHelper(t *testing.T) {
	formats := map[string]*regexp.Regexp{"date": regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)}
	f := func(v float64) *float64 { return &v }
	n := func(v int) *int { return &v }
	cases := []struct {
		p     Param
		value any
		want  string
	}{
		{Param{Type: "string", Enum: []any{1, 2}}, "1", ""},
		{Param{Type: "string", Enum: []any{1, 2}}, 3, "not one of: 1, 2"},
		{Param{Type: "number", Min: f(1), Max: f(5)}, "1", ""},
		{Param{Type: "number", Min: f(1), Max: f(5)}, 5, ""},
		{Param{Type: "number", Min: f(1)}, 0.5, "below min 1"},
		{Param{Type: "number", Max: f(5)}, "6", "above max 5"},
		{Param{Type: "string", MaxLength: n(3)}, "abc", ""},
		{Param{Type: "string", MaxLength: n(3)}, "é€", "longer than 3 bytes"},
		{Param{Type: "string", Enum: []any{"a"}, Format: "date"}, "b", "not one of: a"},
		{Param{Type: "string", Format: "date", MaxLength: n(1)}, "x", "expected format date"},
		{Param{Type: "object", MaxLength: n(1)}, map[string]any{"a": 1}, ""},
	}
	for _, c := range cases {
		if got := valueProblem(c.p, c.value, formats); got != c.want {
			t.Errorf("valueProblem(%+v, %v) = %q, want %q", c.p, c.value, got, c.want)
		}
	}
}
