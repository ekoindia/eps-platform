/**
 * The 586 sample response, verbatim.
 *
 * Shared by `kyc.test.ts` and the dev-only `/console/test` bench, so the tests
 * and the surface used to eyeball the design are looking at the same bytes.
 * Imported from nowhere else: the bench route is already excluded from the
 * production build (see the `import.meta.env.DEV` ternary in `App.tsx`), so
 * this never reaches a shipped bundle.
 */
export const KYC_DOCUMENTS_SAMPLE = {
	response_status_id: 0,
	data: {
		user_code: "39300001",
		document_list: [
			{
				pages: "2",
				status_desc: "",
				is_required: 1,
				name: "Aadhaar Card",
				doc_type: "1",
				error: "",
				status: 0,
				info: "Director's Aadhaar Card",
			},
			{
				pages: "1",
				status_desc: "",
				is_required: 1,
				name: "Director PAN Card",
				doc_type: "15",
				error: "",
				status: 0,
				info: "",
			},
			{
				pages: "2",
				status_desc: "",
				is_required: 0,
				name: "Company Registration certificate",
				doc_type: "12",
				error: "",
				status: 0,
				info: "",
			},
			{
				pages: "1",
				status_desc: "",
				is_required: 0,
				name: "Bank statement",
				doc_type: "7",
				error: "",
				status: 0,
				info: "",
			},
			{
				pages: "1",
				status_desc: "",
				is_required: 0,
				name: "Blank Check",
				doc_type: "13",
				error: "",
				status: 0,
				info: "",
			},
		],
	},
	response_type_id: 1564,
	message: "Success",
	status: 0,
} as const;
