# Graph Report - .  (2026-08-02)

## Corpus Check
- Large corpus: 721 files · ~815,150 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3994 nodes · 9332 edges · 210 communities (187 shown, 23 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 209 edges (avg confidence: 0.78)
- Token cost: 1,329,603 input · 0 output

## Community Hubs (Navigation)
- Docs Endpoint Detail Pane
- Context MCP Server & Auth Debug
- Code Samples & Language Tabs
- Marketing UI Primitives
- In-Browser Signing & RD Testers
- Recipe Flowchart Renderer
- Eko Log Redaction
- Backend Entry & Access Logging
- Agent Bundle Types & Builder
- Session Cookies & Security Log
- Pricing XLSX & BBPS Operators
- Admin GitOps Console
- Payments Pricing Calculator
- Markdown Twin Renderers
- Docs Nav Tree & Guides
- Business Dashboard Widgets
- KYC Upload Dialog
- Homepage Marketing Sections
- Transact MCP Package Manifest
- API Spec Previews
- eps-backend Package Manifest
- PDF Toolkit
- Backend Config & Signup Mount
- Docs Layout & AI Hints
- API Input/Output Preview
- Context MCP Package Manifest
- Icons & Mini TOC
- Connect Widget Wrapper
- Connect Dialog Host
- Console Layout Nav
- Header Dropdown Panels
- Auth Provider & KYC Routes
- App Route Table
- Dashboard Widget Cards
- Console Transactions Client
- Docs Path & GitHub Service
- Frontend Auth Context
- Industries & Curated API Refs
- sdk-js Package Manifest
- Mock Server Package Manifest
- Card Components
- Command Palette
- PDF Worker Client
- Console Layout Tests
- Connected Banking Calculator
- API Products Data
- Eko Upstream Client
- Dashboard Sample & View
- Transact MCP HTTP & Access Log
- Server Render & Legal Layout
- Pricing Calculator Page
- Footer
- Agent Bundle Emitters
- AI-Native Platform Concepts
- SSG Prerender Pipeline
- File Upload Component
- Mascot UI State Concepts
- Developer Console & Profile
- Backend Session & Admin Tests
- Camera Dialog
- Search Index Builder
- Industries x Packs Architecture
- PHP SDK Client
- Markdown Callouts & Code
- MDX Guide Components
- Profile Identity Helpers
- Print Receipt & Logo
- Earnings Summary
- Docs Authoring Guards
- Transact MCP Bundle Types
- Raise Issue Dialog
- Transact MCP Server Tests
- Doc Markdown Renderer
- Transact MCP Context & Fetch
- Earnings Row & Input
- Docs Three-Pane Components
- KYC Documents Flow
- Deploy Poller Script
- KV Store Contract
- AI Harness Brand Icons
- Partner Ecosystem Concepts
- Admin GitOps Design
- eps-backend TS Config
- JS SDK Client
- Wallet Balance Card
- Site Header
- EkoShield Page & Picture
- Agent Distribution & Gating
- Auto-Release Script
- Tracking Params
- User Menu
- PAN Step & Step Resolver
- sdk-js TS Config
- App Error Boundary
- Install Matrix Builder
- Connect Auth Provider
- PHP Composer Manifest
- Code Snippets Theming
- Payment Capability Concepts
- Signup Session & Compose
- Mobile Summary Drawer
- AI Platform Strategy
- Sample Response Reconciliation
- Context MCP TS Config
- Mock Server Matching
- Mock Server TS Config
- Transact MCP TS Config
- Deploy Dialog Primitives
- OTP Input & Label
- Business Fields Data
- VM Deploy Runbook
- Signup Implementation Plans
- Backend-Only Signing SDKs
- MCP Bundle Parity & Updates
- Verification Product Art
- E-Sign Integration
- Trust Boundary Validation
- Poller Deploy Safety
- API Picker & Badge
- Aadhaar Biometric RDService
- Signup Profile Context
- EkoShield Brand Concepts
- Transaction History Flow
- Connect Login Delegation
- Context MCP Vercel Config
- Pricing Tabs
- Agent Plugin & Recipes
- Remote MCP Decision Record
- Poller Test Harness
- Eko Client Tests
- Transact MCP Bundle Loading
- MCP Update Check
- Zoho Signup Embed
- Fade-In Hydration Tests
- Packs & AVDM Capture
- Docs Chat Agent Design
- eps-backend Vercel Config
- Copied-Utils Parity Pins
- Verification & Network Art
- Core Transaction Endpoints
- Stale Chunk Auto-Reload
- KYC Document Status Rules
- Vercel vs VM Deploy Decision
- Sign Agreement Step Tests
- Plugin Marketplace Test
- Try-It Console & CORS Proxy
- Onboarding Gate & Auth Seam
- Edge MCP Hosting Decisions
- Bundle Types Parity Test
- Route Transitions
- Step Rail UI
- Onboarding Interaction Rules
- UI/UX Improvement Plan
- Shell Pop Helper
- Deploy Artifacts Test
- Context MCP Bake Script
- Fixtures Bake Script
- Transact MCP Bake Script
- sdk-js Surface Bake
- sdk-php Surface Bake
- API Coverage Phases
- Context MCP npx Install
- Payment Partner Logos
- Android RDService Integration
- MDX Prerender Plugin
- Edge Transport Hardening
- Vercel Config Test
- Planned Telemetry & Audit
- Signup Step Registry
- Shell Run Script
- curl External Tool
- docker External Tool
- flock External Tool
- redis-cli External Tool
- skopeo External Tool
- sleep External Tool
- sync External Tool
- First-Party Cookie Strategy
- Transact MCP Vitest Config
- MDX Type Declaration
- Vite Env Types
- Imagetools Types
- AePS Settlement Phase
- Transaction Lifecycle Phase
- Spec Provenance Caveat
- UAT / Production Toggle

## God Nodes (most connected - your core abstractions)
1. `cn()` - 149 edges
2. `Button` - 47 edges
3. `SITE_URL` - 40 edges
4. `docsHref()` - 37 edges
5. `openZohoChat()` - 36 edges
6. `FadeIn()` - 33 edges
7. `productHref()` - 33 edges
8. `ApiSpec` - 29 edges
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

## Communities (210 total, 23 thin omitted)

### Community 0 - "Docs Endpoint Detail Pane"
Cohesion: 0.04
Nodes (71): EndpointDetail(), FieldList(), HttpMethodTag(), Method, METHOD_STYLES, SHORT, Variant, InlineCode() (+63 more)

### Community 1 - "Context MCP Server & Auth Debug"
Cohesion: 0.05
Nodes (64): App, config, getApp(), outer, AuthCause, AuthCheck, checkSignatureShape(), checkTimestamp() (+56 more)

### Community 2 - "Code Samples & Language Tabs"
Cohesion: 0.08
Nodes (63): CopyButton(), NumberedCode(), TabButton(), CodeSamples(), MODES, LangIcon(), API_DEFAULT_VERSION, API_AUTH_DOCS_URL (+55 more)

### Community 3 - "Marketing UI Primitives"
Cohesion: 0.08
Nodes (50): ApiChip(), BreadcrumbItem, BreadcrumbNav(), BreadcrumbNavProps, BreadcrumbVariant, VARIANT_STYLES, FadeIn(), FadeInProps (+42 more)

### Community 4 - "In-Browser Signing & RD Testers"
Cohesion: 0.06
Nodes (53): CopyBtn(), CopyState, LogLine, nowTs(), qScoreColor(), RdServiceTester(), statusBadge(), localTime() (+45 more)

### Community 5 - "Recipe Flowchart Renderer"
Cohesion: 0.05
Nodes (57): ARC_TINTS, assignLanes(), edgeLabel(), FREQUENCY_FILL, FREQUENCY_TEXT, METHOD_FILL, METHOD_TEXT, nodeHoverRules() (+49 more)

### Community 6 - "Eko Log Redaction"
Cohesion: 0.06
Nodes (44): EkoLogEntry, EkoLogger, noopEkoLogger, parseEkoLogLevel(), REDACTED_REQUEST_FIELDS, REDACTED_RESPONSE_FIELDS, FIELDS, RESPONSE (+36 more)

### Community 7 - "Backend Entry & Access Logging"
Cohesion: 0.07
Nodes (46): getApp(), handler(), AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, sample, createEkoLogger() (+38 more)

### Community 8 - "Agent Bundle Types & Builder"
Cohesion: 0.06
Nodes (52): AgentApiDetail, AgentApiIndexEntry, AgentBundle, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic, AgentGettingStartedTopic (+44 more)

### Community 9 - "Session Cookies & Security Log"
Cohesion: 0.07
Nodes (34): SecurityLogger, ACCESS_COOKIE, REFRESH_COOKIE, SessionClaim, Sessions, AdminDeps, normalizeMobile(), DatasetResult (+26 more)

### Community 10 - "Pricing XLSX & BBPS Operators"
Cohesion: 0.15
Nodes (47): PricedApi, BBPS_OPERATORS, BbpsOperator, OperatorRow, ROWS, AmountSlab, BbpsCategory, DmtSlab (+39 more)

### Community 11 - "Admin GitOps Console"
Cohesion: 0.06
Nodes (32): AdminConsole(), AdminDocEditor(), getContent, propose, AdminDocsList(), DeployToProduction(), production, LoginForm() (+24 more)

### Community 12 - "Payments Pricing Calculator"
Cohesion: 0.08
Nodes (45): parseSelectionFromParams(), PaymentsCalculator(), sanitizeTxns(), serializeSelection(), PaymentsPicker(), PaymentsPickerProps, PickerRow(), ADD_EARNINGS_EVENT (+37 more)

### Community 13 - "Markdown Twin Renderers"
Cohesion: 0.17
Nodes (44): SIGNUP_PAGE, PRICING_GROUPS, productHref(), recipeHref(), CB_BANKS, renderDocsIndexMarkdown(), faqBlocks(), FaqMarkdownItem (+36 more)

### Community 14 - "Docs Nav Tree & Guides"
Cohesion: 0.08
Nodes (43): collectActiveBranchIds(), DocsNavTree(), normalizePath(), soleBranchChain(), branch(), findSoleChildBranch(), GuideMeta, GUIDES (+35 more)

### Community 15 - "Business Dashboard Widgets"
Cohesion: 0.08
Nodes (40): BusinessDashboard(), isEmpty(), MostUsedServicesWidget, SuccessRatesWidget, load, view(), withServices(), UsageAnalyticsWidget (+32 more)

### Community 16 - "KYC Upload Dialog"
Cohesion: 0.07
Nodes (34): KycUploadDialog(), KycUploadDialogProps, slugify(), toastError, upload, FileUploadOptions, FileUploadProps, WatermarkSpec (+26 more)

### Community 17 - "Homepage Marketing Sections"
Cohesion: 0.08
Nodes (38): CodeBlock(), CodeBlockProps, exampleApiCode, exampleIntegrationSteps, examplePaymentCode, ComplianceSection(), CTASection(), DeveloperSection() (+30 more)

### Community 18 - "Transact MCP Package Manifest"
Cohesion: 0.04
Nodes (46): @ekoindia/eps-sdk, bin, eps-transact-mcp, dependencies, @ekoindia/eps-sdk, hono, @hono/node-server, @modelcontextprotocol/sdk (+38 more)

### Community 19 - "API Spec Previews"
Cohesion: 0.10
Nodes (43): collectImpFields(), collectImpOutputs(), getApiPreviewsForProduct(), getDisplaySpecsForProduct(), getProductDocHref(), getVerifiableFieldsForProduct(), humanizeLabel(), isStatusSpec() (+35 more)

### Community 20 - "eps-backend Package Manifest"
Cohesion: 0.04
Nodes (45): jose, bin, eps-backend, dependencies, hono, @hono/node-server, jose, redis (+37 more)

### Community 21 - "PDF Toolkit"
Cohesion: 0.08
Nodes (35): compressPdf(), extractPdfImages(), imageToJpeg(), mergePdfs(), pdfFromImages(), pdfPageCount(), PdfSource, toBytes() (+27 more)

### Community 22 - "Backend Config & Signup Mount"
Cohesion: 0.07
Nodes (25): EkoLogLevel, BusinessDetails, ZohoClient, Config, REQUIRED, base, baseEnv, Deps (+17 more)

### Community 23 - "Docs Layout & AI Hints"
Cohesion: 0.10
Nodes (28): AiHint(), SITE_TITLE_SUFFIX, DocsLayout(), DocsTheme, DocsThemeToggle(), buildLlmPrompt(), copyText(), PageActions() (+20 more)

### Community 24 - "API Input/Output Preview"
Cohesion: 0.09
Nodes (33): ApiChipProps, relevanceColors, ApiField, ApiInputOutputPreview(), ApiInputOutputPreviewProps, ApiPreviewItem, ApiSampleJson, MultiApiPreview() (+25 more)

### Community 25 - "Context MCP Package Manifest"
Cohesion: 0.05
Nodes (40): bin, eps-context-mcp, dependencies, hono, @hono/node-server, @modelcontextprotocol/sdk, zod, description (+32 more)

### Community 26 - "Icons & Mini TOC"
Cohesion: 0.08
Nodes (32): Eps(), McpIcon(), IconComponent, MiniToc(), MiniTocProps, TocEntry, SITE_ORG_NAME, AgentsPage() (+24 more)

### Community 27 - "Connect Widget Wrapper"
Cohesion: 0.09
Nodes (28): ConnectWidget(), ConnectWidgetProps, IntrinsicElements, JSX, react, Status, syncWidgetProps(), LOAD_EVALUE (+20 more)

### Community 28 - "Connect Dialog Host"
Cohesion: 0.09
Nodes (28): CameraOptions, CameraResult, CameraDialog, CHROME, ConnectDialogs, DialogContext, DialogRequest, DialogResult (+20 more)

### Community 29 - "Console Layout Nav"
Cohesion: 0.10
Nodes (30): ConsoleNav(), CREDENTIALS_ITEM, DOCUMENTS_ITEM, Flow, flowItem(), HOME_ITEM, LifecycleBadge(), MANAGE_ACCOUNT (+22 more)

### Community 30 - "Header Dropdown Panels"
Cohesion: 0.06
Nodes (31): DropdownColumnHeader(), DropdownGrid(), DropdownGridColumn, DropdownGridProps, MenuItemLink(), MenuItemLinkProps, pastelColors, AI_ASK_PROMPT (+23 more)

### Community 31 - "Auth Provider & KYC Routes"
Cohesion: 0.09
Nodes (23): AuthProvider, UpstreamSession, VerifyResult, isAllowedKycFile(), KYC_EXTENSIONS, KYC_TYPES, kycClientRefId(), mountConnect() (+15 more)

### Community 32 - "App Route Table"
Cohesion: 0.06
Nodes (33): AboutPage, Admin, AgentsPage, AiPage, BlogsMediaPage, ConsoleConnectTransaction, ConsoleCredentials, ConsoleDocuments (+25 more)

### Community 33 - "Dashboard Widget Cards"
Cohesion: 0.14
Nodes (18): SuccessRatesWidget(), LifecycleCard(), STATE_COPY, ACTIVE, Card, CardContent, CardDescription, CardFooter (+10 more)

### Community 34 - "Console Transactions Client"
Cohesion: 0.13
Nodes (28): MostUsedServicesWidget(), transactionsClient, creditOf(), debitOf(), deriveAmount(), describeRow(), hueOf(), inferSearchField() (+20 more)

### Community 35 - "Docs Path & GitHub Service"
Cohesion: 0.09
Nodes (13): docTypeFromPath(), ENDPOINTS_DIR, GUIDES_DIR, isEditableDocPath(), slugFromPath(), createDocsService(), DocItem, cfg (+5 more)

### Community 36 - "Frontend Auth Context"
Cohesion: 0.12
Nodes (27): AuthContext, AuthContextValue, AuthProvider(), classify(), Probe(), registeredHandler(), renderAuthed(), useAuth() (+19 more)

### Community 37 - "Industries & Curated API Refs"
Cohesion: 0.08
Nodes (29): API_PRODUCTS_MAP, STALE_DISPLAY_CHIPS, ACTIVE_INDUSTRIES_LIST, ApiGridItem, ComplianceItem, DEFAULT_INTEGRATION_STEPS, DISABLED_PRODUCT_NAMES, INDUSTRIES_LIST (+21 more)

### Community 38 - "sdk-js Package Manifest"
Cohesion: 0.06
Nodes (32): description, devDependencies, tsup, typescript, vitest, engines, node, files (+24 more)

### Community 39 - "Mock Server Package Manifest"
Cohesion: 0.06
Nodes (31): bin, eps-mock-server, description, devDependencies, tsup, typescript, vitest, engines (+23 more)

### Community 40 - "Card Components"
Cohesion: 0.08
Nodes (28): FeatureCard(), FeatureCardProps, ProductCard(), ProductCardProps, StatCard(), StatCardProps, UseCaseCard(), UseCaseCardProps (+20 more)

### Community 41 - "Command Palette"
Cohesion: 0.09
Nodes (28): CATEGORY_BADGE, CommandPalette(), CommandPaletteProps, escapeRegExp(), FIELD_WEIGHT, GROUPS, highlight(), ICON_TINT (+20 more)

### Community 42 - "PDF Worker Client"
Cohesion: 0.13
Nodes (23): call(), getWorker(), PdfCompressionResult, PdfFromImagesOptions, pending, reviveError(), decode(), landscapeJpeg() (+15 more)

### Community 43 - "Console Layout Tests"
Cohesion: 0.08
Nodes (18): ConsoleLayout(), connectInteractions, DEVELOPER, ContextProbe(), DEVELOPER, mockNavigate, mockState, useConsoleMe() (+10 more)

### Community 44 - "Connected Banking Calculator"
Cohesion: 0.12
Nodes (25): DEFAULT_INPUT, nearestStepIndex(), TICK_LABELS, TXN_STEPS, addApiToEstimate(), PricingTable(), RateRow(), Table (+17 more)

### Community 45 - "API Products Data"
Cohesion: 0.08
Nodes (25): API_PRODUCTS_DATA, ApiProductCategory, ApiProductId, ApiProductRef, PRODUCTS_SECTION_SLUG, ProductPageDataShape, page, product (+17 more)

### Community 46 - "Eko Upstream Client"
Cohesion: 0.09
Nodes (11): EkoClient, identityOf(), FILTER_RULES, mountTransactions(), parseFilters(), parsePaging(), foundProfile, harness() (+3 more)

### Community 47 - "Dashboard Sample & View"
Cohesion: 0.12
Nodes (26): SAMPLE_DASHBOARD_OBJECT, SAMPLE_SERVICE_LIST, DatePreset, block(), buildDashboardView(), DashboardMetric, DashboardView, DATASETS (+18 more)

### Community 48 - "Transact MCP HTTP & Access Log"
Cohesion: 0.12
Nodes (22): AccessLogger, AccessRecord, createAccessLogger(), noopAccessLogger, createApp(), extractToolName(), HttpDeps, RL_LIMIT (+14 more)

### Community 49 - "Server Render & Legal Layout"
Cohesion: 0.10
Nodes (14): DefaultMeta(), LegalPageLayout(), LegalPageLayoutProps, SectionDivider(), TooltipContent, Admin(), GrievancePage(), IndustriesPage() (+6 more)

### Community 50 - "Pricing Calculator Page"
Cohesion: 0.11
Nodes (26): MobileSummaryBar(), parseSelectionFromParams(), PricingCalculator(), sanitizeVolume(), SelectionEntry, serializeSelection(), ADD_API_EVENT, nearestStepIndex() (+18 more)

### Community 51 - "Footer"
Cohesion: 0.10
Nodes (19): state, FooterLinkItem, footerLinks, socialLinks, EPS_TRANSACT_MCP_CMD, EPS_TRANSACT_MCP_PKG, EPS_TRANSACT_MCP_URL, GITHUB_ORG_URL (+11 more)

### Community 52 - "Agent Bundle Emitters"
Cohesion: 0.09
Nodes (27): /ai hub page + /ai.md text twin, EPS backend-only auth model (secret-key derivation), buildApi (per-endpoint agent artifact), buildContextPackBody (one canonical pack body), buildFiles (vite-plugin-generate-agent-bundle emitter), buildFixtures (mock-server fixtures), buildIndex (compact agent index), buildInstallMatrix (per-harness MCP wiring) (+19 more)

### Community 53 - "AI-Native Platform Concepts"
Cohesion: 0.11
Nodes (27): AI-native agent platform layer, buildAgentBundle (pure deterministic bundle builder), /agent/eps.json canonical agent bundle, FNV-1a content-hash bundleVersion, AI-native vs AI-friendly distinction, Machine-readable capability manifest, Cross-harness agent evals, Guarded action tools (run_call_in_sandbox, scaffold_integration, validate_signature, run_conformance) (+19 more)

### Community 54 - "SSG Prerender Pipeline"
Cohesion: 0.13
Nodes (23): AppServer(), renderPage(), RenderResult, addFetchPriorityLow(), buildImageContentHashMap(), buildMaps(), fetchImagetoolsBuffer(), IMAGE_EXTENSIONS (+15 more)

### Community 55 - "File Upload Component"
Cohesion: 0.13
Nodes (18): acceptsImages(), acceptsNonImages(), acceptsOnlyImagesAndPdfs(), acceptsType(), FileUpload(), formatBytes(), isImageType(), PendingItem (+10 more)

### Community 56 - "Mascot UI State Concepts"
Cohesion: 0.08
Nodes (26): Chat Typing Indicator, Error / Not-Found UI State, Idle / Empty-State / Offline UI State, Live Support / Help UI State, Loading / Processing UI State, Success / Confirmation UI State, UI Celebration/Delight State, UI General/Greeting State (+18 more)

### Community 57 - "Developer Console & Profile"
Cohesion: 0.10
Nodes (26): Per-platform deploy/rewrite configs, ConsoleLayout (auth branches + left rail), Developer console (/console), My Profile page (/console/profile), PROFILE_DETAIL_BLOCKS allowlist, sessionStorage /me session cache, GET /wallet/balance BFF route (interaction 9), Module-scope wallet-balance cache (+18 more)

### Community 58 - "Backend Session & Admin Tests"
Cohesion: 0.15
Nodes (17): baseEnv, cfg, mk(), mountAdmin(), cfg, encHarness(), harness(), brokenCacheKv() (+9 more)

### Community 59 - "Camera Dialog"
Cohesion: 0.14
Nodes (18): CameraDevice, CameraDialog(), classifyDevices(), pickDeviceIndex(), RESOLUTION, ImageEditorDialog(), BoundingBox, Box (+10 more)

### Community 60 - "Search Index Builder"
Cohesion: 0.14
Nodes (23): hasProductPage(), getActiveProducts(), getAllDocNodes(), API_CATEGORY_ICONS, buildApiItems(), buildEndpointItems(), buildFaqItems(), buildGuideItems() (+15 more)

### Community 61 - "Industries x Packs Architecture"
Cohesion: 0.11
Nodes (25): Cross-linking model (Industry ↔ Pack ↔ Product), Per-page SEO essentials (JSON-LD FAQPage, OG, canonical), Two-axis Industries × Packs architecture, /industries/<slug> and /solutions/<slug> URL structure, /agents → /ai route rename + marketing redesign, Drop-in agent context packs (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md), /docs developer portal plan (spec-driven, 3-pane, SSG), Try-it via Scalar modal + ClientPlugin.beforeRequest (+17 more)

### Community 62 - "PHP SDK Client"
Cohesion: 0.09
Nodes (3): EpsClient, EpsClientTest, PHPUnit\Framework\TestCase

### Community 63 - "Markdown Callouts & Code"
Cohesion: 0.11
Nodes (17): ALIAS, Callout(), CalloutVariant, VARIANTS, LANG_ALIAS, MarkdownCodeBlock(), mdCodeTheme, prismLang() (+9 more)

### Community 64 - "MDX Guide Components"
Cohesion: 0.15
Nodes (19): FaqList(), MDX_COMPONENTS, MdxGuide(), ProductPageContent, GUIDE_COMPONENTS, SIGNUP_URL, API_PRODUCT_PAGES, ProductPageData (+11 more)

### Community 65 - "Profile Identity Helpers"
Cohesion: 0.13
Nodes (17): HeaderDropdownPanels(), Profile, accountIdentity, detailField(), nameInitials(), profileCompleteness(), RoleTransactionList, formatMobile() (+9 more)

### Community 66 - "Print Receipt & Logo"
Cohesion: 0.13
Nodes (14): useConnectDialogs(), PrintReceipt(), EkoLogo(), EkoLogoProps, pad(), printPage(), ACCEPT_PRESETS, CameraTest() (+6 more)

### Community 67 - "Earnings Summary"
Cohesion: 0.16
Nodes (18): ConnectedBankingCalculator(), parseInputFromParams(), EarningsProductRow(), EarningsSummary(), EarningsSummaryProps, QUICK_ADD_PRODUCTS, QUICK_ADD_APIS, QuoteSummary() (+10 more)

### Community 68 - "Docs Authoring Guards"
Cohesion: 0.11
Nodes (23): assertRecipeSlugs build guard, RecipeStep.branches success-path data gap, Disable an API (disabled: true, never delete), SEARCH_INDEX auto-generated at module scope, FAQ answers are markdown, Mutually exclusive FaqTag categories, stripMarkdown (plain-text sink helper), DocsLayout 3-pane grid (+15 more)

### Community 69 - "Transact MCP Bundle Types"
Cohesion: 0.09
Nodes (22): AgentApiDetail, AgentApiIndexEntry, AgentAuthTopic, AgentBundleMeta, AgentEnvironment, AgentEnvironmentsTopic, AgentErrorsTopic, AgentGettingStartedTopic (+14 more)

### Community 70 - "Raise Issue Dialog"
Cohesion: 0.16
Nodes (15): DISPLAY_MEDIA_OPTIONS, RaiseIssueDialog(), RaiseIssueOptions, buildIssueCatalogue(), Category, FeedbackOrigin, GENERIC_ISSUE_TYPE, isRaiseWindowOpen() (+7 more)

### Community 71 - "Transact MCP Server Tests"
Cohesion: 0.19
Nodes (18): AgentBundle, argsFor(), connect(), mockFetch(), panLite, tools, arrayItems(), buildToolDefs() (+10 more)

### Community 72 - "Doc Markdown Renderer"
Cohesion: 0.20
Nodes (19): responseTypeFor(), docsHref(), defaultSnippet(), collectLeaves(), errorScenarioTypeCell(), expandCallouts(), expandCodeSnippets(), expandFaqList() (+11 more)

### Community 73 - "Transact MCP Context & Fetch"
Cohesion: 0.22
Nodes (15): hasCredentials(), isAllowed(), parseAllowed(), parseEnvironment(), TransactCtx, DEFAULT_FETCH_TIMEOUT_MS, withTimeout(), createTransactServer() (+7 more)

### Community 74 - "Earnings Row & Input"
Cohesion: 0.13
Nodes (10): EarningsProductRowProps, nearestStepIndex(), TICK_LABELS, TXN_STEPS, groupDigits(), Input, InputProps, Slider (+2 more)

### Community 75 - "Docs Three-Pane Components"
Cohesion: 0.12
Nodes (19): imp flags ("What can you verify?"), CodeSamples right rail, DocDetailPage (/docs/:slug router page), EndpointDetail (centre pane), Params.tsx responsive param renderer, ResponseAccordion, ResponseFieldTree (recursive field renderer), resolveEndpointUrl (+11 more)

### Community 76 - "KYC Documents Flow"
Cohesion: 0.12
Nodes (19): KYC file rules (KYC_TYPES, KYC_EXTENSIONS, KYC_MAX_FILE_BYTES, KYC_MAX_PAGES), connect-api interaction 586 — fetch required document list, connect-api interaction 587 — upload one document (multipart), KYC_NO_RECORDS — "No Records Found" is an empty state, KYC Document Upload (/console/documents), kycEnabled / useKycEnabled entitlement gate, uploadInteraction (shared multipart transport), Watermark provenance stamp (opt-in per doc_type) (+11 more)

### Community 77 - "Deploy Poller Script"
Cohesion: 0.20
Nodes (13): acquire_lock(), alert(), dc(), deploy_image(), gate(), is_hold(), log(), main() (+5 more)

### Community 78 - "KV Store Contract"
Cohesion: 0.16
Nodes (6): runKvContract(), wait(), Entry, KV, opened, StoreUnavailableError

### Community 79 - "AI Harness Brand Icons"
Cohesion: 0.18
Nodes (11): AntigravityIcon(), ClaudeCodeIcon(), CodexIcon(), CursorIcon(), HarnessIcon(), HarnessIconProps, ICON_MAP, KiroIcon() (+3 more)

### Community 80 - "Partner Ecosystem Concepts"
Cohesion: 0.12
Nodes (18): AePS / Biometric Authentication Service, Assisted Banking / Business Correspondent Service, Eko EPS Partner Ecosystem, Money Transfer / Remittance Service, Payment Gateway / Online Payment Processing, Payments Bank (RBI-Licensed), FingPay Logo, FingPay (+10 more)

### Community 81 - "Admin GitOps Design"
Cohesion: 0.12
Nodes (18): Admin Config Console v1 (in-browser GitOps editor), Deploy Flow (Flow B) — dev to main PR, Edit Flow (Flow A) — propose changes as a PR, Editable file allowlist + path sanitization, Persisted admin GitHub token keyed by session id, 409 STALE_CONTENT concurrent-edit guard, descriptionFile endpoint notes (src/content/docs/endpoints/*.md), remark-callout (hand-rolled GitHub-alert mdast transform) (+10 more)

### Community 82 - "eps-backend TS Config"
Cohesion: 0.11
Nodes (17): compilerOptions, erasableSyntaxOnly, lib, module, moduleResolution, noEmit, outDir, skipLibCheck (+9 more)

### Community 83 - "JS SDK Client"
Cohesion: 0.19
Nodes (11): buildFormData(), EpsClient, EpsClientOptions, here, isBlob(), matchesType(), SdkEndpoint, SdkParam (+3 more)

### Community 84 - "Wallet Balance Card"
Cohesion: 0.20
Nodes (13): connectInteractions, walletBalance, Status, walletBalance, WalletBalance(), CachedBalance, fetchWalletBalance(), FRESH_FOR_MS (+5 more)

### Community 85 - "Site Header"
Cohesion: 0.14
Nodes (15): CommandPalette, Header(), HeaderDropdownPanels, LanguageSelector, LanguageSelectorFallback(), NavDropdownButton(), HeaderDropdownPanelsProps, ScrollDirection (+7 more)

### Community 86 - "EkoShield Page & Picture"
Cohesion: 0.12
Nodes (16): Picture(), PictureProps, digitalProducts, EkoShieldPage(), employmentProducts, financialProducts, gstinProducts, healthcareProducts (+8 more)

### Community 87 - "Agent Distribution & Gating"
Cohesion: 0.12
Nodes (17): eps plugin distribution (marketplace + per-agent install), Agent governance & safety guardrails, Live freshness (version + changelog, EPS_BUNDLE_URL remote refresh), X-Eko-Allowed-Apis tool scoping, EPS transactional MCP server, VITE_SHOW_TRANSACT_MCP marketing gate, Auto-pull poller (image digest watcher), sanitizeError (PII-safe error curation) (+9 more)

### Community 88 - "Auto-Release Script"
Cohesion: 0.26
Nodes (16): canonPackageJson(), cmpSemver(), DRY_RUN, ensureTag(), fingerprint(), localFileMap(), main(), npmView() (+8 more)

### Community 89 - "Tracking Params"
Cohesion: 0.21
Nodes (13): TrackingParamCapture(), TrackingParamCapture(), NavLink, NavLinkCompatProps, appendTrackingParams(), buildLeadWebsiteUrl(), getCalculatorContext(), getStoredTrackingParams() (+5 more)

### Community 90 - "User Menu"
Cohesion: 0.15
Nodes (13): developer, logout, mockState, UserMenu(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel (+5 more)

### Community 91 - "PAN Step & Step Resolver"
Cohesion: 0.18
Nodes (8): PanStep(), resolveSteps(), StepDefinition, StepProps, StepSubmit, registry, SIGNUP_STEPS, SignupState

### Community 92 - "sdk-js TS Config"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, ignoreDeprecations, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+7 more)

### Community 93 - "App Error Boundary"
Cohesion: 0.18
Nodes (8): App(), ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, installChunkErrorReload(), isChunkLoadError(), reloadOnceForStaleChunk(), doHydrate()

### Community 94 - "Install Matrix Builder"
Cohesion: 0.17
Nodes (11): buildInstallMatrix(), HARNESSES, HarnessInstall, HarnessMcp, HarnessPluginInstall, MCP_CMD, PluginInstallStep, matrix (+3 more)

### Community 95 - "Connect Auth Provider"
Cohesion: 0.15
Nodes (5): createConnectAuthProvider(), cfg, LOGIN_OK, setup(), ConnectClient

### Community 96 - "PHP Composer Manifest"
Cohesion: 0.13
Nodes (14): autoload, autoload-dev, psr-4, psr-4, description, license, name, Eko\\Eps\\ (+6 more)

### Community 97 - "Code Snippets Theming"
Cohesion: 0.18
Nodes (11): CodeSnippets(), CopyButton(), prismLang(), LangId, codeBlockTheme, CODE_SNIPPET_SETS, CodeSnippet, getSnippetSet() (+3 more)

### Community 98 - "Payment Capability Concepts"
Cohesion: 0.19
Nodes (14): Address Verification, BHIM App, Eko Payment Services (EPS) API Platform, QR Code Payment, Reverse Geocoding API, Salary Disbursal (Payroll Payout), Secure Payment, UPI (Unified Payments Interface) (+6 more)

### Community 99 - "Signup Session & Compose"
Cohesion: 0.18
Nodes (14): Signup session role, EPS Backend Phase 4 docs-chat agent design, SignupView lightweight /me view, Prune plans once shipped, Superpowers SDD artifact index, dev eps-backend service (build from repo root), prod eps-backend service, prod poller service (+6 more)

### Community 100 - "Mobile Summary Drawer"
Cohesion: 0.19
Nodes (12): MobileEstimateBar(), MobileEstimateBarProps, MobileSummaryBarProps, QuoteSummaryProps, Drawer(), DrawerContent, DrawerDescription, DrawerFooter() (+4 more)

### Community 101 - "AI Platform Strategy"
Cohesion: 0.21
Nodes (13): AI-Native Agent Platform (feature/ai-native-agent-platform), packages/claude-plugin-eps (MCP + skills + /eps command), Distribution decision: public npm + Packagist, GitHub Packages rejected for public distribution, Agent-ready (today) vs AI-native (target rung), EPS strategic buy-in deck plan, Thesis: one source of truth → everything regenerates in sync, AI-Native EPS Platform high-level plan (spine + 5 phases) (+5 more)

### Community 102 - "Sample Response Reconciliation"
Cohesion: 0.15
Nodes (13): /agent/eps.json canonical bundle (Phase 0 spine), @ekoindia/eps-mock-server (offline, recipe-aware), Bucket A — REPLACE (39 endpoints rewritten from prod shape), Bucket B — KEEP + FLAG (suspect prod captures), API sample-response reconciliation (before/after review), Sample↔schema parity automated check, responseData type-inference rules, initiate-fund-transfer spec (IMPS/NEFT/RTGS payout) (+5 more)

### Community 103 - "Context MCP TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 104 - "Mock Server Matching"
Cohesion: 0.24
Nodes (9): port, Fixture, matchResponse(), MockResult, pathToRegExp(), fixtures, createMockServer(), here (+1 more)

### Community 105 - "Mock Server TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 106 - "Transact MCP TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+4 more)

### Community 107 - "Deploy Dialog Primitives"
Cohesion: 0.28
Nodes (9): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, ignoreNestedDialogInteraction(), outsideEvent() (+1 more)

### Community 108 - "OTP Input & Label"
Cohesion: 0.22
Nodes (6): InputOTP, InputOTPGroup, InputOTPSlot, Label, labelVariants, PinStep()

### Community 109 - "Business Fields Data"
Cohesion: 0.32
Nodes (10): BUSINESS_FIELDS, BUSINESS_GROUPS, BusinessField, COMPANY_TYPES, INDIAN_STATES, field(), validateField(), BusinessStep() (+2 more)

### Community 110 - "VM Deploy Runbook"
Cohesion: 0.17
Nodes (12): @ekoindia/eps-context-mcp (local stdio MCP, 9 tiered tools), Certbot renewal timer gotcha, Docker data-root on /data pinned to the vfs driver, nginx reverse-proxy config (X-Real-IP, no buffering, TLS), mcp.eko.in path namespace contract (/transact/, /context/ reserved), eps-transact-mcp VM deployment runbook, Obsidian Terminal visual direction, Variant A — The Agent Demo (/welcome) (+4 more)

### Community 111 - "Signup Implementation Plans"
Cohesion: 0.23
Nodes (12): User Onboarding (Self-Serve Signup) implementation plan, SignupService step orchestration, Two-entry signup step registry, Business Details Step implementation plan, Signup Profile Context + Prefill implementation plan, User Onboarding design spec, SignupState (server-projected onboarding state), Business Details onboarding step design (+4 more)

### Community 112 - "Backend-Only Signing SDKs"
Cohesion: 0.21
Nodes (12): Backend-only signing policy (context MCP), Stateless pass-through signer (no persistence, no body logging), @ekoindia/eps-sdk (Node.js backend SDK), EpsClient (JS), signSecretKey helper (JS), ekoindia/eps-sdk (PHP backend SDK), EpsClient (PHP), Courier-not-consumer mental model for PID data (+4 more)

### Community 113 - "MCP Bundle Parity & Updates"
Cohesion: 0.18
Nodes (12): EPS_BUNDLE_URL remote bundle override, @ekoindia/eps-context-mcp (stdio documentation MCP server), Tiered, lazy, secret-free tool design, Best-effort npm update check, parity.copied-utils.test.ts content-hash pin, @ekoindia/eps-transact-mcp (transactional MCP server), MCP tool annotations for side-effecting verification tools, Registry-driven tool generation from api-specs.ts (+4 more)

### Community 114 - "Verification Product Art"
Cohesion: 0.18
Nodes (12): Aadhaar (India Biometric ID), Aadhaar Verification Illustration, AePS (Aadhaar Enabled Payment System), AePS Main Hero Illustration, Assisted Cash Management Illustration, Assisted Cash Management Service, Bank Account Verification, Bank Verification Illustration (+4 more)

### Community 115 - "E-Sign Integration"
Cohesion: 0.30
Nodes (10): esignOrigin(), EsignOutcome, LEEGALITY_PIPES, loadLeegality(), openEsign(), usesLeegality(), Window, Phase (+2 more)

### Community 116 - "Trust Boundary Validation"
Cohesion: 0.20
Nodes (11): parseFilters allow-list (trust boundary), POST /transactions/search (POST, not GET), selectEvalueAccountId (E-value account resolution), INDIAN_STATES (probed from interaction 387), Interaction 522 — submitBusiness / BUSINESS_FIELDS, Backend-only signed SDKs (@ekoindia/eps-sdk, ekoindia/eps-sdk PHP), eko-signing.ts in-browser HMAC signing (Web Crypto), php-split subtree mirror → Packagist (+3 more)

### Community 117 - "Poller Deploy Safety"
Cohesion: 0.20
Nodes (11): Deterministic GHCR authfile (.ghcr-auth.json), Health gate and automatic rollback, HOLD sentinel file, KV_ENCRYPTION_KEY is a stable secret, KV store redundancy tiers (Valkey / in-memory / Upstash), Merge gate IS the deploy gate, Pull-based auto-deploy poller, Seed deploy.env with the tag, not a digest (+3 more)

### Community 118 - "API Picker & Badge"
Cohesion: 0.25
Nodes (8): ApiPicker(), ApiPickerProps, PickerRow(), Badge(), BadgeProps, badgeVariants, Checkbox, displayName()

### Community 119 - "Aadhaar Biometric RDService"
Cohesion: 0.25
Nodes (11): qScore retry/block thresholds, Aadhaar Biometric Authentication with RDService, UIDAI registered devices (L1 mandate), wadh digest binding capture to a KYC API version, Activate User Service endpoint, RSA Aadhaar-number encryption scheme, AePS Fingpay Biometric eKYC endpoint, fType=2 per NPCI FIR-FMR single-PID-block guidance (+3 more)

### Community 120 - "Signup Profile Context"
Cohesion: 0.27
Nodes (5): SignupProfile, SignupProfileContext, SignupProfileProvider(), Probe(), useSignupProfile()

### Community 121 - "EkoShield Brand Concepts"
Cohesion: 0.31
Nodes (10): EkoShield Product (Fraud Prevention & KYC), Employee Verification / Background Check, Eko Platform Services (EPS) Brand, KYC & Identity Verification, Eko Platform Services Logo (gold icon, white text), EkoShield Logo (shield, fingerprint, 'Your Armor Against Fraud'), EkoShield KYC & Verification Dashboard Mockup, Employee Verification Illustration (+2 more)

### Community 122 - "Transaction History Flow"
Cohesion: 0.20
Nodes (10): SIMPLIBANK_HISTORY_* upstream override (eko.historyUrl), inferSearchField (quick-search shape heuristic), Interaction 154 — transaction history upstream, debitOf / creditOf money rules, Per-page totals / Closing Balance caveat, Transaction History (/console/transactions), transactions.sample.ts (captured interaction-154 response), Hard rule: adopt shape, never live values (+2 more)

### Community 123 - "Connect Login Delegation"
Cohesion: 0.22
Nodes (10): connect-api login delegation (CONNECT_API_BASE_URL), `onboarding === 1` classification gate in getProfile, respond() signup→developer session upgrade, `signup` session role, GHCR authentication (private images, .ghcr-auth.json), GHCR digest poller auto-deploy with health gate + rollback, buildApp() extraction + api/index.ts serverless entry, Upstash Redis (in-memory KV cannot survive serverless) (+2 more)

### Community 124 - "Context MCP Vercel Config"
Cohesion: 0.20
Nodes (9): maxDuration, buildCommand, functions, api/index.ts, bom1, outputDirectory, regions, rewrites (+1 more)

### Community 125 - "Pricing Tabs"
Cohesion: 0.31
Nodes (8): isTabId(), PricingTabId, PricingTabs(), PricingTabsProps, TAB_DEFS, TabsContent, TabsList, TabsTrigger

### Community 126 - "Agent Plugin & Recipes"
Cohesion: 0.31
Nodes (9): Retrieve-then-answer grounding, /eps slash command, Codex does not launch plugin-bundled stdio MCP, EPS agent plugin (eps), integrate-eps skill, Recipe branching on response_type_id / status, run-a-recipe skill, EPS secret-key HMAC-SHA256 convention (+1 more)

### Community 127 - "Remote MCP Decision Record"
Cohesion: 0.22
Nodes (9): eps-context-mcp remote server decision record, mcp.eko.in path-namespaced URL contract, Dozzle + Uptime Kuma observability layer, Poller alternatives + VM observability evaluation, Komodo (rejected single-pane deploy authority), vfs storage driver disk caveat, HOLD sentinel + health-gated rollback, One poller container per project (+1 more)

### Community 128 - "Poller Test Harness"
Cohesion: 0.44
Nodes (7): eq(), load(), no(), ok(), seed_deploy(), setup(), poll_test.sh script

### Community 129 - "Eko Client Tests"
Cohesion: 0.31
Nodes (5): createEkoClient(), ekoCfg, mockFetch(), profileFrom(), INTERACTION_154_SAMPLE

### Community 130 - "Transact MCP Bundle Loading"
Cohesion: 0.22
Nodes (7): BAKED_PATH, here, apiBySlug, here, surface, surfaceBySlug, tools

### Community 131 - "MCP Update Check"
Cohesion: 0.44
Nodes (6): checkForUpdate(), isNewer(), notifyIfOutdated(), parseStrict(), updateNotice(), VersionState

### Community 132 - "Zoho Signup Embed"
Cohesion: 0.36
Nodes (6): buildSrc(), ZohoSignupForm(), ZOHO_SIGNUP_EMBED_URL, isBrowser(), safeLocationHref(), safeSessionStorage

### Community 133 - "Fade-In Hydration Tests"
Cohesion: 0.22
Nodes (4): importFadeIn(), IntersectionCallback, IntersectionObserverStub, observerCallbacks

### Community 134 - "Packs & AVDM Capture"
Cohesion: 0.25
Nodes (8): Assisted Banking Agent Pack (AePS + DMT + BBPS + PPI), Industry detail page template, Lending KYC Pack, Phased rollout (Foundation → Tier-1/2/3 → Optimization), Solution/Pack detail page template, CaptureAvdm() / deviceInfoAvdm() — PID capture + device info, discoverAvdm() — RDSERVICE port scan 11100–11112, Sample UIDAI RD-service integration testing tool (HTML)

### Community 135 - "Docs Chat Agent Design"
Cohesion: 0.25
Nodes (8): ekoLog PIN-derivable field redaction, encodePin (pintwin digit-substitution), POST /chat/ask route, ChatProvider multi-provider abstraction, Chat endpoint privilege isolation (no github/admin imports), KV incrBy(key, delta, ttl) seam, No chat storage, message content never logged, Monthly token-spend circuit breaker

### Community 136 - "eps-backend Vercel Config"
Cohesion: 0.25
Nodes (7): maxDuration, functions, api/index.ts, bom1, regions, rewrites, $schema

### Community 137 - "Copied-Utils Parity Pins"
Cohesion: 0.29
Nodes (6): here, normalize(), Pin, PINS, repoRoot, shaOf()

### Community 138 - "Verification & Network Art"
Cohesion: 0.25
Nodes (8): GST Verification, GST Verification Illustration, Digital Payments Network, Hero Network Illustration, Money Transfer API Illustration, Money Transfer API, PAN Verification Illustration, PAN Verification

### Community 139 - "Core Transaction Endpoints"
Cohesion: 0.32
Nodes (8): AePS Initiate Settlement endpoint, Get Customer Info endpoint, DLT registration for a custom SMS Sender ID, Mobile OTP Send endpoint, PPI DigiKhata Initiate Transaction endpoint, Transaction Inquiry endpoint, Eko response envelope (status / response_status_id / tx_status), Financial transaction status codes (tx_status)

### Community 140 - "Stale Chunk Auto-Reload"
Cohesion: 0.38
Nodes (7): /assets/* excluded from SPA-shell rewrite, Stale-chunk auto-reload, ErrorBoundary around routes, installChunkErrorReload / reloadOnceForStaleChunk, SSG prerender pipeline (ssg/plugin.ts, prerender.ts), ROUTE_CHUNK_MAP modulepreload, Static pre-rendered HTML with SPA fallback

### Community 141 - "KYC Document Status Rules"
Cohesion: 0.29
Nodes (7): DOCUMENT_STATUS / statusOfDocument (1 pending, 2 success, 3 resubmit), ignoreNestedDialogInteraction (Radix top-layer guard), KYC_DOC_CONFIG — per-doc_type local overrides, KycUploadDialog, `multiple` — per-slot attachments combined into one PDF, parseDocumentList (presentation overlay, drops is_required), Sample documents (sampleUrl blanks in public/kyc-samples)

### Community 142 - "Vercel vs VM Deploy Decision"
Cohesion: 0.38
Nodes (7): buildApp side-effect-free factory, Vercel path rejected for production, SimpliBank IP allowlist constraint, eps-backend on Vercel (managed serverless), nginx must overwrite X-Real-IP, eps-backend Production VM Deploy Runbook, debug_auth tool (known-answer test vector)

### Community 143 - "Sign Agreement Step Tests"
Cohesion: 0.29
Nodes (4): ApiError, getAgreementUrl, openEsign, submitAgreement

### Community 144 - "Plugin Marketplace Test"
Cohesion: 0.29
Nodes (6): marketplace, MarketplaceEntry, McpConfig, pluginDirs, PluginManifest, ROOT

### Community 145 - "Try-It Console & CORS Proxy"
Cohesion: 0.33
Nodes (6): Palette SSG safety (never renders during prerender), Console sandbox / API playground (planned), Try-it CORS proxy (VITE_SCALAR_PROXY_URL), Scalar "Try it" console, tryit-client.ts (client-only Scalar modal singleton), connect-api CORS allowlist blocker

### Community 146 - "Onboarding Gate & Auth Seam"
Cohesion: 0.33
Nodes (6): ProfileResult 'onboarding' variant, eps-backend is the connect-api BFF equivalent, onboarding===1 checked before the user_type gate, eko vs connect auth provider seam, EPS business-partner gate stays in this service, Persist upstream creds before setting cookies

### Community 147 - "Edge MCP Hosting Decisions"
Cohesion: 0.33
Nodes (6): packages/eps-agent-core zero-dep bundle accessors, Anonymous edge hosting over VM co-hosting, eps-context-mcp http.ts stateless Hono transport, Cache-Control: no-store on POST /mcp, Shared HTTP adapter extraction deferred, Pull-based deploys + nginx owns :443 (ruling constraints)

### Community 148 - "Bundle Types Parity Test"
Cohesion: 0.33
Nodes (4): here, localSrc, NAMES, siteSrc

### Community 149 - "Route Transitions"
Cohesion: 0.40
Nodes (4): AnimatedRoutes(), AnimatedRoutesProps, PageTransition(), PageTransitionProps

### Community 150 - "Step Rail UI"
Cohesion: 0.33
Nodes (4): ResolvedStep, StepStatus, STATUS_LABEL, StepRail()

### Community 151 - "Onboarding Interaction Rules"
Cohesion: 0.40
Nodes (5): Eko client onboarding interactions (521/523/170/10005/5), Deliberate client+BFF validation duplication, 36 Indian states inlined verbatim instead of fetched, Interaction 522 USER_ONBOARDING_BUSINESS, Native <select> over Radix Select

### Community 152 - "UI/UX Improvement Plan"
Cohesion: 0.50
Nodes (5): useCopyToClipboard on every code block (P3), Hero rebuild: mobile code block + stats + CTA hierarchy, Language tabs on API input/output preview (P2), Eko EPS Website UI/UX improvement plan, Sticky CTA bar (P1)

### Community 155 - "Context MCP Bake Script"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 156 - "Fixtures Bake Script"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 157 - "Transact MCP Bake Script"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 158 - "sdk-js Surface Bake"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 159 - "sdk-php Surface Bake"
Cohesion: 0.40
Nodes (4): dest, destDir, here, src

### Community 161 - "API Coverage Phases"
Cohesion: 0.50
Nodes (4): No-fabrication authoring rule (blocked: source incomplete), Phase 2 — PPI-Levin + PPI-DigiKhata rails, Phase 3 — user & customer management, Phase 6 — helpers, verification extras, BBPS extras

### Community 162 - "Context MCP npx Install"
Cohesion: 0.50
Nodes (3): npx, @ekoindia/eps-context-mcp, eps

### Community 163 - "Payment Partner Logos"
Cohesion: 0.50
Nodes (4): Airtel Payments Bank, Airtel Payments Bank Logo, BillDesk, BillDesk Logo

### Community 164 - "Android RDService Integration"
Cohesion: 0.50
Nodes (4): Android RDService integration via UIDAI Intents, RdServiceTester in-browser device tester, RDService driver discovery on ports 11100-11120, PidOptions XML configuration

### Community 166 - "Edge Transport Hardening"
Cohesion: 1.00
Nodes (3): In-memory abuse throttling, Path-namespaced nginx reverse proxy (/transact/, /context/ reserved), Stateless streamable HTTP transport

## Ambiguous Edges - Review These
- `Editable file allowlist + path sanitization` → `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`  [AMBIGUOUS]
  docs/admin-console.md · relation: references
- `AI-native vs AI-friendly distinction` → `API keys management (blocked on issuance contract)`  [AMBIGUOUS]
  docs/console-roadmap.md · relation: conceptually_related_to

## Knowledge Gaps
- **1043 isolated node(s):** `npx`, `@ekoindia/eps-context-mcp`, `run.sh script`, `_pop.sh script`, `name` (+1038 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Editable file allowlist + path sanitization` and `descriptionFile endpoint notes (src/content/docs/endpoints/*.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `AI-native vs AI-friendly distinction` and `API keys management (blocked on issuance contract)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `doHydrate()` connect `App Error Boundary` to `Backend Session & Admin Tests`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `app()` connect `Backend Session & Admin Tests` to `App Error Boundary`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `requestId()` connect `Backend Session & Admin Tests` to `Session Cookies & Security Log`, `Backend Entry & Access Logging`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **What connects `npx`, `@ekoindia/eps-context-mcp`, `run.sh script` to the rest of the system?**
  _1043 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Docs Endpoint Detail Pane` be split into smaller, more focused modules?**
  _Cohesion score 0.04144736842105263 - nodes in this community are weakly interconnected._