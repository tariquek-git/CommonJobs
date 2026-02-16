import { FastifyReply } from 'fastify';

export const badRequest = (reply: FastifyReply, message: string) => {
  return reply.status(400).send({ error: message });
};

export const unauthorized = (reply: FastifyReply, message = 'Unauthorized') => {
  return reply.status(401).send({ error: message });
};

export const forbidden = (reply: FastifyReply, message = 'Forbidden') => {
  return reply.status(403).send({ error: message });
};

export const notFound = (reply: FastifyReply, message = 'Not found') => {
  return reply.status(404).send({ error: message });
};

export const tooManyRequests = (reply: FastifyReply, retryAfterSec: number) => {
  return reply
    .status(429)
    .header('Retry-After', String(retryAfterSec))
    .send({ error: 'Too many requests' });
};
