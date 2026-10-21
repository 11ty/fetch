import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import AssetCache from "../src/AssetCache.js";

function normalizePath(pathStr) {
	if (typeof pathStr !== "string") {
		return pathStr;
	}

	if (pathStr.match(/^[A-Z]\:/)) {
		pathStr = pathStr.substr(2);
	}
	return pathStr.split(path.sep).join("/");
}

test("Absolute path cache directory", () => {
	let cache = new AssetCache("lksdjflkjsdf", "/tmp/.cache");
	let cachePath = normalizePath(cache.cachePath);

	assert.equal(cachePath, "/tmp/.cache/eleventy-fetch-73015bafd152bccf9929e0f4dcbe36");
});

test("Relative path cache directory", () => {
	let cache = new AssetCache("lksdjflkjsdf", ".cache");
	let cachePath = normalizePath(cache.cachePath);

	assert.notEqual(cachePath, ".cache/eleventy-fetch-73015bafd152bccf9929e0f4dcbe36");
	assert.equal(cachePath.endsWith(".cache/eleventy-fetch-73015bafd152bccf9929e0f4dcbe36"), true);
});

test("AWS Lambda root directory resolves correctly", () => {
	let cwd = normalizePath(process.cwd());
	process.env.ELEVENTY_ROOT = cwd;
	process.env.LAMBDA_TASK_ROOT = "/var/task/z/";
	let cache = new AssetCache("lksdjflkjsdf", ".cache");
	let cachePath = normalizePath(cache.cachePath);

	assert.equal(cachePath, `${cwd}/.cache/eleventy-fetch-73015bafd152bccf9929e0f4dcbe36`);
	(delete "ELEVENTY_ROOT") in process.env;
	(delete "LAMBDA_TASK_ROOT") in process.env;
});

test("Test a save", async () => {
	let asset = new AssetCache("zachleat_twitter_followers", ".customcache");
	let cachePath = normalizePath(asset.cachePath);

	await asset.save({ followers: 10 }, "json");

	assert.ok(fs.existsSync(cachePath));

	fs.unlinkSync(cachePath);
});

test("Cache path should handle slashes without creating directories, issue #14", () => {
	let cache = new AssetCache("lksdjflk/jsdf", "/tmp/.cache");
	let cachePath = normalizePath(cache.cachePath);

	assert.equal(cachePath, "/tmp/.cache/eleventy-fetch-135797dbf5ab1187e5003c49162602");
});

test("Uses `requestId` property when caching a promise", async () => {
	let asset = new AssetCache(Promise.resolve(), ".customcache", {
		requestId: "mock-display-url-2",
	});

	await asset.save({ name: "Sophia Smith" }, "json");

	await asset.destroy();

	assert.ok(!asset.hasAnyCacheFiles());
});

test("Uses `requestId` property when caching a function", async () => {
	let asset = new AssetCache(function () {}, ".cache", {
		requestId: "mock-function",
	});
	await asset.save({ name: "Sophia Smith" }, "json");

	await asset.destroy();

	assert.ok(!asset.hasAnyCacheFiles());
});

test("Uses `requestId` property when caching an async function", async () => {
	let asset = new AssetCache(async function () {}, ".cache", {
		requestId: "mock-async-function",
	});

	await asset.save({ name: "Sophia Smith" }, "json");

	await asset.destroy();

	assert.ok(!asset.hasAnyCacheFiles());
});

test("Uses filenameFormat", async () => {
	let asset = new AssetCache("some-thing", undefined, {
		filenameFormat() {
			// don’t include the file extension
			return "testing";
		},
	});

	let cachePath = normalizePath(asset.cachePath);

	assert.ok(cachePath.endsWith("/.cache/testing"));

	await asset.save({ name: "Sophia Smith" }, "json");

	assert.ok(fs.existsSync(cachePath));

	await asset.destroy();

	assert.ok(!asset.hasAnyCacheFiles());
});

test("v5 flatted cache file", async () => {
	let asset = new AssetCache("some-thing", "test", {
		filenameFormat() {
			// don’t include the file extension
			return "v5flattedcachefile";
		},
	});

	let cachePath = normalizePath(asset.cachePath);
	assert.ok(cachePath.endsWith("test/v5flattedcachefile"));
	assert.ok(asset.cachedObject.cachedAt);
	assert.ok(asset.cachedObject.metadata);
	assert.equal(asset.cachedObject.type, "json");
	assert.deepEqual(asset.getCachedValue(), undefined);
	assert.deepEqual(asset.getCachedContents(), undefined);
});

test("Empty json contents file doesn’t throw, issue #102", async () => {
	let asset = new AssetCache("truncated-json");
	await asset.save({ name: "Sophia Smith" }, "json");

	fs.writeFileSync(asset.cache.contentsPath, "");

	let reloaded = new AssetCache("truncated-json");
	assert.equal(reloaded.getCachedValue(), undefined);

	await asset.destroy();
});
