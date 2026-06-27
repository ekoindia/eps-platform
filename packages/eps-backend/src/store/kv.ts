export interface KV {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSec: number): Promise<void>;
	del(key: string): Promise<void>;
	getdel(key: string): Promise<string | null>;
	incr(key: string, ttlSec: number): Promise<number>;
}

interface Entry {
	value: string;
	expiresAt: number;
}

export function createInMemoryKV(now: () => number = () => Date.now()): KV {
	const map = new Map<string, Entry>();

	const live = (key: string): Entry | null => {
		const e = map.get(key);
		if (!e) return null;
		if (e.expiresAt <= now()) {
			map.delete(key);
			return null;
		}
		return e;
	};

	return {
		async get(key) {
			return live(key)?.value ?? null;
		},
		async set(key, value, ttlSec) {
			map.set(key, { value, expiresAt: now() + ttlSec * 1000 });
		},
		async del(key) {
			map.delete(key);
		},
		async getdel(key) {
			const e = live(key);
			if (!e) return null;
			map.delete(key);
			return e.value;
		},
		async incr(key, ttlSec) {
			const e = live(key);
			if (!e) {
				map.set(key, { value: "1", expiresAt: now() + ttlSec * 1000 });
				return 1;
			}
			const next = Number(e.value) + 1;
			e.value = String(next);
			return next;
		},
	};
}
