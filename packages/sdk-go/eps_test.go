// Cross-language conformance suite for the Go SDK.
//
// Ported case for case from packages/sdk-php/tests/EpsClientTest.php, which is
// itself the executable form of docs/sdk-golden-vector.md. Any divergence here
// is a divergence on the wire.
package eps

import (
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
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
