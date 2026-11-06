import type { Express } from 'express';
import type { RouteDeps } from './http/routeTypes';
import { registerAuthRoutes } from './modules/auth.routes';
import { registerUsersRoutes } from './modules/users.routes';
import { registerOrdersRoutes } from './modules/orders.routes';
import { registerEarningsRoutes } from './modules/earnings.routes';
import { registerPublicTrackingRoutes } from './modules/publicTracking.routes';
import { registerPlacesRoutes } from './modules/places.routes';
import { registerCitiesRoutes } from './modules/cities.routes';
import { registerSettingsRoutes } from './modules/settings.routes';
import { registerCompaniesRoutes } from './modules/companies.routes';
import { registerPricingRoutes } from './modules/pricing.routes';
import { registerDriversRoutes } from './modules/drivers.routes';
import { registerMarkersRoutes } from './modules/markers.routes';
import { registerFinancialRoutes } from './modules/financial.routes';

export type { RouteDeps } from './http/routeTypes';
export { parseRawJsonBody } from './http/parseRawJsonBody';

export function registerApiRoutes(app: Express, deps: RouteDeps) {
  registerAuthRoutes(app);
  registerUsersRoutes(app, deps);
  registerOrdersRoutes(app, deps);
  registerEarningsRoutes(app);
  registerPublicTrackingRoutes(app);
  registerPlacesRoutes(app);
  registerCitiesRoutes(app);
  registerSettingsRoutes(app);
  registerCompaniesRoutes(app);
  registerPricingRoutes(app);
  registerDriversRoutes(app);
  registerMarkersRoutes(app);
  registerFinancialRoutes(app);
}
