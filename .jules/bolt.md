## 2025-02-18 - Optimize SMS Templating Engine

- **Context:** The `sendTemplatedSms` function handles SMS messages by substituting predefined variables using search and replace.
- **Problem:** The original implementation looped over each variable key and instantiated a new `RegExp` object dynamically for each replacement. Compiling regular expressions repeatedly in a loop is highly inefficient. It also opened the door to bugs where earlier replacements could insert text that matched the keys of later variables.
- **Solution:** Replaced the loop with a single static global regex (`/\{([^}]+)\}/g`) that scans the template once. A replacer function takes each matched placeholder and substitutes the appropriate value from the variables object by looking it up using `Object.hasOwn(variables, key)`.
- **Result:** Benchmark metrics showed a ~30% improvement in template compilation time, going from ~263ms to ~185ms for 100,000 iterations.
