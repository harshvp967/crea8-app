// Railway sets RAILWAY_ENVIRONMENT on every deployed service, including when
// NODE_ENV was left unset. Local dev and unit tests have neither.
export const isProductionRuntime = () =>
  process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
