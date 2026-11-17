/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-engine/src/process/default.rs
 */

import { EventType } from './events.js';

export class Processor {
  /** @param {Array<{name: string, next: Function}>} middleware */
  constructor(middleware) {
    this.middleware = middleware;
    this.eventQueue = []; // front = index 0
    this.trace = null; // optional (stage, middlewareName, event) => void
  }

  /**
   * Run an event through the middleware chain. Events dispatched by middlewares
   * are processed afterwards, in order.
   * @returns {Promise<object[]>} the processed events, in order
   */
  async process(event) {
    this.eventQueue.unshift(event);
    const processed = [];
    while (this.eventQueue.length > 0) {
      processed.push(await this.processOne());
    }
    return processed;
  }

  async processOne() {
    let current = this.eventQueue.pop();
    const dispatched = [];
    const dispatch = (e) => dispatched.unshift(e);

    for (const middleware of this.middleware) {
      this.trace?.('in', middleware.name, current);
      current = await middleware.next(current, dispatch);
      this.trace?.('out', middleware.name, current);
      if (current.type === EventType.NOOP) break;
    }

    while (dispatched.length > 0) this.eventQueue.unshift(dispatched.pop());
    return current;
  }
}
