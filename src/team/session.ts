// An epoch and AbortController protect all asynchronous commits, including transports ignoring abort.
export class TeamSession {
  private epoch = 0;
  private controller = new AbortController();
  switch() {
    this.controller.abort();
    this.controller = new AbortController();
    const epoch = ++this.epoch;
    return {
      signal: this.controller.signal,
      current: () => epoch === this.epoch && !this.controller.signal.aborted,
    };
  }
  clear() {
    this.controller.abort();
    this.epoch++;
  }
}
