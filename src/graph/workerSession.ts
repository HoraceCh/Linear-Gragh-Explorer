import type { ElkNode } from "elkjs/lib/elk-api";

type LayoutWorker = {
  layout(input: ElkNode): Promise<ElkNode>;
  terminateWorker(): void;
};

/** One canvas owns its worker. An obsolete in-flight job must not delay its replacement. */
export class LayoutWorkerSession {
  private worker?: LayoutWorker;
  constructor(private readonly create: () => LayoutWorker) {}

  async run(input: ElkNode, signal: AbortSignal): Promise<ElkNode> {
    signal.throwIfAborted();
    const worker = this.worker ??= this.create();
    let abort!: () => void;
    const canceled = new Promise<never>((_, reject) => {
      abort = () => {
        if (this.worker === worker) this.dispose();
        reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
    });
    try {
      return await Promise.race([worker.layout(input), canceled]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  dispose() {
    this.worker?.terminateWorker();
    this.worker = undefined;
  }
}
