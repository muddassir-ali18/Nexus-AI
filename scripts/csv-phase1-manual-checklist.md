# CSV Phase 1 manual verification

Run with `npm run dev` and/or `curl -F file=@... http://localhost:3000/api/analyze-csv`.

1. **Valid multi-month sample** — `public/samples/nexus-synthetic-sales-demo.csv` returns gross, net, adjustments, product rankings without negative adjustment products.
2. **Blank order_id** — CSV with `order_id` column and one blank row shows excluded AOV count/revenue warning.
3. **Repeated order_id** — Multiple rows for one order produce one AOV order count.
4. **Negative revenue** — Adjustment row reduces net revenue but is excluded from product ranking.
5. **Zero prior month** — January net 0 and February net > 0 yields no percentage MoM.
6. **Single month** — MoM null and limitation note present.
7. **Malformed CSV** — Returns safe 400 error JSON.
8. **Empty CSV** — Returns safe 400 error JSON.
9. **Nemotron failure** — Unset `NEBIUS_API_KEY` locally; metrics/evidence still returned with `interpretationError`.
10. **Calculator regression** — `POST /api/investigate` with `Calculate 450 * 0.10` still returns calculator evidence.

Automated core checks:

```bash
npx tsx --test src/lib/data/csv-analyzer-core.node.test.ts
```
