import fs from "node:fs";
// const debug = require("debug")("Eleventy:Assets");

export default class ExistsCache {
	#checks = new Map();
	#count = 0;

	set(target, value) {
		this.#checks.set(target, Boolean(value));
	}

	exists(target) {
		if(this.#checks.has(target)) {
			return this.#checks.get(target);
		}

		let exists = fs.existsSync(target);
		this.#count++;
		this.#checks.set(target, exists);
		return exists;
	}
}
