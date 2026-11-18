# Graph performance

## Reproduce the baseline

Run `npm ci` and `npm exec --offline -- vite-node scripts/benchmark-graph.ts` from the repository root. The harness uses the application’s normalized synthetic fixtures, projection, dependency analysis, ELK options and node dimensions. It verifies each layout produced every requested node, edge and route. No Linear credentials or network calls are involved.

This run used Linux x86-64, Intel Xeon Platinum 8573C, Node 24.22.1 and elkjs 0.11.1. The runner is shared. Each row uses one warm-up followed by five timed layouts with fresh input using the same bundled ELK instance. Rows run smallest to largest. Each projection/impact sample averages 50 calls. End-to-end comparisons across different devices or versions require a fresh baseline on the same hardware.

## Synthetic measurements

Times are milliseconds. The relationship count excludes project/milestone membership. ELK receives only the Blocks column in dependency view. One-hop focus uses the middle issue with both directions enabled.

| Issues / task relations | Blocks | Dependency projection median | Selected issue impact median | Full ELK median (min–max) | Focus nodes / edges | Focus ELK median |
|---|---:|---:|---:|---:|---:|---:|
| 20 / 100 | 19 | 0.082 | 0.323 | 82.7 (76.2–117.2) | 3 / 2 | 17.3 |
| 50 / 200 | 49 | 0.297 | 0.282 | 66.5 (43.2–94.9) | 3 / 2 | 9.6 |
| 100 / 500 | 300 | 0.313 | 1.878 | 1,194.9 (1,138.2–1,809.1) | 7 / 15 | 15.4 |
| 200 / 800 | 600 | 0.191 | 2.206 | 3,780.9 (3,745.1–4,520.0) | 7 / 15 | 11.7 |

The 200-issue fixture spans four populated projects and sixteen milestones, plus an empty project. Dependencies include fan-in, fan-out and cross-project edges. Real data with cycles, longer titles, more reviewers, or a different degree distribution can behave differently.

## Interrupted layout experiment

Run `npm exec --offline -- vite-node scripts/benchmark-cancellation.ts`. A Node worker begins the 200-issue full layout. As soon as that worker reports starting the job, the driver requests the middle issue’s seven-node focus view. The baseline queues focus behind the old layout. The alternative terminates the busy worker and starts the focus layout on a new worker, including replacement startup time. Each strategy gets a fresh isolate for every run; their execution order alternates. Each run uses identical graph inputs and ELK settings.

| Request to focus result | Five samples (ms) | Median (ms) |
|---|---|---:|
| Queue behind the obsolete request | 5,283; 4,744; 4,076; 3,744; 3,693 | 4,076 |
| Terminate and replace the busy worker | 760; 339; 381; 495; 437 | 437 |

The canvas now cancels obsolete in-flight work and reuses an idle worker after successful layout. This comparison exercises the two scheduling strategies with real ELK in Node worker threads. Browser worker startup and React rendering still contribute additional costs. No timing threshold is enforced in CI.

## Interpretation and remaining measurements

Full-graph routing dominates this sample once hundreds of dependency edges participate. Smaller focus neighborhoods retain direct blockers and downstream tasks while making a much smaller layout request. The full and focus columns compare two available views of the same data. They cannot establish a before/after release speedup. The smaller 50-node run being faster than the 20-node run also illustrates why a single shared-runner timing should not be a release threshold.

These measurements exclude browser worker initialization and messaging, React reconciliation, DOM/SVG painting, OAuth, and GraphQL synchronization. The 10,000-node analysis unit test checks algorithm correctness and stack safety. Browser initial render, input-to-paint search/filter latency, touch/pan frame times, browser memory and authenticated Team switching require separate measurements. Until collected, those metrics and cross-version end-to-end performance gains remain unverified. The reproducible 200/800 case provides a baseline for subsequent fixed-device browser comparisons.

## Browser measurement

GitHub CI run 19 used Ubuntu and production Chromium with one sequential sample per fixture. From fixture-button activation through settled layout, a visible React Flow node and two animation frames, the 20/50/100/200-issue fixtures took **359 / 179 / 1,398 / 2,932 ms**. This includes automation polling and worker startup or reuse. These observations support prioritizing focus on dense teams. They do not measure browser launch, pan FPS or an improvement across release versions.
