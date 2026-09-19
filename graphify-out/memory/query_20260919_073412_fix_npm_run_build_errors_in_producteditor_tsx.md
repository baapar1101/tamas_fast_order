---
type: "query"
date: "2026-09-19T07:34:12.176968+00:00"
question: "Fix npm run build errors in ProductEditor.tsx"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ProductEditor.tsx", "ImagePicker.tsx", "Props"]
---

# Q: Fix npm run build errors in ProductEditor.tsx

## Answer

Expanded via graph vocabulary: [product, editor, image, picker, props, select, attribute]. ProductEditor passed obsolete url/onSelect props to ImagePicker, whose actual Props require label/value/onChange. Updated both image picker usages. Replaced cp[idx].key/value mutation with cp[idx] = {...attr, key/value} to satisfy noUncheckedIndexedAccess. Full npm run build succeeded.

## Outcome

- Signal: useful

## Source Nodes

- ProductEditor.tsx
- ImagePicker.tsx
- Props