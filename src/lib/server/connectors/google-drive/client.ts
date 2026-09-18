import { importPKCS8, SignJWT } from 'jose';

type ServiceAccountKey = {
	client_email: string;
	private_key: string;
	token_uri?: string;
};

const driveApiBase = 'https://www.googleapis.com/drive/v3';
const driveTokenUrl = 'https://oauth2.googleapis.com/token';
const driveReadonlyScope = 'https://www.googleapis.com/auth/drive.readonly';
// Google access tokens are typically valid for 3600s; refresh a little early so a
// request never starts with a token that expires mid-flight.
const tokenExpirySkewMs = 60_000;

export class DriveAuthError extends Error {
	constructor(
		public readonly googleErrorCode: string,
		public readonly httpStatus: number
	) {
		super(`Google Drive token exchange failed: ${googleErrorCode}`);
	}
}

export type DriveClient = {
	serviceAccountEmail: string;
	/** Calls the Drive REST v3 API with a fresh (cached, in-process) bearer token. */
	driveFetch(path: string, init?: RequestInit): Promise<Response>;
};

/**
 * A self-authenticating Google Drive client for a service account (ADR 0001 section
 * 1): mints a JWT bearer assertion with `jose` (importPKCS8 + RS256), exchanges it at
 * Google's token endpoint, and calls Drive REST v3 with `fetch`. Mirrors
 * src/lib/server/auth/google.ts's raw fetch + jose pattern. No `googleapis` /
 * `google-auth-library` dependency. The access token is cached in-process per client
 * instance (module-scoped closure, not global) and never logged.
 */
export function createDriveClient(serviceAccountKeyBase64: string): DriveClient {
	const key = parseServiceAccountKey(serviceAccountKeyBase64);
	let cached: { accessToken: string; expiresAt: number } | null = null;

	async function getAccessToken(): Promise<string> {
		const now = Date.now();
		if (cached && cached.expiresAt - tokenExpirySkewMs > now) return cached.accessToken;

		const tokenUrl = key.token_uri ?? driveTokenUrl;
		const assertion = await signAssertion(key, tokenUrl);

		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion
			})
		});

		if (!response.ok) {
			const googleErrorCode = await extractGoogleErrorCode(response);
			throw new DriveAuthError(googleErrorCode, response.status);
		}

		const payload = (await response.json()) as { access_token?: string; expires_in?: number };
		if (!payload.access_token) throw new DriveAuthError('missing_access_token', response.status);

		cached = { accessToken: payload.access_token, expiresAt: now + (payload.expires_in ?? 3600) * 1000 };
		return cached.accessToken;
	}

	return {
		serviceAccountEmail: key.client_email,
		async driveFetch(path, init) {
			const accessToken = await getAccessToken();
			return fetch(`${driveApiBase}${path}`, {
				...init,
				headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
			});
		}
	};
}

async function signAssertion(key: ServiceAccountKey, audience: string): Promise<string> {
	const privateKey = await importPKCS8(key.private_key, 'RS256');
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({ scope: driveReadonlyScope })
		.setProtectedHeader({ alg: 'RS256' })
		.setIssuer(key.client_email)
		.setSubject(key.client_email)
		.setAudience(audience)
		.setIssuedAt(now)
		.setExpirationTime(now + 3600)
		.sign(privateKey);
}

function parseServiceAccountKey(base64: string): ServiceAccountKey {
	let json: string;
	try {
		json = Buffer.from(base64, 'base64').toString('utf8');
	} catch {
		throw new Error('GOOGLE_DRIVE_SA_KEY_B64 is not valid base64');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		throw new Error('GOOGLE_DRIVE_SA_KEY_B64 did not decode to valid JSON');
	}

	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		typeof (parsed as Record<string, unknown>).client_email !== 'string' ||
		typeof (parsed as Record<string, unknown>).private_key !== 'string'
	) {
		throw new Error('Decoded service-account key is missing client_email or private_key');
	}

	// Never log `parsed` — it contains the private key.
	return parsed as ServiceAccountKey;
}

/**
 * Google's token-endpoint error body is `{ error, error_description }`; only the
 * short code is ever logged (ADR 0001 section 7).
 */
export async function extractGoogleErrorCode(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: string };
		return typeof body.error === 'string' ? body.error : `http_${response.status}`;
	} catch {
		return `http_${response.status}`;
	}
}

/**
 * Drive API error bodies are shaped `{ error: { code, message, errors: [{ reason }] } }`;
 * only the short reason code is ever logged.
 */
export async function extractDriveErrorReason(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: { errors?: Array<{ reason?: string }>; status?: string } };
		return body.error?.errors?.[0]?.reason ?? body.error?.status ?? `http_${response.status}`;
	} catch {
		return `http_${response.status}`;
	}
}
