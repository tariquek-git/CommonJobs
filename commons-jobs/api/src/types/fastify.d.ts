import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    isAdmin?: boolean;
  }
}
