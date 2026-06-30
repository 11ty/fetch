const test = require("ava");
const path = require("node:path");
const { Util } = require("../");
const AssetCache = require("../src/AssetCache");
const RemoteAssetCache = require("../src/RemoteAssetCache");

test("getDurationMs", (t) => {
	let cache = new RemoteAssetCache("https://example.com/");
	// t.is(cache.getDurationMs("0"), 0);
	t.is(cache.getDurationMs("0s"), 0);
	t.is(cache.getDurationMs("1s"), 1000);
	t.is(cache.getDurationMs("1m"), 60 * 1000);
	t.is(cache.getDurationMs("1h"), 60 * 60 * 1000);
	t.is(cache.getDurationMs("1d"), 24 * 60 * 60 * 1000);
	t.is(cache.getDurationMs("1w"), 7 * 24 * 60 * 60 * 1000);
	t.is(cache.getDurationMs("1y"), 365 * 24 * 60 * 60 * 1000);

	t.is(cache.getDurationMs("5s"), 5000);
	t.is(cache.getDurationMs("0m"), 0);
	t.is(cache.getDurationMs("7m"), 60 * 7000);
	t.is(cache.getDurationMs("9h"), 60 * 60 * 9000);
	t.is(cache.getDurationMs("0h"), 0);
	t.is(cache.getDurationMs("11d"), 24 * 60 * 60 * 11000);
	t.is(cache.getDurationMs("0d"), 0);
	t.is(cache.getDurationMs("13w"), 7 * 24 * 60 * 60 * 13000);
	t.is(cache.getDurationMs("0w"), 0);
	t.is(cache.getDurationMs("15y"), 365 * 24 * 60 * 60 * 15000);
	t.is(cache.getDurationMs("0y"), 0);
});

test("Local hash file names", async (t) => {
	let pngUrl = "https://www.zachleat.com/img/avatar-2017-big.png";
	t.is(
		new RemoteAssetCache(pngUrl).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(pngUrl)}`),
	);

	let fontUrl = "https://www.zachleat.com/font.woff";
	t.is(
		new RemoteAssetCache(fontUrl).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(fontUrl)}`),
	);

	let fontUrl2 = "https://www.zachleat.com/font.woff2";
	t.is(
		new RemoteAssetCache(fontUrl2).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(fontUrl2)}`),
	);
});

test("Clean url", async (t) => {
	let shortUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	t.is(
		new RemoteAssetCache(longUrl, ".cache", {
			removeUrlQueryParams: true,
		}).displayUrl,
		shortUrl,
	);
});

test("Local hash without file extension in URL", async (t) => {
	let noExt = "https://twitter.com/zachleat/profile_image?size=bigger";
	t.is(
		new RemoteAssetCache(noExt).cachePath,
		path.resolve(".", `.cache/eleventy-fetch-${AssetCache.getHash(noExt)}`),
	);
});

test("Unique hashes for URLs", async (t) => {
	let apiURL1 = "https://api.zooniverse.org/projects/illustratedlife/talk/subjects/ASC0000qu3";
	let apiURL2 = "https://api.zooniverse.org/projects/illustratedlife/talk/subjects/ASC0000q71";
	let cachePath1 = new RemoteAssetCache(apiURL1).cachePath;
	let cachePath2 = new RemoteAssetCache(apiURL2).cachePath;
	t.not(cachePath1, cachePath2);
});

test("Same hashes for implicit and explicit HTTP GET", async (t) => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "GET" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: {},
	}).cachePath;
	t.is(cachePath1, cachePath2);
});

test("Unique hashes for different HTTP methods", async (t) => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "POST" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { method: "DELETE" },
	}).cachePath;
	t.not(cachePath1, cachePath2);
});

test("Unique hashes for different HTTP bodies", async (t) => {
	let sameURL = "https://example.com/";
	let cachePath1 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { body: "123" },
	}).cachePath;
	let cachePath2 = new RemoteAssetCache(sameURL, ".cache", {
		fetchOptions: { body: "456" },
	}).cachePath;
	t.not(cachePath1, cachePath2);
});

test("Fetching!", async (t) => {
	let pngUrl = "https://www.11ty.dev/img/possum.png";
	let ac = new RemoteAssetCache(pngUrl);
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	t.is(ac.fetchCount, 1);
	t.is(Buffer.isBuffer(buffer), true);
});

test("Fetching (dry run)!", async (t) => {
	let svgUrl = "https://www.11ty.dev/img/possum.png";
	let ac = new RemoteAssetCache(svgUrl, ".cache", {
		dryRun: true,
	});
	let buffer = await ac.fetch();
	t.is(Buffer.isBuffer(buffer), true);
	t.is(ac.fetchCount, 1);
	t.false(ac.hasAnyCacheFiles());
});

test("Fetching pass in URL", async (t) => {
	let pngUrl = new URL("https://www.11ty.dev/img/possum.png");
	let ac = new RemoteAssetCache(pngUrl);
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	t.is(Buffer.isBuffer(buffer), true);
});

test("Fetching pass non-stringable", async (t) => {
	let e = await t.throwsAsync(async () => {
		class B {}
		let source = new B();

		let ac = new RemoteAssetCache(source, undefined, {
			dryRun: true,
		});
		await ac.fetch();
	});

	t.is(e.message, "Invalid source: must be a string, function, or Promise. If a function or Promise, you must provide a `toString()` method or an `options.requestId` unique key. Received: [object Object]");
});

test("Fetching pass class with toString()", async (t) => {
	class B {
		toString() {
			return "https://www.11ty.dev/img/possum.png";
		}
	}

	let ac = new RemoteAssetCache(new B());
	let buffer = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	t.is(Buffer.isBuffer(buffer), true);
});

test("formatUrlForDisplay (manual query param removal)", async (t) => {
	let finalUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	t.is(
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

test("formatUrlForDisplay (using removeUrlQueryParams)", async (t) => {
	let finalUrl = "https://example.com/207115/photos/243-0-1.jpg";
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	t.is(
		new RemoteAssetCache(longUrl, ".cache", {
			removeUrlQueryParams: true,
			formatUrlForDisplay(url) {
				return url;
			},
		}).displayUrl,
		finalUrl,
	);
});

test("formatUrlForDisplay (using removeUrlQueryParams and requestId)", async (t) => {
	let longUrl =
		"https://example.com/207115/photos/243-0-1.jpg?Policy=FAKE_THING~2123ksjhd&Signature=FAKE_THING~2123ksjhd&Key-Pair-Id=FAKE_THING~2123ksjhd";
	t.is(
		new RemoteAssetCache(function() {}, ".cache", {
			requestId: longUrl,
			removeUrlQueryParams: true,
			formatUrlForDisplay(url) {
				return url;
			},
		}).displayUrl,
		"function() {}",
	);
});

test("Issue #6, URLs with HTTP Auth", async (t) => {
	let url = "https://${USERNAME}:${PASSWORD}@api.pinboard.in/v1/posts/all?format=json&tag=read";
	t.true(Util.isFullUrl(url));
});

test("Error with `cause`", async (t) => {
	let finalUrl = "https://www.11ty.dev/img/possum-asldkfjaklsdf.png";
	let asset = new RemoteAssetCache(finalUrl);

	try {
		await asset.fetch();
	} catch (e) {
		// Node 26 changed the error messaging here
		t.truthy(
			e.message.startsWith(`Bad response for https://www.11ty.dev/img/possum-asldkfjaklsdf.png (404):`),
		);
		t.truthy(e.cause);
	} finally {
		await asset.destroy();
	}
});

test("supports promises that resolve", async (t) => {
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

	t.deepEqual(actual, expected);

});

test("supports promises that reject", async (t) => {
	let expected = "mock error message";
	let cause = new Error("mock cause");
	let promise = Promise.reject(new Error(expected, { cause }));

	let asset = new RemoteAssetCache(promise, undefined, {
		requestId: "reject-promise",
	});

	try {
		await asset.fetch();
	} catch (e) {
		t.is(e.message, expected);
		t.is(e.cause, cause);
	} finally {
		try {
			await asset.destroy();
		} catch (e) {}
	}
});

test("supports async functions that return data", async (t) => {
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

	t.deepEqual(actual, expected);

});

test("supports async functions that throw", async (t) => {
	let expected = "mock error message";
	let cause = new Error("mock cause");
	let asyncFunction = async () => {
		throw new Error(expected, { cause });
	};

	try {
		let ac = new RemoteAssetCache(asyncFunction, undefined, {
			requestId: "async-throws",
		});
		await ac.fetch();
	} catch (e) {
		t.is(e.message, expected);
		t.is(e.cause, cause);
	} finally {
		try {
			await asset.destroy();
		} catch (e) {}
	}


});

test("type: xml", async (t) => {
	let feedUrl = "https://www.11ty.dev/blog/feed.xml";
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "xml"
	});
	let xml = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	t.true(xml.length > 50)
});

test("type: parsed-xml", async (t) => {
	let feedUrl = "https://www.11ty.dev/blog/feed.xml";
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "parsed-xml"
	});
	let xml = await ac.fetch();
	try {
		await ac.destroy();
	} catch (e) {}

	t.is(xml.children.length, 1)
});

test("returnType: response, cache miss", async (t) => {
	let feedUrl = "https://www.11ty.dev/blog/feed.xml";
	let ac = new RemoteAssetCache(feedUrl, ".cache", {
		type: "xml",
		returnType: "response",
	});
	let response = await ac.fetch();

	try {
		await ac.destroy();
	} catch (e) {}

	t.is(ac.fetchCount, 1);
	t.is(response.url, feedUrl);
	t.is(response.status, 200);
	t.truthy(response.headers.server);
	t.truthy(response.headers['last-modified']);
	t.truthy(response.body);
	t.is(response.cache, "miss");
});


test("returnType: response, cache hit", async (t) => {
	let feedUrl = "https://www.11ty.dev/blog/feed.xml";
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

	t.is(response.cache, "hit");
});

