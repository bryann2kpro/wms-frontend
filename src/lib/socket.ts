import { io as socketIO, type Socket } from "socket.io-client";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";

let _socket: Socket | null = null;

/**
 * Returns the shared Socket.IO client instance.
 * The socket does NOT connect automatically — call socket.connect()
 * only when needed (e.g. before starting a bulk PDF job).
 */
export function getSocket(): Socket {
	if (!_socket) {
		// Use only the origin (scheme + host + port) — if we pass a URL with a
		// path like "/api", socket.io-client treats it as a namespace, causing
		// "Invalid namespace" errors. The Socket.IO path (/socket.io) is set separately.
		const origin = new URL(env.VITE_API_URL).origin;
		_socket = socketIO(origin, {
			path: "/socket.io",
			autoConnect: false,
			// auth as a callback so the latest token is sent on every (re)connect
			auth: (cb) => cb({ token: getAccessToken() ?? "" }),
		});
	}
	return _socket;
}
