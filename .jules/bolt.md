
## 2025-01-20 - Precompile RegExp in SMS Templates

**What**: Precompiled the dynamically generated regular expressions for SMS template substitution (`SAMPLE_VARS`) outside of the request handler loop.
**Why**: Inside `apps/api/src/routes/admin/sms.ts`, the `test` route instantiated a new `RegExp` object inside a `for` loop for every key in `SAMPLE_VARS` during every request. Compiling regexes is CPU-intensive. Moving it to the module level ensures they are compiled exactly once.
**Impact**: Improves the execution speed of the variable substitution logic.
**Measurement**: Benchmarks showed an improvement from ~296ms to ~116ms (for 100,000 operations), roughly a 60% reduction in execution time for this specific block of code.
