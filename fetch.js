import PQueue from "p-queue";
import debugUtil from "debug";
const debug = debugUtil("Eleventy:Fetch");

import Sources from "./src/Sources.js";
import RemoteAssetCache from "./src/RemoteAssetCache.js";
import AssetCache from "./src/AssetCache.js";
import DirectoryManager from "./src/DirectoryManager.js";

const globalOptions = {
	type: "buffer",
	directory: ".cache",
	concurrency: 10,
	fetchOptions: {},
	timeout: "60s", // milliseconds or a duration string, falsy to disable
	dryRun: false, // don’t write anything to the file system

	// *does* affect cache key hash
	removeUrlQueryParams: false,

	// runs after removeUrlQueryParams, does not affect cache key hash
	// formatUrlForDisplay: function(url) {
	// 	return url;
	// },

	verbose: false, // Changed in 3.0+

	hashLength: 30,
};

/* Queue */
let queue = new PQueue({
	concurrency: globalOptions.concurrency,
});

queue.addEventListener("active", () => {
	debug(`Concurrency: ${queue.concurrency}, Size: ${queue.size}, Pending: ${queue.pending}`);
});

let instCache = {};

let directoryManager = new DirectoryManager();

function createRemoteAssetCache(source, rawOptions = {}) {
	if (!Sources.isFullUrl(source) && !Sources.isValidSource(source)) {
		return Promise.reject(new Error("Invalid source. Received: " + source));
	}

	let options = Object.assign({}, globalOptions, rawOptions);
	// Function and Promise sources infer `type` from the returned value (#67)
	if (!rawOptions?.type && (typeof source === "function" || typeof source?.then === "function")) {
		delete options.type;
	}
	let sourceKey = RemoteAssetCache.getRequestId(source, options);
	if (!sourceKey) {
		return Promise.reject(Sources.getInvalidSourceError(source));
	}

	if (instCache[sourceKey]) {
		return instCache[sourceKey];
	}

	let inst = new RemoteAssetCache(source, options.directory, options);
	inst.setQueue(queue);
	inst.setDirectoryManager(directoryManager);

	instCache[sourceKey] = inst;

	return inst;
}

export default function Fetch(source, options) {
	let instance = createRemoteAssetCache(source, options);
	return instance.queue();
}

Object.defineProperty(Fetch, "concurrency", {
	get: function () {
		return queue.concurrency;
	},
	set: function (concurrency) {
		queue.concurrency = concurrency;
	},
});

// Deprecated API kept for backwards compat, instead: use default export directly.
// Intentional: queueCallback is ignored here
function deprecatedQueue(source, queueCallback, options) {
	let instance = createRemoteAssetCache(source, options);
	return instance.queue();
}

// Removed name for `createFetch`, which returns a RemoteAssetCache instance (not the fetched data).
function removedFetch() {
	throw new Error(
		"To avoid confusion, the named `Fetch` export from @11ty/eleventy-fetch has been renamed to `createFetch`. You almost certainly want to use the default export!",
	);
}

const Util = {
	isFullUrl: Sources.isFullUrl,
};

// Properties on the default export are kept for backwards compat.
Object.assign(Fetch, {
	createFetch: createRemoteAssetCache,
	Fetch: removedFetch,
	queue: deprecatedQueue,
	Util,
	RemoteAssetCache,
	AssetCache,
	Sources,
});

export {
	createRemoteAssetCache as createFetch,
	removedFetch as Fetch,
	deprecatedQueue as queue,
	Util,
	RemoteAssetCache,
	AssetCache,
	Sources,
	// `require()` returns the default export.
	Fetch as "module.exports",
};
