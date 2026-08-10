# Graph Report - eko-eps-website  (2026-08-10)

## Corpus Check
- 711 files · ~874,873 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4242 nodes · 10017 edges · 216 communities (192 shown, 24 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 218 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2bfef20a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api-specs-common.ts
- eps-context-mcp/src/bundle-types.ts
- lib/notifications.ts
- zoho-chat.ts
- AuthProvider.tsx
- render-recipe.ts
- wallet-balance.ts
- cn
- DocsIndexPage.tsx
- SignupWizard.tsx
- xlsx/shared.ts
- ConnectedBankingCalculator.tsx
- payments-pricing.ts
- render-products-index.ts
- docs-registry.ts
- console/dashboard.ts
- interactions.ts
- api-spec-previews.ts
- eps-transact-mcp/package.json
- EkoShieldPage.tsx
- eps-backend/package.json
- api-pricing.ts
- signup.ts
- UserMenu.tsx
- ProductPageLayout.tsx
- eps-context-mcp/package.json
- AppServer.tsx
- ConnectWidget.tsx
- DialogHost.tsx
- PricingPage.tsx
- HeaderDropdownPanels.tsx
- app.ts
- App.tsx
- http/notifications.test.ts
- Transactions.tsx
- github.ts
- auth/client.ts
- resolveSteps.ts
- sdk-js/package.json
- eps-mock-server/package.json
- widget-events.ts
- search-index.ts
- pdf-client.ts
- render-doc.ts
- Credentials.tsx
- AiPage.tsx
- openZohoChat
- http/dashboard.test.ts
- eps-transact-mcp/src/http.ts
- build-openapi.ts
- site.ts
- ApiInputOutputPreview.tsx
- buildFiles (vite-plugin-generate-agent-bundle emitter)
- API technical specification layer (api-specs.ts)
- prerender.ts
- CameraDialog.tsx
- Pingo Mascot
- Business Dashboard (/console)
- buildApp.ts
- ImageEditorDialog.tsx
- build-postman.ts
- Static page generation pipeline (ssg/)
- EpsClientTest
- MarkdownProse.tsx
- Header.tsx
- connectProvider.ts
- TestDialogs.tsx
- EkoClient
- docs-registry.ts (guides + endpoints unifier)
- eps-transact-mcp/src/bundle-types.ts
- pdf-render.ts
- tools.ts
- MobileSummaryBar.tsx
- stdio.ts
- pdf-ops.ts
- EndpointDetail (centre pane)
- Self-serve signup wizard (/signup)
- poll.sh
- ProductsMegaPanel.tsx
- EndpointDetail.tsx
- Eko EPS Partner Ecosystem
- IndustryPageLayout.tsx
- compilerOptions
- src/client.ts
- ConsoleLayout.tsx
- eko-signing.ts
- Backend-only signed SDKs (@ekoindia/eps-sdk, ekoindia/eps-sdk PHP)
- EPS transactional MCP server
- auto-release.mjs
- Edit Flow (Flow A) — propose changes as a PR
- KycUploadDialog.tsx
- EkoLogo.tsx
- compilerOptions
- Feature: Notifications
- api-product-pages.ts
- eko.ts
- composer.json
- MdxGuide.tsx
- Eko Payment Services (EPS) API Platform
- @ekoindia/eps-backend BFF
- SignupService step orchestration
- Agent packages release runbook
- API sample-response reconciliation (before/after review)
- compilerOptions
- eps-mock-server/src/server.ts
- compilerOptions
- compilerOptions
- PUD-ConnectProd1 — migrating Docker from `vfs` to `overlay2`
- PinStep.tsx
- build-context-pack.ts
- @ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools)
- EPS secret-key HMAC signing scheme
- @ekoindia/eps-transact-mcp (transactional MCP server)
- Aadhaar (India Biometric ID)
- extract-body.ts
- eps-backend — Docker Ops Cheatsheet
- Pull-based auto-deploy poller
- http/connect.test.ts
- Aadhaar Biometric Authentication with RDService
- RdServiceTester.tsx
- Interaction 154 — transaction history upstream
- `onboarding === 1` classification gate in getProfile
- eps-context-mcp/vercel.json
- LanguageSelector.tsx
- EPS agent plugin (eps)
- Auto-deploy poller (poll.sh sidecar)
- poll_test.sh
- utils.ts
- eps-transact-mcp/src/load-bundle.ts
- eps-transact-mcp/src/update-check.ts
- audit/accessLog.ts
- IntersectionObserverStub
- Industry detail page template
- POST /chat/ask route
- eps-backend/vercel.json
- parity.copied-utils.test.ts
- Money Transfer API
- Financial transaction status codes (tx_status)
- Interaction 522 USER_ONBOARDING_BUSINESS
- KYC_DOC_CONFIG — per-doc_type local overrides
- eps-backend Production VM Deploy Runbook
- FileUpload.tsx
- plugin-marketplace.test.ts
- render-products-index.test.ts
- tryit-client.ts (client-only Scalar modal singleton)
- eps-context-mcp http.ts stateless Hono transport
- bundle-types.parity.test.ts
- ZohoSignupForm.tsx
- api-products.ts
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
- BusinessStep.tsx
- AnimatedRoutes.tsx
- Stale-chunk auto-reload
- build-install-matrix.ts
- ErrorBoundary.tsx
- MarkdownCodeBlock.tsx
- SecretKeyTester.test.tsx
- EkoShield Product (Fraud Prevention & KYC)
- eko vs connect auth provider seam

## God Nodes (most connected - your core abstractions)
1. `cn()` - 158 edges
2. `Button` - 49 edges
3. `SITE_URL` - 40 edges
4. `docsHref()` - 37 edges
5. `openZohoChat()` - 36 edges
6. `FadeIn()` - 33 edges
7. `productHref()` - 33 edges
8. `ApiSpec` - 29 edges
9. `EkoClient` - 28 edges
10. `KV` - 27 edges

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
- 3-file cycle: `src/components/ProductPageLayout.tsx -> src/lib/data/solutions.ts -> src/lib/data/api-product-pages.ts -> src/components/ProductPageLayout.tsx`
- 3-file cycle: `src/components/FileUpload.tsx -> src/components/connect/DialogHost.tsx -> src/components/connect/RaiseIssueDialog.tsx -> src/components/FileUpload.tsx`
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

## Communities (216 total, 24 thin omitted)

### Community 0 - "api-specs-common.ts"
Cohesion: 0.04
Nodes (65): AgentApiDetail, AgentApiIndexEntry, AgentAuthTopic, AgentBundle, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic (+57 more)

### Community 1 - "eps-context-mcp/src/bundle-types.ts"
Cohesion: 0.05
Nodes (64): App, config, getApp(), outer, AuthCause, AuthCheck, checkSignatureShape(), checkTimestamp() (+56 more)

### Community 2 - "lib/notifications.ts"
Cohesion: 0.06
Nodes (51): useOptionalConnectDialogs(), NotificationsCard(), items, markReadMock, panelMock, NotificationBell(), items, markReadMock (+43 more)

### Community 3 - "zoho-chat.ts"
Cohesion: 0.17
Nodes (15): TrackingParamCapture(), TrackingParamCapture(), NavLink, NavLinkCompatProps, appendTrackingParams(), getCalculatorContext(), getStoredTrackingParams(), isTrackingParam() (+7 more)

### Community 4 - "AuthProvider.tsx"
Cohesion: 0.11
Nodes (27): AuthContext, AuthContextValue, AuthProvider(), AuthState, classify(), Probe(), registeredHandler(), renderAuthed() (+19 more)

### Community 5 - "render-recipe.ts"
Cohesion: 0.06
Nodes (57): branch(), ARC_TINTS, assignLanes(), edgeLabel(), FREQUENCY_FILL, FREQUENCY_TEXT, METHOD_FILL, METHOD_TEXT (+49 more)

### Community 6 - "wallet-balance.ts"
Cohesion: 0.15
Nodes (17): connectInteractions, walletBalance, Status, walletBalance, WalletBalance(), LOAD_WALLET_INTERACTION_IDS, loadWalletInteractionId(), resetRoleTransactionCache() (+9 more)

### Community 7 - "cn"
Cohesion: 0.07
Nodes (36): FeatureCard(), FeatureCardProps, ProductCard(), ProductCardProps, StatCard(), StatCardProps, UseCaseCard(), UseCaseCardProps (+28 more)

### Community 8 - "DocsIndexPage.tsx"
Cohesion: 0.06
Nodes (71): CopyButton(), NumberedCode(), TabButton(), CodeSamples(), MODES, CodeSnippets(), CopyButton(), prismLang() (+63 more)

### Community 9 - "SignupWizard.tsx"
Cohesion: 0.16
Nodes (18): SuccessRatesWidget(), Step, StepMark(), Card, CardContent, CardDescription, CardFooter, CardHeader (+10 more)

### Community 10 - "xlsx/shared.ts"
Cohesion: 0.14
Nodes (50): SelectedApiRowProps, PricedApi, BBPS_OPERATORS, BbpsOperator, OperatorRow, ROWS, AmountSlab, BbpsCategory (+42 more)

### Community 11 - "ConnectedBankingCalculator.tsx"
Cohesion: 0.19
Nodes (17): ConnectedBankingCalculator(), DEFAULT_INPUT, nearestStepIndex(), parseInputFromParams(), TICK_LABELS, TXN_STEPS, GST_RATE, PricingFaq (+9 more)

### Community 12 - "payments-pricing.ts"
Cohesion: 0.09
Nodes (41): parseSelectionFromParams(), PaymentsCalculator(), sanitizeTxns(), serializeSelection(), PaymentsPicker(), PaymentsPickerProps, PickerRow(), HAS_VOLUME_DISCOUNTS (+33 more)

### Community 13 - "render-products-index.ts"
Cohesion: 0.12
Nodes (61): SITE_URL, productHref(), verifyHeading(), renderDocsIndexMarkdown(), faqBlocks(), FaqMarkdownItem, renderFaqMarkdown(), renderLlmsTxt() (+53 more)

### Community 14 - "docs-registry.ts"
Cohesion: 0.09
Nodes (38): collectActiveBranchIds(), DocsNavTree(), normalizePath(), soleBranchChain(), findSoleChildBranch(), GuideMeta, GUIDES, categoryForSpec() (+30 more)

### Community 15 - "console/dashboard.ts"
Cohesion: 0.07
Nodes (40): BusinessDashboard(), isEmpty(), MostUsedServicesWidget, SuccessRatesWidget, load, view(), withServices(), UsageAnalyticsWidget (+32 more)

### Community 16 - "interactions.ts"
Cohesion: 0.09
Nodes (29): ProfileCard(), HeaderDropdownPanels(), Profile, accountIdentity, chatIdentity, detailField(), nameInitials(), profileCompleteness() (+21 more)

### Community 17 - "api-spec-previews.ts"
Cohesion: 0.16
Nodes (24): API_PRODUCTS, collectImpFields(), collectImpOutputs(), getApiPreviewsForProduct(), getDisplaySpecsForProduct(), getProductDocHref(), getVerifiableFieldsForProduct(), humanizeLabel() (+16 more)

### Community 18 - "eps-transact-mcp/package.json"
Cohesion: 0.04
Nodes (46): @ekoindia/eps-sdk, bin, eps-transact-mcp, dependencies, @ekoindia/eps-sdk, hono, @hono/node-server, @modelcontextprotocol/sdk (+38 more)

### Community 19 - "EkoShieldPage.tsx"
Cohesion: 0.13
Nodes (14): digitalProducts, EkoShieldPage(), employmentProducts, financialProducts, gstinProducts, healthcareProducts, identityProducts, industries (+6 more)

### Community 20 - "eps-backend/package.json"
Cohesion: 0.04
Nodes (45): jose, bin, eps-backend, dependencies, hono, @hono/node-server, jose, redis (+37 more)

### Community 21 - "api-pricing.ts"
Cohesion: 0.10
Nodes (37): ApiPicker(), parseSelectionFromParams(), PricingCalculator(), sanitizeVolume(), SelectionEntry, serializeSelection(), ADD_API_EVENT, saveCalculatorContext() (+29 more)

### Community 22 - "signup.ts"
Cohesion: 0.05
Nodes (23): SecurityLogger, Sessions, BusinessDetails, ZohoClient, AdminDeps, Deps, BUSINESS_RULES, mountSignup() (+15 more)

### Community 23 - "UserMenu.tsx"
Cohesion: 0.16
Nodes (13): developer, logout, mockState, UserMenu(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel (+5 more)

### Community 24 - "ProductPageLayout.tsx"
Cohesion: 0.10
Nodes (30): ApiChip(), ApiChipProps, relevanceColors, ApiField, ApiPreviewItem, ApiSampleJson, Picture(), PictureProps (+22 more)

### Community 25 - "eps-context-mcp/package.json"
Cohesion: 0.05
Nodes (40): bin, eps-context-mcp, dependencies, hono, @hono/node-server, @modelcontextprotocol/sdk, zod, description (+32 more)

### Community 26 - "AppServer.tsx"
Cohesion: 0.09
Nodes (18): SITE_TITLE_SUFFIX, DocsLayout(), buildLlmPrompt(), copyText(), PageActions(), useTryIt(), LegalPageLayout(), LegalPageLayoutProps (+10 more)

### Community 27 - "ConnectWidget.tsx"
Cohesion: 0.09
Nodes (27): ConnectWidget(), ConnectWidgetProps, IntrinsicElements, JSX, react, Status, syncWidgetProps(), LOAD_EVALUE (+19 more)

### Community 28 - "DialogHost.tsx"
Cohesion: 0.08
Nodes (29): CameraResult, CameraDialog, CHROME, ConnectDialogs, DialogContext, DialogRequest, DialogResult, FileViewDialog (+21 more)

### Community 29 - "PricingPage.tsx"
Cohesion: 0.09
Nodes (30): AiHint(), IndustryPageLayout(), answerComponents, FaqAccordion(), FaqAccordionProps, FaqAnswer(), FaqCrossLink(), FaqItem (+22 more)

### Community 30 - "HeaderDropdownPanels.tsx"
Cohesion: 0.07
Nodes (23): AI_ASK_PROMPT, aiClientLinks, AiLinkItem, aiLinks, apiColumns, bcApis, companyLinks, companySocialLinks (+15 more)

### Community 31 - "app.ts"
Cohesion: 0.10
Nodes (42): createDocsService(), createEkoAuthProvider(), UpstreamSession, ACCESS_COOKIE, SessionClaim, mountAdmin(), createApp(), normalizeMobile() (+34 more)

### Community 32 - "App.tsx"
Cohesion: 0.06
Nodes (35): AboutPage, Admin, AgentsPage, AiPage, BlogsMediaPage, ConsoleConnectTransaction, ConsoleCredentials, ConsoleDocuments (+27 more)

### Community 33 - "http/notifications.test.ts"
Cohesion: 0.09
Nodes (24): DATE_PRESETS, DAYS_BACK, formatIst(), IST_OFFSET_MS, istRange(), parsePreset(), PRESETS, startOfIstDay() (+16 more)

### Community 34 - "Transactions.tsx"
Cohesion: 0.08
Nodes (47): MostUsedServicesWidget(), ADD_EARNINGS_EVENT, AddButton(), addProductToEstimate(), PaymentsRateTable(), slabRange(), slabValue(), addApiToEstimate() (+39 more)

### Community 35 - "github.ts"
Cohesion: 0.09
Nodes (13): docTypeFromPath(), ENDPOINTS_DIR, GUIDES_DIR, isEditableDocPath(), slugFromPath(), DocItem, cfg, createGitHubClient() (+5 more)

### Community 36 - "auth/client.ts"
Cohesion: 0.06
Nodes (29): getContent, propose, DeployToProduction(), production, ME, done, mockRefresh, panPending (+21 more)

### Community 37 - "resolveSteps.ts"
Cohesion: 0.08
Nodes (23): esignOrigin(), EsignOutcome, LEEGALITY_PIPES, loadLeegality(), openEsign(), usesLeegality(), Window, ResolvedStep (+15 more)

### Community 38 - "sdk-js/package.json"
Cohesion: 0.06
Nodes (32): description, devDependencies, tsup, typescript, vitest, engines, node, files (+24 more)

### Community 39 - "eps-mock-server/package.json"
Cohesion: 0.06
Nodes (31): bin, eps-mock-server, description, devDependencies, tsup, typescript, vitest, engines (+23 more)

### Community 40 - "widget-events.ts"
Cohesion: 0.14
Nodes (17): CameraOptions, FileViewDialog(), FileViewOptions, FileViewType, isSafeUrl(), sniffType(), toYouTubeEmbed(), TYPE_BY_EXTENSION (+9 more)

### Community 41 - "search-index.ts"
Cohesion: 0.05
Nodes (62): CATEGORY_BADGE, CommandPalette(), CommandPaletteProps, escapeRegExp(), GROUPS, highlight(), ICON_TINT, ResultRow() (+54 more)

### Community 42 - "pdf-client.ts"
Cohesion: 0.11
Nodes (30): call(), compressPdf(), extractPdfImages(), getWorker(), imageToJpeg(), mergePdfs(), PdfCompressionResult, pdfFromImages() (+22 more)

### Community 43 - "render-doc.ts"
Cohesion: 0.14
Nodes (25): codeColor(), ResponseAccordion(), Row, SIGNUP_URL, resolveResponseFields(), responseTypeFor(), docsHref(), endpointSlug() (+17 more)

### Community 44 - "Credentials.tsx"
Cohesion: 0.15
Nodes (12): CopyBtn(), CopyState, localTime(), OutputRow(), SecretKeyTester(), uatCredentials, ApiCredentials(), Credentials() (+4 more)

### Community 45 - "AiPage.tsx"
Cohesion: 0.07
Nodes (39): Eps(), AntigravityIcon(), ClaudeCodeIcon(), CodexIcon(), CursorIcon(), HarnessIcon(), HarnessIconProps, ICON_MAP (+31 more)

### Community 46 - "openZohoChat"
Cohesion: 0.10
Nodes (31): PickerRow(), EarningsProductRow(), EarningsProductRowProps, nearestStepIndex(), TICK_LABELS, TXN_STEPS, EarningsSummary(), EarningsSummaryProps (+23 more)

### Community 47 - "http/dashboard.test.ts"
Cohesion: 0.10
Nodes (29): SAMPLE_DASHBOARD_OBJECT, SAMPLE_SERVICE_LIST, envelope(), harness(), upstream, DatePreset, block(), buildDashboardView() (+21 more)

### Community 48 - "eps-transact-mcp/src/http.ts"
Cohesion: 0.12
Nodes (22): AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, createApp(), extractToolName(), HttpDeps, RL_LIMIT (+14 more)

### Community 49 - "build-openapi.ts"
Cohesion: 0.08
Nodes (38): resolveContentType(), resolveHeaders(), CATEGORY_ORDER, CATEGORY_TITLES, DocCategory, getDocumentedSpecs(), createModal(), getTryItModal() (+30 more)

### Community 50 - "site.ts"
Cohesion: 0.10
Nodes (17): state, FooterLinkItem, footerLinks, socialLinks, CTASection(), EPS_TRANSACT_MCP_CMD, EPS_TRANSACT_MCP_PKG, EPS_TRANSACT_MCP_URL (+9 more)

### Community 51 - "ApiInputOutputPreview.tsx"
Cohesion: 0.15
Nodes (13): ApiInputOutputPreviewProps, MultiApiPreview(), SectionHeader(), TerminalHeader(), isTabId(), PricingTabId, PricingTabs(), PricingTabsProps (+5 more)

### Community 52 - "buildFiles (vite-plugin-generate-agent-bundle emitter)"
Cohesion: 0.09
Nodes (27): /ai hub page + /ai.md text twin, EPS backend-only auth model (secret-key derivation), buildApi (per-endpoint agent artifact), buildContextPackBody (one canonical pack body), buildFiles (vite-plugin-generate-agent-bundle emitter), buildFixtures (mock-server fixtures), buildIndex (compact agent index), buildInstallMatrix (per-harness MCP wiring) (+19 more)

### Community 53 - "API technical specification layer (api-specs.ts)"
Cohesion: 0.11
Nodes (27): AI-native agent platform layer, buildAgentBundle (pure deterministic bundle builder), /agent/eps.json canonical agent bundle, FNV-1a content-hash bundleVersion, AI-native vs AI-friendly distinction, Machine-readable capability manifest, Cross-harness agent evals, Guarded action tools (run_call_in_sandbox, scaffold_integration, validate_signature, run_conformance) (+19 more)

### Community 54 - "prerender.ts"
Cohesion: 0.13
Nodes (22): AppServer(), renderPage(), RenderResult, addFetchPriorityLow(), buildImageContentHashMap(), buildMaps(), fetchImagetoolsBuffer(), IMAGE_EXTENSIONS (+14 more)

### Community 55 - "CameraDialog.tsx"
Cohesion: 0.19
Nodes (14): CameraDevice, CameraDialog(), classifyDevices(), pickDeviceIndex(), RESOLUTION, blobToDataUrl(), hasTorch(), ImageCaptureConstructor (+6 more)

### Community 56 - "Pingo Mascot"
Cohesion: 0.08
Nodes (26): Chat Typing Indicator, Error / Not-Found UI State, Idle / Empty-State / Offline UI State, Live Support / Help UI State, Loading / Processing UI State, Success / Confirmation UI State, UI Celebration/Delight State, UI General/Greeting State (+18 more)

### Community 57 - "Business Dashboard (/console)"
Cohesion: 0.09
Nodes (29): Per-platform deploy/rewrite configs, ConsoleLayout (auth branches + left rail), Developer console (/console), My Profile page (/console/profile), PROFILE_DETAIL_BLOCKS allowlist, sessionStorage /me session cache, GET /wallet/balance BFF route (interaction 9), Module-scope wallet-balance cache (+21 more)

### Community 58 - "buildApp.ts"
Cohesion: 0.06
Nodes (51): getApp(), handler(), createSecurityLogger(), noopSecurityLogger, SecurityEvent, SecurityOutcome, SecurityRecord, capture() (+43 more)

### Community 59 - "ImageEditorDialog.tsx"
Cohesion: 0.12
Nodes (18): ImageEditorDialog(), blurScoreFromImageFile, processedFile, setBlurScore, toastError, toastWarning, BoundingBox, Box (+10 more)

### Community 60 - "build-postman.ts"
Cohesion: 0.27
Nodes (8): buildPostmanCollection(), PostmanCollection, PostmanFolder, PostmanRequest, PostmanScript, PRE_REQUEST_SIGNING_SCRIPT, bundle, collection

### Community 61 - "Static page generation pipeline (ssg/)"
Cohesion: 0.11
Nodes (25): Cross-linking model (Industry ↔ Pack ↔ Product), Per-page SEO essentials (JSON-LD FAQPage, OG, canonical), Two-axis Industries × Packs architecture, /industries/<slug> and /solutions/<slug> URL structure, /agents → /ai route rename + marketing redesign, Drop-in agent context packs (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md), /docs developer portal plan (spec-driven, 3-pane, SSG), Try-it via Scalar modal + ClientPlugin.beforeRequest (+17 more)

### Community 62 - "EpsClientTest"
Cohesion: 0.09
Nodes (3): EpsClient, EpsClientTest, PHPUnit\Framework\TestCase

### Community 63 - "MarkdownProse.tsx"
Cohesion: 0.17
Nodes (9): components, heading(), MarkdownProse(), SAMPLE, ALERT_TYPES, MdNode, remarkCallout(), toCallout() (+1 more)

### Community 64 - "Header.tsx"
Cohesion: 0.13
Nodes (16): CommandPalette, Header(), HeaderDropdownPanels, LanguageSelector, LanguageSelectorFallback(), NavDropdownButton(), HeaderDropdownPanelsProps, ScrollDirection (+8 more)

### Community 65 - "connectProvider.ts"
Cohesion: 0.16
Nodes (11): AuthProvider, VerifyResult, buildMeView(), deriveStateFromProfile(), MeView, SignupView, profile, EkoAccount (+3 more)

### Community 66 - "TestDialogs.tsx"
Cohesion: 0.16
Nodes (11): useConnectDialogs(), pad(), printPage(), ACCEPT_PRESETS, CameraTest(), FileUploadTest(), FileViewerTest(), ImageEditorTest() (+3 more)

### Community 67 - "EkoClient"
Cohesion: 0.07
Nodes (17): createEkoClient(), EkoClient, identityOf(), ekoCfg, mockFetch(), profileFrom(), profileFromDetail(), INTERACTION_154_SAMPLE (+9 more)

### Community 68 - "docs-registry.ts (guides + endpoints unifier)"
Cohesion: 0.11
Nodes (22): assertRecipeSlugs build guard, RecipeStep.branches success-path data gap, Disable an API (disabled: true, never delete), SEARCH_INDEX auto-generated at module scope, FAQ answers are markdown, Mutually exclusive FaqTag categories, stripMarkdown (plain-text sink helper), CodeSnippets MDX component (+14 more)

### Community 69 - "eps-transact-mcp/src/bundle-types.ts"
Cohesion: 0.09
Nodes (22): AgentApiDetail, AgentApiIndexEntry, AgentAuthTopic, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic, AgentGettingStartedTopic (+14 more)

### Community 70 - "pdf-render.ts"
Cohesion: 0.12
Nodes (25): BLUR_ANALYSIS_MAX_LENGTH, blurScore(), blurScoreFromImageFile(), blurScoreFromVideo(), BlurScoreOptions, lowestBlurScore(), scoresByFile, blurredCheckerboard() (+17 more)

### Community 71 - "tools.ts"
Cohesion: 0.19
Nodes (18): AgentBundle, argsFor(), connect(), mockFetch(), panLite, tools, arrayItems(), buildToolDefs() (+10 more)

### Community 72 - "MobileSummaryBar.tsx"
Cohesion: 0.17
Nodes (13): MobileEstimateBar(), MobileEstimateBarProps, MobileSummaryBar(), MobileSummaryBarProps, QuoteSummaryProps, Drawer(), DrawerContent, DrawerDescription (+5 more)

### Community 73 - "stdio.ts"
Cohesion: 0.22
Nodes (15): hasCredentials(), isAllowed(), parseAllowed(), parseEnvironment(), TransactCtx, DEFAULT_FETCH_TIMEOUT_MS, withTimeout(), createTransactServer() (+7 more)

### Community 74 - "pdf-ops.ts"
Cohesion: 0.18
Nodes (17): decode(), landscapeJpeg(), portraitJpeg(), A4_POINTS, embed(), getPageCount(), imagesToPdf(), loadDocument() (+9 more)

### Community 75 - "EndpointDetail (centre pane)"
Cohesion: 0.12
Nodes (19): imp flags ("What can you verify?"), CodeSamples right rail, DocDetailPage (/docs/:slug router page), EndpointDetail (centre pane), Params.tsx responsive param renderer, ResponseAccordion, ResponseFieldTree (recursive field renderer), resolveEndpointUrl (+11 more)

### Community 76 - "Self-serve signup wizard (/signup)"
Cohesion: 0.12
Nodes (19): KYC file rules (KYC_TYPES, KYC_EXTENSIONS, KYC_MAX_FILE_BYTES, KYC_MAX_PAGES), connect-api interaction 586 — fetch required document list, connect-api interaction 587 — upload one document (multipart), KYC_NO_RECORDS — "No Records Found" is an empty state, KYC Document Upload (/console/documents), kycEnabled / useKycEnabled entitlement gate, uploadInteraction (shared multipart transport), Watermark provenance stamp (opt-in per doc_type) (+11 more)

### Community 77 - "poll.sh"
Cohesion: 0.16
Nodes (15): acquire_lock(), alert(), clear_hold(), deploy_image(), gate(), hold_is_falsified(), is_hold(), log() (+7 more)

### Community 78 - "ProductsMegaPanel.tsx"
Cohesion: 0.20
Nodes (10): DropdownColumnHeader(), DropdownGrid(), DropdownGridColumn, DropdownGridProps, MenuItemLink(), MenuItemLinkProps, pastelColors, NavApiItem (+2 more)

### Community 79 - "EndpointDetail.tsx"
Cohesion: 0.08
Nodes (30): ApiInputOutputPreview(), EndpointDetail(), RequestSection(), FieldList(), HttpMethodTag(), Method, METHOD_STYLES, SHORT (+22 more)

### Community 80 - "Eko EPS Partner Ecosystem"
Cohesion: 0.12
Nodes (18): AePS / Biometric Authentication Service, Assisted Banking / Business Correspondent Service, Eko EPS Partner Ecosystem, Money Transfer / Remittance Service, Payment Gateway / Online Payment Processing, Payments Bank (RBI-Licensed), FingPay Logo, FingPay (+10 more)

### Community 81 - "IndustryPageLayout.tsx"
Cohesion: 0.07
Nodes (50): BreadcrumbItem, BreadcrumbNav(), BreadcrumbNavProps, BreadcrumbVariant, VARIANT_STYLES, CodeBlock(), CodeBlockProps, exampleApiCode (+42 more)

### Community 82 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, erasableSyntaxOnly, lib, module, moduleResolution, noEmit, outDir, skipLibCheck (+9 more)

### Community 83 - "src/client.ts"
Cohesion: 0.19
Nodes (11): buildFormData(), EpsClient, EpsClientOptions, here, isBlob(), matchesType(), SdkEndpoint, SdkParam (+3 more)

### Community 84 - "ConsoleLayout.tsx"
Cohesion: 0.06
Nodes (31): ConsoleLayout(), ConsoleNav(), CREDENTIALS_ITEM, DOCUMENTS_ITEM, Flow, flowItem(), HOME_ITEM, MANAGE_ACCOUNT (+23 more)

### Community 85 - "eko-signing.ts"
Cohesion: 0.19
Nodes (8): base64Bytes(), base64Utf8(), buildSignedHeaders(), computeSecretKey(), hmacSha256Base64(), ekoSigningPlugin, SecurityEntry, SignedHeaders

### Community 86 - "Backend-only signed SDKs (@ekoindia/eps-sdk, ekoindia/eps-sdk PHP)"
Cohesion: 0.20
Nodes (11): parseFilters allow-list (trust boundary), POST /transactions/search (POST, not GET), selectEvalueAccountId (E-value account resolution), INDIAN_STATES (probed from interaction 387), Interaction 522 — submitBusiness / BUSINESS_FIELDS, Backend-only signed SDKs (@ekoindia/eps-sdk, ekoindia/eps-sdk PHP), eko-signing.ts in-browser HMAC signing (Web Crypto), php-split subtree mirror → Packagist (+3 more)

### Community 87 - "EPS transactional MCP server"
Cohesion: 0.12
Nodes (17): eps plugin distribution (marketplace + per-agent install), Agent governance & safety guardrails, Live freshness (version + changelog, EPS_BUNDLE_URL remote refresh), X-Eko-Allowed-Apis tool scoping, EPS transactional MCP server, VITE_SHOW_TRANSACT_MCP marketing gate, Auto-pull poller (image digest watcher), sanitizeError (PII-safe error curation) (+9 more)

### Community 88 - "auto-release.mjs"
Cohesion: 0.26
Nodes (16): canonPackageJson(), cmpSemver(), DRY_RUN, ensureTag(), fingerprint(), localFileMap(), main(), npmView() (+8 more)

### Community 89 - "Edit Flow (Flow A) — propose changes as a PR"
Cohesion: 0.22
Nodes (10): Admin Config Console v1 (in-browser GitOps editor), Deploy Flow (Flow B) — dev to main PR, Edit Flow (Flow A) — propose changes as a PR, Editable file allowlist + path sanitization, Persisted admin GitHub token keyed by session id, 409 STALE_CONTENT concurrent-edit guard, Separate container from eps-backend, <FileUpload> control (+2 more)

### Community 90 - "KycUploadDialog.tsx"
Cohesion: 0.07
Nodes (36): KycUploadDialog(), KycUploadDialogProps, slugify(), toastError, upload, TooltipContent, DEFAULT_BLUR_THRESHOLD, configOf() (+28 more)

### Community 91 - "EkoLogo.tsx"
Cohesion: 0.33
Nodes (7): Eko Platform Services (EPS) Brand, Eko Platform Services Logo (gold icon, white text), EPS Logo (gold icon, gold wordmark), EPS Logo (gold icon, white wordmark), PrintReceipt(), EkoLogo(), EkoLogoProps

### Community 92 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, ignoreDeprecations, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+7 more)

### Community 93 - "Feature: Notifications"
Cohesion: 0.18
Nodes (10): 1. The pull loop, 2. The endpoints, 3. The view, 4. The surfaces, 5. Deliberately not ported from Eloka, 6. Phase 2: web push, Feature: Notifications, Terminal versus transient (+2 more)

### Community 94 - "api-product-pages.ts"
Cohesion: 0.20
Nodes (15): FaqList(), ProductPageContent, API_PRODUCT_PAGES, ProductPageData, ProductPageSeo, VERIFICATION_STEPS_BASE, COMMON_API_FAQS, FAQ_TAGS (+7 more)

### Community 95 - "eko.ts"
Cohesion: 0.05
Nodes (54): createEkoLogger(), EkoLogEntry, EkoLogger, EkoLogLevel, noopEkoLogger, parseEkoLogLevel(), REDACTED_REQUEST_FIELDS, REDACTED_RESPONSE_FIELDS (+46 more)

### Community 96 - "composer.json"
Cohesion: 0.13
Nodes (14): autoload, autoload-dev, psr-4, psr-4, description, license, name, Eko\\Eps\\ (+6 more)

### Community 97 - "MdxGuide.tsx"
Cohesion: 0.24
Nodes (7): ALIAS, Callout(), CalloutVariant, VARIANTS, MDX_COMPONENTS, MdxGuide(), GUIDE_COMPONENTS

### Community 98 - "Eko Payment Services (EPS) API Platform"
Cohesion: 0.19
Nodes (14): Address Verification, BHIM App, Eko Payment Services (EPS) API Platform, QR Code Payment, Reverse Geocoding API, Salary Disbursal (Payroll Payout), Secure Payment, UPI (Unified Payments Interface) (+6 more)

### Community 99 - "@ekoindia/eps-backend BFF"
Cohesion: 0.18
Nodes (14): Signup session role, EPS Backend Phase 4 docs-chat agent design, SignupView lightweight /me view, Prune plans once shipped, Superpowers SDD artifact index, dev eps-backend service (build from repo root), prod eps-backend service, prod poller service (+6 more)

### Community 100 - "SignupService step orchestration"
Cohesion: 0.23
Nodes (12): User Onboarding (Self-Serve Signup) implementation plan, SignupService step orchestration, Two-entry signup step registry, Business Details Step implementation plan, Signup Profile Context + Prefill implementation plan, User Onboarding design spec, SignupState (server-projected onboarding state), Business Details onboarding step design (+4 more)

### Community 101 - "Agent packages release runbook"
Cohesion: 0.21
Nodes (13): AI-Native Agent Platform (feature/ai-native-agent-platform), packages/claude-plugin-eps (MCP + skills + /eps command), Distribution decision: public npm + Packagist, GitHub Packages rejected for public distribution, Agent-ready (today) vs AI-native (target rung), EPS strategic buy-in deck plan, Thesis: one source of truth → everything regenerates in sync, AI-Native EPS Platform high-level plan (spine + 5 phases) (+5 more)

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

### Community 107 - "PUD-ConnectProd1 — migrating Docker from `vfs` to `overlay2`"
Cohesion: 0.14
Nodes (13): 1. Preflight — all of it days BEFORE the window, none of it during, 1a. Does `/data` actually support overlay2?, 1b. Space gate — the host must hold three copies at once, 1c. Prove every image is re-pullable BEFORE taking anything down, 1d. Full inventory, 2. Capture `ems` and snapshot volume data, 3. The window, 4. Verify — all of it, before declaring the window closed (+5 more)

### Community 108 - "PinStep.tsx"
Cohesion: 0.29
Nodes (4): InputOTP, InputOTPGroup, InputOTPSlot, PinStep()

### Community 109 - "build-context-pack.ts"
Cohesion: 0.31
Nodes (7): buildContextPackBody(), CONTEXT_PACK_FILES, ContextPackFile, body, bundle, withHeading(), EPS_MCP_PKG

### Community 110 - "@ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools)"
Cohesion: 0.17
Nodes (12): @ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools), Certbot renewal timer gotcha, Docker data-root on /data pinned to the vfs driver, nginx reverse-proxy config (X-Real-IP, no buffering, TLS), mcp.eko.in path namespace contract (/transact/, /context/ reserved), eps-transact-mcp VM deployment runbook, Obsidian Terminal visual direction, Variant A — The Agent Demo (/welcome) (+4 more)

### Community 112 - "EPS secret-key HMAC signing scheme"
Cohesion: 0.21
Nodes (12): Backend-only signing policy (context MCP), Stateless pass-through signer (no persistence, no body logging), @ekoindia/eps-sdk (Node.js backend SDK), EpsClient (JS), signSecretKey helper (JS), ekoindia/eps-sdk (PHP backend SDK), EpsClient (PHP), Courier-not-consumer mental model for PID data (+4 more)

### Community 113 - "@ekoindia/eps-transact-mcp (transactional MCP server)"
Cohesion: 0.18
Nodes (12): EPS_BUNDLE_URL remote bundle override, @ekoindia/eps-context-mcp (stdio documentation MCP server), Tiered, lazy, secret-free tool design, Best-effort npm update check, parity.copied-utils.test.ts content-hash pin, @ekoindia/eps-transact-mcp (transactional MCP server), MCP tool annotations for side-effecting verification tools, Registry-driven tool generation from api-specs.ts (+4 more)

### Community 114 - "Aadhaar (India Biometric ID)"
Cohesion: 0.18
Nodes (12): Aadhaar (India Biometric ID), Aadhaar Verification Illustration, AePS (Aadhaar Enabled Payment System), AePS Main Hero Illustration, Assisted Cash Management Illustration, Assisted Cash Management Service, Bank Account Verification, Bank Verification Illustration (+4 more)

### Community 116 - "eps-backend — Docker Ops Cheatsheet"
Cohesion: 0.14
Nodes (13): 10. Local dev, 1. The invariant command, 2. Where everything lives, 3. Status & health, 4. Logs, 5. Restart & recreate, 6. Changing `.env` safely, 7. Redis / Valkey (+5 more)

### Community 117 - "Pull-based auto-deploy poller"
Cohesion: 0.20
Nodes (11): Deterministic GHCR authfile (.ghcr-auth.json), Health gate and automatic rollback, HOLD sentinel file, KV_ENCRYPTION_KEY is a stable secret, KV store redundancy tiers (Valkey / in-memory / Upstash), Merge gate IS the deploy gate, Pull-based auto-deploy poller, Seed deploy.env with the tag, not a digest (+3 more)

### Community 118 - "http/connect.test.ts"
Cohesion: 0.12
Nodes (7): ConnectClient, developer, harness(), NOW, uploadHarness(), upstream(), withCookie

### Community 119 - "Aadhaar Biometric Authentication with RDService"
Cohesion: 0.25
Nodes (11): qScore retry/block thresholds, Aadhaar Biometric Authentication with RDService, UIDAI registered devices (L1 mandate), wadh digest binding capture to a KYC API version, Activate User Service endpoint, RSA Aadhaar-number encryption scheme, AePS Fingpay Biometric eKYC endpoint, fType=2 per NPCI FIR-FMR single-PID-block guidance (+3 more)

### Community 120 - "RdServiceTester.tsx"
Cohesion: 0.19
Nodes (23): LogLine, nowTs(), qScoreColor(), RdServiceTester(), statusBadge(), attrValue(), buildPidOptionsXml(), captureFromDevice() (+15 more)

### Community 122 - "Interaction 154 — transaction history upstream"
Cohesion: 0.20
Nodes (10): SIMPLIBANK_HISTORY_* upstream override (eko.historyUrl), inferSearchField (quick-search shape heuristic), Interaction 154 — transaction history upstream, debitOf / creditOf money rules, Per-page totals / Closing Balance caveat, Transaction History (/console/transactions), transactions.sample.ts (captured interaction-154 response), Hard rule: adopt shape, never live values (+2 more)

### Community 123 - "`onboarding === 1` classification gate in getProfile"
Cohesion: 0.22
Nodes (10): connect-api login delegation (CONNECT_API_BASE_URL), `onboarding === 1` classification gate in getProfile, respond() signup→developer session upgrade, `signup` session role, GHCR authentication (private images, .ghcr-auth.json), GHCR digest poller auto-deploy with health gate + rollback, buildApp() extraction + api/index.ts serverless entry, Upstash Redis (in-memory KV cannot survive serverless) (+2 more)

### Community 124 - "eps-context-mcp/vercel.json"
Cohesion: 0.20
Nodes (9): maxDuration, buildCommand, functions, api/index.ts, bom1, outputDirectory, regions, rewrites (+1 more)

### Community 125 - "LanguageSelector.tsx"
Cohesion: 0.50
Nodes (6): LanguageSelector(), ensureGoogleTranslateLoaded(), LANGUAGES, translateSelect(), useLanguage(), Window

### Community 126 - "EPS agent plugin (eps)"
Cohesion: 0.31
Nodes (9): Retrieve-then-answer grounding, /eps slash command, Codex does not launch plugin-bundled stdio MCP, EPS agent plugin (eps), integrate-eps skill, Recipe branching on response_type_id / status, run-a-recipe skill, EPS secret-key HMAC-SHA256 convention (+1 more)

### Community 127 - "Auto-deploy poller (poll.sh sidecar)"
Cohesion: 0.22
Nodes (9): eps-context-mcp remote server decision record, mcp.eko.in path-namespaced URL contract, Dozzle + Uptime Kuma observability layer, Poller alternatives + VM observability evaluation, Komodo (rejected single-pane deploy authority), vfs storage driver disk caveat, HOLD sentinel + health-gated rollback, One poller container per project (+1 more)

### Community 128 - "poll_test.sh"
Cohesion: 0.30
Nodes (8): eq(), hooked(), load(), no(), ok(), seed_deploy(), setup(), poll_test.sh script

### Community 129 - "utils.ts"
Cohesion: 0.07
Nodes (26): AdminConsole(), AdminDocEditor(), AdminDocsList(), LoginForm(), maskMobile(), adopt, refresh, toastInfo (+18 more)

### Community 130 - "eps-transact-mcp/src/load-bundle.ts"
Cohesion: 0.22
Nodes (7): BAKED_PATH, here, apiBySlug, here, surface, surfaceBySlug, tools

### Community 131 - "eps-transact-mcp/src/update-check.ts"
Cohesion: 0.44
Nodes (6): checkForUpdate(), isNewer(), notifyIfOutdated(), parseStrict(), updateNotice(), VersionState

### Community 132 - "audit/accessLog.ts"
Cohesion: 0.36
Nodes (5): AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, sample

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

### Community 140 - "Interaction 522 USER_ONBOARDING_BUSINESS"
Cohesion: 0.40
Nodes (5): Eko client onboarding interactions (521/523/170/10005/5), Deliberate client+BFF validation duplication, 36 Indian states inlined verbatim instead of fetched, Interaction 522 USER_ONBOARDING_BUSINESS, Native <select> over Radix Select

### Community 141 - "KYC_DOC_CONFIG — per-doc_type local overrides"
Cohesion: 0.29
Nodes (7): DOCUMENT_STATUS / statusOfDocument (1 pending, 2 success, 3 resubmit), ignoreNestedDialogInteraction (Radix top-layer guard), KYC_DOC_CONFIG — per-doc_type local overrides, KycUploadDialog, `multiple` — per-slot attachments combined into one PDF, parseDocumentList (presentation overlay, drops is_required), Sample documents (sampleUrl blanks in public/kyc-samples)

### Community 142 - "eps-backend Production VM Deploy Runbook"
Cohesion: 0.38
Nodes (7): buildApp side-effect-free factory, Vercel path rejected for production, SimpliBank IP allowlist constraint, eps-backend on Vercel (managed serverless), nginx must overwrite X-Real-IP, eps-backend Production VM Deploy Runbook, debug_auth tool (known-answer test vector)

### Community 143 - "FileUpload.tsx"
Cohesion: 0.10
Nodes (26): acceptsImages(), acceptsNonImages(), acceptsOnlyImagesAndPdfs(), acceptsType(), checkBlurOrExplain(), FileUpload(), FileUploadProps, formatBytes() (+18 more)

### Community 144 - "plugin-marketplace.test.ts"
Cohesion: 0.29
Nodes (6): marketplace, MarketplaceEntry, McpConfig, pluginDirs, PluginManifest, ROOT

### Community 145 - "render-products-index.test.ts"
Cohesion: 0.08
Nodes (22): ApiProductId, ApiProductRef, ProductPageDataShape, page, product, related, specs, PRODUCTS_TXT_PARTS (+14 more)

### Community 146 - "tryit-client.ts (client-only Scalar modal singleton)"
Cohesion: 0.17
Nodes (12): descriptionFile endpoint notes (src/content/docs/endpoints/*.md), remark-callout (hand-rolled GitHub-alert mdast transform), resolveDescription / resolveShortDescription, Palette SSG safety (never renders during prerender), Console sandbox / API playground (planned), Try-it CORS proxy (VITE_SCALAR_PROXY_URL), DEV-only credential prefill, Interactive OpenAPI document ({ interactive: true }) (+4 more)

### Community 147 - "eps-context-mcp http.ts stateless Hono transport"
Cohesion: 0.33
Nodes (6): packages/eps-agent-core zero-dep bundle accessors, Anonymous edge hosting over VM co-hosting, eps-context-mcp http.ts stateless Hono transport, Cache-Control: no-store on POST /mcp, Shared HTTP adapter extraction deferred, Pull-based deploys + nginx owns :443 (ruling constraints)

### Community 148 - "bundle-types.parity.test.ts"
Cohesion: 0.33
Nodes (4): here, localSrc, NAMES, siteSrc

### Community 149 - "ZohoSignupForm.tsx"
Cohesion: 0.33
Nodes (7): buildSrc(), ZohoSignupForm(), buildLeadWebsiteUrl(), ZOHO_SIGNUP_EMBED_URL, isBrowser(), safeLocationHref(), safeSessionStorage

### Community 151 - "api-products.ts"
Cohesion: 0.07
Nodes (33): ACTIVE_PRODUCTS_MAP, API_PRODUCTS_DATA, API_PRODUCTS_MAP, PRODUCTS_SECTION_SLUG, STALE_DISPLAY_CHIPS, ACTIVE_INDUSTRIES_LIST, ApiGridItem, ComplianceItem (+25 more)

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

### Community 211 - "BusinessStep.tsx"
Cohesion: 0.16
Nodes (15): BUSINESS_FIELDS, BUSINESS_GROUPS, BusinessField, COMPANY_TYPES, INDIAN_STATES, field(), validateField(), BusinessStep() (+7 more)

### Community 212 - "AnimatedRoutes.tsx"
Cohesion: 0.40
Nodes (4): AnimatedRoutes(), AnimatedRoutesProps, PageTransition(), PageTransitionProps

### Community 214 - "Stale-chunk auto-reload"
Cohesion: 0.38
Nodes (7): /assets/* excluded from SPA-shell rewrite, Stale-chunk auto-reload, ErrorBoundary around routes, installChunkErrorReload / reloadOnceForStaleChunk, SSG prerender pipeline (ssg/plugin.ts, prerender.ts), ROUTE_CHUNK_MAP modulepreload, Static pre-rendered HTML with SPA fallback

### Community 216 - "build-install-matrix.ts"
Cohesion: 0.22
Nodes (7): HARNESSES, HarnessInstall, HarnessMcp, HarnessPluginInstall, MCP_CMD, PluginInstallStep, matrix

### Community 217 - "ErrorBoundary.tsx"
Cohesion: 0.16
Nodes (9): App(), ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, installChunkErrorReload(), isChunkLoadError(), reloadOnceForStaleChunk(), doHydrate() (+1 more)

### Community 219 - "MarkdownCodeBlock.tsx"
Cohesion: 0.29
Nodes (4): LANG_ALIAS, MarkdownCodeBlock(), mdCodeTheme, prismLang()

### Community 220 - "SecretKeyTester.test.tsx"
Cohesion: 0.32
Nodes (5): accessKeyInput(), enterGoldenInputs(), GOLDEN, realCompute, timestampInput()

### Community 224 - "EkoShield Product (Fraud Prevention & KYC)"
Cohesion: 0.47
Nodes (6): EkoShield Product (Fraud Prevention & KYC), Employee Verification / Background Check, KYC & Identity Verification, EkoShield Logo (shield, fingerprint, 'Your Armor Against Fraud'), EkoShield KYC & Verification Dashboard Mockup, Employee Verification Illustration

### Community 225 - "eko vs connect auth provider seam"
Cohesion: 0.33
Nodes (6): ProfileResult 'onboarding' variant, eps-backend is the connect-api BFF equivalent, onboarding===1 checked before the user_type gate, eko vs connect auth provider seam, EPS business-partner gate stays in this service, Persist upstream creds before setting cookies

## Ambiguous Edges - Review These
- `Editable file allowlist + path sanitization` → `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`  [AMBIGUOUS]
  docs/admin-console.md · relation: references
- `AI-native vs AI-friendly distinction` → `API keys management (blocked on issuance contract)`  [AMBIGUOUS]
  docs/console-roadmap.md · relation: conceptually_related_to

## Knowledge Gaps
- **1099 isolated node(s):** `npx`, `@ekoindia/eps-context-mcp`, `run.sh script`, `_pop.sh script`, `name` (+1094 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Editable file allowlist + path sanitization` and `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `AI-native vs AI-friendly distinction` and `API keys management (blocked on issuance contract)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `doHydrate()` connect `ErrorBoundary.tsx` to `app.ts`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `app()` connect `app.ts` to `ErrorBoundary.tsx`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `requestId()` connect `app.ts` to `buildApp.ts`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **What connects `npx`, `@ekoindia/eps-context-mcp`, `run.sh script` to the rest of the system?**
  _1099 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api-specs-common.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.044620253164556964 - nodes in this community are weakly interconnected._