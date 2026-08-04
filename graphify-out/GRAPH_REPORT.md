# Graph Report - eko-eps-website  (2026-08-03)

## Corpus Check
- 681 files · ~824,929 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4033 nodes · 9397 edges · 207 communities (182 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 212 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `407c4d1c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api-specs-common.ts
- eps-context-mcp/src/bundle-types.ts
- SignupWizard.tsx
- PricingPage.tsx
- eko-signing.ts
- render-recipe.ts
- eko.ts
- buildApp.ts
- code-samples.ts
- app.ts
- xlsx/shared.ts
- auth/client.ts
- payments-pricing.ts
- render-doc.ts
- docs-registry.ts
- console/dashboard.ts
- KycUploadDialog.tsx
- dialog.tsx
- eps-transact-mcp/package.json
- api-spec-previews.ts
- eps-backend/package.json
- pdf-client.ts
- config.ts
- PricingCalculator.tsx
- ProductPageLayout.tsx
- eps-context-mcp/package.json
- cn
- ConsoleLayout.tsx
- DialogHost.tsx
- HarnessIcon.tsx
- HeaderDropdownPanels.tsx
- http/connect.ts
- App.tsx
- api-pricing.ts
- Transactions.tsx
- github.ts
- AuthProvider.tsx
- build-openapi.ts
- sdk-js/package.json
- eps-mock-server/package.json
- AppServer.tsx
- search-index.ts
- pdf-ops.test.ts
- Credentials.tsx
- EndpointDetail.tsx
- ConnectedBankingCalculator.tsx
- EkoClient
- dashboardView.ts
- eps-transact-mcp/src/http.ts
- GrievancePage.tsx
- render-products-index.ts
- PaymentsCalculator.tsx
- buildFiles (vite-plugin-generate-agent-bundle emitter)
- API technical specification layer (api-specs.ts)
- prerender.ts
- FileUpload.tsx
- Pingo Mascot
- Business Dashboard (/console)
- http/dashboard.test.ts
- ImageEditorDialog.tsx
- api-product-pages.ts
- Static page generation pipeline (ssg/)
- EpsClientTest
- MarkdownProse.tsx
- industries.ts
- Profile.tsx
- TestDialogs.tsx
- QuoteSummary.tsx
- docs-registry.ts (guides + endpoints unifier)
- eps-transact-mcp/src/bundle-types.ts
- RaiseIssueDialog.tsx
- tools.ts
- EarningsProductRow.tsx
- stdio.ts
- tryit-client.ts
- EndpointDetail (centre pane)
- Self-serve signup wizard (/signup)
- poll.sh
- KV
- zoho-chat.ts
- Eko EPS Partner Ecosystem
- tryit-client.ts (client-only Scalar modal singleton)
- compilerOptions
- src/client.ts
- wallet-balance.ts
- RdServiceTester.tsx
- button.tsx
- EPS transactional MCP server
- auto-release.mjs
- SignAgreementStep.tsx
- useConsoleMe
- resolveSteps.ts
- compilerOptions
- ErrorBoundary.tsx
- EarningsSummary.tsx
- ConnectClient
- composer.json
- BusinessStep.test.tsx
- Eko Payment Services (EPS) API Platform
- @ekoindia/eps-backend BFF
- PinStep.tsx
- Agent packages release runbook
- API sample-response reconciliation (before/after review)
- compilerOptions
- eps-mock-server/src/server.ts
- compilerOptions
- compilerOptions
- build-install-matrix.ts
- pdf-render.ts
- BusinessStep.tsx
- @ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools)
- SignupService step orchestration
- EPS secret-key HMAC signing scheme
- @ekoindia/eps-transact-mcp (transactional MCP server)
- Aadhaar (India Biometric ID)
- extract-body.ts
- build-postman.ts
- Pull-based auto-deploy poller
- reload-on-chunk-error.ts
- Aadhaar Biometric Authentication with RDService
- SecretKeyTester.test.tsx
- Eko Platform Services (EPS) Brand
- Interaction 154 — transaction history upstream
- `onboarding === 1` classification gate in getProfile
- eps-context-mcp/vercel.json
- label.tsx
- EPS agent plugin (eps)
- Auto-deploy poller (poll.sh sidecar)
- poll_test.sh
- eko.test.ts
- eps-transact-mcp/src/load-bundle.ts
- eps-transact-mcp/src/update-check.ts
- ScrollToTop.tsx
- IntersectionObserverStub
- Industry detail page template
- POST /chat/ask route
- eps-backend/vercel.json
- parity.copied-utils.test.ts
- Money Transfer API
- Financial transaction status codes (tx_status)
- Stale-chunk auto-reload
- KYC_DOC_CONFIG — per-doc_type local overrides
- eps-backend Production VM Deploy Runbook
- plugin-marketplace.test.ts
- eko vs connect auth provider seam
- eps-context-mcp http.ts stateless Hono transport
- bundle-types.parity.test.ts
- AnimatedRoutes.tsx
- Interaction 522 USER_ONBOARDING_BUSINESS
- Eko EPS Website UI/UX improvement plan
- _pop.sh
- deploy-artifacts.test.ts
- eps-context-mcp/scripts/bake-bundle.mjs
- bake-fixtures.mjs
- eps-transact-mcp/scripts/bake-bundle.mjs
- sdk-js/scripts/bake-surface.mjs
- sdk-php/scripts/bake-surface.mjs
- No-fabrication authoring rule (blocked: source incomplete)
- eps
- Airtel Payments Bank
- PidOptions XML configuration
- plugin.ts
- In-memory abuse throttling
- vercel-config.test.ts
- Agent telemetry gap
- resolveSteps() + SIGNUP_STEPS registry
- run.sh
- curl
- docker
- flock
- redis-cli
- skopeo
- sleep
- sync
- First-party session cookies via backend subdomain
- eps-transact-mcp/vitest.config.ts
- mdx.d.ts
- vite-env.d.ts
- vite-imagetools.d.ts
- Phase 4 — AePS fund settlement
- Phase 5 — transaction lifecycle & refunds
- Spec data provenance caveat
- UAT/Production environment toggle

## God Nodes (most connected - your core abstractions)
1. `cn()` - 147 edges
2. `Button` - 47 edges
3. `SITE_URL` - 40 edges
4. `docsHref()` - 34 edges
5. `openZohoChat()` - 34 edges
6. `FadeIn()` - 33 edges
7. `ApiSpec` - 29 edges
8. `productHref()` - 28 edges
9. `Footer()` - 26 edges
10. `EkoClient` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Recipe branching on response_type_id / status` --semantically_similar_to--> `Eko client onboarding interactions (521/523/170/10005/5)`  [INFERRED] [semantically similar]
  packages/claude-plugin-eps/skills/run-a-recipe/SKILL.md → docs/superpowers/plans/2026-07-15-user-onboarding.md
- `POST /chat/ask route` --semantically_similar_to--> `integrate-eps skill`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-07-02-eps-backend-docs-chat-agent-design.md → packages/claude-plugin-eps/skills/integrate-eps/SKILL.md
- `Language tabs on API input/output preview (P2)` --semantically_similar_to--> `EPS secret-key HMAC-SHA256 convention`  [INFERRED] [semantically similar]
  docs/ui-ux-improvement-plan.md → packages/claude-plugin-eps/skills/sign-request/SKILL.md
- `computeSecretKey (Web Crypto HMAC-SHA256)` --semantically_similar_to--> `Backend-only HMAC-SHA256 request signing`  [INFERRED] [semantically similar]
  docs/developer-docs/try-it-now.md → README.md
- `onboarding===1 checked before the user_type gate` --semantically_similar_to--> `EPS business-partner gate stays in this service`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-07-15-user-onboarding-design.md → packages/eps-backend/README.md

## Import Cycles
- 3-file cycle: `src/components/FileUpload.tsx -> src/components/connect/DialogHost.tsx -> src/components/connect/RaiseIssueDialog.tsx -> src/components/FileUpload.tsx`
- 3-file cycle: `src/components/ProductPageLayout.tsx -> src/lib/data/solutions.ts -> src/lib/data/api-product-pages.ts -> src/components/ProductPageLayout.tsx`
- 4-file cycle: `src/components/ProductPageLayout.tsx -> src/components/SolutionCard.tsx -> src/lib/data/solutions.ts -> src/lib/data/api-product-pages.ts -> src/components/ProductPageLayout.tsx`

## Hyperedges (group relationships)
- **Agent bundle fan-out: one builder, many artifacts** — docs_ai_agent_platform_buildagentbundle, docs_ai_agent_platform_eps_json_bundle, docs_ai_agent_platform_buildsdksurface, docs_ai_agent_platform_buildfixtures, docs_ai_agent_platform_buildinstallmatrix, docs_ai_agent_platform_buildcontextpackbody, docs_ai_agent_platform_buildpostmancollection [EXTRACTED 1.00]
- **Read-time recomposition of a full ApiSpec view** — docs_api_specs_apispec, docs_developer_docs_single_source_of_truth_resolveheaders, docs_developer_docs_single_source_of_truth_resolverequestparams, docs_developer_docs_single_source_of_truth_buildsamplerequest, docs_developer_docs_single_source_of_truth_resolveresponsefields, docs_developer_docs_code_samples_resolveendpointurl [EXTRACTED 1.00]
- **Browser try-it signing flow (access_key never leaves the page)** — docs_developer_docs_api_documentation_codesamples, docs_developer_docs_try_it_now_tryit_client, docs_developer_docs_try_it_now_interactive_openapi, docs_developer_docs_try_it_now_ekosigningplugin, docs_developer_docs_try_it_now_computesecretkey, docs_developer_docs_try_it_now_cors_proxy [EXTRACTED 1.00]
- **KYC document upload flow (entitlement → list → parse → dialog → upload)** — docs_features_kyc_documents_kycenabled, docs_features_kyc_documents_interaction_586, docs_features_kyc_documents_parsedocumentlist, docs_features_kyc_documents_kycuploaddialog, docs_features_kyc_documents_interaction_587, docs_features_kyc_documents_uploadinteraction [EXTRACTED 1.00]
- **Signup onboarding interaction chain (521 → 523 → 522 → pintwin → session upgrade)** — docs_features_user_onboarding_interaction_521, docs_features_user_onboarding_interaction_523, docs_features_user_onboarding_interaction_522, docs_features_user_onboarding_pintwin, docs_features_user_onboarding_respond_upgrade, docs_features_user_onboarding_onboarding_gate [EXTRACTED 1.00]
- **api-specs.ts single-source-of-truth artifact pipeline** — docs_local_roadmap_ai_agent_platform_status_eps_json_bundle, docs_markdown_generation_vite_plugin_generate_markdown, docs_pricing_calculator_xlsx_calculator, docs_local_roadmap_temp_project_progress_updates_docs_portal_plan, docs_local_roadmap_api_sample_reconciliation_reconciliation, docs_local_roadmap_pitch_deck_plan_single_source_thesis [INFERRED 0.85]
- **Self-serve signup onboarding flow (BFF + wizard)** — docs_superpowers_plans_2026_07_15_user_onboarding_plan, docs_superpowers_specs_2026_07_15_user_onboarding_design_design, docs_superpowers_plans_2026_07_15_user_onboarding_signupservice, docs_superpowers_plans_2026_07_15_user_onboarding_ekoclient_onboarding_interactions, docs_superpowers_plans_2026_07_15_user_onboarding_encodepin, docs_superpowers_plans_2026_07_15_user_onboarding_signup_session_role, docs_superpowers_specs_2026_07_15_user_onboarding_design_signupstate [EXTRACTED 1.00]
- **Business Details step: contract widening, 522, inlined states** — docs_superpowers_specs_2026_07_16_business_details_step_design_design, docs_superpowers_plans_2026_07_16_business_details_step_plan, docs_superpowers_specs_2026_07_16_business_details_step_design_interaction_522, docs_superpowers_specs_2026_07_16_business_details_step_design_named_record_submit, docs_superpowers_specs_2026_07_16_business_details_step_design_indian_states_inlined, docs_superpowers_specs_2026_07_16_signup_profile_context_design_signupprofilecontext [INFERRED 0.85]
- **Shared-VM pull-based deploy + observability stack** — packages_eps_backend_deploy_poller_readme_poller, packages_eps_backend_docker_compose_prod_poller_service, packages_eps_backend_docker_compose_prod_eps_backend_service, packages_eps_backend_docker_compose_prod_redis_valkey, packages_eps_backend_deploy_poller_alternatives_evaluated_pull_based_constraint, packages_eps_backend_deploy_poller_alternatives_evaluated_dozzle_uptime_kuma [INFERRED 0.85]
- **Shared-VM pull-based deploy pattern (poller, GHCR authfile, HOLD, health gate)** — packages_eps_backend_docs_eps_backend_vm_deploy_pull_based_poller, packages_eps_backend_docs_eps_backend_vm_deploy_ghcr_authfile, packages_eps_backend_docs_eps_backend_vm_deploy_hold_sentinel, packages_eps_backend_docs_eps_backend_vm_deploy_health_gate_rollback, packages_eps_transact_mcp_deploy_docker_compose_prod_shared_poller_image, packages_eps_transact_mcp_deploy_docker_compose_prod_transact_prod_stack [EXTRACTED 1.00]
- **One API registry feeds docs, SDKs, and both MCP servers** — packages_eps_transact_mcp_readme_registry_driven_tools, packages_eps_context_mcp_readme_eps_bundle_url, packages_sdk_php_readme_sdk_surface_catalog, packages_sdk_js_readme_epsclient, packages_eps_context_mcp_readme_eps_context_mcp [EXTRACTED 1.00]
- **Backend-only secret boundary across signing surfaces** — src_content_docs_how_auth_works_hmac_secret_key, packages_eps_context_mcp_readme_backend_only_signing, packages_eps_context_mcp_readme_debug_auth, packages_eps_transact_mcp_readme_stateless_passthrough_signer, packages_sdk_js_readme_epsclient, packages_sdk_php_readme_epsclient, src_content_docs_how_auth_works_secret_key_playground [INFERRED 0.85]

## Communities (207 total, 25 thin omitted)

### Community 0 - "api-specs-common.ts"
Cohesion: 0.04
Nodes (69): AgentApiDetail, AgentApiIndexEntry, AgentAuthTopic, AgentBundle, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic (+61 more)

### Community 1 - "eps-context-mcp/src/bundle-types.ts"
Cohesion: 0.05
Nodes (64): App, config, getApp(), outer, AuthCause, AuthCheck, checkSignatureShape(), checkTimestamp() (+56 more)

### Community 2 - "SignupWizard.tsx"
Cohesion: 0.10
Nodes (22): SuccessRatesWidget(), LifecycleCard(), STATE_COPY, ACTIVE, Card, CardContent, CardDescription, CardFooter (+14 more)

### Community 3 - "PricingPage.tsx"
Cohesion: 0.07
Nodes (53): ApiChip(), BreadcrumbItem, BreadcrumbNav(), BreadcrumbNavProps, BreadcrumbVariant, VARIANT_STYLES, FadeIn(), FadeInProps (+45 more)

### Community 4 - "eko-signing.ts"
Cohesion: 0.19
Nodes (8): base64Bytes(), base64Utf8(), buildSignedHeaders(), computeSecretKey(), hmacSha256Base64(), ekoSigningPlugin, SecurityEntry, SignedHeaders

### Community 5 - "render-recipe.ts"
Cohesion: 0.06
Nodes (57): branch(), ARC_TINTS, assignLanes(), edgeLabel(), FREQUENCY_FILL, FREQUENCY_TEXT, METHOD_FILL, METHOD_TEXT (+49 more)

### Community 6 - "eko.ts"
Cohesion: 0.06
Nodes (44): EkoLogEntry, EkoLogger, noopEkoLogger, parseEkoLogLevel(), REDACTED_REQUEST_FIELDS, REDACTED_RESPONSE_FIELDS, FIELDS, RESPONSE (+36 more)

### Community 7 - "buildApp.ts"
Cohesion: 0.07
Nodes (46): getApp(), handler(), AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, sample, createEkoLogger() (+38 more)

### Community 8 - "code-samples.ts"
Cohesion: 0.06
Nodes (71): CopyButton(), NumberedCode(), TabButton(), CodeSamples(), MODES, CodeSnippets(), CopyButton(), prismLang() (+63 more)

### Community 9 - "app.ts"
Cohesion: 0.07
Nodes (34): SecurityLogger, ACCESS_COOKIE, REFRESH_COOKIE, SessionClaim, Sessions, AdminDeps, normalizeMobile(), DatasetResult (+26 more)

### Community 10 - "xlsx/shared.ts"
Cohesion: 0.15
Nodes (47): BbpsOperator, OperatorRow, ROWS, AmountSlab, BbpsCategory, DmtSlab, ExcelJS, nodeRequire (+39 more)

### Community 11 - "auth/client.ts"
Cohesion: 0.07
Nodes (28): AdminConsole(), AdminDocEditor(), getContent, propose, AdminDocsList(), DeployToProduction(), production, LoginForm() (+20 more)

### Community 12 - "payments-pricing.ts"
Cohesion: 0.22
Nodes (19): applySetupFeeDiscount(), buildSetupFeeQuote(), BBPS_CATEGORIES_MAP, BC_SETUP_FEE, bcSetupFeeFaqAnswer(), calcEarningsQuote(), calcPaymentsSetupFee(), clampAvgAmount() (+11 more)

### Community 13 - "render-doc.ts"
Cohesion: 0.11
Nodes (59): SIGNUP_PAGE, productHref(), recipeHref(), verifyHeading(), responseTypeFor(), docsHref(), defaultSnippet(), collectLeaves() (+51 more)

### Community 14 - "docs-registry.ts"
Cohesion: 0.08
Nodes (45): collectActiveBranchIds(), DocsNavTree(), normalizePath(), soleBranchChain(), findSoleChildBranch(), GuideMeta, GUIDES, SHOW_TRANSACT_MCP (+37 more)

### Community 15 - "console/dashboard.ts"
Cohesion: 0.06
Nodes (50): BusinessDashboard(), isEmpty(), MostUsedServicesWidget, SuccessRatesWidget, load, view(), withServices(), UsageAnalyticsWidget (+42 more)

### Community 16 - "KycUploadDialog.tsx"
Cohesion: 0.07
Nodes (33): KycUploadDialog(), KycUploadDialogProps, slugify(), toastError, upload, Badge(), BadgeProps, badgeVariants (+25 more)

### Community 17 - "dialog.tsx"
Cohesion: 0.24
Nodes (11): TalkToSalesDialogProps, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, ignoreNestedDialogInteraction() (+3 more)

### Community 18 - "eps-transact-mcp/package.json"
Cohesion: 0.04
Nodes (46): @ekoindia/eps-sdk, bin, eps-transact-mcp, dependencies, @ekoindia/eps-sdk, hono, @hono/node-server, @modelcontextprotocol/sdk (+38 more)

### Community 19 - "api-spec-previews.ts"
Cohesion: 0.17
Nodes (23): collectImpFields(), collectImpOutputs(), getApiPreviewsForProduct(), getDisplaySpecsForProduct(), getProductDocHref(), getVerifiableFieldsForProduct(), humanizeLabel(), isStatusSpec() (+15 more)

### Community 20 - "eps-backend/package.json"
Cohesion: 0.04
Nodes (45): jose, bin, eps-backend, dependencies, hono, @hono/node-server, jose, redis (+37 more)

### Community 21 - "pdf-client.ts"
Cohesion: 0.11
Nodes (31): call(), compressPdf(), getWorker(), imageToJpeg(), mergePdfs(), PdfCompressionResult, pdfFromImages(), PdfFromImagesOptions (+23 more)

### Community 22 - "config.ts"
Cohesion: 0.07
Nodes (25): EkoLogLevel, BusinessDetails, ZohoClient, Config, REQUIRED, base, baseEnv, Deps (+17 more)

### Community 23 - "PricingCalculator.tsx"
Cohesion: 0.15
Nodes (20): ApiPicker(), parseSelectionFromParams(), PricingCalculator(), sanitizeVolume(), SelectionEntry, serializeSelection(), ADD_API_EVENT, nearestStepIndex() (+12 more)

### Community 24 - "ProductPageLayout.tsx"
Cohesion: 0.07
Nodes (38): ApiChipProps, relevanceColors, ApiField, ApiInputOutputPreview(), ApiInputOutputPreviewProps, ApiPreviewItem, ApiSampleJson, MultiApiPreview() (+30 more)

### Community 25 - "eps-context-mcp/package.json"
Cohesion: 0.05
Nodes (40): bin, eps-context-mcp, dependencies, hono, @hono/node-server, @modelcontextprotocol/sdk, zod, description (+32 more)

### Community 26 - "cn"
Cohesion: 0.04
Nodes (59): FeatureCard(), FeatureCardProps, ProductCard(), ProductCardProps, StatCard(), StatCardProps, UseCaseCard(), UseCaseCardProps (+51 more)

### Community 27 - "ConsoleLayout.tsx"
Cohesion: 0.05
Nodes (59): ConnectWidget(), ConnectWidgetProps, IntrinsicElements, JSX, react, Status, syncWidgetProps(), LOAD_EVALUE (+51 more)

### Community 28 - "DialogHost.tsx"
Cohesion: 0.09
Nodes (28): CameraOptions, CameraResult, CameraDialog, CHROME, ConnectDialogs, DialogContext, DialogRequest, DialogResult (+20 more)

### Community 29 - "HarnessIcon.tsx"
Cohesion: 0.14
Nodes (16): AntigravityIcon(), ClaudeCodeIcon(), CodexIcon(), CursorIcon(), HarnessIcon(), HarnessIconProps, ICON_MAP, KiroIcon() (+8 more)

### Community 30 - "HeaderDropdownPanels.tsx"
Cohesion: 0.04
Nodes (57): PrintReceipt(), DropdownColumnHeader(), DropdownGrid(), DropdownGridColumn, DropdownGridProps, MenuItemLink(), MenuItemLinkProps, pastelColors (+49 more)

### Community 31 - "http/connect.ts"
Cohesion: 0.09
Nodes (23): AuthProvider, UpstreamSession, VerifyResult, isAllowedKycFile(), KYC_EXTENSIONS, KYC_TYPES, kycClientRefId(), mountConnect() (+15 more)

### Community 32 - "App.tsx"
Cohesion: 0.06
Nodes (33): AboutPage, Admin, AgentsPage, AiPage, BlogsMediaPage, ConsoleConnectTransaction, ConsoleCredentials, ConsoleDocuments (+25 more)

### Community 33 - "api-pricing.ts"
Cohesion: 0.15
Nodes (21): calcSetupFee(), clampDiscountPercent(), PRICED_APIS, PriceTier, PRICING_FAQS, PRICING_GROUP_ORDER, QuoteLine, rateInPaise() (+13 more)

### Community 34 - "Transactions.tsx"
Cohesion: 0.13
Nodes (27): MostUsedServicesWidget(), creditOf(), debitOf(), deriveAmount(), describeRow(), hueOf(), inferSearchField(), initialsOf() (+19 more)

### Community 35 - "github.ts"
Cohesion: 0.09
Nodes (13): docTypeFromPath(), ENDPOINTS_DIR, GUIDES_DIR, isEditableDocPath(), slugFromPath(), createDocsService(), DocItem, cfg (+5 more)

### Community 36 - "AuthProvider.tsx"
Cohesion: 0.11
Nodes (27): AuthContext, AuthContextValue, AuthProvider(), AuthState, classify(), Probe(), registeredHandler(), renderAuthed() (+19 more)

### Community 37 - "build-openapi.ts"
Cohesion: 0.09
Nodes (29): ApiSpec, CATEGORY_ORDER, CATEGORY_TITLES, DocCategory, DESCRIPTION_FILES, descriptionFileBody(), resolveDescription(), resolveShortDescription() (+21 more)

### Community 38 - "sdk-js/package.json"
Cohesion: 0.06
Nodes (32): description, devDependencies, tsup, typescript, vitest, engines, node, files (+24 more)

### Community 39 - "eps-mock-server/package.json"
Cohesion: 0.06
Nodes (31): bin, eps-mock-server, description, devDependencies, tsup, typescript, vitest, engines (+23 more)

### Community 40 - "AppServer.tsx"
Cohesion: 0.08
Nodes (42): TrackingParamCapture(), AiHint(), DefaultMeta(), SITE_TITLE_SUFFIX, DocsLayout(), buildLlmPrompt(), copyText(), PageActions() (+34 more)

### Community 41 - "search-index.ts"
Cohesion: 0.06
Nodes (56): CATEGORY_BADGE, CommandPaletteProps, escapeRegExp(), GROUPS, highlight(), ICON_TINT, ResultRow(), SCOPES (+48 more)

### Community 42 - "pdf-ops.test.ts"
Cohesion: 0.24
Nodes (11): decode(), landscapeJpeg(), portraitJpeg(), A4_POINTS, embed(), getPageCount(), imagesToPdf(), loadDocument() (+3 more)

### Community 43 - "Credentials.tsx"
Cohesion: 0.15
Nodes (12): CopyBtn(), CopyState, localTime(), OutputRow(), SecretKeyTester(), Lifecycle, uatCredentials, ApiCredentials() (+4 more)

### Community 44 - "EndpointDetail.tsx"
Cohesion: 0.08
Nodes (26): RequestSection(), FieldList(), HttpMethodTag(), Method, METHOD_STYLES, SHORT, Variant, InlineCode() (+18 more)

### Community 45 - "ConnectedBankingCalculator.tsx"
Cohesion: 0.11
Nodes (30): ConnectedBankingCalculator(), DEFAULT_INPUT, nearestStepIndex(), parseInputFromParams(), TICK_LABELS, TXN_STEPS, AddButton(), addProductToEstimate() (+22 more)

### Community 46 - "EkoClient"
Cohesion: 0.09
Nodes (11): EkoClient, identityOf(), FILTER_RULES, mountTransactions(), parseFilters(), parsePaging(), foundProfile, harness() (+3 more)

### Community 47 - "dashboardView.ts"
Cohesion: 0.12
Nodes (26): SAMPLE_DASHBOARD_OBJECT, SAMPLE_SERVICE_LIST, DatePreset, block(), buildDashboardView(), DashboardMetric, DashboardView, DATASETS (+18 more)

### Community 48 - "eps-transact-mcp/src/http.ts"
Cohesion: 0.12
Nodes (22): AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, createApp(), extractToolName(), HttpDeps, RL_LIMIT (+14 more)

### Community 49 - "GrievancePage.tsx"
Cohesion: 0.14
Nodes (6): LegalPageLayout(), LegalPageLayoutProps, SectionDivider(), GrievancePage(), PrivacyPolicyPage(), RefundPolicyPage()

### Community 50 - "render-products-index.ts"
Cohesion: 0.05
Nodes (62): GST_RATE, HAS_VOLUME_DISCOUNTS, PRICING_GROUPS, SETUP_FEE_DISCOUNT_PERCENT, SETUP_FEE_DISCOUNTED, ApiProductId, ApiProductRef, BBPS_OPERATORS (+54 more)

### Community 51 - "PaymentsCalculator.tsx"
Cohesion: 0.13
Nodes (20): MobileEstimateBar(), MobileEstimateBarProps, MobileSummaryBar(), MobileSummaryBarProps, parseSelectionFromParams(), PaymentsCalculator(), sanitizeTxns(), serializeSelection() (+12 more)

### Community 52 - "buildFiles (vite-plugin-generate-agent-bundle emitter)"
Cohesion: 0.09
Nodes (27): /ai hub page + /ai.md text twin, EPS backend-only auth model (secret-key derivation), buildApi (per-endpoint agent artifact), buildContextPackBody (one canonical pack body), buildFiles (vite-plugin-generate-agent-bundle emitter), buildFixtures (mock-server fixtures), buildIndex (compact agent index), buildInstallMatrix (per-harness MCP wiring) (+19 more)

### Community 53 - "API technical specification layer (api-specs.ts)"
Cohesion: 0.11
Nodes (27): AI-native agent platform layer, buildAgentBundle (pure deterministic bundle builder), /agent/eps.json canonical agent bundle, FNV-1a content-hash bundleVersion, AI-native vs AI-friendly distinction, Machine-readable capability manifest, Cross-harness agent evals, Guarded action tools (run_call_in_sandbox, scaffold_integration, validate_signature, run_conformance) (+19 more)

### Community 54 - "prerender.ts"
Cohesion: 0.13
Nodes (23): AppServer(), renderPage(), RenderResult, addFetchPriorityLow(), buildImageContentHashMap(), buildMaps(), fetchImagetoolsBuffer(), IMAGE_EXTENSIONS (+15 more)

### Community 55 - "FileUpload.tsx"
Cohesion: 0.11
Nodes (22): acceptsImages(), acceptsNonImages(), acceptsOnlyImagesAndPdfs(), acceptsType(), FileUpload(), FileUploadOptions, FileUploadProps, formatBytes() (+14 more)

### Community 56 - "Pingo Mascot"
Cohesion: 0.08
Nodes (26): Chat Typing Indicator, Error / Not-Found UI State, Idle / Empty-State / Offline UI State, Live Support / Help UI State, Loading / Processing UI State, Success / Confirmation UI State, UI Celebration/Delight State, UI General/Greeting State (+18 more)

### Community 57 - "Business Dashboard (/console)"
Cohesion: 0.10
Nodes (26): Per-platform deploy/rewrite configs, ConsoleLayout (auth branches + left rail), Developer console (/console), My Profile page (/console/profile), PROFILE_DETAIL_BLOCKS allowlist, sessionStorage /me session cache, GET /wallet/balance BFF route (interaction 9), Module-scope wallet-balance cache (+18 more)

### Community 58 - "http/dashboard.test.ts"
Cohesion: 0.15
Nodes (17): baseEnv, cfg, mk(), mountAdmin(), cfg, encHarness(), harness(), brokenCacheKv() (+9 more)

### Community 59 - "ImageEditorDialog.tsx"
Cohesion: 0.14
Nodes (18): CameraDevice, CameraDialog(), classifyDevices(), pickDeviceIndex(), RESOLUTION, ImageEditorDialog(), BoundingBox, Box (+10 more)

### Community 60 - "api-product-pages.ts"
Cohesion: 0.11
Nodes (23): ALIAS, Callout(), CalloutVariant, VARIANTS, FaqList(), MDX_COMPONENTS, MdxGuide(), ProductPageContent (+15 more)

### Community 61 - "Static page generation pipeline (ssg/)"
Cohesion: 0.11
Nodes (25): Cross-linking model (Industry ↔ Pack ↔ Product), Per-page SEO essentials (JSON-LD FAQPage, OG, canonical), Two-axis Industries × Packs architecture, /industries/<slug> and /solutions/<slug> URL structure, /agents → /ai route rename + marketing redesign, Drop-in agent context packs (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md), /docs developer portal plan (spec-driven, 3-pane, SSG), Try-it via Scalar modal + ClientPlugin.beforeRequest (+17 more)

### Community 62 - "EpsClientTest"
Cohesion: 0.09
Nodes (3): EpsClient, EpsClientTest, PHPUnit\Framework\TestCase

### Community 63 - "MarkdownProse.tsx"
Cohesion: 0.14
Nodes (13): LANG_ALIAS, MarkdownCodeBlock(), mdCodeTheme, prismLang(), components, heading(), MarkdownProse(), SAMPLE (+5 more)

### Community 64 - "industries.ts"
Cohesion: 0.08
Nodes (29): API_PRODUCTS_MAP, STALE_DISPLAY_CHIPS, ACTIVE_INDUSTRIES_LIST, ApiGridItem, ComplianceItem, DEFAULT_INTEGRATION_STEPS, DISABLED_PRODUCT_NAMES, INDUSTRIES_LIST (+21 more)

### Community 65 - "Profile.tsx"
Cohesion: 0.08
Nodes (29): developer, logout, mockState, UserMenu(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel (+21 more)

### Community 66 - "TestDialogs.tsx"
Cohesion: 0.16
Nodes (11): useConnectDialogs(), pad(), printPage(), ACCEPT_PRESETS, CameraTest(), FileUploadTest(), FileViewerTest(), ImageEditorTest() (+3 more)

### Community 67 - "QuoteSummary.tsx"
Cohesion: 0.15
Nodes (15): ApiPickerProps, PickerRow(), PaymentsPicker(), PaymentsPickerProps, PickerRow(), addApiToEstimate(), RateRow(), QUICK_ADD_APIS (+7 more)

### Community 68 - "docs-registry.ts (guides + endpoints unifier)"
Cohesion: 0.11
Nodes (23): assertRecipeSlugs build guard, RecipeStep.branches success-path data gap, Disable an API (disabled: true, never delete), SEARCH_INDEX auto-generated at module scope, FAQ answers are markdown, Mutually exclusive FaqTag categories, stripMarkdown (plain-text sink helper), DocsLayout 3-pane grid (+15 more)

### Community 69 - "eps-transact-mcp/src/bundle-types.ts"
Cohesion: 0.09
Nodes (22): AgentApiDetail, AgentApiIndexEntry, AgentAuthTopic, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic, AgentGettingStartedTopic (+14 more)

### Community 70 - "RaiseIssueDialog.tsx"
Cohesion: 0.16
Nodes (15): DISPLAY_MEDIA_OPTIONS, RaiseIssueDialog(), RaiseIssueOptions, buildIssueCatalogue(), Category, FeedbackOrigin, GENERIC_ISSUE_TYPE, isRaiseWindowOpen() (+7 more)

### Community 71 - "tools.ts"
Cohesion: 0.19
Nodes (18): AgentBundle, argsFor(), connect(), mockFetch(), panLite, tools, arrayItems(), buildToolDefs() (+10 more)

### Community 72 - "EarningsProductRow.tsx"
Cohesion: 0.12
Nodes (12): EarningsProductRow(), EarningsProductRowProps, nearestStepIndex(), TICK_LABELS, TXN_STEPS, groupDigits(), Input, InputProps (+4 more)

### Community 73 - "stdio.ts"
Cohesion: 0.22
Nodes (15): hasCredentials(), isAllowed(), parseAllowed(), parseEnvironment(), TransactCtx, DEFAULT_FETCH_TIMEOUT_MS, withTimeout(), createTransactServer() (+7 more)

### Community 74 - "tryit-client.ts"
Cohesion: 0.29
Nodes (10): createModal(), getTryItModal(), HIDDEN_SECTION_LABELS, markHiddenSections(), observeHiddenSections(), openTryIt(), IMPORTANT: this module pulls in the Vue-based client and its CSS, so it must be, uatAuthentication() (+2 more)

### Community 75 - "EndpointDetail (centre pane)"
Cohesion: 0.10
Nodes (21): imp flags ("What can you verify?"), Console sandbox / API playground (planned), CodeSamples right rail, DocDetailPage (/docs/:slug router page), EndpointDetail (centre pane), Params.tsx responsive param renderer, ResponseAccordion, ResponseFieldTree (recursive field renderer) (+13 more)

### Community 76 - "Self-serve signup wizard (/signup)"
Cohesion: 0.12
Nodes (19): KYC file rules (KYC_TYPES, KYC_EXTENSIONS, KYC_MAX_FILE_BYTES, KYC_MAX_PAGES), connect-api interaction 586 — fetch required document list, connect-api interaction 587 — upload one document (multipart), KYC_NO_RECORDS — "No Records Found" is an empty state, KYC Document Upload (/console/documents), kycEnabled / useKycEnabled entitlement gate, uploadInteraction (shared multipart transport), Watermark provenance stamp (opt-in per doc_type) (+11 more)

### Community 77 - "poll.sh"
Cohesion: 0.20
Nodes (13): acquire_lock(), alert(), dc(), deploy_image(), gate(), is_hold(), log(), main() (+5 more)

### Community 78 - "KV"
Cohesion: 0.16
Nodes (6): runKvContract(), wait(), Entry, KV, opened, StoreUnavailableError

### Community 79 - "zoho-chat.ts"
Cohesion: 0.08
Nodes (33): NavLink, NavLinkCompatProps, buildSrc(), ZohoSignupForm(), appendTrackingParams(), buildLeadWebsiteUrl(), getCalculatorContext(), getStoredTrackingParams() (+25 more)

### Community 80 - "Eko EPS Partner Ecosystem"
Cohesion: 0.12
Nodes (18): AePS / Biometric Authentication Service, Assisted Banking / Business Correspondent Service, Eko EPS Partner Ecosystem, Money Transfer / Remittance Service, Payment Gateway / Online Payment Processing, Payments Bank (RBI-Licensed), FingPay Logo, FingPay (+10 more)

### Community 81 - "tryit-client.ts (client-only Scalar modal singleton)"
Cohesion: 0.10
Nodes (22): Admin Config Console v1 (in-browser GitOps editor), Deploy Flow (Flow B) — dev to main PR, Edit Flow (Flow A) — propose changes as a PR, Editable file allowlist + path sanitization, Persisted admin GitHub token keyed by session id, 409 STALE_CONTENT concurrent-edit guard, descriptionFile endpoint notes (src/content/docs/endpoints/*.md), remark-callout (hand-rolled GitHub-alert mdast transform) (+14 more)

### Community 82 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, erasableSyntaxOnly, lib, module, moduleResolution, noEmit, outDir, skipLibCheck (+9 more)

### Community 83 - "src/client.ts"
Cohesion: 0.19
Nodes (11): buildFormData(), EpsClient, EpsClientOptions, here, isBlob(), matchesType(), SdkEndpoint, SdkParam (+3 more)

### Community 84 - "wallet-balance.ts"
Cohesion: 0.19
Nodes (14): connectInteractions, walletBalance, Status, walletBalance, WalletBalance(), resetRoleTransactionCache(), CachedBalance, fetchWalletBalance() (+6 more)

### Community 85 - "RdServiceTester.tsx"
Cohesion: 0.19
Nodes (23): LogLine, nowTs(), qScoreColor(), RdServiceTester(), statusBadge(), attrValue(), buildPidOptionsXml(), captureFromDevice() (+15 more)

### Community 86 - "button.tsx"
Cohesion: 0.08
Nodes (32): CodeBlock(), CodeBlockProps, exampleApiCode, exampleIntegrationSteps, examplePaymentCode, HeaderDropdownPanels(), caseStudies, ComplianceSection() (+24 more)

### Community 87 - "EPS transactional MCP server"
Cohesion: 0.12
Nodes (17): eps plugin distribution (marketplace + per-agent install), Agent governance & safety guardrails, Live freshness (version + changelog, EPS_BUNDLE_URL remote refresh), X-Eko-Allowed-Apis tool scoping, EPS transactional MCP server, VITE_SHOW_TRANSACT_MCP marketing gate, Auto-pull poller (image digest watcher), sanitizeError (PII-safe error curation) (+9 more)

### Community 88 - "auto-release.mjs"
Cohesion: 0.26
Nodes (16): canonPackageJson(), cmpSemver(), DRY_RUN, ensureTag(), fingerprint(), localFileMap(), main(), npmView() (+8 more)

### Community 89 - "SignAgreementStep.tsx"
Cohesion: 0.16
Nodes (14): esignOrigin(), EsignOutcome, LEEGALITY_PIPES, loadLeegality(), openEsign(), usesLeegality(), Window, Phase (+6 more)

### Community 90 - "useConsoleMe"
Cohesion: 0.14
Nodes (11): ConsoleLayout(), connectInteractions, DEVELOPER, ContextProbe(), DEVELOPER, mockNavigate, mockState, useConsoleMe() (+3 more)

### Community 91 - "resolveSteps.ts"
Cohesion: 0.15
Nodes (9): ResolvedStep, StepDefinition, StepStatus, StepSubmit, registry, STATUS_LABEL, StepRail(), SIGNUP_STEPS (+1 more)

### Community 92 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, ignoreDeprecations, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+7 more)

### Community 93 - "ErrorBoundary.tsx"
Cohesion: 0.24
Nodes (4): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, ConnectTransaction()

### Community 94 - "EarningsSummary.tsx"
Cohesion: 0.19
Nodes (11): EarningsSummary(), EarningsSummaryProps, QUICK_ADD_PRODUCTS, SetupFeeLine(), SetupFeeLineProps, Separator, Toaster(), ToasterProps (+3 more)

### Community 95 - "ConnectClient"
Cohesion: 0.15
Nodes (5): createConnectAuthProvider(), cfg, LOGIN_OK, setup(), ConnectClient

### Community 96 - "composer.json"
Cohesion: 0.13
Nodes (14): autoload, autoload-dev, psr-4, psr-4, description, license, name, Eko\\Eps\\ (+6 more)

### Community 97 - "BusinessStep.test.tsx"
Cohesion: 0.27
Nodes (5): SignupProfile, SignupProfileContext, SignupProfileProvider(), Probe(), useSignupProfile()

### Community 98 - "Eko Payment Services (EPS) API Platform"
Cohesion: 0.19
Nodes (14): Address Verification, BHIM App, Eko Payment Services (EPS) API Platform, QR Code Payment, Reverse Geocoding API, Salary Disbursal (Payroll Payout), Secure Payment, UPI (Unified Payments Interface) (+6 more)

### Community 99 - "@ekoindia/eps-backend BFF"
Cohesion: 0.18
Nodes (14): Signup session role, EPS Backend Phase 4 docs-chat agent design, SignupView lightweight /me view, Prune plans once shipped, Superpowers SDD artifact index, dev eps-backend service (build from repo root), prod eps-backend service, prod poller service (+6 more)

### Community 100 - "PinStep.tsx"
Cohesion: 0.29
Nodes (4): InputOTP, InputOTPGroup, InputOTPSlot, PinStep()

### Community 101 - "Agent packages release runbook"
Cohesion: 0.15
Nodes (19): AI-Native Agent Platform (feature/ai-native-agent-platform), packages/claude-plugin-eps (MCP + skills + /eps command), Distribution decision: public npm + Packagist, Backend-only signed SDKs (@ekoindia/eps-sdk, ekoindia/eps-sdk PHP), GitHub Packages rejected for public distribution, Agent-ready (today) vs AI-native (target rung), EPS strategic buy-in deck plan, Thesis: one source of truth → everything regenerates in sync (+11 more)

### Community 102 - "API sample-response reconciliation (before/after review)"
Cohesion: 0.15
Nodes (13): /agent/eps.json canonical bundle (Phase 0 spine), @ekoindia/eps-mock-server (offline, recipe-aware), Bucket A — REPLACE (39 endpoints rewritten from prod shape), Bucket B — KEEP + FLAG (suspect prod captures), API sample-response reconciliation (before/after review), Sample↔schema parity automated check, responseData type-inference rules, initiate-fund-transfer spec (IMPS/NEFT/RTGS payout) (+5 more)

### Community 103 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 104 - "eps-mock-server/src/server.ts"
Cohesion: 0.24
Nodes (9): port, Fixture, matchResponse(), MockResult, pathToRegExp(), fixtures, createMockServer(), here (+1 more)

### Community 105 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 106 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 107 - "build-install-matrix.ts"
Cohesion: 0.22
Nodes (7): HARNESSES, HarnessInstall, HarnessMcp, HarnessPluginInstall, MCP_CMD, PluginInstallStep, matrix

### Community 108 - "pdf-render.ts"
Cohesion: 0.13
Nodes (16): extractPdfImages(), EncryptedPdfError, NotCompressibleError, RasterPage, findNonImageOp(), isPageImageOnly(), NON_IMAGE_OP_NAMES, NON_IMAGE_OPS (+8 more)

### Community 109 - "BusinessStep.tsx"
Cohesion: 0.32
Nodes (10): BUSINESS_FIELDS, BUSINESS_GROUPS, BusinessField, COMPANY_TYPES, INDIAN_STATES, field(), validateField(), BusinessStep() (+2 more)

### Community 110 - "@ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools)"
Cohesion: 0.17
Nodes (12): @ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools), Certbot renewal timer gotcha, Docker data-root on /data pinned to the vfs driver, nginx reverse-proxy config (X-Real-IP, no buffering, TLS), mcp.eko.in path namespace contract (/transact/, /context/ reserved), eps-transact-mcp VM deployment runbook, Obsidian Terminal visual direction, Variant A — The Agent Demo (/welcome) (+4 more)

### Community 111 - "SignupService step orchestration"
Cohesion: 0.23
Nodes (12): User Onboarding (Self-Serve Signup) implementation plan, SignupService step orchestration, Two-entry signup step registry, Business Details Step implementation plan, Signup Profile Context + Prefill implementation plan, User Onboarding design spec, SignupState (server-projected onboarding state), Business Details onboarding step design (+4 more)

### Community 112 - "EPS secret-key HMAC signing scheme"
Cohesion: 0.21
Nodes (12): Backend-only signing policy (context MCP), Stateless pass-through signer (no persistence, no body logging), @ekoindia/eps-sdk (Node.js backend SDK), EpsClient (JS), signSecretKey helper (JS), ekoindia/eps-sdk (PHP backend SDK), EpsClient (PHP), Courier-not-consumer mental model for PID data (+4 more)

### Community 113 - "@ekoindia/eps-transact-mcp (transactional MCP server)"
Cohesion: 0.18
Nodes (12): EPS_BUNDLE_URL remote bundle override, @ekoindia/eps-context-mcp (stdio documentation MCP server), Tiered, lazy, secret-free tool design, Best-effort npm update check, parity.copied-utils.test.ts content-hash pin, @ekoindia/eps-transact-mcp (transactional MCP server), MCP tool annotations for side-effecting verification tools, Registry-driven tool generation from api-specs.ts (+4 more)

### Community 114 - "Aadhaar (India Biometric ID)"
Cohesion: 0.18
Nodes (12): Aadhaar (India Biometric ID), Aadhaar Verification Illustration, AePS (Aadhaar Enabled Payment System), AePS Main Hero Illustration, Assisted Cash Management Illustration, Assisted Cash Management Service, Bank Account Verification, Bank Verification Illustration (+4 more)

### Community 116 - "build-postman.ts"
Cohesion: 0.27
Nodes (8): buildPostmanCollection(), PostmanCollection, PostmanFolder, PostmanRequest, PostmanScript, PRE_REQUEST_SIGNING_SCRIPT, bundle, collection

### Community 117 - "Pull-based auto-deploy poller"
Cohesion: 0.20
Nodes (11): Deterministic GHCR authfile (.ghcr-auth.json), Health gate and automatic rollback, HOLD sentinel file, KV_ENCRYPTION_KEY is a stable secret, KV store redundancy tiers (Valkey / in-memory / Upstash), Merge gate IS the deploy gate, Pull-based auto-deploy poller, Seed deploy.env with the tag, not a digest (+3 more)

### Community 118 - "reload-on-chunk-error.ts"
Cohesion: 0.36
Nodes (5): App(), installChunkErrorReload(), isChunkLoadError(), reloadOnceForStaleChunk(), doHydrate()

### Community 119 - "Aadhaar Biometric Authentication with RDService"
Cohesion: 0.25
Nodes (11): qScore retry/block thresholds, Aadhaar Biometric Authentication with RDService, UIDAI registered devices (L1 mandate), wadh digest binding capture to a KYC API version, Activate User Service endpoint, RSA Aadhaar-number encryption scheme, AePS Fingpay Biometric eKYC endpoint, fType=2 per NPCI FIR-FMR single-PID-block guidance (+3 more)

### Community 120 - "SecretKeyTester.test.tsx"
Cohesion: 0.32
Nodes (5): accessKeyInput(), enterGoldenInputs(), GOLDEN, realCompute, timestampInput()

### Community 121 - "Eko Platform Services (EPS) Brand"
Cohesion: 0.31
Nodes (10): EkoShield Product (Fraud Prevention & KYC), Employee Verification / Background Check, Eko Platform Services (EPS) Brand, KYC & Identity Verification, Eko Platform Services Logo (gold icon, white text), EkoShield Logo (shield, fingerprint, 'Your Armor Against Fraud'), EkoShield KYC & Verification Dashboard Mockup, Employee Verification Illustration (+2 more)

### Community 122 - "Interaction 154 — transaction history upstream"
Cohesion: 0.13
Nodes (15): SIMPLIBANK_HISTORY_* upstream override (eko.historyUrl), inferSearchField (quick-search shape heuristic), Interaction 154 — transaction history upstream, debitOf / creditOf money rules, Per-page totals / Closing Balance caveat, parseFilters allow-list (trust boundary), POST /transactions/search (POST, not GET), selectEvalueAccountId (E-value account resolution) (+7 more)

### Community 123 - "`onboarding === 1` classification gate in getProfile"
Cohesion: 0.22
Nodes (10): connect-api login delegation (CONNECT_API_BASE_URL), `onboarding === 1` classification gate in getProfile, respond() signup→developer session upgrade, `signup` session role, GHCR authentication (private images, .ghcr-auth.json), GHCR digest poller auto-deploy with health gate + rollback, buildApp() extraction + api/index.ts serverless entry, Upstash Redis (in-memory KV cannot survive serverless) (+2 more)

### Community 124 - "eps-context-mcp/vercel.json"
Cohesion: 0.20
Nodes (9): maxDuration, buildCommand, functions, api/index.ts, bom1, outputDirectory, regions, rewrites (+1 more)

### Community 125 - "label.tsx"
Cohesion: 0.32
Nodes (4): Label, labelVariants, PanStep(), StepProps

### Community 126 - "EPS agent plugin (eps)"
Cohesion: 0.31
Nodes (9): Retrieve-then-answer grounding, /eps slash command, Codex does not launch plugin-bundled stdio MCP, EPS agent plugin (eps), integrate-eps skill, Recipe branching on response_type_id / status, run-a-recipe skill, EPS secret-key HMAC-SHA256 convention (+1 more)

### Community 127 - "Auto-deploy poller (poll.sh sidecar)"
Cohesion: 0.22
Nodes (9): eps-context-mcp remote server decision record, mcp.eko.in path-namespaced URL contract, Dozzle + Uptime Kuma observability layer, Poller alternatives + VM observability evaluation, Komodo (rejected single-pane deploy authority), vfs storage driver disk caveat, HOLD sentinel + health-gated rollback, One poller container per project (+1 more)

### Community 128 - "poll_test.sh"
Cohesion: 0.44
Nodes (7): eq(), load(), no(), ok(), seed_deploy(), setup(), poll_test.sh script

### Community 129 - "eko.test.ts"
Cohesion: 0.31
Nodes (5): createEkoClient(), ekoCfg, mockFetch(), profileFrom(), INTERACTION_154_SAMPLE

### Community 130 - "eps-transact-mcp/src/load-bundle.ts"
Cohesion: 0.22
Nodes (7): BAKED_PATH, here, apiBySlug, here, surface, surfaceBySlug, tools

### Community 131 - "eps-transact-mcp/src/update-check.ts"
Cohesion: 0.44
Nodes (6): checkForUpdate(), isNewer(), notifyIfOutdated(), parseStrict(), updateNotice(), VersionState

### Community 133 - "IntersectionObserverStub"
Cohesion: 0.22
Nodes (4): importFadeIn(), IntersectionCallback, IntersectionObserverStub, observerCallbacks

### Community 134 - "Industry detail page template"
Cohesion: 0.25
Nodes (8): Assisted Banking Agent Pack (AePS + DMT + BBPS + PPI), Industry detail page template, Lending KYC Pack, Phased rollout (Foundation → Tier-1/2/3 → Optimization), Solution/Pack detail page template, CaptureAvdm() / deviceInfoAvdm() — PID capture + device info, discoverAvdm() — RDSERVICE port scan 11100–11112, Sample UIDAI RD-service integration testing tool (HTML)

### Community 135 - "POST /chat/ask route"
Cohesion: 0.25
Nodes (8): ekoLog PIN-derivable field redaction, encodePin (pintwin digit-substitution), POST /chat/ask route, ChatProvider multi-provider abstraction, Chat endpoint privilege isolation (no github/admin imports), KV incrBy(key, delta, ttl) seam, No chat storage, message content never logged, Monthly token-spend circuit breaker

### Community 136 - "eps-backend/vercel.json"
Cohesion: 0.25
Nodes (7): maxDuration, functions, api/index.ts, bom1, regions, rewrites, $schema

### Community 137 - "parity.copied-utils.test.ts"
Cohesion: 0.29
Nodes (6): here, normalize(), Pin, PINS, repoRoot, shaOf()

### Community 138 - "Money Transfer API"
Cohesion: 0.25
Nodes (8): GST Verification, GST Verification Illustration, Digital Payments Network, Hero Network Illustration, Money Transfer API Illustration, Money Transfer API, PAN Verification Illustration, PAN Verification

### Community 139 - "Financial transaction status codes (tx_status)"
Cohesion: 0.32
Nodes (8): AePS Initiate Settlement endpoint, Get Customer Info endpoint, DLT registration for a custom SMS Sender ID, Mobile OTP Send endpoint, PPI DigiKhata Initiate Transaction endpoint, Transaction Inquiry endpoint, Eko response envelope (status / response_status_id / tx_status), Financial transaction status codes (tx_status)

### Community 140 - "Stale-chunk auto-reload"
Cohesion: 0.38
Nodes (7): /assets/* excluded from SPA-shell rewrite, Stale-chunk auto-reload, ErrorBoundary around routes, installChunkErrorReload / reloadOnceForStaleChunk, SSG prerender pipeline (ssg/plugin.ts, prerender.ts), ROUTE_CHUNK_MAP modulepreload, Static pre-rendered HTML with SPA fallback

### Community 141 - "KYC_DOC_CONFIG — per-doc_type local overrides"
Cohesion: 0.29
Nodes (7): DOCUMENT_STATUS / statusOfDocument (1 pending, 2 success, 3 resubmit), ignoreNestedDialogInteraction (Radix top-layer guard), KYC_DOC_CONFIG — per-doc_type local overrides, KycUploadDialog, `multiple` — per-slot attachments combined into one PDF, parseDocumentList (presentation overlay, drops is_required), Sample documents (sampleUrl blanks in public/kyc-samples)

### Community 142 - "eps-backend Production VM Deploy Runbook"
Cohesion: 0.38
Nodes (7): buildApp side-effect-free factory, Vercel path rejected for production, SimpliBank IP allowlist constraint, eps-backend on Vercel (managed serverless), nginx must overwrite X-Real-IP, eps-backend Production VM Deploy Runbook, debug_auth tool (known-answer test vector)

### Community 144 - "plugin-marketplace.test.ts"
Cohesion: 0.29
Nodes (6): marketplace, MarketplaceEntry, McpConfig, pluginDirs, PluginManifest, ROOT

### Community 146 - "eko vs connect auth provider seam"
Cohesion: 0.33
Nodes (6): ProfileResult 'onboarding' variant, eps-backend is the connect-api BFF equivalent, onboarding===1 checked before the user_type gate, eko vs connect auth provider seam, EPS business-partner gate stays in this service, Persist upstream creds before setting cookies

### Community 147 - "eps-context-mcp http.ts stateless Hono transport"
Cohesion: 0.33
Nodes (6): packages/eps-agent-core zero-dep bundle accessors, Anonymous edge hosting over VM co-hosting, eps-context-mcp http.ts stateless Hono transport, Cache-Control: no-store on POST /mcp, Shared HTTP adapter extraction deferred, Pull-based deploys + nginx owns :443 (ruling constraints)

### Community 148 - "bundle-types.parity.test.ts"
Cohesion: 0.33
Nodes (4): here, localSrc, NAMES, siteSrc

### Community 149 - "AnimatedRoutes.tsx"
Cohesion: 0.40
Nodes (4): AnimatedRoutes(), AnimatedRoutesProps, PageTransition(), PageTransitionProps

### Community 151 - "Interaction 522 USER_ONBOARDING_BUSINESS"
Cohesion: 0.40
Nodes (5): Eko client onboarding interactions (521/523/170/10005/5), Deliberate client+BFF validation duplication, 36 Indian states inlined verbatim instead of fetched, Interaction 522 USER_ONBOARDING_BUSINESS, Native <select> over Radix Select

### Community 152 - "Eko EPS Website UI/UX improvement plan"
Cohesion: 0.50
Nodes (5): useCopyToClipboard on every code block (P3), Hero rebuild: mobile code block + stats + CTA hierarchy, Language tabs on API input/output preview (P2), Eko EPS Website UI/UX improvement plan, Sticky CTA bar (P1)

### Community 155 - "eps-context-mcp/scripts/bake-bundle.mjs"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 156 - "bake-fixtures.mjs"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 157 - "eps-transact-mcp/scripts/bake-bundle.mjs"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 158 - "sdk-js/scripts/bake-surface.mjs"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 159 - "sdk-php/scripts/bake-surface.mjs"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 161 - "No-fabrication authoring rule (blocked: source incomplete)"
Cohesion: 0.50
Nodes (4): No-fabrication authoring rule (blocked: source incomplete), Phase 2 — PPI-Levin + PPI-DigiKhata rails, Phase 3 — user & customer management, Phase 6 — helpers, verification extras, BBPS extras

### Community 162 - "eps"
Cohesion: 0.50
Nodes (3): npx, @ekoindia/eps-context-mcp, eps

### Community 163 - "Airtel Payments Bank"
Cohesion: 0.50
Nodes (4): Airtel Payments Bank, Airtel Payments Bank Logo, BillDesk, BillDesk Logo

### Community 164 - "PidOptions XML configuration"
Cohesion: 0.50
Nodes (4): Android RDService integration via UIDAI Intents, RdServiceTester in-browser device tester, RDService driver discovery on ports 11100-11120, PidOptions XML configuration

### Community 166 - "In-memory abuse throttling"
Cohesion: 1.00
Nodes (3): In-memory abuse throttling, Path-namespaced nginx reverse proxy (/transact/, /context/ reserved), Stateless streamable HTTP transport

## Ambiguous Edges - Review These
- `Editable file allowlist + path sanitization` → `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`  [AMBIGUOUS]
  docs/admin-console.md · relation: references
- `AI-native vs AI-friendly distinction` → `API keys management (blocked on issuance contract)`  [AMBIGUOUS]
  docs/console-roadmap.md · relation: conceptually_related_to

## Knowledge Gaps
- **1046 isolated node(s):** `engine`, `TOKEN_ALIASES`, `IndexedDoc`, `INDEX_FIELDS`, `Ranked` (+1041 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Editable file allowlist + path sanitization` and `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `AI-native vs AI-friendly distinction` and `API keys management (blocked on issuance contract)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `doHydrate()` connect `reload-on-chunk-error.ts` to `http/dashboard.test.ts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `app()` connect `http/dashboard.test.ts` to `reload-on-chunk-error.ts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `requestId()` connect `http/dashboard.test.ts` to `app.ts`, `buildApp.ts`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **What connects `engine`, `TOKEN_ALIASES`, `IndexedDoc` to the rest of the system?**
  _1046 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api-specs-common.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04396266184884071 - nodes in this community are weakly interconnected._