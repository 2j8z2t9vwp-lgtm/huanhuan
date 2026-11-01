// The upstream CLI's import.meta.url entry guard is not Windows-safe.
// Call its exported host directly without changing upstream source.
import {resolve,join} from 'node:path';
import {startReviewHost} from '../vendor/integrations/promo-workflow-mcp/packages/promo-mcp/dist/review-host.js';
import {ProjectRegistry} from '../vendor/integrations/promo-workflow-mcp/packages/promo-mcp/dist/project-registry.js';
const dataDirectory=resolve(process.env.PROMO_WORKFLOW_DATA_DIR);
const registry=new ProjectRegistry(process.env.PROMO_PROJECT_REGISTRY||join(dataDirectory,'projects-registry.json'),dataDirectory);
await registry.discoverCurrent();
await registry.scan();
await startReviewHost({dataDirectory,host:'127.0.0.1',port:Number(process.env.PROMO_REVIEW_PORT),registry});
console.log('Promo Review Desk ready');
