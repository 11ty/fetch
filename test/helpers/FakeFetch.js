const ORIGIN = "https://fetch.test";

// Keyed by the last path segment.
const ROUTES = {
	"": () => new Response("<!doctype html><title>Fake</title>", {
		headers: { "content-type": "text/html" },
	}),
	"possum.png": () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
		headers: { "content-type": "image/png" },
	}),
	"feed.xml": () => new Response(`<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Fake feed</title></feed>`, {
		headers: {
			"content-type": "application/xml",
			"server": "fake",
			"last-modified": "Wed, 21 Oct 2026 00:00:00 GMT",
		},
	}),
};

export function fakeUrl(pathname) {
	return `${ORIGIN}${pathname}`;
}

export function installFakeFetch() {
	globalThis.fetch = async (input) => {
		let url = new URL(input);
		if (url.origin !== ORIGIN) {
			throw new TypeError(`fetch failed: ${url} is not a fake URL`);
		}

		let name = url.pathname.split("/").pop();
		let response = Object.hasOwn(ROUTES, name) ? ROUTES[name]() :new Response("Not Found", { status: 404, statusText: "Not Found" });
		Object.defineProperty(response, "url", { value: url.toString() });
		return response;
	};
}
