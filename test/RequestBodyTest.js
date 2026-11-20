const test = require("ava");
const Fetch = require("../");
const RemoteAssetCache = require("../src/RemoteAssetCache");

test("URLSearchParams bodies have distinct cache keys", (t) => {
	let source = "https://example.com/form";
	let first = Fetch.Fetch(source, {
		fetchOptions: { method: "POST", body: new URLSearchParams({ query: "abc" }) },
	});
	let second = Fetch.Fetch(source, {
		fetchOptions: { method: "POST", body: new URLSearchParams({ query: "xyz" }) },
	});
	t.not(first.cachePath, second.cachePath);
	t.not(first, second);
});

test("Equivalent URLSearchParams bodies reuse the same cache", (t) => {
	let source = "https://example.com/repeated-form";
	let entries = [["tag", "one"], ["tag", "two"], ["query", "café & tea"]];
	let first = Fetch.Fetch(source, {
		fetchOptions: { method: "POST", body: new URLSearchParams(entries) },
	});
	let second = Fetch.Fetch(source, {
		fetchOptions: { method: "POST", body: new URLSearchParams(entries) },
	});
	let reordered = Fetch.Fetch(source, {
		fetchOptions: { method: "POST", body: new URLSearchParams(entries.slice().reverse()) },
	});
	t.is(first, second);
	t.not(first.cachePath, reordered.cachePath);
});

test("Empty URLSearchParams bodies differ from populated bodies", (t) => {
	let source = "https://example.com/empty-form";
	let empty = new RemoteAssetCache(source, undefined, {
		fetchOptions: { body: new URLSearchParams() },
	});
	let populated = new RemoteAssetCache(source, undefined, {
		fetchOptions: { body: new URLSearchParams({ empty: "" }) },
	});
	t.not(empty.cachePath, populated.cachePath);
});

test.serial("Different form requests fetch their own responses without changing the body", async (t) => {
	let originalFetch = global.fetch;
	let receivedBodies = [];
	global.fetch = async (source, options) => {
		receivedBodies.push(options.body);
		return new Response(options.body.toString());
	};
	t.teardown(() => { global.fetch = originalFetch; });
	let first = new URLSearchParams({ query: "first" });
	let second = new URLSearchParams({ query: "second" });
	let options = { type: "text", dryRun: true };
	let source = "https://example.com/mock-form";
	t.is(await Fetch(source, { ...options, fetchOptions: { method: "POST", body: first } }), "query=first");
	t.is(await Fetch(source, { ...options, fetchOptions: { method: "POST", body: second } }), "query=second");
	t.deepEqual(receivedBodies, [first, second]);
	t.is(receivedBodies[0], first);
	t.is(receivedBodies[1], second);
});
