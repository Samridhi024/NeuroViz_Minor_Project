# k6 Load Test

Run the included k6 script to smoke-test the health endpoint locally or against a staging URL.

Install k6: https://k6.io/docs/getting-started/installation/

Run locally:

```bash
k6 run test/load/k6_script.js
```

In CI you can run k6 in a container:

```bash
docker run --rm -i loadimpact/k6 run - < test/load/k6_script.js
```