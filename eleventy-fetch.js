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
	let sourceKey = RemoteAssetCache.getRequestId(source, options);
	if(!sourceKey) {
		return Promise.reject(Sources.getInvalidSourceError(source));
	}

	if(instCache[sourceKey]) {
		return instCache[sourceKey];
	}

	let inst = new RemoteAssetCache(source, options.directory, options);
	inst.setQueue(queue);
	inst.setDirectoryManager(directoryManager);

	instCache[sourceKey] = inst;

	return inst;
}

export default function EleventyFetch(source, options) {
	let instance = createRemoteAssetCache(source, options);
	return instance.queue();
}

Object.defineProperty(EleventyFetch, "concurrency", {
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

const Util = {
	isFullUrl: Sources.isFullUrl,
};

// Properties on the default export are kept for backwards compat.
Object.assign(EleventyFetch, {
	Fetch: createRemoteAssetCache,
	queue: deprecatedQueue,
	Util,
	RemoteAssetCache,
	AssetCache,
	Sources,
});

export {
	createRemoteAssetCache as Fetch,
	deprecatedQueue as queue,
	Util,
	RemoteAssetCache,
	AssetCache,
	Sources,
	// `require()` returns the default export.
	EleventyFetch as "module.exports",
};
