import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Util } from "../fetch.js";
import AssetCache from "../src/AssetCache.js";
import RemoteAssetCache from "../src/RemoteAssetCache.js";
import { fakeUrl, installFakeFetch } from "./helpers/FakeFetch.js";

installFakeFetch();

test("getDurationMs", () => {
	let cache = new RemoteAssetCache("https://example.com/");
	// assert.equal(cache.getDurationMs("0"), 0);
	assert.equal(cache.getDurationMs("0s"), 0);
	assert.equal(cache.getDurationMs("1s"), 1000);
	assert.equal(cache.getDurationMs("1m"), 60 * 1000);
	assert.equal(cache.getDurationMs("1h"), 60 * 60 * 1000);
	assert.equal(cache.getDurationMs("1d"), 24 * 60 * 60 * 1000);
	assert.equal(cache.getDurationMs("1w"), 7 * 24 * 60 * 60 * 1000);
	assert.equal(cache.getDurationMs("1y"), 365 * 24 * 60 * 60 * 1000);

	assert.equal(cache.getDurationMs("5s"), 5000);
	assert.equal(cache.getDurationMs("0m"), 0);
	assert.equal(cache.getDurationMs("7m"), 60 * 7000);
	assert.equal(cache.getDurationMs("9h"), 60 * 60 * 9000);
	assert.equal(cache.getDurationMs("0h"), 0);
	assert.equal(cache.getDurationMs("11d"), 24 * 60 * 60 * 11000);
	assert.equal(cache.getDurationMs("0d"), 0);
	assert.equal(cache.getDurationMs("13w"), 7 * 24 * 60 * 60 * 13000);
	assert.equal(cache.getDurationMs("0w"), 0);
	assert.equal(cache.getDurationMs("15y"), 365 * 24 * 60 * 60 * 15000);
	assert.equal(cache.getDurationMs("0y"), 0);
});

test("Local hash file names", async () => {
	let pngUrl = "https://www.zachleat.com/img/avatar-2017-big.png";
	assert.equal(
		new RemoteAssetCache(pngUrl).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(pngUrl)}`),
	);

	let fontUrl = "https://www.zachleat.com/font.woff";
	assert.equal(
		new RemoteAssetCache(fontUrl).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(fontUrl)}`),
	);

	let fontUrl2 = "https://www.zachleat.com/font.woff2";
	assert.equal(
		new RemoteAssetCache(fontUrl2).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(fontUrl2)}`),
	);
});

test("Clean url", async () => {
	let shortUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	assert.equal(
		new RemoteAssetCache(longUrl, ".cache", {
			removeUrlQueryParams: true,
		}).displayUrl,
		shortUrl,
	);
});

test("Local hash without file extension in URL", async () => {
	let noExt = "https://twitter.com/zachleat/profile_image?size=bigger";
	assert.equal(
		new RemoteAssetCache(noExt).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(noExt)}`),
	);
});

test("Unique hashes for URLs", async () => {
	let apiURL1 = "https://api.zooniverse.org/projects/illustratedlife/talk/subjects/ASC0000qu3";
	let apiURL2 = "https://api.zooniverse.org/projects/illustratedlife/talk/subjects/ASC0000q71";
	let cachePath1 = new RemoteAssetCache(apiURL1).cachePath;
	let cachePath2 = new RemoteAssetCache(apiURL2).cachePath;
	assert.notEqual(cachePath1, cachePath2);
});

test("Same hashes for implicit and explicit HTTP GET", async () => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "GET" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: {},
	}).cachePath;
	assert.equal(cachePath1, cachePath2);
});

test("Unique hashes for different HTTP methods", async () => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "POST" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "DELETE" },
	}).cachePath;
	assert.notEqual(cachePath1, cachePath2);
});

test("Unique hashes for different HTTP bodies", async () => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { body: "123" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { body: "456" },
	}).cachePath;
	assert.notEqual(cachePath1, cachePath2);
});

test("Fetching!", async () => {
	let pngUrl = fakeUrl("/remote/possum.png");
	let ac = new RemoteAssetCache(pngUrl);
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(ac.fetchCount, 1);
	assert.equal(Buffer.isBuffer(buffer), true);
});

test("Fetching (dry run)!", async () => {
	let pngUrl = fakeUrl("/remote/dry-run/possum.png");
	let ac = new RemoteAssetCache(pngUrl, ".cache", {
		dryRun: true,
	});
	let buffer = await ac.fetch();
	assert.equal(Buffer.isBuffer(buffer), true);
	assert.equal(ac.fetchCount, 1);
	assert.equal(ac.hasAnyCacheFiles(), false);
});

test("Fetching pass in URL", async () => {
	let pngUrl = new URL(fakeUrl("/remote/possum.png"));
	let ac = new RemoteAssetCache(pngUrl);
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(Buffer.isBuffer(buffer), true);
});

test("Fetching pass non-stringable", async () => {
	await assert.rejects(
		async () => {
			class B {}
			let source = new B();

			let ac = new RemoteAssetCache(source, undefined, {
				dryRun: true,
			});
			await ac.fetch();
		},
		{
			message:
				"Invalid source: must be a string, function, or Promise. If a function or Promise, you must provide a `toString()` method or an `options.requestId` unique key. Received: [object Object]",
		},
	);
});

test("Fetching pass class with toString()", async () => {
	class B {
		toString() {
			return fakeUrl("/remote/possum.png");
		}
	}

	let ac = new RemoteAssetCache(new B());
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(Buffer.isBuffer(buffer), true);
});

test("formatUrlForDisplay (manual query param removal)", async () => {
	let finalUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	assert.equal(
		new RemoteAssetCache(longUrl, ".cache", {
			removeUrlQueryParams: false,
			formatUrlForDisplay(url) {
				let [rest, queryParams] = url.split("?");
				return rest;
			},
		}).displayUrl,
		finalUrl,
	);
});

test("formatUrlForDisplay (using removeUrlQueryParams)", async () => {
	let finalUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	assert.equal(
		new RemoteAssetCache(longUrl, ".cache", {
			removeUrlQueryParams: true,
			formatUrlForDisplay(url) {
				return url;
			},
		}).displayUrl,
		finalUrl,
	);
});

test("formatUrlForDisplay (using removeUrlQueryParams and requestId)", async () => {
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	assert.equal(
		new RemoteAssetCache(function () {}, ".cache", {
			requestId: longUrl,
			removeUrlQueryParams: true,
			formatUrlForDisplay(url) {
				return url;
			},
		}).displayUrl,
		"function () {}",
	);
});

test("Issue #6, URLs with HTTP Auth", async () => {
	let url = "https://${USERNAME}:${PASSWORD}@api.pinboard.in/v1/posts/all?format=json&tag=read";
	assert.equal(Util.isFullUrl(url), true);
});

test("Error with `cause`", async () => {
	let finalUrl = fakeUrl("/remote/missing.png");
	let asset = new RemoteAssetCache(finalUrl);

	try {
		await assert.rejects(asset.fetch(), (e) => {
			assert.ok(e.message.startsWith(`Bad response for ${finalUrl} (404):`));
			assert.ok(e.cause);
			return true;
		});
	} finally {
		await asset.destroy();
	}
});

test("supports promises that resolve", async () => {
	let expected = { mockKey: "mockValue" };
	let promise = Promise.resolve(expected);
	let asset = new RemoteAssetCache(promise, undefined, {
		type: "json",
		requestId: "resolve-promise",
	});

	let actual = await asset.fetch();
	try {
		await asset.destroy();
	} catch (e) {}

	assert.deepEqual(actual, expected);
});

test("supports promises that reject", async () => {
	let expected = "mock error message";
	let cause = new Error("mock cause");
	let promise = Promise.reject(new Error(expected, { cause }));

	let asset = new RemoteAssetCache(promise, undefined, {
		requestId: "reject-promise",
	});

	try {
		await assert.rejects(asset.fetch(), { message: expected, cause });
	} finally {
		try {
			await asset.destroy();
		} catch (e) {}
	}
});

test("supports async functions that return data", async () => {
	let expected = { mockKey: "mockValue" };
	let asyncFunction = async () => {
		return Promise.resolve(expected);
	};
	let asset = new RemoteAssetCache(asyncFunction, undefined, {
		type: "json",
		requestId: "async-return",
	});

	let actual = await asset.fetch();
	try {
		await asset.destroy();
	} catch (e) {}

	assert.deepEqual(actual, expected);
});

test("supports async functions that throw", async () => {
	let expected = "mock error message";
	let cause = new Error("mock cause");
	let asyncFunction = async () => {
		throw new Error(expected, { cause });
	};

	let asset = new RemoteAssetCache(asyncFunction, undefined, {
		requestId: "async-throws",
	});

	try {
		await assert.rejects(asset.fetch(), { message: expected, cause });
	} finally {
		try {
			await asset.destroy();
		} catch (e) {}
	}
});

test("type: xml", async () => {
	let feedUrl = fakeUrl("/remote/feed.xml");
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "xml",
	});
	let xml = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(xml.length > 50, true);
});

test("type: parsed-xml", async () => {
	let feedUrl = fakeUrl("/remote/feed.xml");
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "parsed-xml",
	});
	let xml = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(xml.children.length, 1);
});

test("returnType: response, cache miss", async () => {
	let feedUrl = fakeUrl("/remote/feed.xml");
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "xml",
		returnType: "response",
	});
	let response = await ac.fetch();

	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(ac.fetchCount, 1);
	assert.equal(response.url, feedUrl);
	assert.equal(response.status, 200);
	assert.ok(response.headers.server);
	assert.ok(response.headers["last-modified"]);
	assert.ok(response.body);
	assert.equal(response.cache, "miss");
});

test("returnType: response, cache hit", async () => {
	let feedUrl = fakeUrl("/remote/feed.xml");
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "xml",
		returnType: "response",
	});

	// miss
	await ac.fetch();

	// hit
	let response = await ac.fetch();

	try {
		await ac.destroy();
	} catch (e) {}

	assert.equal(response.cache, "hit");
});
