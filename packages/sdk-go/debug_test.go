// Debug mode conformance: ported from packages/sdk-js/src/debug.test.ts and the
// fixture table in "Debug mode conformance", docs/sdk-golden-vector.md.
package eps

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
)

const debugDev = "abcd1234wxyz"

// debugSecrets must never appear in anything a debug writer receives.
var debugSecrets = []string{
	debugDev,
	golden, // the full secret-key at fixedMS
	"123456789012",
	"9876543210",
	"000111222333",
	"654321",
	"k@x.in",
	"john@example.com",
	"Kumar",
	"KUMAR_123456789012",
}

type debugEvent = map[string]any

// debugClient builds a client with debug writing to a buffer, a fixed clock
// and no backoff sleeps.
func debugClient(t *testing.T, tr http.RoundTripper, mutate ...func(*Config)) (*Client, *bytes.Buffer) {
	t.Helper()
	cfg := Config{
		DeveloperKey: debugDev,
		AccessKey:    accessKey,
		Environment:  "sandbox",
		InitiatorID:  "9962981729",
		HTTPClient:   &http.Client{Transport: tr},
	}
	for _, m := range mutate {
		m(&cfg)
	}
	buf := &bytes.Buffer{}
	client, err := NewWithDebug(cfg, buf)
	if err != nil {
		t.Fatalf("NewWithDebug: %v", err)
	}
	client.now = func() int64 { return fixedMS }
	client.retryBaseDelay = 0
	return client, buf
}

// parseEvents checks every line is one whole JSON object and decodes them.
func parseEvents(t *testing.T, raw string) []debugEvent {
	t.Helper()
	if raw == "" {
		return nil
	}
	if !strings.HasSuffix(raw, "\n") {
		t.Fatalf("output does not end in a newline: %q", raw)
	}
	var events []debugEvent
	for _, line := range strings.Split(strings.TrimSuffix(raw, "\n"), "\n") {
		if !strings.HasPrefix(line, `{"logger":"eps-sdk"`) {
			t.Fatalf("line does not start with the logger key: %.80s", line)
		}
		var e debugEvent
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			t.Fatalf("line is not JSON: %v: %.200s", err, line)
		}
		events = append(events, e)
	}
	return events
}

func ofType(events []debugEvent, event string) []debugEvent {
	var out []debugEvent
	for _, e := range events {
		if e["event"] == event {
			out = append(out, e)
		}
	}
	return out
}

func eventNames(events []debugEvent) []string {
	names := make([]string, len(events))
	for i, e := range events {
		names[i] = fmt.Sprint(e["event"])
	}
	return names
}

func expectNoSecrets(t *testing.T, raw string) {
	t.Helper()
	for _, secret := range debugSecrets {
		if strings.Contains(raw, secret) {
			t.Errorf("debug output leaks %q", secret)
		}
	}
}

func wantEqual(t *testing.T, label string, got, want any) {
	t.Helper()
	g, _ := json.Marshal(got)
	w, _ := json.Marshal(want)
	if string(g) != string(w) {
		t.Errorf("%s = %s, want %s", label, g, w)
	}
}

func okWith(extra string) step {
	return withBody(`{"status":0,"response_status_id":0` + extra + `}`)
}

// captureStderr swaps os.Stderr for a pipe; the returned func restores it and
// yields everything written.
func captureStderr(t *testing.T) func() string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	orig := os.Stderr
	os.Stderr = w
	done := make(chan string)
	go func() {
		b, _ := io.ReadAll(r)
		done <- string(b)
	}()
	restored := false
	restore := func() string {
		if restored {
			return ""
		}
		restored = true
		os.Stderr = orig
		w.Close()
		return <-done
	}
	t.Cleanup(func() { restore() })
	return restore
}

// ---- switch ----------------------------------------------------------------

// TestDebugConfigUnchanged compiles only while Config keeps today's fields in
// today's order: debug mode added no Config field.
func TestDebugConfigUnchanged(t *testing.T) {
	retries, auto := 1, true
	cfg := Config{"dev", accessKey, "sandbox", "9962981729", "20810200", nil, &retries, 0, &auto}
	if _, err := New(cfg); err != nil {
		t.Fatal(err)
	}
}

func plainCall(t *testing.T, debugWriter io.Writer, useWriter bool) {
	t.Helper()
	cfg := Config{
		DeveloperKey: debugDev, AccessKey: accessKey, Environment: "sandbox", InitiatorID: "9962981729",
		HTTPClient: respondWith(200, `{"status":0}`),
	}
	cfg.HTTPClient.Timeout = defaultTimeout
	var client *Client
	var err error
	if useWriter {
		client, err = NewWithDebug(cfg, debugWriter)
	} else {
		client, err = New(cfg)
	}
	if err != nil {
		t.Fatal(err)
	}
	client.now = func() int64 { return fixedMS }
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
}

func TestDebugOffByDefault(t *testing.T) {
	t.Setenv("EPS_SDK_DEBUG", "")
	os.Unsetenv("EPS_SDK_DEBUG")
	restore := captureStderr(t)
	plainCall(t, nil, false)
	if out := restore(); out != "" {
		t.Errorf("stderr = %q, want nothing", out)
	}
}

func TestDebugEnvWritesJSONLinesToStderr(t *testing.T) {
	t.Setenv("EPS_SDK_DEBUG", " TRUE ")
	restore := captureStderr(t)
	plainCall(t, nil, false)
	out := restore()
	events := parseEvents(t, out)
	wantEqual(t, "events", eventNames(events), []string{"init", "request", "response"})
	init := events[0]
	for key, want := range map[string]any{
		"source": "env", "developer_key": "****wxyz", "env": "sandbox", "sdk": "go",
		"timeout_ms": float64(30000), "retries": float64(2), "auto_status_check": true,
		"base_url": "https://staging.eko.in/ekoapi/v3",
	} {
		if init[key] != want {
			t.Errorf("init.%s = %v, want %v", key, init[key], want)
		}
	}
	if v, _ := init["sdk_version"].(string); v == "" {
		t.Errorf("sdk_version = %v, want a version or \"unknown\"", init["sdk_version"])
	}
	if r, _ := init["runtime"].(string); !strings.HasPrefix(r, "go") {
		t.Errorf("runtime = %v", init["runtime"])
	}
	expectNoSecrets(t, out)
}

func TestDebugDiscardBeatsEnv(t *testing.T) {
	t.Setenv("EPS_SDK_DEBUG", "1")
	restore := captureStderr(t)
	plainCall(t, io.Discard, true)
	if out := restore(); out != "" {
		t.Errorf("stderr = %q, want nothing", out)
	}
}

func TestDebugWriterOptionBeatsEnvOff(t *testing.T) {
	t.Setenv("EPS_SDK_DEBUG", "0")
	client, buf := debugClient(t, &scripted{steps: []step{ok()}})
	_ = client
	if init := parseEvents(t, buf.String())[0]; init["source"] != "option" {
		t.Errorf("init.source = %v, want option", init["source"])
	}
}

// ---- events ----------------------------------------------------------------

func TestDebugGetURLHeadersAndKeyOrder(t *testing.T) {
	client, buf := debugClient(t, &scripted{steps: []step{okWith("")}})
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	out := buf.String()
	events := parseEvents(t, out)
	wantEqual(t, "events", eventNames(events), []string{"init", "request", "response"})

	// Top-level key order, read from the raw line.
	line := strings.Split(out, "\n")[1]
	dec := json.NewDecoder(strings.NewReader(line))
	dec.Token() // {
	var keys []string
	for len(keys) < 9 {
		key, _ := dec.Token()
		keys = append(keys, key.(string))
		var skip json.RawMessage
		_ = dec.Decode(&skip)
	}
	wantEqual(t, "key order", keys, []string{"logger", "ts", "event", "sdk", "sdk_version", "surface", "env", "call_id", "slug"})

	request, response := events[1], events[2]
	if !regexp.MustCompile(`^[0-9a-f]{8}$`).MatchString(fmt.Sprint(request["call_id"])) || response["call_id"] != request["call_id"] {
		t.Errorf("call_id = %v / %v", request["call_id"], response["call_id"])
	}
	if !regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`).MatchString(fmt.Sprint(request["ts"])) {
		t.Errorf("ts = %v", request["ts"])
	}
	if want := "https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210/operator?initiator_id=****1729"; request["url"] != want {
		t.Errorf("url = %v, want %s", request["url"], want)
	}
	wantEqual(t, "headers", request["headers"], map[string]string{
		"developer_key":        "****wxyz",
		"secret-key":           "****",
		"secret-key-timestamp": "1700000000000",
		"content-type":         "application/json",
	})
	if request["body"] != nil || request["method"] != "GET" || request["attempt"] != float64(1) {
		t.Errorf("request = %v", request)
	}
	wantEqual(t, "response body", response["body"], map[string]any{"status": 0, "response_status_id": 0})
	if _, isNum := response["ms"].(float64); !isNum || response["status"] != float64(200) {
		t.Errorf("response = %v", response)
	}
	expectNoSecrets(t, out)
}

func TestDebugMasksJSONBodyAndResponseByKeyClass(t *testing.T) {
	photo := strings.Repeat("A", 5000)
	response := `,"message":"sent to k@x.in, ref 9876543210","data":{"tid":"2611230001","name":"Kumar","email":"k@x.in",` +
		`"dob":"1990-01-01","photo":"` + photo + `","reference_id":"123456789012","john@example.com":"x","123456789012":"y"},` +
		`"otp_code":{"reference_id":"r1"},"foo":[{"tid":"t1"}]`
	client, buf := debugClient(t, &scripted{steps: []step{okWith(response)}})
	mustCall(t, client, "pan-lite", map[string]any{
		"pan_number": "ABCDE1234F",
		"name":       "Kumar",
		"dob":        "1990-01-01",
		"AADHAR":     "123456789012",
		"otp_code":   "654321",
		"otp":        "7777", // 4 chars: asserted by field, not by the byte scan
		"foo_bar":    "x",
		"entries": []any{map[string]any{
			"reference_id": "r1", "bank_account": "000111222333", "ifsc": "SBIN0000001",
		}},
	})
	out := buf.String()
	events := parseEvents(t, out)
	body := ofType(events, "request")[0]["body"].(map[string]any)
	for key, want := range map[string]any{
		"pan_number": "****234F", "name": "****", "dob": "****", "AADHAR": "****9012",
		"otp_code": "****", "otp": "****", "foo_bar": "****", "initiator_id": "****1729",
	} {
		if body[key] != want {
			t.Errorf("request body.%s = %v, want %v", key, body[key], want)
		}
	}
	wantEqual(t, "entries", body["entries"], []any{map[string]any{
		"reference_id": "r1", "bank_account": "****2333", "ifsc": "SBIN0000001",
	}})
	if !refRe.MatchString(fmt.Sprint(body["client_ref_id"])) {
		t.Errorf("client_ref_id = %v, want the generated ref raw", body["client_ref_id"])
	}
	resp := ofType(events, "response")[0]["body"].(map[string]any)
	if resp["message"] != "sent to ****@****, ref ****3210" {
		t.Errorf("message = %v", resp["message"])
	}
	wantEqual(t, "data", resp["data"], map[string]any{
		"tid": "2611230001", "name": "****", "email": "****", "dob": "****", "photo": "****",
		"reference_id": "****", // a request secret echoed under a safe key
		"#1":           "****", "#2": "****",
	})
	if resp["otp_code"] != "****" || resp["foo"] != "****" {
		t.Errorf("otp_code / foo = %v / %v", resp["otp_code"], resp["foo"])
	}
	expectNoSecrets(t, out)
}

func TestDebugMasksBadClientRefInURLAndEcho(t *testing.T) {
	client, buf := debugClient(t, &scripted{steps: []step{okWith(`,"data":{"client_ref_id":"KUMAR 123456789012"}`)}})
	mustCall(t, client, "bbps-fetch-bill", map[string]any{
		"phone_operator_code":    "1",
		"utility_acc_no":         "000111222333",
		"confirmation_mobile_no": "9876543210",
		"sender_name":            "Kumar",
		"category":               1,
		"client_ref_id":          "KUMAR 123456789012",
		"source_ip":              "10.0.0.1",
	})
	out := buf.String()
	events := parseEvents(t, out)
	u := fmt.Sprint(ofType(events, "request")[0]["url"])
	for _, want := range []string{"client_ref_id=****&", "utility_acc_no=****2333", "phone_operator_code=1", "category=1"} {
		if !strings.Contains(u, want) {
			t.Errorf("url %s does not contain %s", u, want)
		}
	}
	data := ofType(events, "response")[0]["body"].(map[string]any)["data"].(map[string]any)
	if data["client_ref_id"] != "****" {
		t.Errorf("echoed client_ref_id = %v", data["client_ref_id"])
	}
	expectNoSecrets(t, out)
}

func TestDebugScrubsAndCapsNonJSONErrorPage(t *testing.T) {
	page := "<html><title>502 Bad Gateway</title>" + strings.Repeat("x", 600) + " 123456789012 " +
		encodeURIComponent("Kumar Abhi") + " " + debugDev + "</html>"
	echoFirst := "<html>123456789012 Kumar%20Abhi " + debugDev + "</html>"
	client, buf := debugClient(t, &scripted{steps: []step{{status: 502, body: echoFirst + page}}})
	_, err := client.Call(context.Background(), "pan-lite", map[string]any{
		"pan_number": "ABCDE1234F", "name": "Kumar Abhi", "dob": "1990-01-01", "AADHAR": "123456789012",
	})
	var httpErr *HTTPError
	if !errors.As(err, &httpErr) || httpErr.StatusCode != 502 {
		t.Fatalf("err = %v, want HTTP 502", err)
	}
	out := buf.String()
	events := parseEvents(t, out)
	response := ofType(events, "response")[0]
	body := fmt.Sprint(response["body"])
	if response["status"] != float64(502) || !strings.HasPrefix(body, "<html>****9012 **** ****</html>") {
		t.Errorf("response = %v", response)
	}
	capRe := regexp.MustCompile(`…\(\+\d+ chars\)$`)
	if !capRe.MatchString(body) || len([]rune(capRe.ReplaceAllString(body, ""))) != 512 {
		t.Errorf("body not capped at 512 code points: %q", body)
	}
	if !strings.Contains(out, "<html>") {
		t.Error("HTML was escaped; want it readable")
	}
	if e := ofType(events, "error")[0]; e["error"] != "HTTPError" {
		t.Errorf("error = %v, want HTTPError", e["error"])
	}
	expectNoSecrets(t, out)
}

func TestDebugMultipartFieldsAndFileMetadata(t *testing.T) {
	panPath := filepath.Join(t.TempDir(), "KUMAR_123456789012.JPG")
	if err := os.WriteFile(panPath, []byte("12345"), 0o600); err != nil {
		t.Fatal(err)
	}
	client, buf := debugClient(t, &scripted{steps: []step{ok()}})
	mustCall(t, client, "activate-aeps-fingpay", map[string]any{
		"user_code":            "20810200",
		"modelname":            "MANTRA",
		"devicenumber":         "D1",
		"account":              "000111222333",
		"ifsc":                 "SBIN0000001",
		"shop_type":            "1",
		"office_address":       map[string]any{"line": "Kumar House"},
		"address_as_per_proof": map[string]any{"line": "Kumar House"},
		"aadhar":               "123456789012",
		"pan_card":             panPath,
		"aadhar_front":         File{Name: "front.PNG", Content: []byte("abc")},
		"aadhar_back":          &File{Name: "back", Content: []byte("abcd")},
		"latlong":              "28.6,77.2",
	})
	out := buf.String()
	request := ofType(parseEvents(t, out), "request")[0]
	if !strings.Contains(fmt.Sprint(request["url"]), "/admin/network/agent/20810200/aeps-fingpay/activate") {
		t.Errorf("url = %v", request["url"])
	}
	body := request["body"].(map[string]any)
	fields := body["fields"].(map[string]any)
	for key, want := range map[string]any{
		"account": "****2333", "aadhar": "****9012", "modelname": "MANTRA", "office_address": "****", "latlong": "****",
	} {
		if fields[key] != want {
			t.Errorf("fields.%s = %v, want %v", key, fields[key], want)
		}
	}
	// encodeMultipart walks params in sorted order: aadhar_back, aadhar_front, pan_card.
	wantEqual(t, "files", body["files"], []any{
		map[string]any{"param": "aadhar_back", "ext": nil, "bytes": 4},
		map[string]any{"param": "aadhar_front", "ext": "png", "bytes": 3},
		map[string]any{"param": "pan_card", "ext": "jpg", "bytes": 5},
	})
	expectNoSecrets(t, out)
}

func TestDebugPreSendFailureIsOneErrorEvent(t *testing.T) {
	tr := &scripted{steps: []step{ok()}}
	client, buf := debugClient(t, tr)
	if _, err := client.Call(context.Background(), "no-such-slug", nil); err == nil {
		t.Fatal("want an unknown-slug error")
	}
	if _, err := client.Call(context.Background(), "pan-lite", map[string]any{"name": "Kumar"}); err == nil {
		t.Fatal("want a missing-param error")
	}
	out := buf.String()
	events := parseEvents(t, out)
	wantEqual(t, "events", eventNames(events), []string{"init", "error", "error"})
	if events[1]["error"] != "error" || events[1]["slug"] != "no-such-slug" {
		t.Errorf("error event = %v", events[1])
	}
	if !strings.Contains(fmt.Sprint(events[1]["message"]), "Unknown endpoint slug") {
		t.Errorf("message = %v", events[1]["message"])
	}
	if len(tr.requests) != 0 {
		t.Errorf("sent %d requests, want 0", len(tr.requests))
	}
	expectNoSecrets(t, out)
}

func TestDebugTransportFailureThenError(t *testing.T) {
	zero := 0
	tr := &scripted{steps: []step{{err: errors.New("fetch failed for " + debugDev + " 9876543210")}}}
	client, buf := debugClient(t, tr, func(c *Config) { c.Retries = &zero })
	_, err := client.Call(context.Background(), "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	var te *TransportError
	if !errors.As(err, &te) {
		t.Fatalf("err = %v, want *TransportError", err)
	}
	out := buf.String()
	events := parseEvents(t, out)
	wantEqual(t, "events", eventNames(events), []string{"init", "request", "transport_error", "error"})
	te0 := events[2]
	if te0["attempt"] != float64(1) || te0["error"] != "error" || te0["message"] != "fetch failed for **** ****3210" {
		t.Errorf("transport_error = %v", te0)
	}
	if _, isNum := te0["ms"].(float64); !isNum {
		t.Errorf("transport_error.ms = %v", te0["ms"])
	}
	if _, has := te0["status"]; has {
		t.Error("transport_error with no response must not carry status")
	}
	if events[3]["error"] != "TransportError" {
		t.Errorf("error = %v", events[3]["error"])
	}
	expectNoSecrets(t, out)
}

// failingBody errors mid-read, after the status arrived.
type failingBody struct{}

func (failingBody) Read([]byte) (int, error) { return 0, errors.New("connection reset") }
func (failingBody) Close() error             { return nil }

func TestDebugBodyReadFailureCarriesStatus(t *testing.T) {
	zero := 0
	tr := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: failingBody{}, Header: make(http.Header), Request: r}, nil
	})
	client, buf := debugClient(t, tr, func(c *Config) { c.Retries = &zero })
	if _, err := client.Call(context.Background(), "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"}); err == nil {
		t.Fatal("want an error")
	}
	events := parseEvents(t, buf.String())
	wantEqual(t, "events", eventNames(events), []string{"init", "request", "transport_error", "error"})
	if events[2]["status"] != float64(200) || events[2]["message"] != "connection reset" {
		t.Errorf("transport_error = %v", events[2])
	}
}

func TestDebugRetryLogsEachAttemptAndDelay(t *testing.T) {
	one := 1
	client, buf := debugClient(t, &scripted{steps: []step{{status: 503, body: "busy"}, ok()}},
		func(c *Config) { c.Retries = &one })
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	events := parseEvents(t, buf.String())
	var got []string
	for _, e := range events {
		got = append(got, fmt.Sprint(e["event"], e["attempt"]))
	}
	wantEqual(t, "events", got, []string{"init<nil>", "request1", "response1", "retry1", "request2", "response2"})
	if ofType(events, "retry")[0]["delay_ms"] != float64(0) {
		t.Errorf("delay_ms = %v", ofType(events, "retry")[0]["delay_ms"])
	}
	if ofType(events, "response")[0]["body"] != "busy" {
		t.Errorf("non-JSON body = %v", ofType(events, "response")[0]["body"])
	}
}

var debugTransfer = map[string]any{
	"recipient_id":  1,
	"amount":        100,
	"customer_id":   "9876543210",
	"otp":           "4321",
	"otp_ref_id":    "ref1",
	"client_ref_id": "ref123",
}

func TestDebugInquiryUnderItsOwnCallID(t *testing.T) {
	client, buf := debugClient(t, &scripted{steps: []step{{status: 503, body: "busy"}, okWith(`,"data":{"tx_status":0}`)}})
	_, err := client.Call(context.Background(), "dmt-initiate-transfer", debugTransfer)
	var ind *IndeterminateError
	if !errors.As(err, &ind) {
		t.Fatalf("err = %v, want *IndeterminateError", err)
	}
	events := parseEvents(t, buf.String())
	var slugs []string
	for _, e := range ofType(events, "request") {
		slugs = append(slugs, fmt.Sprint(e["slug"]))
	}
	wantEqual(t, "request slugs", slugs, []string{"dmt-initiate-transfer", "transaction-inquiry"})
	body := ofType(events, "request")[0]["body"].(map[string]any)
	if body["amount"] != float64(100) || body["otp"] != "****" || body["customer_id"] != "****3210" {
		t.Errorf("transfer body = %v (amount must stay a number)", body)
	}
	errs := ofType(events, "error")
	last := errs[len(errs)-1]
	if last["error"] != "IndeterminateError" || last["client_ref_id"] != "ref123" {
		t.Errorf("error = %v", last)
	}
	ids := map[any]bool{}
	for _, e := range events {
		if id, has := e["call_id"]; has {
			ids[id] = true
		}
	}
	if len(ids) != 2 {
		t.Errorf("call ids = %v, want 2", ids)
	}
}

func TestDebugBoundsDeepAndHugeBodies(t *testing.T) {
	deep := `"leaf"`
	for i := 0; i < 12; i++ {
		deep = `{"data":` + deep + `}`
	}
	client, buf := debugClient(t, &scripted{steps: []step{withBody(`{"status":0,"data":` + deep + `}`)}})
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	body, _ := json.Marshal(ofType(parseEvents(t, buf.String()), "response")[0]["body"])
	if !strings.Contains(string(body), `"****"`) || strings.Contains(string(body), "leaf") {
		t.Errorf("deep body = %s", body)
	}

	var items []string
	for i := 0; i < 3000; i++ {
		items = append(items, fmt.Sprintf(`{"tid":"%-050s"}`, fmt.Sprintf("t%d", i)))
	}
	client, buf = debugClient(t, &scripted{steps: []step{withBody(`{"status":0,"data":[` + strings.Join(items, ",") + `]}`)}})
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	if got := fmt.Sprint(ofType(parseEvents(t, buf.String()), "response")[0]["body"]); !regexp.MustCompile(`^\[\d+ bytes omitted\]$`).MatchString(got) {
		t.Errorf("huge body = %.100s", got)
	}
}

// ---- isolation -------------------------------------------------------------

type panicWriter struct{}

func (panicWriter) Write([]byte) (int, error) { panic("sink exploded") }

type errWriter struct{}

func (errWriter) Write([]byte) (int, error) { return 0, errors.New("sink exploded") }

func TestDebugWriterFailureLeavesOutcomeUnchanged(t *testing.T) {
	scenarios := []struct {
		name   string
		steps  func() []step
		slug   string
		params map[string]any
	}{
		{"a validation failure", func() []step { return []step{ok()} }, "pan-lite", map[string]any{"name": "x"}},
		{"a successful financial call", func() []step { return []step{okWith(`,"data":{"tid":"1"}`)} }, "dmt-initiate-transfer", debugTransfer},
		{"an indeterminate financial call", func() []step {
			return []step{{status: 503, body: "busy"}, okWith(`,"data":{"tx_status":0}`)}
		}, "dmt-initiate-transfer", debugTransfer},
	}
	outcome := func(w io.Writer, steps []step, slug string, params map[string]any) string {
		tr := &scripted{steps: steps}
		client, err := NewWithDebug(Config{
			DeveloperKey: debugDev, AccessKey: accessKey, Environment: "sandbox", InitiatorID: "9962981729",
			HTTPClient: &http.Client{Transport: tr},
		}, w)
		if err != nil {
			t.Fatal(err)
		}
		client.now = func() int64 { return fixedMS }
		client.retryBaseDelay = 0
		result, err := client.Call(context.Background(), slug, params)
		var ind *IndeterminateError
		check := ""
		if errors.As(err, &ind) {
			check = fmt.Sprint(ind.StatusCheck, ind.StatusCheckErr, ind.Status)
		}
		return fmt.Sprintf("%v | %v | %T | %s | %d requests", result, err, err, check, len(tr.requests))
	}
	for _, s := range scenarios {
		off := outcome(io.Discard, s.steps(), s.slug, s.params)
		for _, w := range []io.Writer{panicWriter{}, errWriter{}} {
			if on := outcome(w, s.steps(), s.slug, s.params); on != off {
				t.Errorf("%s with %T: %s, want %s", s.name, w, on, off)
			}
		}
	}
}

func TestDebugConcurrentClientsShareAWriterWithWholeLines(t *testing.T) {
	buf := &bytes.Buffer{} // not goroutine-safe by itself: the package mutex must be
	var clients []*Client
	for i := 0; i < 2; i++ {
		client, err := NewWithDebug(Config{
			DeveloperKey: debugDev, AccessKey: accessKey, Environment: "sandbox", InitiatorID: "9962981729",
			HTTPClient: respondWith(200, `{"status":0,"data":{"message":"`+strings.Repeat("y", 4000)+`"}}`),
		}, buf)
		if err != nil {
			t.Fatal(err)
		}
		clients = append(clients, client)
	}
	var wg sync.WaitGroup
	for _, client := range clients {
		for j := 0; j < 20; j++ {
			wg.Add(1)
			go func(c *Client) {
				defer wg.Done()
				_, _ = c.Call(context.Background(), "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
			}(client)
		}
	}
	wg.Wait()
	events := parseEvents(t, buf.String())
	if want := 2 + 2*20*2; len(events) != want {
		t.Errorf("got %d whole events, want %d", len(events), want)
	}
}

// ---- masker URL alignment ---------------------------------------------------

func TestDebugMaskerURLAlignment(t *testing.T) {
	m := newMasker(redactLists{Safe: []string{"tid", "user_code"}, Last4: []string{"customer_id"}}, nil)
	base := "https://h/v3"
	mask := func(u string) string { return m.url(u, base, "/x/{customer_id}/y", nil, &[]string{}) }
	cases := []struct{ name, in, want string }{
		{"path params and query values by class", base + "/x/9876543210/y?tid=1&k%40x=2", base + "/x/****3210/y?tid=1&#1=****"},
		{"an encoded slash inside its segment", base + "/x/98765%2F43210/y", base + "/x/****3210/y"},
		{"a safe query value that is not safe-shaped", base + "/x/1/y?tid=KUMAR%20123456789012", base + "/x/****/y?tid=****"},
		{"another base", "https://evil/v3/x/1/y", debugUnavailable},
		{"a different literal segment", base + "/z/1/y", debugUnavailable},
		{"an extra segment", base + "/x/1/y/z", debugUnavailable},
		{"a malformed escape", base + "/x/%E0%A4%A/y", debugUnavailable},
		{"invalid UTF-8 after decoding", base + "/x/%E0%A4/y", debugUnavailable},
	}
	for _, c := range cases {
		if got := mask(c.in); got != c.want {
			t.Errorf("%s: %s, want %s", c.name, got, c.want)
		}
	}
}

func TestDebugTextScrubsEveryEncodedFormOfAKnownValue(t *testing.T) {
	m := newMasker(redactLists{}, nil)
	known := []string{"Kumar Abhi/x"}
	in := "a Kumar Abhi/x b " + encodeURIComponent(known[0]) + " c " + url.QueryEscape(known[0]) + " d " + url.PathEscape(known[0])
	if got := m.text(in, 1024, known); got != "a **** b **** c **** d ****" {
		t.Errorf("text = %q", got)
	}
	if got := encodeURIComponent("a b/é!*'()~"); got != "a%20b%2F%C3%A9!*'()~" {
		t.Errorf("encodeURIComponent = %q", got)
	}
}

func TestDebugEmptyDeveloperKeyIsNeverAKnownValue(t *testing.T) {
	client, buf := debugClient(t, &scripted{steps: []step{okWith(`,"data":{"tid":"2611230001"}`)}},
		func(c *Config) { c.DeveloperKey = "" })
	mustCall(t, client, "bbps-operator-code-circle", map[string]any{"customer_mobile": "9876543210"})
	data := ofType(parseEvents(t, buf.String()), "response")[0]["body"].(map[string]any)["data"].(map[string]any)
	if data["tid"] != "2611230001" {
		t.Errorf("tid = %v, want it raw (an empty key must not mask every safe value)", data["tid"])
	}
	if got := newMasker(redactLists{}, nil).text("abc", 10, []string{""}); got != "abc" {
		t.Errorf("text with an empty known value = %q", got)
	}
}
