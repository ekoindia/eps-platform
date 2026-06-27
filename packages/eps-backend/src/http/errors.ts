export class AppError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export function errorBody(code: string, message: string) {
	return { error: { code, message } };
}
