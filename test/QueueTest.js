import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Cache, { queue, createFetch } from "../fetch.js";
import { fakeUrl, installFakeFetch } from "./helpers/FakeFetch.js";

installFakeFetch();

test("Queue without options", async () => {
	let example = fakeUrl("/queue/");
	let req = await queue(example, () => {
		let asset = new RemoteAssetCache(example);
		return asset.fetch();
	});

	assert.ok(Buffer.isBuffer(req));

	try {
		await req.destroy();
	} catch (e) {}
});

test("Double Fetch", async () => {
	let pngUrl = fakeUrl("/queue/possum.png");
	let ac1 = Cache(pngUrl);
	let ac2 = Cache(pngUrl);

	// Make sure we only fetch once!
	assert.equal(ac1, ac2);

	await ac1;
	await ac2;

	let forDestroyOnly = createFetch(pngUrl);
	// file is now accessible
	try {
		await forDestroyOnly.destroy();
	} catch (e) {}
});

test("Double Fetch (dry run)", async () => {
	let pngUrl = fakeUrl("/queue/dry-run/possum.png");
	let ac1 = Cache(pngUrl, { dryRun: true });
	let ac2 = Cache(pngUrl, { dryRun: true });

	// Make sure we only fetch once!
	assert.equal(ac1, ac2);

	await ac1;
	await ac2;

	let forTestOnly = createFetch(pngUrl, {
		cacheDirectory: ".cache",
		dryRun: true,
	});
	// file is now accessible
	assert.equal(forTestOnly.hasAnyCacheFiles(), false);
});

test("Double Fetch async function (dry run)", async () => {
	let expected = { mockKey: "mockValue" };

	async function fetch() {
		return Promise.resolve(expected);
	}

	let ac1 = Cache(fetch, {
		dryRun: true,
		requestId: "fetch-1",
	});
	let ac2 = Cache(fetch, {
		dryRun: true,
		requestId: "fetch-2",
	});

	// two distinct fetches
	assert.notEqual(ac1, ac2);

	let result1 = await ac1;
	let result2 = await ac2;

	assert.deepEqual(result1, result2);
	assert.deepEqual(result1, expected);
	assert.deepEqual(result2, expected);
});

test("Double Fetch 404 errors should only fetch once", async () => {
	let ac1 = Cache(fakeUrl("/queue/404"), {
		dryRun: true,
	});
	let ac2 = Cache(fakeUrl("/queue/404"), {
		dryRun: true,
	});

	// Make sure we only fetch once!
	assert.equal(ac1, ac2);

	await assert.rejects(async () => await ac1);
	await assert.rejects(async () => await ac2);
});

test("Docs example https://www.11ty.dev/docs/plugins/fetch/#manually-store-your-own-data-in-the-cache", async (t) => {
	t.plan(2);

	async function fn() {
		t.assert.ok(true);
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({ followerCount: 1000 });
			});
		});
	}

	let fakeFollowers = Cache(fn, {
		type: "json",
		dryRun: true,
		requestId: "zachleat_twitter_followers",
	});

	t.assert.deepStrictEqual(await fakeFollowers, {
		followerCount: 1000,
	});
});

test("Raw Fetch using queue method", async () => {
	let pngUrl = fakeUrl("/queue/possum.png?q=1");
	let ac1 = createFetch(pngUrl);
	let ac2 = createFetch(pngUrl);

	// Destroy to clear any existing cache
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}

	// Make sure the instance is the same
	assert.equal(ac1, ac2);

	let result1 = await ac1.queue();
	assert.equal(ac1.wasLastFetchCacheHit(), false);

	let result2 = await ac1.queue();
	// reuses the same fetch
	assert.equal(ac1.wasLastFetchCacheHit(), false);

	assert.equal(result1, result2);

	// file is now accessible
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}
});

test("Raw Fetch using fetch method", async () => {
	let pngUrl = fakeUrl("/queue/possum.png?q=2");
	let ac1 = createFetch(pngUrl);
	let ac2 = createFetch(pngUrl);

	// Destroy to clear any existing cache
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}

	// Make sure the instance is the same
	assert.equal(ac1, ac2);

	let result1 = await ac1.fetch();
	assert.equal(ac1.wasLastFetchCacheHit(), false);

	let result2 = await ac1.fetch();
	assert.equal(ac1.wasLastFetchCacheHit(), true);

	assert.equal(result1, result2);

	// file is now accessible
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}
});

test("Raw Fetch using fetch method (check parallel fetch promise reuse)", async () => {
	let pngUrl = fakeUrl("/queue/possum.png?q=3");
	let ac1 = createFetch(pngUrl);
	let ac2 = createFetch(pngUrl);

	// Destroy to clear any existing cache
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}

	// Make sure the instance is the same
	assert.equal(ac1, ac2);

	let [result1, result2] = await Promise.all([ac1.fetch(), ac1.fetch()]);

	assert.equal(result1, result2);

	assert.equal(ac1.wasLastFetchCacheHit(), false);

	// file is now accessible
	try {
		await ac1.destroy();
	} catch (e) {}
	try {
		await ac2.destroy();
	} catch (e) {}
});

test("Refetches data on transient failures", async () => {
	let firstFetch = true;
	let successData = "Good data";
	let failData = "Transient error";
	let ac1 = createFetch(
		() => {
			if (firstFetch) {
				firstFetch = false;
				throw new Error(failData);
			}
			return successData;
		},
		{ duration: "0s" },
	);

	await assert.rejects(async () => await ac1.queue());
	assert.equal(await ac1.queue(), successData);
});

test("Function source without a type infers json and writes to the cache (#67)", async () => {
	let calls = 0;
	let fn = async () => {
		calls++;
		return { foo: "bar" };
	};
	let options = { requestId: "infer-type-json", duration: "1h" };

	let ac = createFetch(fn, options);
	try {
		assert.deepEqual(await ac.queue(), { foo: "bar" });
		assert.equal(ac.cachedObject.type, "json");
		assert.equal(fs.readFileSync(ac.cache.contentsPath, "utf8"), `{"foo":"bar"}`);
		assert.deepEqual(await ac.fetch(), { foo: "bar" });
		assert.equal(calls, 1);
	} finally {
		try {
			await ac.destroy();
		} catch (e) {}
	}
});
